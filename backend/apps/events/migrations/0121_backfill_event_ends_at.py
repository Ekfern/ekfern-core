"""
Fill Event.ends_at for existing events, and carry a host's "Extend" into the
staff link override where it reaches past the new default.

The rule is copied here, not imported from apps.events.lifecycle, so this
migration keeps meaning what it meant when it ran. No series exist yet, so only
dates and sub-events matter. 30 is the default link window: the settings row
does not exist at migration time.
"""
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.db import migrations
from django.db.models import Max
from django.db.models.functions import Coalesce

DEFAULT_LINK_DAYS = 30


def _tz(name):
    try:
        return ZoneInfo(name or 'Asia/Kolkata')
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo('Asia/Kolkata')


def backfill(apps, schema_editor):
    Event = apps.get_model('events', 'Event')
    SubEvent = apps.get_model('events', 'SubEvent')

    latest_by_event = dict(
        SubEvent.objects.filter(is_removed=False)
        .values('event_id')
        .annotate(latest=Max(Coalesce('end_at', 'start_at')))
        .values_list('event_id', 'latest')
    )

    for event in Event.objects.exclude(date=None).only('id', 'date', 'event_end_date', 'timezone', 'expiry_date'):
        tz = _tz(event.timezone)
        days = [event.event_end_date or event.date]
        latest = latest_by_event.get(event.id)
        if latest:
            days.append(latest.astimezone(tz).date())
        ends_at = datetime.combine(max(days) + timedelta(days=1), time.min, tzinfo=tz)

        update = {'ends_at': ends_at}
        if event.expiry_date:
            extended_off = datetime.combine(event.expiry_date + timedelta(days=1), time.min, tzinfo=tz)
            if extended_off > ends_at + timedelta(days=DEFAULT_LINK_DAYS):
                update['link_active_until'] = event.expiry_date
        Event.objects.filter(pk=event.pk).update(**update)


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0120_event_lifecycle'),
    ]

    operations = [
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
