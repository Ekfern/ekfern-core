"""
The guest-facing boundary: every public endpoint passes the lifecycle gate
(apps/events/public_access.py), and the gate answers the way guests need.
"""
from datetime import date, timedelta

from django.core.cache import cache
from django.test import SimpleTestCase, TestCase
from django.urls import URLPattern, URLResolver, get_resolver
from django.utils import timezone
from rest_framework.permissions import AllowAny
from rest_framework.test import APIClient

from apps.catalog.tests import make_catalog, make_item
from apps.events import public_access
from apps.events.models import Event, EventLifecycleSettings, InvitePage
from apps.users.models import User


def _walk(patterns, prefix=''):
    for pattern in patterns:
        if isinstance(pattern, URLResolver):
            yield from _walk(pattern.url_patterns, prefix + str(pattern.pattern))
        elif isinstance(pattern, URLPattern):
            yield prefix + str(pattern.pattern), pattern.callback


class EveryPublicEndpointIsGuardedTests(SimpleTestCase):
    """A new AllowAny view must say what it needs, or why it needs nothing."""

    def test_no_public_view_skips_the_gate(self):
        unmarked = []
        for route, callback in _walk(get_resolver().url_patterns):
            view = getattr(callback, 'cls', None) or getattr(callback, 'view_class', None)
            if view is None:
                continue
            if not any(p is AllowAny for p in getattr(view, 'permission_classes', [])):
                continue
            marked = any(
                getattr(target, attr, None)
                for target in (callback, view)
                for attr in (public_access.MARK, public_access.EXEMPT_MARK)
            )
            if not marked:
                unmarked.append(f'{route} -> {view.__name__}')
        self.assertEqual(unmarked, [], 'Mark these with @guest_endpoint(NEED) or @not_guest_endpoint(why).')

    def test_the_known_guest_endpoints_are_guarded_for_what_they_do(self):
        needs = {}
        for route, callback in _walk(get_resolver().url_patterns):
            view = getattr(callback, 'cls', None) or getattr(callback, 'view_class', None)
            need = getattr(callback, public_access.MARK, None) or getattr(view, public_access.MARK, None)
            if need:
                needs[getattr(view, '__name__', route)] = need
        self.assertEqual(needs.get('PublicInviteViewSet'), public_access.READ)
        self.assertEqual(needs.get('CatalogRespondView'), public_access.CATALOG)


class GateBehaviourTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.host = User.objects.create_user(email='gate-host@test.com', name='Host')
        self.event = Event.objects.create(host=self.host, slug='gate-event', title='Gate', is_public=True,
                                          has_rsvp=True, date=date.today() + timedelta(days=5))
        InvitePage.objects.create(event=self.event, slug=self.event.slug, is_published=True,
                                  config={'tiles': []}, published_config={'tiles': []})

    def set_date(self, day):
        self.event.date = day
        self.event.save()

    def archive(self):
        EventLifecycleSettings.objects.update_or_create(pk=1, defaults={'enforce_link_off': True})
        cache.clear()
        long_ago = date.today() - timedelta(days=120)
        self.event.date = long_ago
        self.event.host_warned_link_off_at = timezone.now() - timedelta(days=60)
        self.event.save()

    def rsvp(self):
        return self.client.post(f'/api/events/{self.event.id}/rsvp/', {
            'name': 'Asha', 'phone': '+919800000001', 'will_attend': 'yes', 'guests_count': 1,
        }, format='json')

    def test_rsvp_is_accepted_before_the_end(self):
        self.assertIn(self.rsvp().status_code, (200, 201))

    def test_rsvp_after_the_end_is_refused_with_a_code(self):
        self.set_date(date.today() - timedelta(days=2))
        response = self.rsvp()
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['code'], 'RSVP_CLOSED')
        self.assertEqual(response.data['lifecycle']['phase'], 'ended')
        self.assertIn('no-store', response['Cache-Control'])

    def test_rsvp_to_a_cancelled_event_says_so(self):
        self.event.cancelled_at = timezone.now()
        self.event.save()
        self.assertEqual(self.rsvp().data['code'], 'EVENT_CANCELLED')

    def test_rsvp_config_carries_the_lifecycle(self):
        self.set_date(date.today() - timedelta(days=2))
        lifecycle = self.client.get(f'/api/events/invite/{self.event.slug}/rsvp-config/').data['lifecycle']
        self.assertFalse(lifecycle['rsvp_open'])
        self.assertTrue(lifecycle['catalog_open'])

    def test_an_archived_event_is_gone_everywhere(self):
        self.archive()
        config = self.client.get(f'/api/events/invite/{self.event.slug}/rsvp-config/')
        self.assertEqual(config.status_code, 410)
        self.assertEqual(config.data['code'], 'EVENT_ARCHIVED')
        self.assertEqual(self.rsvp().status_code, 410)

    def test_the_archived_invite_wins_over_a_warm_cache(self):
        first = self.client.get(f'/api/events/invite/{self.event.slug}/')
        self.assertNotEqual(first.data.get('status'), 'archived')
        self.client.get(f'/api/events/invite/{self.event.slug}/')  # now cached
        self.archive()
        cache_survivor = EventLifecycleSettings.get_config()  # settings row re-read, invite cache untouched
        self.assertTrue(cache_survivor['enforce_link_off'])
        response = self.client.get(f'/api/events/invite/{self.event.slug}/')
        self.assertEqual(response.data['status'], 'archived')
        self.assertNotIn('title', response.data)
        self.assertIn('no-store', response['Cache-Control'])

    def test_preview_does_not_unlock_an_archived_invite_for_strangers(self):
        self.archive()
        response = self.client.get(f'/api/events/invite/{self.event.slug}/?preview=true')
        self.assertEqual(response.data['status'], 'archived')

    def test_the_host_can_still_preview_an_archived_invite(self):
        self.archive()
        self.client.force_authenticate(user=self.host)
        response = self.client.get(f'/api/events/invite/{self.event.slug}/?preview=true')
        self.assertNotEqual(response.data.get('status'), 'archived')

    def test_without_enforcement_nothing_is_archived(self):
        self.archive()
        EventLifecycleSettings.objects.filter(pk=1).update(enforce_link_off=False)
        cache.clear()
        response = self.client.get(f'/api/events/invite/{self.event.slug}/rsvp-config/')
        self.assertEqual(response.status_code, 200)


class CatalogGateTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        host = User.objects.create_user(email='gate-cat@test.com', name='Host')
        self.event = Event.objects.create(host=host, slug='gate-cat', title='Cat', is_public=True,
                                          has_registry=True, date=date.today() - timedelta(days=2))
        self.item = make_item(make_catalog(self.event), action_type='interest')

    def respond(self):
        return self.client.post(f'/api/catalog/{self.event.slug}/respond/', {
            'catalog_item_id': self.item.id, 'response_type': 'interest',
            'name': 'Ravi', 'phone': '+919800000002',
        }, format='json')

    def test_gifts_stay_open_after_the_event(self):
        self.assertEqual(self.respond().status_code, 201)

    def test_closed_gifts_refuse_new_responses_but_the_list_stays_readable(self):
        self.event.catalog_closed_at = timezone.now()
        self.event.save()
        refused = self.respond()
        self.assertEqual(refused.status_code, 409)
        self.assertEqual(refused.data['code'], 'CATALOG_CLOSED')
        page = self.client.get(f'/api/catalog/{self.event.slug}/')
        self.assertEqual(page.status_code, 200)
        self.assertFalse(page.data['lifecycle']['catalog_open'])
        self.assertEqual(len(page.data['items']), 1)


class InviteCacheLifecycleTests(TestCase):
    """No cache layer may serve the invite past its next lifecycle change."""

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        host = User.objects.create_user(email='cache-host@test.com', name='Host')
        self.event = Event.objects.create(host=host, slug='cache-event', title='Cache', is_public=True,
                                          date=date.today() + timedelta(days=10))
        InvitePage.objects.create(event=self.event, slug=self.event.slug, is_published=True,
                                  published_at=timezone.now(), config={'tiles': []}, published_config={'tiles': []})

    def get(self):
        return self.client.get(f'/api/events/invite/{self.event.slug}/')

    def test_the_payload_says_where_the_event_is_and_until_when(self):
        lifecycle = self.get().data['lifecycle']
        self.assertEqual(lifecycle['phase'], 'upcoming')
        self.assertIsNotNone(lifecycle['valid_until'])
        self.assertNotIn('cancel_note', lifecycle)  # host-only fields stay off the guest payload

    def test_far_from_a_change_the_usual_headers_apply(self):
        self.assertIn('s-maxage=300, stale-while-revalidate=3600', self.get()['Cache-Control'])

    def test_close_to_a_change_the_headers_shrink_to_fit(self):
        from apps.events.views import _guest_cache_control
        now = timezone.now()
        payload = {'lifecycle': {'valid_until': (now + timedelta(minutes=20)).isoformat()}}
        self.assertEqual(_guest_cache_control(payload, now),
                         'public, s-maxage=300, stale-while-revalidate=900, max-age=60')
        payload = {'lifecycle': {'valid_until': (now + timedelta(seconds=150)).isoformat()}}
        self.assertEqual(_guest_cache_control(payload, now),
                         'public, s-maxage=150, stale-while-revalidate=0, max-age=60')
        payload = {'lifecycle': {'valid_until': (now + timedelta(seconds=30)).isoformat()}}
        self.assertIn('no-store', _guest_cache_control(payload, now))

    def test_a_cached_copy_is_dropped_once_its_moment_passes(self):
        from unittest import mock
        self.get()  # cached as upcoming
        later = timezone.now() + timedelta(days=12)
        with mock.patch('django.utils.timezone.now', return_value=later):
            response = self.get()
        self.assertEqual(response.data['lifecycle']['phase'], 'ended')

    def test_status_is_never_cached(self):
        response = self.client.get(f'/api/events/invite/{self.event.slug}/status/')
        self.assertEqual(response.data['lifecycle']['phase'], 'upcoming')
        self.assertIn('no-store', response['Cache-Control'])
