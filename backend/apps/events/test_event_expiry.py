"""An event is over once its last day has passed - not its first. The full rule: test_lifecycle.py."""
from datetime import date, timedelta

from django.test import TestCase

from apps.events.models import Event


class EventExpiryTests(TestCase):
    def test_a_one_day_event_expires_after_its_date(self):
        self.assertTrue(Event(date=date.today() - timedelta(days=1)).is_expired)
        self.assertFalse(Event(date=date.today()).is_expired)

    def test_a_multi_day_event_is_not_over_on_day_two(self):
        event = Event(date=date.today() - timedelta(days=1), event_end_date=date.today() + timedelta(days=1))
        self.assertFalse(event.is_expired)

    def test_a_multi_day_event_expires_after_its_last_day(self):
        event = Event(date=date.today() - timedelta(days=3), event_end_date=date.today() - timedelta(days=1))
        self.assertTrue(event.is_expired)

    def test_no_date_never_expires(self):
        self.assertFalse(Event().is_expired)


class LastDayApiTests(TestCase):
    def setUp(self):
        from rest_framework.test import APIClient
        from apps.users.models import User

        self.client = APIClient()
        self.client.force_authenticate(user=User.objects.create_user(email='lastday@test.com', name='Host'))

    def test_creating_several_events_keeps_the_last_day(self):
        r = self.client.post('/api/events/', {
            'title': 'Three days', 'event_type': 'wedding', 'date': '2026-12-11', 'event_end_date': '2026-12-13',
        }, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(str(Event.objects.get(id=r.data['id']).event_end_date), '2026-12-13')

    def test_a_last_day_before_the_first_is_refused(self):
        r = self.client.post('/api/events/', {
            'title': 'Backwards', 'event_type': 'wedding', 'date': '2026-12-11', 'event_end_date': '2026-12-10',
        }, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertIn('event_end_date', r.data)
