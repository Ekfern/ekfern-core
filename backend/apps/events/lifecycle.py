"""
When an event is over, and what closes when.

One source for every surface - guest pages, host dashboard, analytics, the
scheduled transitions job. Everything is worked out in the event's own time
zone: a Los Angeles party is still happening at 01:00 IST the next morning.

The rule, in order:

    ends_at       start of the day after the last day. The last day is the
                  latest of the event's last date and its latest sub-event; for
                  a repeating series, its last occurrence (None while open).
    RSVP          open until ends_at.
    Gifts         open until ends_at + catalog days, unless the host closed
                  them earlier.
    Link          active until ends_at + link days - but never before the host
                  has been warned, and never while the platform switch
                  (EventLifecycleSettings.enforce_link_off) is off. If the
                  warning job never runs, nothing goes dark.

A cancelled event closes RSVP and gifts at once; its link follows the same
clock as any other event.
"""
from __future__ import annotations

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.conf import settings
from django.utils import timezone

UPCOMING = 'upcoming'
HAPPENING = 'happening'
ONGOING = 'ongoing'
ENDED = 'ended'
CANCELLED = 'cancelled'
ARCHIVED = 'archived'

# Phases a host dashboard files under "Past".
PAST_PHASES = frozenset({ENDED, CANCELLED, ARCHIVED})

# An open series is expanded at most this far ahead when looking for a date.
_SERIES_HORIZON_DAYS = 3 * 366


def _config() -> dict:
    from .models import EventLifecycleSettings
    return EventLifecycleSettings.get_config()


def event_tz(event) -> ZoneInfo:
    for name in (getattr(event, 'timezone', None), settings.TIME_ZONE):
        if name:
            try:
                return ZoneInfo(name)
            except (ZoneInfoNotFoundError, ValueError):
                continue
    return ZoneInfo('UTC')


def _now(now):
    return now or timezone.now()


def local_today(event, now=None) -> date:
    return timezone.localtime(_now(now), event_tz(event)).date()


def start_of_day(event, day: date) -> datetime:
    return datetime.combine(day, time.min, tzinfo=event_tz(event))


# --- Repeating series ---------------------------------------------------------

def is_series(event) -> bool:
    return bool(getattr(event, 'recurrence_rrule', '') and event.date)


def _rule_is_finite(event) -> bool:
    rule = event.recurrence_rrule.upper()
    return 'UNTIL=' in rule or 'COUNT=' in rule


def series_dates(event):
    """
    The series as a dateutil rruleset of naive local midnights, skipped dates
    removed. Only call when is_series(event).
    """
    from dateutil.rrule import rruleset, rrulestr

    start = datetime.combine(event.date, time.min)
    rules = rruleset()
    rules.rrule(rrulestr(event.recurrence_rrule, dtstart=start))
    for skipped in event.recurrence_exdates or []:
        try:
            rules.exdate(datetime.combine(date.fromisoformat(str(skipped)), time.min))
        except ValueError:
            continue
    return rules


def last_occurrence(event) -> date | None:
    """The final date of a series, or None while it has no end."""
    if not is_series(event) or not _rule_is_finite(event):
        return None
    last = None
    for occurrence in series_dates(event):
        last = occurrence
    return last.date() if last else event.date


def next_occurrence(event, now=None) -> date | None:
    """The next date of a series on or after today (event's zone), or None."""
    if not is_series(event):
        return None
    today = local_today(event, now)
    found = series_dates(event).after(datetime.combine(today, time.min), inc=True)
    if not found or (found.date() - today).days > _SERIES_HORIZON_DAYS:
        return None
    return found.date()


# --- The clock ----------------------------------------------------------------

def _latest_sub_event_day(event) -> date | None:
    """
    The local date of the latest sub-event's end (or start). Uses the list
    query's annotation when present, so a dashboard is not one query per event.
    """
    latest = getattr(event, 'latest_sub_event_at', None)
    if latest is None and event.pk and not hasattr(event, 'latest_sub_event_at'):
        from django.db.models import Max
        from django.db.models.functions import Coalesce

        latest = event.sub_events.filter(is_removed=False).aggregate(
            latest=Max(Coalesce('end_at', 'start_at'))
        )['latest']
    if latest is None:
        return None
    return timezone.localtime(latest, event_tz(event)).date()


def last_day(event) -> date | None:
    """The last day guests gather on; None for an undated event or an open series."""
    if not event.date:
        return None
    if is_series(event):
        if not _rule_is_finite(event):
            return None
        days = [last_occurrence(event) or event.date]
    else:
        days = [event.event_end_date or event.date]
    sub = _latest_sub_event_day(event)
    if sub:
        days.append(sub)
    return max(days)


def compute_ends_at(event) -> datetime | None:
    """Start of the day after the last day, in the event's zone. None: never ends."""
    day = last_day(event)
    if day is None:
        return None
    return start_of_day(event, day + timedelta(days=1))


def _days(event, field: str) -> int:
    own = getattr(event, field, None)
    return int(own) if own is not None else int(_config()[field])


def catalog_closes_at(event) -> datetime | None:
    """When gifts close: the host's early close, else ends_at + gift days."""
    ends = compute_ends_at(event)
    automatic = ends + timedelta(days=_days(event, 'catalog_days_after_end')) if ends else None
    closed = getattr(event, 'catalog_closed_at', None)
    candidates = [moment for moment in (automatic, closed) if moment]
    return min(candidates) if candidates else None


def scheduled_link_off_at(event) -> datetime | None:
    """When the link is due to go off by the calendar alone (what hosts are warned about)."""
    ends = compute_ends_at(event)
    if ends is None:
        return None
    off = ends + timedelta(days=_days(event, 'link_days_after_end'))
    override = getattr(event, 'link_active_until', None)
    if override:
        off = max(off, start_of_day(event, override + timedelta(days=1)))
    return off


def link_off_at(event) -> datetime | None:
    """
    When the link actually goes off. None means it stays on: no end, or the
    host has not been warned yet. A warning always buys the host the full
    notice period, however late it was sent.
    """
    scheduled = scheduled_link_off_at(event)
    warned = getattr(event, 'host_warned_link_off_at', None)
    if scheduled is None or warned is None:
        return None
    return max(scheduled, warned + timedelta(days=int(_config()['warn_days_before'])))


def link_active(event, now=None) -> bool:
    if not _config()['enforce_link_off']:
        return True
    off = link_off_at(event)
    return off is None or _now(now) < off


def is_cancelled(event) -> bool:
    return bool(getattr(event, 'cancelled_at', None))


def rsvp_open(event, now=None) -> bool:
    if is_cancelled(event) or not link_active(event, now):
        return False
    ends = compute_ends_at(event)
    return ends is None or _now(now) < ends


def catalog_open(event, now=None) -> bool:
    if is_cancelled(event) or not link_active(event, now):
        return False
    closes = catalog_closes_at(event)
    return closes is None or _now(now) < closes


def phase(event, now=None) -> str:
    now = _now(now)
    if not link_active(event, now):
        return ARCHIVED
    if is_cancelled(event):
        return CANCELLED
    if not event.date or local_today(event, now) < event.date:
        return UPCOMING
    ends = compute_ends_at(event)
    if ends is not None and now >= ends:
        return ENDED
    return ONGOING if is_series(event) else HAPPENING


def is_over(event, now=None) -> bool:
    return phase(event, now) in PAST_PHASES


def _iso(value):
    return value.isoformat() if value else None


def lifecycle_payload(event, now=None) -> dict:
    """What every surface needs to show the event's state. Safe for guests."""
    now = _now(now)
    current = phase(event, now)
    next_date = next_occurrence(event, now)
    return {
        'phase': current,
        'timezone': str(event_tz(event)),
        'ends_at': _iso(compute_ends_at(event)),
        'rsvp_open': rsvp_open(event, now),
        'catalog_open': catalog_open(event, now),
        'catalog_closes_at': _iso(catalog_closes_at(event)),
        'catalog_closed_early': bool(getattr(event, 'catalog_closed_at', None)),
        'link_off_at': _iso(scheduled_link_off_at(event)),
        'cancelled_note': (getattr(event, 'cancel_note', '') or '') if current == CANCELLED else '',
        'series': {
            'rrule': event.recurrence_rrule,
            'skipped': [str(d) for d in (event.recurrence_exdates or [])],
            'next_date': _iso(next_date),
            'today': next_date == local_today(event, now) if next_date else False,
        } if is_series(event) else None,
    }


def next_change_at(event, now=None) -> datetime | None:
    """
    The next moment anything in lifecycle_payload changes by the calendar
    alone. A cached copy of the payload must not outlive it. Hand changes
    (cancel, close gifts) instead rotate or purge the caches when made.
    """
    now = _now(now)
    candidates = [compute_ends_at(event), catalog_closes_at(event)]
    if event.date:
        candidates.append(start_of_day(event, event.date))
    if _config()['enforce_link_off']:
        candidates.append(link_off_at(event))
    if is_series(event):
        # The next date and "today" roll over at local midnight.
        candidates.append(start_of_day(event, local_today(event, now) + timedelta(days=1)))
    future = [moment for moment in candidates if moment and moment > now]
    return min(future) if future else None


def host_lifecycle_payload(event, now=None) -> dict:
    """The guest payload plus what only the host's controls need."""
    now = _now(now)
    payload = lifecycle_payload(event, now)
    ends = compute_ends_at(event)
    automatic_close = ends + timedelta(days=_days(event, 'catalog_days_after_end')) if ends else None
    payload.update({
        'cancelled_at': _iso(getattr(event, 'cancelled_at', None)),
        'cancel_note': getattr(event, 'cancel_note', '') or '',
        'link_off_enforced': bool(_config()['enforce_link_off']),
        # Reopening only undoes an early close; it never stretches the window.
        'can_reopen_catalog': bool(
            getattr(event, 'catalog_closed_at', None)
            and not is_cancelled(event)
            and (automatic_close is None or now < automatic_close)
        ),
    })
    return payload


def over_q(now=None):
    """
    Database filter for events that are over (ended or cancelled), from the
    stored ends_at. For counts and buckets; per-event decisions use phase().
    """
    from django.db.models import Q
    return Q(ends_at__lte=_now(now)) | Q(cancelled_at__isnull=False)


def latest_sub_event_subquery():
    """Annotation for latest_sub_event_at, so a list of events costs no query each."""
    from django.db.models import OuterRef, Subquery
    from django.db.models.functions import Coalesce
    from .models import SubEvent

    return Subquery(
        SubEvent.objects.filter(event=OuterRef('pk'), is_removed=False)
        .annotate(moment=Coalesce('end_at', 'start_at'))
        .order_by('-moment')
        .values('moment')[:1]
    )


def sync_ends_at(event_id) -> None:
    """Re-store Event.ends_at after something it depends on changed (a sub-event)."""
    from .models import Event

    event = Event.objects.filter(pk=event_id).first()
    if event is None:
        return
    value = compute_ends_at(event)
    if event.ends_at != value:
        Event.objects.filter(pk=event_id).update(ends_at=value)
