"""
A sub-event's own Good to know: written by the host through the sub-event API,
read by guests on the invitation's carousel.
"""
from datetime import timedelta

from django.core.cache import cache
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.events.models import Event, InvitePage, SubEvent
from apps.users.models import User


class SubEventGoodToKnowTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.host = User.objects.create_user(email='gtk-host@test.com', name='GTK Host')
        self.client.force_authenticate(user=self.host)
        self.event = Event.objects.create(
            host=self.host, slug='gtk-wedding', title='GTK Wedding', is_public=True, event_structure='ENVELOPE',
        )
        self.start = timezone.now() + timedelta(days=30)

    def _create(self, good_to_know, title='Mehendi'):
        return self.client.post(
            f'/api/events/envelopes/{self.event.id}/sub-events/',
            {'title': title, 'start_at': self.start.isoformat(), 'is_public_visible': True, 'good_to_know': good_to_know},
            format='json',
        )

    def test_a_sub_event_keeps_its_own_answers(self):
        r = self._create([
            {'id': 'a', 'kind': 'dress', 'text': 'Wear yellow'},
            {'id': 'b', 'kind': 'parking', 'text': 'Valet', 'url': '  maps.app/x  '},
        ])
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)
        sub = SubEvent.objects.get(id=r.data['id'])
        self.assertEqual(sub.good_to_know, [
            {'id': 'a', 'kind': 'dress', 'text': 'Wear yellow'},
            {'id': 'b', 'kind': 'parking', 'text': 'Valet', 'url': 'maps.app/x'},
        ])

    def test_no_answers_is_an_empty_list(self):
        r = self._create([])
        self.assertEqual(r.status_code, status.HTTP_201_CREATED, r.data)
        self.assertEqual(SubEvent.objects.get(id=r.data['id']).good_to_know, [])

    def test_bad_answers_are_refused(self):
        for bad in (
            [{'id': 'a', 'kind': 'playlist', 'text': 'x'}],                                   # unknown kind
            [{'id': 'a', 'kind': 'dress', 'text': 'x'}, {'id': 'b', 'kind': 'dress', 'text': 'y'}],  # twice
            [{'id': 'a', 'kind': 'dress', 'text': 'x' * 301}],                                 # too long
            [{'kind': 'dress', 'text': 'x'}],                                                  # no id
            'wear yellow',                                                                     # not a list
        ):
            r = self._create(bad)
            self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST, bad)

    def test_editing_one_answer(self):
        sub_id = self._create([{'id': 'a', 'kind': 'dress', 'text': 'Wear yellow'}]).data['id']
        r = self.client.patch(
            f'/api/events/sub-events/{sub_id}/',
            {'good_to_know': [{'id': 'a', 'kind': 'dress', 'text': 'Wear green'}]},
            format='json',
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK, r.data)
        self.assertEqual(r.data['good_to_know'][0]['text'], 'Wear green')


class PublicInviteSubEventGoodToKnowTests(TestCase):
    """Guests get each sub-event's answers, without a query per sub-event."""

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        host = User.objects.create_user(email='gtk-public@test.com', name='Public Host')
        self.event = Event.objects.create(
            host=host, slug='gtk-public', title='Public', is_public=True, event_structure='ENVELOPE',
        )
        self.page = InvitePage.objects.create(event=self.event, slug=self.event.slug, is_published=True, config={'tiles': []})
        self.start = timezone.now() + timedelta(days=30)

    def _add(self, n):
        for i in range(n):
            SubEvent.objects.create(
                event=self.event, title=f'Function {i}', start_at=self.start + timedelta(hours=i),
                is_public_visible=True, good_to_know=[{'id': f'd{i}', 'kind': 'dress', 'text': f'Colour {i}'}],
            )
        self.event.public_sub_events_count = SubEvent.objects.filter(event=self.event, is_public_visible=True).count()
        self.event.save(update_fields=['public_sub_events_count'])
        cache.clear()

    def _sub_events(self):
        r = self.client.get(f'/api/events/invite/{self.page.slug}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        return r.data['allowed_sub_events']

    def test_each_sub_event_carries_its_answers(self):
        self._add(2)
        answers = [s['good_to_know'] for s in self._sub_events()]
        self.assertEqual(answers, [
            [{'id': 'd0', 'kind': 'dress', 'text': 'Colour 0'}],
            [{'id': 'd1', 'kind': 'dress', 'text': 'Colour 1'}],
        ])

    def test_answers_cost_no_query_per_sub_event(self):
        self._add(1)
        with CaptureQueriesContext(connection) as one:
            self._sub_events()
        self._add(3)
        with CaptureQueriesContext(connection) as four:
            self._sub_events()
        self.assertEqual(len(four), len(one))
