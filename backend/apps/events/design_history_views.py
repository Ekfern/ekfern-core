"""
Reading an event's design history.

Read-only on purpose: there is no restore endpoint. A host sees what the invite
used to look like and what its settings were, and redoes it by hand.
"""
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .access import get_event_or_404
from .design_diff import diff_configs, diff_details
from .models import EventVersion


def summarize(config):
    """
    The settings a host would need in order to recreate a version by hand.

    A thumbnail shows what it looked like; this says what it was set to. Values
    are passed through as stored so the summary never disagrees with the config
    it came from.
    """
    config = config or {}
    tiles = config.get('tiles') or []
    return {
        'background_url': config.get('background_url'),
        'customColors': config.get('customColors'),
        'customFonts': config.get('customFonts'),
        'texture': config.get('texture'),
        'pageBorder': config.get('pageBorder'),
        'pageFrame': config.get('pageFrame'),
        'tiles': [
            {
                'id': t.get('id'),
                'type': t.get('type'),
                'enabled': t.get('enabled', True),
            }
            for t in tiles
            if isinstance(t, dict)
        ],
    }


def serialize_version(version, include_summary=False):
    data = {
        'id': version.id,
        'saved_by': version.saved_by.name or version.saved_by.email if version.saved_by else None,
        'label': version.label,
        'size_bytes': version.size_bytes,
        'created_at': version.created_at,
        'updated_at': version.updated_at,
    }
    if include_summary:
        # Never the config itself: nothing renders a stored version, and configs
        # are the one part of this that can be large.
        data['summary'] = summarize(version.config)
    return data


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def design_versions(request, event_id):
    """
    List an event's design history, newest first.

    Metadata only - the configs themselves are fetched one at a time, so opening
    the panel never ships an event's whole history at once.
    """
    event = get_event_or_404(request.user, event_id)
    rows = (
        EventVersion.objects.filter(event=event)
        .select_related('saved_by')
        .order_by('-created_at')
    )
    return Response({'results': [serialize_version(v) for v in rows]})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def design_version_detail(request, event_id, version_id):
    """
    What changed in this version, and what it was set to.

    The changes are against the version immediately before it, because knowing
    which setting moved and what it held is what lets a host put it back by
    hand. The oldest version has nothing to compare against, so it reports its
    settings instead.
    """
    event = get_event_or_404(request.user, event_id)
    version = EventVersion.objects.filter(event=event, id=version_id).first()
    if version is None:
        return Response({'error': 'Version not found.'}, status=status.HTTP_404_NOT_FOUND)

    previous = (
        EventVersion.objects.filter(event=event, created_at__lt=version.created_at)
        .order_by('-created_at')
        .first()
    )

    data = serialize_version(version, include_summary=True)
    data['is_first'] = previous is None
    # Details first: a changed date or title is the bigger news, and reads
    # oddly underneath a list of colour tweaks.
    data['changes'] = diff_details(
        previous.details if previous else {}, version.details
    ) + diff_configs(previous.config if previous else {}, version.config)
    return Response(data)
