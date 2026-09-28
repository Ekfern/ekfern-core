"""
Recording what an event used to be.

One entry point, ``record_event_version``, called wherever an event's design or
its details are written. How history behaves - folding a burst of autosaves into
one entry, and how much is kept - lives here rather than at the call sites.

A version snapshots the *whole* event: the invite design and the details
together. Keeping them in one row is what lets a single timeline answer "what
changed about this event", instead of splitting a date change and a colour
change across two histories that have to be read side by side.
"""
import json
import logging

from django.utils import timezone

from .models import EventVersion

logger = logging.getLogger(__name__)

#: The fields a host edits on Event Details. Anything outside this is either
#: derived, internal, or belongs to the design.
DETAIL_FIELDS = (
    'title',
    'event_type',
    'date',
    'event_end_date',
    'city',
    'country',
    'timezone',
    'is_public',
    'has_rsvp',
    'has_registry',
    'event_structure',
)


def details_of(event):
    """The host-editable details of an event, as plain JSON-safe values."""
    out = {}
    for field in DETAIL_FIELDS:
        value = getattr(event, field, None)
        out[field] = value.isoformat() if hasattr(value, 'isoformat') else value
    return out


def record_event_version(event, saved_by=None, label=''):
    """
    Snapshot an event, folding it into the caller's current editing session.

    Reads the current state off the event rather than taking it as an argument,
    so a save that touches only the details still records the design as it
    stands, and a version is always a complete picture.

    A new row is written only when the previous version was by someone else, is
    older than the coalescing window, or was marked worth keeping. Otherwise the
    most recent row is updated in place, so an afternoon of autosaves becomes one
    entry rather than several hundred.

    Never raises: history is a convenience, and failing to record it must not
    fail the save it is recording.
    """
    try:
        config = event.page_config or {}
        details = details_of(event)
        size = len(json.dumps({'config': config, 'details': details}))

        latest = EventVersion.objects.filter(event=event).order_by('-created_at').first()

        same_session = (
            latest is not None
            and not latest.label
            and not label
            and latest.saved_by_id == (saved_by.id if saved_by else None)
            and timezone.now() - latest.created_at <= EventVersion.COALESCE_WINDOW
        )

        if same_session:
            latest.config = config
            latest.details = details
            latest.size_bytes = size
            latest.save(update_fields=['config', 'details', 'size_bytes', 'updated_at'])
            version = latest
        else:
            version = EventVersion.objects.create(
                event=event, config=config, details=details,
                saved_by=saved_by, label=label, size_bytes=size,
            )

        _trim(event)
        return version
    except Exception:
        logger.exception('[History] failed to record a version for event %s', getattr(event, 'id', None))
        return None


def _trim(event):
    """
    Drop the oldest versions once an event's history exceeds the size budget.

    Budgeting by bytes rather than by count means a normal config keeps a long
    history, while one carrying embedded images cannot grow it into the
    megabytes. The newest version is always kept, however large it is - an event
    with no history at all would be worse than one with a single entry.
    """
    rows = list(
        EventVersion.objects.filter(event=event)
        .order_by('-created_at')
        .values_list('id', 'size_bytes')
    )
    running = 0
    doomed = []
    for index, (version_id, size) in enumerate(rows):
        running += size or 0
        if index > 0 and running > EventVersion.MAX_TOTAL_BYTES:
            doomed.append(version_id)
    if doomed:
        EventVersion.objects.filter(id__in=doomed).delete()
