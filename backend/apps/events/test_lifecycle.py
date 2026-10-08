"""The event lifecycle: when an event is over, and what closes when (apps/events/lifecycle.py)."""
from datetime import date, datetime, timedelta, timezone as dt_timezone
from zoneinfo import ZoneInfo

from django.core.cache import cache
from django.test import TestCase, override_settings

from apps.events import lifecycle
from apps.events.models import Event, EventLifecycleSettings, SubEvent
from apps.users.models import User

IST = ZoneInfo('Asia/Kolkata')
LA = ZoneInfo('America/Los_Angeles')


def at(day: date, hour=12, tz=IST):
    return datetime(day.year, day.month, day.day, hour, tzinfo=tz)


D = date(2026, 11, 8)  # a Sunday


class LifecycleTestCase(TestCase):
    def setUp(self):
        cache.clear()
        self.host = User.objects.create_user(email='life@test.com', name='Host')

    def make(self, **fields):
        fields.setdefault('date', D)
        fields.setdefault('title', 'Party')
        fields.setdefault('slug', f'life-{Event.objects.count()}')
        return Event.objects.create(host=self.host, **fields)

    def settings_row(self, **values):
        EventLifecycleSettings.objects.update_or_create(pk=1, defaults=values)
        cache.clear()


class PhaseTests(LifecycleTestCase):
    def test_a_one_day_event_moves_through_its_phases(self):
        event = self.make()
        self.assertEqual(lifecycle.phase(event, at(D - timedelta(days=1))), lifecycle.UPCOMING)
        self.assertEqual(lifecycle.phase(event, at(D, 9)), lifecycle.HAPPENING)
        self.assertEqual(lifecycle.phase(event, at(D, 23)), lifecycle.HAPPENING)
        self.assertEqual(lifecycle.phase(event, at(D + timedelta(days=1), 0)), lifecycle.ENDED)

    def test_the_event_zone_decides_not_the_server(self):
        event = self.make(timezone='America/Los_Angeles')
        # 01:00 IST on the 9th is still the 8th in Los Angeles.
        self.assertEqual(lifecycle.phase(event, at(D + timedelta(days=1), 1, IST)), lifecycle.HAPPENING)
        self.assertEqual(lifecycle.phase(event, at(D + timedelta(days=1), 0, LA)), lifecycle.ENDED)

    def test_a_multi_day_event_is_not_over_on_day_two(self):
        event = self.make(event_end_date=D + timedelta(days=2))
        self.assertEqual(lifecycle.phase(event, at(D + timedelta(days=1))), lifecycle.HAPPENING)
        self.assertEqual(lifecycle.phase(event, at(D + timedelta(days=3), 0)), lifecycle.ENDED)

    def test_a_sub_event_after_the_last_day_keeps_it_going(self):
        event = self.make()
        SubEvent.objects.create(event=event, title='Reception', start_at=at(D + timedelta(days=2), 19))
        event.refresh_from_db()
        self.assertEqual(event.ends_at, datetime(2026, 11, 11, tzinfo=IST))
        self.assertEqual(lifecycle.phase(event, at(D + timedelta(days=2), 20)), lifecycle.HAPPENING)

    def test_a_removed_sub_event_no_longer_counts(self):
        event = self.make()
        sub = SubEvent.objects.create(event=event, title='Reception', start_at=at(D + timedelta(days=2), 19))
        sub.is_removed = True
        sub.save()
        event.refresh_from_db()
        self.assertEqual(event.ends_at, datetime(2026, 11, 9, tzinfo=IST))

    def test_an_undated_event_is_upcoming_and_never_closes(self):
        event = self.make(date=None)
        self.assertEqual(lifecycle.phase(event, at(D)), lifecycle.UPCOMING)
        self.assertTrue(lifecycle.rsvp_open(event, at(D)))
        self.assertIsNone(event.ends_at)

    def test_is_expired_means_over(self):
        event = self.make(date=date.today() - timedelta(days=3))
        self.assertTrue(event.is_expired)
        self.assertFalse(self.make(date=date.today() + timedelta(days=3)).is_expired)

    def test_cancelled_closes_rsvp_and_gifts_at_once(self):
        event = self.make(cancelled_at=at(D - timedelta(days=5)), cancel_note='Sorry, family emergency')
        now = at(D - timedelta(days=3))
        self.assertEqual(lifecycle.phase(event, now), lifecycle.CANCELLED)
        self.assertFalse(lifecycle.rsvp_open(event, now))
        self.assertFalse(lifecycle.catalog_open(event, now))
        self.assertEqual(lifecycle.lifecycle_payload(event, now)['cancelled_note'], 'Sorry, family emergency')


class StoredEndsAtTests(LifecycleTestCase):
    def test_saving_a_new_date_moves_ends_at(self):
        event = self.make()
        event.date = D + timedelta(days=7)
        event.save(update_fields=['date'])
        event.refresh_from_db()
        self.assertEqual(event.ends_at, datetime(2026, 11, 16, tzinfo=IST))

    def test_an_unrelated_partial_save_leaves_it_alone(self):
        event = self.make()
        Event.objects.filter(pk=event.pk).update(ends_at=None)
        event.refresh_from_db()
        event.title = 'Renamed'
        event.save(update_fields=['title'])
        event.refresh_from_db()
        self.assertIsNone(event.ends_at)


class WindowTests(LifecycleTestCase):
    def test_rsvp_closes_at_the_end_and_gifts_30_days_later(self):
        event = self.make()
        ended = at(D + timedelta(days=1), 0)
        self.assertFalse(lifecycle.rsvp_open(event, ended))
        self.assertTrue(lifecycle.catalog_open(event, ended))
        self.assertTrue(lifecycle.catalog_open(event, at(D + timedelta(days=30), 23)))
        self.assertFalse(lifecycle.catalog_open(event, at(D + timedelta(days=31), 0)))

    def test_the_host_can_close_gifts_early_and_reopen_them(self):
        event = self.make(catalog_closed_at=at(D + timedelta(days=2)))
        self.assertFalse(lifecycle.catalog_open(event, at(D + timedelta(days=3))))
        event.catalog_closed_at = None
        self.assertTrue(lifecycle.catalog_open(event, at(D + timedelta(days=3))))

    def test_an_event_can_carry_its_own_gift_window(self):
        event = self.make(catalog_days_after_end=90)
        self.assertTrue(lifecycle.catalog_open(event, at(D + timedelta(days=80))))

    def test_the_platform_default_comes_from_the_settings_row(self):
        self.settings_row(catalog_days_after_end=5)
        event = self.make()
        self.assertFalse(lifecycle.catalog_open(event, at(D + timedelta(days=7))))

    @override_settings(EVENT_CATALOG_DAYS_AFTER_END=2)
    def test_without_a_row_it_falls_back_to_django_settings(self):
        event = self.make()
        self.assertFalse(lifecycle.catalog_open(event, at(D + timedelta(days=4))))


class LinkOffTests(LifecycleTestCase):
    """The link must never go dark without the platform switch and a warned host."""

    long_after = at(D + timedelta(days=200))

    def test_while_the_switch_is_off_every_link_stays_active(self):
        event = self.make(host_warned_link_off_at=at(D))
        self.assertTrue(lifecycle.link_active(event, self.long_after))
        self.assertEqual(lifecycle.phase(event, self.long_after), lifecycle.ENDED)

    def test_without_a_warning_the_link_never_goes_off(self):
        self.settings_row(enforce_link_off=True)
        event = self.make()
        self.assertTrue(lifecycle.link_active(event, self.long_after))
        self.assertIsNone(lifecycle.link_off_at(event))

    def test_a_warned_host_loses_the_link_on_schedule(self):
        self.settings_row(enforce_link_off=True)
        event = self.make(host_warned_link_off_at=at(D + timedelta(days=22)))
        self.assertTrue(lifecycle.link_active(event, at(D + timedelta(days=30), 23)))
        self.assertFalse(lifecycle.link_active(event, at(D + timedelta(days=31), 0)))
        self.assertEqual(lifecycle.phase(event, at(D + timedelta(days=31), 1)), lifecycle.ARCHIVED)
        self.assertFalse(lifecycle.rsvp_open(event, at(D + timedelta(days=31), 1)))

    def test_a_late_warning_still_buys_the_full_notice(self):
        self.settings_row(enforce_link_off=True)
        warned = at(D + timedelta(days=60))
        event = self.make(host_warned_link_off_at=warned)
        self.assertTrue(lifecycle.link_active(event, warned + timedelta(days=6)))
        self.assertFalse(lifecycle.link_active(event, warned + timedelta(days=7)))

    def test_staff_override_keeps_it_on_through_that_day(self):
        self.settings_row(enforce_link_off=True)
        event = self.make(host_warned_link_off_at=at(D), link_active_until=D + timedelta(days=100))
        self.assertTrue(lifecycle.link_active(event, at(D + timedelta(days=100), 23)))
        self.assertFalse(lifecycle.link_active(event, at(D + timedelta(days=101), 0)))

    def test_an_open_series_never_goes_off(self):
        self.settings_row(enforce_link_off=True)
        event = self.make(recurrence_rrule='FREQ=WEEKLY;BYDAY=SU', host_warned_link_off_at=at(D))
        self.assertTrue(lifecycle.link_active(event, self.long_after))


class SeriesTests(LifecycleTestCase):
    def test_a_weekly_series_stays_ongoing_and_counts_to_the_next_date(self):
        event = self.make(recurrence_rrule='FREQ=WEEKLY;BYDAY=SU')
        tuesday = at(D + timedelta(days=2))
        self.assertEqual(lifecycle.phase(event, tuesday), lifecycle.ONGOING)
        self.assertTrue(lifecycle.rsvp_open(event, tuesday))
        self.assertEqual(lifecycle.next_occurrence(event, tuesday), D + timedelta(days=7))
        self.assertIsNone(event.ends_at)

    def test_on_the_day_the_next_date_is_today(self):
        event = self.make(recurrence_rrule='FREQ=WEEKLY;BYDAY=SU')
        sunday = at(D + timedelta(days=7), 9)
        payload = lifecycle.lifecycle_payload(event, sunday)
        self.assertEqual(payload['series']['next_date'], (D + timedelta(days=7)).isoformat())
        self.assertTrue(payload['series']['today'])

    def test_every_two_weeks(self):
        event = self.make(recurrence_rrule='FREQ=WEEKLY;INTERVAL=2;BYDAY=SU')
        self.assertEqual(lifecycle.next_occurrence(event, at(D + timedelta(days=1))), D + timedelta(days=14))

    def test_last_sunday_of_the_month(self):
        event = self.make(date=date(2026, 11, 29), recurrence_rrule='FREQ=MONTHLY;BYDAY=-1SU')
        self.assertEqual(lifecycle.next_occurrence(event, at(date(2026, 11, 30))), date(2026, 12, 27))

    def test_a_skipped_date_moves_to_the_next(self):
        event = self.make(recurrence_rrule='FREQ=WEEKLY;BYDAY=SU', recurrence_exdates=[str(D + timedelta(days=7))])
        self.assertEqual(lifecycle.next_occurrence(event, at(D + timedelta(days=1))), D + timedelta(days=14))

    def test_a_series_with_an_until_ends_after_its_last_date(self):
        event = self.make(recurrence_rrule='FREQ=WEEKLY;BYDAY=SU;UNTIL=20261129')
        self.assertEqual(event.ends_at, datetime(2026, 11, 30, tzinfo=IST))
        self.assertEqual(lifecycle.phase(event, at(date(2026, 11, 30), 1)), lifecycle.ENDED)
        self.assertIsNone(lifecycle.next_occurrence(event, at(date(2026, 11, 30), 1)))

    def test_a_series_across_a_daylight_saving_change_keeps_its_weekday(self):
        # US clocks go back on Sun 1 Nov 2026.
        event = self.make(date=date(2026, 10, 25), timezone='America/New_York', recurrence_rrule='FREQ=WEEKLY;BYDAY=SU')
        self.assertEqual(lifecycle.next_occurrence(event, datetime(2026, 10, 26, 12, tzinfo=dt_timezone.utc)), date(2026, 11, 1))
        self.assertEqual(lifecycle.next_occurrence(event, datetime(2026, 11, 2, 12, tzinfo=dt_timezone.utc)), date(2026, 11, 8))


class SettingsSingletonTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_saving_always_writes_row_one_and_clears_the_cache(self):
        self.assertFalse(EventLifecycleSettings.get_config()['enforce_link_off'])
        EventLifecycleSettings(pk=7, enforce_link_off=True).save()
        self.assertEqual(EventLifecycleSettings.objects.get().pk, 1)
        self.assertTrue(EventLifecycleSettings.get_config()['enforce_link_off'])

    def test_defaults_are_30_30_7_and_not_enforced(self):
        self.assertEqual(EventLifecycleSettings.get_config(), {
            'link_days_after_end': 30, 'catalog_days_after_end': 30, 'warn_days_before': 7, 'enforce_link_off': False,
        })
