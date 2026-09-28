"""
Tests for the event access resolver.

These assert *denial* rather than access: the refactor moved permission checks
out of queryset filters, where they failed closed by accident, into one resolver
where they have to fail closed on purpose.
"""
from django.http import Http404
from django.test import TestCase
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.test import APIClient

from apps.users.models import User

from .access import (
    NO_ACCESS,
    ROLE_OWNER,
    get_event_or_404,
    require_event_access,
    resolve_event_access,
)
from .capabilities import ALL_CAPABILITIES, DELETE_EVENT, EDIT_RSVP, MANAGE_GUESTS
from .models import Event


class EventAccessResolverTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email='owner@test.com', name='Owner')
        self.stranger = User.objects.create_user(email='stranger@test.com', name='Stranger')
        self.event = Event.objects.create(host=self.owner, slug='resolver-event', title='Resolver Event')

    def test_owner_gets_every_capability(self):
        access = resolve_event_access(self.owner, self.event)
        self.assertEqual(access.role, ROLE_OWNER)
        self.assertTrue(access.is_owner)
        for capability in ALL_CAPABILITIES:
            self.assertTrue(access.can(capability), capability)
        # Owner-only actions are answered by role, never by stored capabilities.
        self.assertTrue(access.can(DELETE_EVENT))

    def test_stranger_gets_nothing(self):
        access = resolve_event_access(self.stranger, self.event)
        self.assertEqual(access, NO_ACCESS)
        self.assertFalse(access.has_access)
        self.assertFalse(access.can(MANAGE_GUESTS))

    def test_anonymous_gets_nothing(self):
        self.assertEqual(resolve_event_access(None, self.event), NO_ACCESS)

    def test_require_event_access_denies_stranger(self):
        with self.assertRaises(PermissionDenied):
            require_event_access(self.stranger, self.event)
        with self.assertRaises(PermissionDenied):
            require_event_access(None, self.event)

    def test_require_event_access_allows_owner_for_any_capability(self):
        self.assertTrue(require_event_access(self.owner, self.event, EDIT_RSVP).is_owner)

    def test_get_event_or_404_hides_existence_from_strangers(self):
        # A stranger and a missing event must be indistinguishable, which is what
        # the old `get_object_or_404(Event, id=..., host=request.user)` gave us.
        with self.assertRaises(Http404):
            get_event_or_404(self.stranger, self.event.id)
        with self.assertRaises(Http404):
            get_event_or_404(self.owner, self.event.id + 9999)
        self.assertEqual(get_event_or_404(self.owner, self.event.id), self.event)


class EventForUserQuerysetTests(TestCase):
    def setUp(self):
        self.a = User.objects.create_user(email='a@test.com', name='A')
        self.b = User.objects.create_user(email='b@test.com', name='B')
        self.a_event = Event.objects.create(host=self.a, slug='a-event', title='A Event')
        self.b_event = Event.objects.create(host=self.b, slug='b-event', title='B Event')

    def test_for_user_returns_only_your_events(self):
        self.assertEqual(list(Event.objects.for_user(self.a)), [self.a_event])
        self.assertEqual(list(Event.objects.for_user(self.b)), [self.b_event])

    def test_for_user_is_empty_for_anonymous(self):
        self.assertEqual(list(Event.objects.for_user(None)), [])

    def test_for_user_matches_host_filter_when_there_are_no_cohosts(self):
        # The regression guard for this refactor: until collaborators exist,
        # "events I can work on" must be exactly "events I own".
        for user in (self.a, self.b):
            self.assertEqual(
                set(Event.objects.for_user(user).values_list('id', flat=True)),
                set(Event.objects.filter(host=user).values_list('id', flat=True)),
            )


class EventAccessStatusCodeTests(TestCase):
    """The two failure codes in use before the refactor must stay as they were."""

    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(email='code-owner@test.com', name='Owner')
        self.stranger = User.objects.create_user(email='code-stranger@test.com', name='Stranger')
        self.event = Event.objects.create(host=self.owner, slug='code-event', title='Code Event')

    def test_viewset_detail_route_denies_with_404(self):
        # Queryset scoping rejects a stranger before the explicit capability
        # check is reached, so detail routes answer 404 rather than the 403 the
        # helper raises. That was true before this refactor and is asserted here
        # so the contract cannot drift silently.
        self.client.force_authenticate(user=self.stranger)
        response = self.client.get(f'/api/events/{self.event.id}/guests/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_standalone_view_denies_with_404(self):
        self.client.force_authenticate(user=self.stranger)
        response = self.client.get(f'/api/events/{self.event.id}/booking-schedule/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_owner_still_reaches_their_event(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.get(f'/api/events/{self.event.id}/guests/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
