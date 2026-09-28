"""
Recording what an event's invite design used to look like.

One entry point, ``record_design_version``, called wherever page_config is
written. Everything about how history behaves - folding a burst of autosaves
into one entry, and how much is kept - lives here rather than at the call sites.
"""
import json
import logging

from django.utils import timezone

from .models import EventDesignVersion

logger = logging.getLogger(__name__)


def record_design_version(event, config, saved_by=None, label=''):
    """
    Snapshot a config, folding it into the caller's current editing session.

    A new row is written only when the previous version was by someone else, is
    older than the coalescing window, or was marked worth keeping. Otherwise the
    most recent row is updated in place, so an afternoon of autosaves becomes one
    entry rather than several hundred.

    Never raises: history is a convenience, and failing to record it must not
    fail the save it is recording.
    """
    try:
        payload = config or {}
        size = len(json.dumps(payload))

        latest = EventDesignVersion.objects.filter(event=event).order_by('-created_at').first()

        same_session = (
            latest is not None
            and not latest.label
            and not label
            and latest.saved_by_id == (saved_by.id if saved_by else None)
            and timezone.now() - latest.created_at <= EventDesignVersion.COALESCE_WINDOW
        )

        if same_session:
            latest.config = payload
            latest.size_bytes = size
            latest.save(update_fields=['config', 'size_bytes', 'updated_at'])
            version = latest
        else:
            version = EventDesignVersion.objects.create(
                event=event, config=payload, saved_by=saved_by, label=label, size_bytes=size,
            )

        _trim(event)
        return version
    except Exception:
        logger.exception('[DesignHistory] failed to record a version for event %s', getattr(event, 'id', None))
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
        EventDesignVersion.objects.filter(event=event)
        .order_by('-created_at')
        .values_list('id', 'size_bytes')
    )
    budget = EventDesignVersion.MAX_TOTAL_BYTES
    running = 0
    doomed = []
    for index, (version_id, size) in enumerate(rows):
        running += size or 0
        if index > 0 and running > budget:
            doomed.append(version_id)
    if doomed:
        EventDesignVersion.objects.filter(id__in=doomed).delete()
