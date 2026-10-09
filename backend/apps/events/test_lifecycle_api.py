"""The lifecycle as hosts and staff reach it: serializers, host controls, impact, admin analytics."""
from datetime import date, timedelta

from django.core.cache import cache
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIClient

from apps.events.capabilities import EDIT_CATALOG, MANAGE_GUESTS
from apps.events.models import Event, EventLifecycleOverride, SubEvent
from apps.events.test_cohosts import accepted_cohost
from apps.users.models import User


class HostLifecycleApiTests(TestCase):
    def setUp(self):
        cache.clear()
        self.owner = User.objects.create_user(email='lc-owner@test.com', name='Owner')
        self.event = Event.objects.create(host=self.owner, slug='lc-event', title='Party',
                                          date=date.today() - timedelta(days=2))
        self.client = APIClient()
        self.client.force_authenticate(user=self.owner)

    def post(self, path, data=None, user=None):
        if user:
            self.client.force_authenticate(user=user)
        return self.client.post(f'/api/events/{self.event.id}/{path}/', data or {}, format='json')

    def test_detail_and_list_carry_the_lifecycle(self):
        detail = self.client.get(f'/api/events/{self.event.id}/').data
        self.assertEqual(detail['lifecycle']['phase'], 'ended')
        self.assertTrue(detail['lifecycle']['catalog_open'])
        self.assertFalse(detail['lifecycle']['rsvp_open'])
        listed = self.client.get('/api/events/').data
        rows = listed['results'] if isinstance(listed, dict) else listed
        self.assertEqual(rows[0]['lifecycle']['phase'], 'ended')
        self.assertNotIn('expiry_date', rows[0])

    def test_the_list_costs_no_query_per_event_for_sub_events(self):
        def list_queries():
            self.client.get('/api/events/')  # warm caches
            with CaptureQueriesContext(connection) as queries:
                self.client.get('/api/events/')
            return len(queries.captured_queries)

        def add(n):
            event = Event.objects.create(host=self.owner, slug=f'lc-many-{n}', title='E', date=date.today())
            SubEvent.objects.create(event=event, title='S', start_at=timezone.now() + timedelta(days=3))

        add(0)
        one = list_queries()
        for n in range(1, 5):
            add(n)
        self.assertEqual(list_queries(), one)

    def test_expiry_date_can_no_longer_be_written(self):
        self.client.patch(f'/api/events/{self.event.id}/', {'expiry_date': '2030-01-01'}, format='json')
        self.event.refresh_from_db()
        self.assertIsNone(self.event.expiry_date)

    def test_close_and_reopen_gifts_are_audited(self):
        closed = self.post('close-catalog', {'reason': 'Done'})
        self.assertEqual(closed.status_code, 200, closed.data)
        self.assertFalse(closed.data['lifecycle']['catalog_open'])
        self.assertTrue(closed.data['lifecycle']['can_reopen_catalog'])
        reopened = self.post('reopen-catalog')
        self.assertTrue(reopened.data['lifecycle']['catalog_open'])
        self.assertEqual(list(EventLifecycleOverride.objects.order_by('at').values_list('action', flat=True)),
                         ['close_catalog', 'reopen_catalog'])
        self.assertEqual(EventLifecycleOverride.objects.first().by, self.owner)

    def test_reopening_never_stretches_the_window(self):
        Event.objects.filter(pk=self.event.pk).update(date=date.today() - timedelta(days=60),
                                                      catalog_closed_at=timezone.now() - timedelta(days=50))
        Event.objects.get(pk=self.event.pk).save()  # re-store ends_at
        response = self.post('reopen-catalog')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['code'], 'CATALOG_WINDOW_OVER')

    def test_a_cohost_needs_the_catalog_capability_to_close_gifts(self):
        without = User.objects.create_user(email='lc-co1@test.com', name='Co')
        accepted_cohost(self.event, without, [MANAGE_GUESTS])
        self.assertEqual(self.post('close-catalog', user=without).status_code, 403)
        with_cap = User.objects.create_user(email='lc-co2@test.com', name='Co2')
        accepted_cohost(self.event, with_cap, [EDIT_CATALOG])
        self.assertEqual(self.post('close-catalog', user=with_cap).status_code, 200)

    def test_cancel_and_restore(self):
        Event.objects.filter(pk=self.event.pk).update(date=date.today() + timedelta(days=10))
        cancelled = self.post('cancel', {'note': 'Moving to spring'})
        self.assertEqual(cancelled.data['lifecycle']['phase'], 'cancelled')
        self.assertEqual(cancelled.data['lifecycle']['cancelled_note'], 'Moving to spring')
        self.assertFalse(cancelled.data['lifecycle']['rsvp_open'])
        restored = self.post('uncancel')
        self.assertEqual(restored.data['lifecycle']['phase'], 'upcoming')
        self.assertEqual(EventLifecycleOverride.objects.filter(action__in=['cancel', 'uncancel']).count(), 2)

    def test_only_the_owner_can_cancel(self):
        cohost = User.objects.create_user(email='lc-co3@test.com', name='Co')
        accepted_cohost(self.event, cohost)
        self.assertEqual(self.post('cancel', user=cohost).status_code, 403)

    def test_impact_follows_the_lifecycle(self):
        self.assertTrue(self.client.get(f'/api/events/{self.event.id}/impact/').data['is_expired'])
        Event.objects.filter(pk=self.event.pk).update(date=date.today() + timedelta(days=3))
        Event.objects.get(pk=self.event.pk).save()
        self.assertFalse(self.client.get(f'/api/events/{self.event.id}/impact/').data['is_expired'])

    def test_staff_extend_endpoint_is_gone(self):
        staff = User.objects.create_user(email='lc-staff@test.com', name='Staff')
        staff.is_staff = True
        staff.save()
        self.client.force_authenticate(user=staff)
        response = self.client.post('/api/auth/staff/extend-event-expiry/', {'event_slug': 'lc-event', 'extend_days': 5})
        self.assertEqual(response.status_code, 404)
