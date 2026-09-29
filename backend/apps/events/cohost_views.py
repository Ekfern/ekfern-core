"""
Co-host invitation, acceptance and removal.

Invites are by email only — the User model's ``USERNAME_FIELD`` is ``email`` and
there is no username to resolve against.

The invite link carries a signed row id rather than a stored token column, the
same pattern as ``membership.issue_pass``: expiry comes for free and there is
nothing extra to keep in sync. Revocation is handled by checking ``status`` at
acceptance, not by invalidating the signature.
"""
import logging

from django.core import signing
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.common.email_backend import send_email
from apps.users.models import User

from .access import get_event_or_404, resolve_event_access
from .capabilities import (
    DEFAULT_COHOST_CAPABILITIES,
    DEFAULT_COHOST_NOTIFICATIONS,
    MANAGE_COHOSTS,
    MAX_COHOSTS_PER_EVENT,
    normalize_capabilities,
    normalize_notifications,
)
from .models import Event, EventCoHost

logger = logging.getLogger(__name__)

INVITE_SALT = 'events.cohost.invite'
INVITE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60  # a week is plenty for an email link


def issue_invite_token(cohost: EventCoHost) -> str:
    return signing.TimestampSigner(salt=INVITE_SALT).sign(str(cohost.id))


def resolve_invite(token: str):
    """Return the EventCoHost a valid, unexpired token refers to, else None."""
    if not token:
        return None
    signer = signing.TimestampSigner(salt=INVITE_SALT)
    try:
        # SignatureExpired subclasses BadSignature, so this covers both.
        raw = signer.unsign(token, max_age=INVITE_MAX_AGE_SECONDS)
    except signing.BadSignature:
        return None
    try:
        cohost_id = int(raw)
    except (TypeError, ValueError):
        return None
    return EventCoHost.objects.select_related('event', 'event__host').filter(id=cohost_id).first()


def canonical_email(raw) -> str:
    """Strip, lowercase, validate. The canonical form used for every comparison."""
    value = (raw or '').strip().lower()
    if not value:
        raise DjangoValidationError('Email is required.')
    validate_email(value)
    return value


def serialize_cohost(cohost: EventCoHost) -> dict:
    """Owner-facing shape. A pending row has no name because it has no account."""
    return {
        'id': cohost.id,
        'email': cohost.invited_email,
        'name': cohost.user.name if cohost.user_id else None,
        'status': cohost.status,
        'capabilities': cohost.capabilities,
        'notifications': cohost.notifications,
        'accepted_at': cohost.accepted_at,
        'declined_at': cohost.declined_at,
        'left_at': cohost.left_at,
        'created_at': cohost.created_at,
    }


def _send_invite_email(cohost: EventCoHost, request) -> None:
    """Never lets a mail failure roll back an invite that was created correctly."""
    from django.conf import settings

    base = getattr(settings, 'FRONTEND_URL', '') or request.build_absolute_uri('/')[:-1]
    link = f"{base.rstrip('/')}/cohost-invite/{issue_invite_token(cohost)}"
    event = cohost.event
    inviter = event.host.name or event.host.email
    subject = f"{inviter} invited you to co-host {event.title}"
    body = (
        f"{inviter} has invited you to co-host \"{event.title}\" on Ekfern.\n\n"
        f"Co-hosts can help manage the event. You will need to accept the invite "
        f"before you get access:\n\n{link}\n\n"
        f"This link expires in 7 days. If you were not expecting this, you can ignore it."
    )
    try:
        send_email(cohost.invited_email, subject, body)
    except Exception as exc:
        logger.error(
            "[CoHost] invite email failed for cohost=%s event=%s: %s",
            cohost.id, event.id, exc, exc_info=True,
        )


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def event_cohosts(request, event_id):
    """List co-hosts, or invite one. Owner only — ``manage_cohosts`` is never granted."""
    event = get_event_or_404(request.user, event_id, MANAGE_COHOSTS)

    if request.method == 'GET':
        rows = EventCoHost.objects.filter(event=event).select_related('user')
        return Response({'results': [serialize_cohost(c) for c in rows]})

    try:
        email = canonical_email(request.data.get('email'))
    except DjangoValidationError:
        return Response({'error': 'Enter a valid email address.'}, status=status.HTTP_400_BAD_REQUEST)

    if email == (event.host.email or '').strip().lower():
        return Response(
            {'error': 'You are the host of this event.'}, status=status.HTTP_400_BAD_REQUEST
        )

    capabilities = request.data.get('capabilities')
    capabilities = (
        normalize_capabilities(capabilities)
        if capabilities is not None
        else list(DEFAULT_COHOST_CAPABILITIES)
    )

    # Explicit check so the caller gets a useful message. The partial unique
    # constraint stays as the backstop for two invites racing each other.
    if EventCoHost.objects.filter(
        event=event, invited_email=email, status__in=EventCoHost.ACTIVE_STATUSES
    ).exists():
        return Response(
            {'error': 'That person already has a pending or accepted invite for this event.'},
            status=status.HTTP_409_CONFLICT,
        )

    active = EventCoHost.objects.filter(
        event=event, status__in=EventCoHost.ACTIVE_STATUSES
    )
    if active.count() >= MAX_COHOSTS_PER_EVENT:
        return Response(
            {
                'error': (
                    f'An event can have up to {MAX_COHOSTS_PER_EVENT} co-hosts. '
                    'Remove someone, or cancel a pending invite, to add another.'
                )
            },
            status=status.HTTP_409_CONFLICT,
        )

    # Link an existing account straight away so the invite can also surface in
    # their dashboard. It still grants nothing until the status flips.
    try:
        existing_user = User.objects.get_by_email(email)
    except User.DoesNotExist:
        existing_user = None

    try:
        with transaction.atomic():
            cohost = EventCoHost(
                event=event,
                user=existing_user,
                invited_email=email,
                capabilities=capabilities,
                notifications=list(DEFAULT_COHOST_NOTIFICATIONS),
                status=EventCoHost.STATUS_PENDING,
            )
            cohost.full_clean(exclude=['accepted_at'])
            cohost.save()
    except DjangoValidationError as exc:
        return Response({'error': exc.message_dict}, status=status.HTTP_400_BAD_REQUEST)
    except IntegrityError:
        return Response(
            {'error': 'That person already has a pending or accepted invite for this event.'},
            status=status.HTTP_409_CONFLICT,
        )

    _send_invite_email(cohost, request)
    return Response(serialize_cohost(cohost), status=status.HTTP_201_CREATED)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def event_cohost_detail(request, event_id, cohost_id):
    """
    PATCH: change what a co-host may do and which emails they get.
    DELETE: revoke a co-host, cancel a pending invite, or clear a finished one
    (declined or left) from the owner's list. Owner only.
    """
    event = get_event_or_404(request.user, event_id, MANAGE_COHOSTS)
    cohost = EventCoHost.objects.filter(event=event, id=cohost_id).select_related('user').first()
    if cohost is None:
        return Response({'error': 'Co-host not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'PATCH':
        return _update_cohost(request, cohost)

    cohost.status = EventCoHost.STATUS_REVOKED
    cohost.save(update_fields=['status', 'updated_at'])
    return Response(serialize_cohost(cohost))


def _update_cohost(request, cohost: EventCoHost) -> Response:
    """
    Only ``capabilities`` and ``notifications`` can change, and only on an
    active invite: a finished one grants nothing and is sent nothing, so
    settings on it would be a promise nobody keeps.
    """
    if cohost.status not in EventCoHost.ACTIVE_STATUSES:
        return Response(
            {'error': 'This person is no longer a co-host on this event.'},
            status=status.HTTP_409_CONFLICT,
        )

    fields = []
    for key, normalize in (
        ('capabilities', normalize_capabilities),
        ('notifications', normalize_notifications),
    ):
        if key not in request.data:
            continue
        value = request.data.get(key)
        if not isinstance(value, list):
            return Response(
                {'error': f'{key} must be a list.'}, status=status.HTTP_400_BAD_REQUEST
            )
        setattr(cohost, key, normalize(value))
        fields.append(key)

    if not fields:
        return Response(
            {'error': 'Nothing to update. Send capabilities and/or notifications.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    cohost.save(update_fields=[*fields, 'updated_at'])
    return Response(serialize_cohost(cohost))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def leave_event(request, event_id):
    """A co-host removes themselves. Distinct from being revoked, for the owner's list."""
    event = Event.objects.filter(id=event_id).first()
    if event is None:
        return Response({'error': 'Event not found.'}, status=status.HTTP_404_NOT_FOUND)

    cohost = EventCoHost.objects.filter(
        event=event, user=request.user, status=EventCoHost.STATUS_ACCEPTED
    ).first()
    if cohost is None:
        return Response(
            {'error': 'You are not a co-host on this event.'}, status=status.HTTP_404_NOT_FOUND
        )

    cohost.status = EventCoHost.STATUS_LEFT
    cohost.left_at = timezone.now()
    cohost.save(update_fields=['status', 'left_at', 'updated_at'])
    return Response({'status': cohost.status})


@api_view(['GET'])
@permission_classes([AllowAny])
def cohost_invite_detail(request, token):
    """
    What an invite is for, before acceptance.

    Open to anonymous callers on purpose: the recipient may have no account yet
    and needs to see what they are signing up for. The token was delivered to
    the invited address, so holding it already implies access to that inbox.
    """
    cohost = resolve_invite(token)
    if cohost is None:
        return Response(
            {'error': 'This invite link is invalid or has expired.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    return Response({
        'status': cohost.status,
        'invited_email': cohost.invited_email,
        'event': {'id': cohost.event_id, 'title': cohost.event.title},
        'invited_by': cohost.event.host.name or cohost.event.host.email,
        'capabilities': cohost.capabilities,
        'account_exists': User.objects.filter(email__iexact=cohost.invited_email).exists(),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def accept_cohost_invite(request, token):
    """
    Accept an invite. Explicit, manual, and bound to the invited address.

    The email must match, so a forwarded invite link is not a bearer credential.
    """
    cohost = resolve_invite(token)
    if cohost is None:
        return Response(
            {'error': 'This invite link is invalid or has expired.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    if cohost.status == EventCoHost.STATUS_ACCEPTED:
        return Response(serialize_cohost(cohost))
    if cohost.status != EventCoHost.STATUS_PENDING:
        return Response(
            {'error': 'This invite is no longer open.'}, status=status.HTTP_409_CONFLICT
        )

    if (request.user.email or '').strip().lower() != cohost.invited_email:
        return Response(
            {
                'error': 'This invite was sent to a different email address.',
                'invited_email': cohost.invited_email,
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    if request.data.get('policy_accepted') is not True:
        return Response(
            {'error': 'You must accept the privacy policy to become a co-host.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if cohost.event.host_id == request.user.id:
        return Response(
            {'error': 'You are the host of this event.'}, status=status.HTTP_400_BAD_REQUEST
        )

    try:
        with transaction.atomic():
            cohost.user = request.user
            cohost.status = EventCoHost.STATUS_ACCEPTED
            cohost.accepted_at = timezone.now()
            cohost.save(update_fields=['user', 'status', 'accepted_at', 'updated_at'])
    except IntegrityError:
        return Response(
            {'error': 'You are already a co-host on this event.'},
            status=status.HTTP_409_CONFLICT,
        )

    return Response(serialize_cohost(cohost))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def decline_cohost_invite(request, token):
    """Decline an invite. Kept rather than deleted so the owner can see it happened."""
    cohost = resolve_invite(token)
    if cohost is None:
        return Response(
            {'error': 'This invite link is invalid or has expired.'},
            status=status.HTTP_404_NOT_FOUND,
        )
    if cohost.status != EventCoHost.STATUS_PENDING:
        return Response(
            {'error': 'This invite is no longer open.'}, status=status.HTTP_409_CONFLICT
        )
    if (request.user.email or '').strip().lower() != cohost.invited_email:
        return Response(
            {'error': 'This invite was sent to a different email address.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    cohost.status = EventCoHost.STATUS_DECLINED
    cohost.declined_at = timezone.now()
    cohost.save(update_fields=['status', 'declined_at', 'updated_at'])
    return Response({'status': cohost.status})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_cohost_invites(request):
    """Pending invites for the signed-in user, for the dashboard banner."""
    email = (request.user.email or '').strip().lower()
    rows = EventCoHost.objects.filter(
        invited_email=email, status=EventCoHost.STATUS_PENDING
    ).select_related('event', 'event__host')
    return Response({'results': [
        {
            'id': c.id,
            'token': issue_invite_token(c),
            'event': {'id': c.event_id, 'title': c.event.title},
            'invited_by': c.event.host.name or c.event.host.email,
            'capabilities': c.capabilities,
        }
        for c in rows
    ]})
