import logging

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.events.models import Event, Guest, RSVP
from apps.events.utils import upload_to_s3

from .models import CatalogItem, CatalogResponse, HostCatalog
from .notifications import send_catalog_response_notification
from .serializers import (
    CatalogItemSerializer,
    CatalogResponseCreateSerializer,
    CatalogResponseSerializer,
    HostCatalogSerializer,
    PublicCatalogItemSerializer,
)
from .throttles import CatalogSubmissionThrottle

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_event_for_host(event_id, user):
    """Return event if user is the host, else raise 403."""
    event = get_object_or_404(Event, id=event_id)
    if event.host != user:
        return None, Response(
            {'error': 'You do not have permission to manage this event.'},
            status=status.HTTP_403_FORBIDDEN,
        )
    return event, None


def _resolve_guest_from_token(token, event):
    """Return Guest or None for the given token on this event."""
    if not token:
        return None
    try:
        return Guest.objects.get(guest_token=token, event=event, is_removed=False)
    except Guest.DoesNotExist:
        return None


def _check_catalog_access(catalog, guest, event):
    """
    Check catalog_access_mode against the resolved guest's RSVP state.
    Returns (allowed: bool, error_message: str|None, code: str|None).
    """
    mode = catalog.catalog_access_mode

    if mode == 'same_as_event':
        return True, None, None

    if guest is None:
        return (
            False,
            'Please sign in or use your invite link to access this catalog.',
            'guest_required',
        )

    rsvps = RSVP.objects.filter(
        event=event,
        guest=guest,
        is_removed=False,
    )

    if mode == 'after_rsvp':
        if rsvps.exists():
            return True, None, None
        return (
            False,
            'Please complete your RSVP to access this catalog.',
            'rsvp_required',
        )

    if mode == 'confirmed_only':
        if rsvps.filter(will_attend='yes').exists():
            return True, None, None
        return (
            False,
            'This catalog is only available to confirmed attendees.',
            'confirmed_required',
        )

    return True, None, None


def _catalog_access_denied_response(error_msg, code):
    return Response(
        {'error': error_msg, 'code': code},
        status=status.HTTP_403_FORBIDDEN,
    )


def _check_event_access(event, guest_token):
    """
    Enforce event privacy. Returns (guest_or_none, error_response_or_none).
    Public events: always allowed, guest may be None.
    Private events: require a valid guest_token resolving to a Guest.
    """
    if event.is_public:
        guest = _resolve_guest_from_token(guest_token, event)
        return guest, None

    guest = _resolve_guest_from_token(guest_token, event)
    if guest is None:
        return None, Response(
            {'error': 'This is a private event. Use your invite link to access.'},
            status=status.HTTP_403_FORBIDDEN,
        )
    return guest, None


# ---------------------------------------------------------------------------
# Host views (IsAuthenticated + ownership)
# ---------------------------------------------------------------------------

class CatalogDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, event_id):
        event, err = _get_event_for_host(event_id, request.user)
        if err:
            return err
        catalog, _ = HostCatalog.objects.get_or_create(
            event=event,
            defaults={'is_enabled': event.has_registry},
        )
        return Response(HostCatalogSerializer(catalog).data)

    def patch(self, request, event_id):
        event, err = _get_event_for_host(event_id, request.user)
        if err:
            return err
        catalog, _ = HostCatalog.objects.get_or_create(
            event=event,
            defaults={'is_enabled': event.has_registry},
        )
        serializer = HostCatalogSerializer(catalog, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        # Keep Event.has_registry in sync
        if 'is_enabled' in request.data:
            event.has_registry = catalog.is_enabled
            event.save(update_fields=['has_registry'])

        return Response(serializer.data)


class CatalogItemListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, event_id):
        event, err = _get_event_for_host(event_id, request.user)
        if err:
            return err
        catalog = get_object_or_404(HostCatalog, event=event)
        items = CatalogItem.objects.filter(catalog=catalog)
        return Response(CatalogItemSerializer(items, many=True).data)

    def post(self, request, event_id):
        event, err = _get_event_for_host(event_id, request.user)
        if err:
            return err
        catalog, _ = HostCatalog.objects.get_or_create(
            event=event,
            defaults={'is_enabled': event.has_registry},
        )
        serializer = CatalogItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(catalog=catalog)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class CatalogItemDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_item(self, event_id, item_id, user):
        event, err = _get_event_for_host(event_id, user)
        if err:
            return None, None, err
        item = get_object_or_404(CatalogItem, id=item_id, catalog__event=event)
        return event, item, None

    def get(self, request, event_id, item_id):
        _, item, err = self._get_item(event_id, item_id, request.user)
        if err:
            return err
        return Response(CatalogItemSerializer(item).data)

    def patch(self, request, event_id, item_id):
        _, item, err = self._get_item(event_id, item_id, request.user)
        if err:
            return err
        serializer = CatalogItemSerializer(item, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, event_id, item_id):
        _, item, err = self._get_item(event_id, item_id, request.user)
        if err:
            return err
        item.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CatalogItemImageUploadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, event_id, item_id):
        event, err = _get_event_for_host(event_id, request.user)
        if err:
            return err
        item = get_object_or_404(CatalogItem, id=item_id, catalog__event=event)

        image = request.FILES.get('image')
        if not image:
            return Response({'error': 'No image provided.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            url = upload_to_s3(image, event_id=event_id, folder='catalog-items')
        except Exception as e:
            logger.error(f'Catalog image upload failed for item {item_id}: {e}')
            return Response({'error': 'Image upload failed.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        item.image_url = url
        item.save(update_fields=['image_url'])
        return Response({'image_url': url})


class CatalogResponseListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, event_id):
        event, err = _get_event_for_host(event_id, request.user)
        if err:
            return err
        responses = CatalogResponse.objects.filter(event=event).select_related('catalog_item')
        return Response(CatalogResponseSerializer(responses, many=True).data)


class CatalogResponseDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, event_id, response_id):
        event, err = _get_event_for_host(event_id, request.user)
        if err:
            return err
        response = get_object_or_404(CatalogResponse, id=response_id, event=event)
        new_status = request.data.get('status')
        valid_statuses = [s[0] for s in CatalogResponse.STATUS_CHOICES]
        if new_status not in valid_statuses:
            return Response(
                {'error': f'Invalid status. Choose from: {valid_statuses}'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        response.status = new_status
        response.save(update_fields=['status', 'updated_at'])
        return Response(CatalogResponseSerializer(response).data)


# ---------------------------------------------------------------------------
# Public views (AllowAny)
# ---------------------------------------------------------------------------

class PublicCatalogView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, slug):
        slug = slug.lower().strip()
        event = get_object_or_404(Event, slug=slug)

        guest_token = request.query_params.get('g', '').strip()
        guest, err = _check_event_access(event, guest_token)
        if err:
            return err

        try:
            catalog = event.host_catalog
        except HostCatalog.DoesNotExist:
            return Response({'error': 'Catalog not available.'}, status=status.HTTP_404_NOT_FOUND)

        if not catalog.is_enabled:
            return Response({'error': 'Catalog not available.'}, status=status.HTTP_404_NOT_FOUND)

        allowed, error_msg, code = _check_catalog_access(catalog, guest, event)
        if not allowed:
            return _catalog_access_denied_response(error_msg, code)

        items = CatalogItem.objects.filter(catalog=catalog, status='published')
        return Response({
            'catalog': HostCatalogSerializer(catalog).data,
            'items': PublicCatalogItemSerializer(items, many=True).data,
            'event': {
                'id': event.id,
                'title': event.title,
                'slug': event.slug,
                'is_public': event.is_public,
            },
        })


class CatalogRespondView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [CatalogSubmissionThrottle]

    def post(self, request, slug):
        slug = slug.lower().strip()
        event = get_object_or_404(Event, slug=slug)

        guest_token = request.query_params.get('g', '').strip()
        guest, err = _check_event_access(event, guest_token)
        if err:
            return err

        try:
            catalog = event.host_catalog
        except HostCatalog.DoesNotExist:
            return Response({'error': 'Catalog not available.'}, status=status.HTTP_404_NOT_FOUND)

        if not catalog.is_enabled:
            return Response({'error': 'Catalog not available.'}, status=status.HTTP_404_NOT_FOUND)

        allowed, error_msg, code = _check_catalog_access(catalog, guest, event)
        if not allowed:
            return _catalog_access_denied_response(error_msg, code)

        serializer = CatalogResponseCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Verify item belongs to this catalog
        item = get_object_or_404(
            CatalogItem,
            id=data['catalog_item_id'],
            catalog=catalog,
            status='published',
        )

        # Resolve identity
        name = data.get('name', '').strip()
        email = data.get('email', '').strip()
        phone = data.get('phone', '').strip()

        if guest:
            # Auto-populate from Guest record
            name = guest.name or name
            email = guest.email or email or ''
            phone = guest.phone or phone
            # Fallback: try linked RSVP for email
            if not email:
                rsvp = RSVP.objects.filter(
                    event=event, guest=guest, is_removed=False
                ).first()
                if rsvp and rsvp.email:
                    email = rsvp.email

        # Anonymous guests must provide name + email
        if not guest:
            if not name:
                return Response({'error': 'Name is required.'}, status=status.HTTP_400_BAD_REQUEST)
            if not email:
                return Response({'error': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # If identified guest still has no email after fallbacks, require it
        if not email:
            return Response({'error': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)

        response_obj = CatalogResponse.objects.create(
            catalog_item=item,
            event=event,
            guest=guest,
            name=name,
            email=email,
            phone=phone,
            response_type=data['response_type'],
            amount=data.get('amount'),
            message=data.get('message', ''),
            source=data.get('source', 'direct'),
        )

        send_catalog_response_notification(response_obj)

        return Response(
            {'message': 'Response recorded.', 'id': response_obj.id},
            status=status.HTTP_201_CREATED,
        )
