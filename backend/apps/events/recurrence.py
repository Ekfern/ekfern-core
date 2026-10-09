"""
A repeating series, as hosts choose it and as it is stored.

Hosts pick from three rhythms - weekly on some weekdays, every other week, or
monthly on the same weekday (the 2nd Sunday, the last Friday) as the first
date - with an optional last date and dates to skip. That choice is stored as a
standard RFC 5545 RRULE plus skipped dates, so calendar files and any later
per-date feature read the same thing (apps/events/lifecycle.py expands it).

    {"freq": "weekly", "weekdays": [6], "until": "2026-12-27", "skipped": ["2026-11-01"]}
    <->  recurrence_rrule = "FREQ=WEEKLY;BYDAY=SU;UNTIL=20261227"
         recurrence_exdates = ["2026-11-01"]
"""
from __future__ import annotations

from datetime import date

from rest_framework import serializers

DAY_CODES = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']  # Python's weekday() order
FREQS = ('weekly', 'fortnightly', 'monthly')
MAX_SKIPPED = 100


def _date(value, field):
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value))
    except ValueError:
        raise serializers.ValidationError({'recurrence': f'{field} must be a date (YYYY-MM-DD).'})


def nth_weekday(day: date) -> int:
    """
    Which of its weekday in the month a date is: 1-4, or -1 for a 5th, which
    repeats as "the last" since not every month has a 5th.
    """
    n = (day.day - 1) // 7 + 1
    return -1 if n >= 5 else n


def to_rrule(spec, first: date | None) -> tuple[str, list[str]]:
    """Validate a host's choice and turn it into (RRULE, skipped dates). None/empty: no series."""
    if not spec:
        return '', []
    if not isinstance(spec, dict):
        raise serializers.ValidationError({'recurrence': 'Choose how often it repeats.'})
    if not first:
        raise serializers.ValidationError({'recurrence': 'A repeating event needs its first date.'})

    freq = spec.get('freq')
    if freq not in FREQS:
        raise serializers.ValidationError({'recurrence': 'Repeat weekly, every 2 weeks or monthly.'})

    parts = []
    if freq == 'monthly':
        parts += ['FREQ=MONTHLY', f'BYDAY={nth_weekday(first)}{DAY_CODES[first.weekday()]}']
    else:
        weekdays = spec.get('weekdays') or [first.weekday()]
        if not isinstance(weekdays, list) or not all(isinstance(d, int) and 0 <= d <= 6 for d in weekdays):
            raise serializers.ValidationError({'recurrence': 'Weekdays are 0 (Monday) to 6 (Sunday).'})
        if first.weekday() not in weekdays:
            raise serializers.ValidationError({'recurrence': 'The first date must fall on one of the chosen days.'})
        parts.append('FREQ=WEEKLY')
        if freq == 'fortnightly':
            parts.append('INTERVAL=2')
        parts.append('BYDAY=' + ','.join(DAY_CODES[d] for d in sorted(set(weekdays))))

    until = spec.get('until')
    if until:
        until = _date(until, 'Until')
        if until < first:
            raise serializers.ValidationError({'recurrence': "The last date can't be before the first."})
        parts.append(f'UNTIL={until:%Y%m%d}')

    skipped = spec.get('skipped') or []
    if not isinstance(skipped, list) or len(skipped) > MAX_SKIPPED:
        raise serializers.ValidationError({'recurrence': 'Too many skipped dates.'})
    skipped = sorted({_date(d, 'Skipped date').isoformat() for d in skipped})
    return ';'.join(parts), skipped


def from_rrule(rrule: str, skipped) -> dict | None:
    """The host's choice back from what is stored, for the form."""
    if not rrule:
        return None
    fields = dict(part.split('=', 1) for part in rrule.upper().split(';') if '=' in part)
    until = fields.get('UNTIL', '')[:8]
    spec = {
        'freq': 'monthly' if fields.get('FREQ') == 'MONTHLY'
        else 'fortnightly' if fields.get('INTERVAL') == '2' else 'weekly',
        'weekdays': [],
        'until': f'{until[:4]}-{until[4:6]}-{until[6:8]}' if len(until) == 8 else None,
        'skipped': list(skipped or []),
    }
    if spec['freq'] != 'monthly':
        spec['weekdays'] = [DAY_CODES.index(code) for code in fields.get('BYDAY', '').split(',') if code in DAY_CODES]
    return spec


class RecurrenceField(serializers.Field):
    """`recurrence` on the event: the host's choice in, the host's choice out."""

    def __init__(self, **kwargs):
        kwargs.setdefault('source', '*')
        kwargs.setdefault('required', False)
        kwargs.setdefault('allow_null', True)
        super().__init__(**kwargs)

    def to_representation(self, event):
        return from_rrule(getattr(event, 'recurrence_rrule', ''), getattr(event, 'recurrence_exdates', []))

    def to_internal_value(self, data):
        # Turned into an RRULE in the serializer's validate(), where the first date is known.
        return {'_recurrence_spec': data}

    def validate_empty_values(self, data):
        if data is None:
            return (True, {'_recurrence_spec': None})
        return super().validate_empty_values(data)


def apply_recurrence(attrs, instance=None):
    """In a serializer's validate(): turn the submitted choice into stored fields."""
    if '_recurrence_spec' not in attrs:
        # A series whose first date moved: "the 2nd Sunday" follows the new date,
        # and a weekly rhythm must still include its new weekday.
        stored = getattr(instance, 'recurrence_rrule', '')
        if not (stored and 'date' in attrs and attrs['date'] != instance.date):
            return attrs
        spec = from_rrule(stored, instance.recurrence_exdates)
    else:
        spec = attrs.pop('_recurrence_spec')
    first = attrs.get('date', getattr(instance, 'date', None))
    rrule, skipped = to_rrule(spec, first)
    if rrule and attrs.get('event_end_date', getattr(instance, 'event_end_date', None)):
        raise serializers.ValidationError({'recurrence': 'A repeating event has no last day; clear it first.'})
    attrs['recurrence_rrule'] = rrule
    attrs['recurrence_exdates'] = skipped
    return attrs
