"""Repeating series: what hosts choose, how it is stored, and what the API refuses."""
from datetime import date, datetime
from zoneinfo import ZoneInfo

from django.core.cache import cache
from django.test import SimpleTestCase, TestCase
from rest_framework import serializers
from rest_framework.test import APIClient

from apps.events import lifecycle
from apps.events.models import Event
from apps.events.recurrence import from_rrule, to_rrule
from apps.users.models import User

SUN = date(2026, 11, 8)  # 2nd Sunday of November


class ToRruleTests(SimpleTestCase):
    def test_weekly_defaults_to_the_first_dates_weekday(self):
        self.assertEqual(to_rrule({'freq': 'weekly'}, SUN), ('FREQ=WEEKLY;BYDAY=SU', []))

    def test_every_two_weeks_on_several_days_with_an_end(self):
        rule, _ = to_rrule({'freq': 'fortnightly', 'weekdays': [6, 2], 'until': '2026-12-27'}, SUN)
        self.assertEqual(rule, 'FREQ=WEEKLY;INTERVAL=2;BYDAY=WE,SU;UNTIL=20261227')

    def test_monthly_keeps_the_same_nth_weekday(self):
        self.assertEqual(to_rrule({'freq': 'monthly'}, SUN)[0], 'FREQ=MONTHLY;BYDAY=2SU')
        self.assertEqual(to_rrule({'freq': 'monthly'}, date(2026, 11, 29))[0], 'FREQ=MONTHLY;BYDAY=-1SU')

    def test_skipped_dates_are_kept_sorted_and_unique(self):
        _, skipped = to_rrule({'freq': 'weekly', 'skipped': ['2026-11-22', '2026-11-15', '2026-11-22']}, SUN)
        self.assertEqual(skipped, ['2026-11-15', '2026-11-22'])

    def test_no_choice_means_no_series(self):
        self.assertEqual(to_rrule(None, SUN), ('', []))

    def test_refusals(self):
        for spec in (
            {'freq': 'daily'},
            {'freq': 'weekly', 'weekdays': [9]},
            {'freq': 'weekly', 'weekdays': [0]},  # first date is a Sunday
            {'freq': 'weekly', 'until': '2026-11-01'},
        ):
            with self.subTest(spec=spec), self.assertRaises(serializers.ValidationError):
                to_rrule(spec, SUN)
        with self.assertRaises(serializers.ValidationError):
            to_rrule({'freq': 'weekly'}, None)

    def test_round_trip(self):
        spec = {'freq': 'fortnightly', 'weekdays': [2, 6], 'until': '2026-12-27', 'skipped': ['2026-11-22']}
        rule, skipped = to_rrule(spec, SUN)
        self.assertEqual(from_rrule(rule, skipped), spec)


class RecurrenceApiTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.client.force_authenticate(User.objects.create_user(email='rec@test.com', name='Host'))

    def test_create_a_weekly_series_that_stays_open(self):
        r = self.client.post('/api/events/', {
            'title': 'Satsang', 'event_type': 'satsang', 'date': '2026-10-04',
            'recurrence': {'freq': 'weekly'},
        }, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        event = Event.objects.get(pk=r.data['id'])
        self.assertEqual(event.recurrence_rrule, 'FREQ=WEEKLY;BYDAY=SU')
        self.assertIsNone(event.ends_at)
        detail = self.client.get(f'/api/events/{event.id}/').data
        self.assertEqual(detail['recurrence']['freq'], 'weekly')
        self.assertEqual(detail['lifecycle']['phase'], lifecycle.phase(event))

    def test_end_the_series_and_skip_a_date(self):
        event = Event.objects.create(host=User.objects.get(), slug='rec', title='S', date=SUN,
                                     recurrence_rrule='FREQ=WEEKLY;BYDAY=SU')
        r = self.client.patch(f'/api/events/{event.id}/', {
            'recurrence': {'freq': 'weekly', 'until': '2026-11-29', 'skipped': ['2026-11-15']},
        }, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        event.refresh_from_db()
        self.assertEqual(event.recurrence_exdates, ['2026-11-15'])
        self.assertEqual(event.ends_at, datetime(2026, 11, 30, tzinfo=ZoneInfo('Asia/Kolkata')))

    def test_stop_repeating(self):
        event = Event.objects.create(host=User.objects.get(), slug='rec2', title='S', date=SUN,
                                     recurrence_rrule='FREQ=WEEKLY;BYDAY=SU')
        self.client.patch(f'/api/events/{event.id}/', {'recurrence': None}, format='json')
        event.refresh_from_db()
        self.assertEqual(event.recurrence_rrule, '')
        self.assertIsNotNone(event.ends_at)

    def test_a_series_has_no_last_day(self):
        r = self.client.post('/api/events/', {
            'title': 'S', 'event_type': 'satsang', 'date': '2026-10-04', 'event_end_date': '2026-10-05',
            'recurrence': {'freq': 'weekly'},
        }, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertIn('recurrence', r.data)

    def test_moving_a_monthly_series_follows_the_new_date(self):
        event = Event.objects.create(host=User.objects.get(), slug='rec3', title='S', date=SUN,
                                     recurrence_rrule='FREQ=MONTHLY;BYDAY=2SU')
        self.client.patch(f'/api/events/{event.id}/', {'date': '2026-11-29'}, format='json')
        event.refresh_from_db()
        self.assertEqual(event.recurrence_rrule, 'FREQ=MONTHLY;BYDAY=-1SU')

    def test_moving_a_weekly_series_off_its_weekday_is_refused(self):
        event = Event.objects.create(host=User.objects.get(), slug='rec4', title='S', date=SUN,
                                     recurrence_rrule='FREQ=WEEKLY;BYDAY=SU')
        r = self.client.patch(f'/api/events/{event.id}/', {'date': '2026-11-10'}, format='json')
        self.assertEqual(r.status_code, 400)
