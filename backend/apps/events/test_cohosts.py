"""Co-host membership: resolution, invitation, acceptance and removal."""
from django.core.exceptions import ValidationError
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.users.models import User

from .access import ROLE_COHOST, ROLE_OWNER, resolve_event_access
from .capabilities import (
    ALL_CAPABILITIES,
    ALL_NOTIFICATIONS,
    DELETE_EVENT,
    NOTIFY_CATALOG_RESPONSE,
    NOTIFY_RSVP_NEW,
    MAX_COHOSTS_PER_EVENT,
    EDIT_INVITATION,
    MANAGE_COHOSTS,
    MANAGE_GUESTS,
    SEND_MESSAGES,
)
from .cohost_views import issue_invite_token
from .models import Event, EventCoHost
from .recipients import notification_recipients


def accepted_cohost(event, user, capabilities=None):
    return EventCoHost.objects.create(
        event=event,
        user=user,
        invited_email=user.email,
        status=EventCoHost.STATUS_ACCEPTED,
        capabilities=capabilities if capabilities is not None else [MANAGE_GUESTS],
    )


class CoHostResolutionTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email='owner@test.com', name='Owner')
        self.cohost = User.objects.create_user(email='cohost@test.com', name='Co')
        self.event = Event.objects.create(host=self.owner, slug='ch-event', title='CH Event')

    def test_accepted_cohost_gets_only_granted_capabilities(self):
        accepted_cohost(self.event, self.cohost, [MANAGE_GUESTS, EDIT_INVITATION])
        access = resolve_event_access(self.cohost, self.event)
        self.assertEqual(access.role, ROLE_COHOST)
        self.assertTrue(access.can(MANAGE_GUESTS))
        self.assertTrue(access.can(EDIT_INVITATION))
        self.assertFalse(access.can(SEND_MESSAGES))

    def test_cohost_never_gets_owner_only_actions(self):
        # Even if the stored row somehow names them, they are not grantable.
        accepted_cohost(self.event, self.cohost, [MANAGE_GUESTS, DELETE_EVENT, MANAGE_COHOSTS])
        access = resolve_event_access(self.cohost, self.event)
        self.assertFalse(access.can(DELETE_EVENT))
        self.assertFalse(access.can(MANAGE_COHOSTS))

    def test_status_is_the_gate_not_the_user_link(self):
        row = EventCoHost.objects.create(
            event=self.event, user=self.cohost, invited_email=self.cohost.email,
            status=EventCoHost.STATUS_PENDING, capabilities=[MANAGE_GUESTS],
        )
        for blocked in (
            EventCoHost.STATUS_PENDING,
            EventCoHost.STATUS_DECLINED,
            EventCoHost.STATUS_REVOKED,
            EventCoHost.STATUS_LEFT,
        ):
            row.status = blocked
            row.save(update_fields=['status'])
            self.assertFalse(
                resolve_event_access(self.cohost, self.event).has_access, blocked
            )

    def test_owner_still_outranks_everything(self):
        self.assertEqual(resolve_event_access(self.owner, self.event).role, ROLE_OWNER)

    def test_owner_cannot_also_be_a_cohost(self):
        row = EventCoHost(event=self.event, user=self.owner, invited_email=self.owner.email)
        with self.assertRaises(ValidationError):
            row.full_clean(exclude=['accepted_at'])

    def test_invited_email_is_stored_canonically(self):
        row = EventCoHost.objects.create(
            event=self.event, user=None, invited_email='  MiXeD@Example.COM ',
        )
        self.assertEqual(row.invited_email, 'mixed@example.com')


class CoHostQuerysetTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email='q-owner@test.com', name='Owner')
        self.cohost = User.objects.create_user(email='q-cohost@test.com', name='Co')
        self.owned = Event.objects.create(host=self.owner, slug='q-owned', title='Owned')
        self.shared = Event.objects.create(host=self.owner, slug='q-shared', title='Shared')
        accepted_cohost(self.shared, self.cohost)

    def test_for_user_includes_accepted_cohosted_events(self):
        self.assertEqual(list(Event.objects.for_user(self.cohost)), [self.shared])

    def test_for_user_excludes_pending_cohosted_events(self):
        other = Event.objects.create(host=self.owner, slug='q-pending', title='Pending')
        EventCoHost.objects.create(
            event=other, user=self.cohost, invited_email=self.cohost.email,
            status=EventCoHost.STATUS_PENDING,
        )
        self.assertNotIn(other, Event.objects.for_user(self.cohost))

    def test_owner_sees_their_events_once(self):
        # The join can duplicate rows; distinct() is what stops the dashboard
        # showing the same event twice.
        accepted_cohost(self.owned, User.objects.create_user(email='q-x@test.com', name='X'))
        ids = list(Event.objects.for_user(self.owner).values_list('id', flat=True))
        self.assertEqual(sorted(ids), sorted({self.owned.id, self.shared.id}))
        self.assertEqual(len(ids), len(set(ids)))


class CoHostInviteFlowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(email='i-owner@test.com', name='Owner')
        self.invitee = User.objects.create_user(email='i-invitee@test.com', name='Invitee')
        self.other = User.objects.create_user(email='i-other@test.com', name='Other')
        self.event = Event.objects.create(host=self.owner, slug='i-event', title='Invite Event')
        self.url = f'/api/events/{self.event.id}/cohosts/'

    def invite(self, email):
        self.client.force_authenticate(user=self.owner)
        return self.client.post(self.url, {'email': email}, format='json')

    def test_owner_can_invite_and_defaults_are_stored(self):
        response = self.invite('  NEW@Example.com ')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        row = EventCoHost.objects.get(event=self.event)
        self.assertEqual(row.invited_email, 'new@example.com')
        self.assertEqual(row.status, EventCoHost.STATUS_PENDING)
        self.assertTrue(row.capabilities)

    def test_existing_account_is_linked_but_still_pending(self):
        self.invite(self.invitee.email)
        row = EventCoHost.objects.get(event=self.event)
        self.assertEqual(row.user_id, self.invitee.id)
        self.assertEqual(row.status, EventCoHost.STATUS_PENDING)
        self.assertFalse(resolve_event_access(self.invitee, self.event).has_access)

    def test_duplicate_active_invite_is_rejected(self):
        self.assertEqual(self.invite('dupe@test.com').status_code, status.HTTP_201_CREATED)
        self.assertEqual(self.invite('DUPE@test.com').status_code, status.HTTP_409_CONFLICT)

    def test_cannot_invite_the_owner(self):
        self.assertEqual(self.invite(self.owner.email).status_code, status.HTTP_400_BAD_REQUEST)

    def test_invalid_email_rejected(self):
        self.assertEqual(self.invite('not-an-email').status_code, status.HTTP_400_BAD_REQUEST)

    def test_cohost_cannot_invite_another_cohost(self):
        accepted_cohost(self.event, self.invitee)
        self.client.force_authenticate(user=self.invitee)
        response = self.client.post(self.url, {'email': 'x@test.com'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_stranger_cannot_list_cohosts(self):
        self.client.force_authenticate(user=self.other)
        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_404_NOT_FOUND)


class CoHostAcceptanceTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(email='a-owner@test.com', name='Owner')
        self.invitee = User.objects.create_user(email='a-invitee@test.com', name='Invitee')
        self.other = User.objects.create_user(email='a-other@test.com', name='Other')
        self.event = Event.objects.create(host=self.owner, slug='a-event', title='Accept Event')
        self.row = EventCoHost.objects.create(
            event=self.event, user=None, invited_email=self.invitee.email,
            capabilities=[MANAGE_GUESTS],
        )
        self.token = issue_invite_token(self.row)

    def accept(self, user, **body):
        self.client.force_authenticate(user=user)
        return self.client.post(
            f'/api/events/cohost-invites/{self.token}/accept/', body, format='json'
        )

    def test_acceptance_grants_access(self):
        response = self.accept(self.invitee, policy_accepted=True)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.row.refresh_from_db()
        self.assertEqual(self.row.status, EventCoHost.STATUS_ACCEPTED)
        self.assertEqual(self.row.user_id, self.invitee.id)
        self.assertIsNotNone(self.row.accepted_at)
        self.assertTrue(resolve_event_access(self.invitee, self.event).can(MANAGE_GUESTS))

    def test_wrong_email_cannot_accept(self):
        # A forwarded invite link must not work for whoever holds it.
        response = self.accept(self.other, policy_accepted=True)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.row.refresh_from_db()
        self.assertEqual(self.row.status, EventCoHost.STATUS_PENDING)
        self.assertFalse(resolve_event_access(self.other, self.event).has_access)

    def test_policy_checkbox_is_required(self):
        response = self.accept(self.invitee)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.row.refresh_from_db()
        self.assertEqual(self.row.status, EventCoHost.STATUS_PENDING)

    def test_revoked_invite_cannot_be_accepted(self):
        self.row.status = EventCoHost.STATUS_REVOKED
        self.row.save(update_fields=['status'])
        self.assertEqual(
            self.accept(self.invitee, policy_accepted=True).status_code,
            status.HTTP_409_CONFLICT,
        )

    def test_garbage_token_is_not_found(self):
        self.client.force_authenticate(user=self.invitee)
        response = self.client.post(
            '/api/events/cohost-invites/not-a-real-token/accept/',
            {'policy_accepted': True}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_invite_detail_is_readable_before_signup(self):
        self.client.force_authenticate(user=None)
        response = self.client.get(f'/api/events/cohost-invites/{self.token}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()['invited_email'], self.invitee.email)
        self.assertEqual(response.json()['event']['title'], 'Accept Event')

    def test_decline(self):
        self.client.force_authenticate(user=self.invitee)
        response = self.client.post(f'/api/events/cohost-invites/{self.token}/decline/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.row.refresh_from_db()
        self.assertEqual(self.row.status, EventCoHost.STATUS_DECLINED)
        self.assertFalse(resolve_event_access(self.invitee, self.event).has_access)


class CoHostRemovalTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(email='r-owner@test.com', name='Owner')
        self.cohost = User.objects.create_user(email='r-cohost@test.com', name='Co')
        self.event = Event.objects.create(host=self.owner, slug='r-event', title='Remove Event')
        self.row = accepted_cohost(self.event, self.cohost)

    def test_owner_revokes_and_access_stops_immediately(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.delete(
            f'/api/events/{self.event.id}/cohosts/{self.row.id}/'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.row.refresh_from_db()
        self.assertEqual(self.row.status, EventCoHost.STATUS_REVOKED)
        self.assertFalse(resolve_event_access(self.cohost, self.event).has_access)

    def test_cohost_can_leave(self):
        self.client.force_authenticate(user=self.cohost)
        response = self.client.post(f'/api/events/{self.event.id}/cohosts/leave/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.row.refresh_from_db()
        self.assertEqual(self.row.status, EventCoHost.STATUS_LEFT)
        self.assertFalse(resolve_event_access(self.cohost, self.event).has_access)

    def test_cohost_cannot_revoke_anyone(self):
        self.client.force_authenticate(user=self.cohost)
        response = self.client.delete(
            f'/api/events/{self.event.id}/cohosts/{self.row.id}/'
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class CoHostEndToEndAccessTests(TestCase):
    """What a co-host can actually reach through the API."""

    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(email='e-owner@test.com', name='Owner')
        self.cohost = User.objects.create_user(email='e-cohost@test.com', name='Co')
        self.event = Event.objects.create(host=self.owner, slug='e-event', title='E2E Event')

    def test_guest_list_follows_the_capability(self):
        url = f'/api/events/{self.event.id}/guests/'
        self.client.force_authenticate(user=self.cohost)
        self.assertEqual(self.client.get(url).status_code, status.HTTP_404_NOT_FOUND)

        row = accepted_cohost(self.event, self.cohost, [MANAGE_GUESTS])
        self.assertEqual(self.client.get(url).status_code, status.HTTP_200_OK)

        row.status = EventCoHost.STATUS_REVOKED
        row.save(update_fields=['status'])
        self.assertEqual(self.client.get(url).status_code, status.HTTP_404_NOT_FOUND)

    def test_cohost_event_list_shows_shared_event(self):
        accepted_cohost(self.event, self.cohost)
        self.client.force_authenticate(user=self.cohost)
        response = self.client.get('/api/events/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        rows = body['results'] if isinstance(body, dict) else body
        self.assertEqual([r['id'] for r in rows], [self.event.id])


class CoHostDefaultViewSetActionTests(TestCase):
    """
    The default ModelViewSet actions, which have no explicit ownership check of
    their own and are reached only through get_object().

    A co-host deleted an event through this path during end-to-end testing: the
    access check passed and no capability was required, so "delete is owner-only"
    was true in the resolver and false in practice.
    """

    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(email='v-owner@test.com', name='Owner')
        self.cohost = User.objects.create_user(email='v-cohost@test.com', name='Co')
        self.event = Event.objects.create(host=self.owner, slug='v-event', title='VS Event')
        accepted_cohost(
            self.event, self.cohost,
            [MANAGE_GUESTS, EDIT_INVITATION, SEND_MESSAGES],
        )
        self.url = f'/api/events/{self.event.id}/'

    def test_cohost_cannot_delete_the_event(self):
        self.client.force_authenticate(user=self.cohost)
        response = self.client.delete(self.url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Event.objects.filter(id=self.event.id).exists())

    def test_owner_can_delete_the_event(self):
        self.client.force_authenticate(user=self.owner)
        self.assertEqual(self.client.delete(self.url).status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Event.objects.filter(id=self.event.id).exists())

    def test_cohost_can_read_the_event(self):
        self.client.force_authenticate(user=self.cohost)
        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_200_OK)

    def test_cohost_with_edit_invitation_can_update(self):
        self.client.force_authenticate(user=self.cohost)
        response = self.client.patch(self.url, {'title': 'Renamed'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.event.refresh_from_db()
        self.assertEqual(self.event.title, 'Renamed')

    def test_cohost_without_edit_invitation_cannot_update(self):
        EventCoHost.objects.filter(event=self.event, user=self.cohost).update(
            capabilities=[MANAGE_GUESTS]
        )
        self.client.force_authenticate(user=self.cohost)
        response = self.client.patch(self.url, {'title': 'Nope'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.event.refresh_from_db()
        self.assertEqual(self.event.title, 'VS Event')

    def test_stranger_cannot_touch_the_event(self):
        stranger = User.objects.create_user(email='v-stranger@test.com', name='S')
        self.client.force_authenticate(user=stranger)
        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.client.delete(self.url).status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(Event.objects.filter(id=self.event.id).exists())


class CoHostLimitTests(TestCase):
    """At most MAX_COHOSTS_PER_EVENT people may hold access to one event."""

    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(email='l-owner@test.com', name='Owner')
        self.event = Event.objects.create(host=self.owner, slug='l-event', title='Limit Event')
        self.url = f'/api/events/{self.event.id}/cohosts/'
        self.client.force_authenticate(user=self.owner)

    def invite(self, email):
        return self.client.post(self.url, {'email': email}, format='json')

    def fill_to_limit(self, status_value=EventCoHost.STATUS_PENDING):
        for i in range(MAX_COHOSTS_PER_EVENT):
            EventCoHost.objects.create(
                event=self.event, invited_email=f'filler{i}@test.com', status=status_value,
            )

    def test_invites_are_refused_at_the_limit(self):
        self.fill_to_limit()
        response = self.invite('one-too-many@test.com')
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertIn(str(MAX_COHOSTS_PER_EVENT), response.json()['error'])

    def test_accepted_cohosts_count_towards_the_limit(self):
        self.fill_to_limit(EventCoHost.STATUS_ACCEPTED)
        self.assertEqual(self.invite('nope@test.com').status_code, status.HTTP_409_CONFLICT)

    def test_declined_and_revoked_invites_free_a_slot(self):
        # The limit is on who can hold access, not on how many times you may ask.
        self.fill_to_limit()
        EventCoHost.objects.filter(invited_email='filler0@test.com').update(
            status=EventCoHost.STATUS_DECLINED
        )
        self.assertEqual(self.invite('replacement@test.com').status_code, status.HTTP_201_CREATED)

    def test_duplicate_at_the_limit_says_duplicate_not_limit(self):
        # "Remove someone to add another" is wrong advice when the person is
        # already on the list, so the more specific message has to win.
        self.fill_to_limit()
        response = self.invite('filler0@test.com')
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertIn('already has a pending', response.json()['error'])

    def test_up_to_the_limit_is_allowed(self):
        for i in range(MAX_COHOSTS_PER_EVENT):
            self.assertEqual(
                self.invite(f'ok{i}@test.com').status_code,
                status.HTTP_201_CREATED,
                f'invite {i + 1} should be allowed',
            )


class CoHostSettingsUpdateTests(TestCase):
    """The owner changes what a co-host may do and which emails they get."""

    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(email='u-owner@test.com', name='Owner')
        self.cohost = User.objects.create_user(email='u-cohost@test.com', name='Co')
        self.event = Event.objects.create(host=self.owner, slug='u-event', title='Update Event')
        self.row = accepted_cohost(self.event, self.cohost, [MANAGE_GUESTS, SEND_MESSAGES])
        self.url = f'/api/events/{self.event.id}/cohosts/{self.row.id}/'
        self.client.force_authenticate(user=self.owner)

    def test_owner_turns_a_capability_off_and_it_is_enforced(self):
        response = self.client.patch(self.url, {'capabilities': [MANAGE_GUESTS]}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['capabilities'], [MANAGE_GUESTS])
        access = resolve_event_access(self.cohost, self.event)
        self.assertTrue(access.can(MANAGE_GUESTS))
        self.assertFalse(access.can(SEND_MESSAGES))

    def test_unknown_and_owner_only_names_are_dropped(self):
        response = self.client.patch(
            self.url,
            {'capabilities': [EDIT_INVITATION, DELETE_EVENT, 'bogus'], 'notifications': [NOTIFY_RSVP_NEW, 'bogus']},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['capabilities'], [EDIT_INVITATION])
        self.assertEqual(response.data['notifications'], [NOTIFY_RSVP_NEW])

    def test_every_capability_can_be_turned_off(self):
        response = self.client.patch(self.url, {'capabilities': []}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['capabilities'], [])
        # Still a co-host who can see the event, just not change it.
        self.assertTrue(resolve_event_access(self.cohost, self.event).has_access)

    def test_notifications_update_alone_leaves_capabilities(self):
        response = self.client.patch(self.url, {'notifications': []}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.row.refresh_from_db()
        self.assertEqual(self.row.notifications, [])
        self.assertEqual(self.row.capabilities, [MANAGE_GUESTS, SEND_MESSAGES])

    def test_non_list_is_rejected(self):
        response = self.client.patch(self.url, {'capabilities': 'manage_guests'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_empty_body_is_rejected(self):
        response = self.client.patch(self.url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_finished_invite_cannot_be_changed(self):
        self.row.status = EventCoHost.STATUS_LEFT
        self.row.save()
        response = self.client.patch(self.url, {'capabilities': []}, format='json')
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)

    def test_cohost_cannot_change_their_own_settings(self):
        self.client.force_authenticate(user=self.cohost)
        response = self.client.patch(self.url, {'capabilities': list(ALL_CAPABILITIES)}, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class CoHostDatesAndDefaultsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = User.objects.create_user(email='d-owner@test.com', name='Owner')
        self.cohost = User.objects.create_user(email='d-cohost@test.com', name='Co')
        self.event = Event.objects.create(host=self.owner, slug='d-event', title='Dates Event')

    def test_new_invite_has_every_notification_on(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.post(
            f'/api/events/{self.event.id}/cohosts/', {'email': 'new@test.com'}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['notifications'], sorted(ALL_NOTIFICATIONS))

    def test_leaving_records_when(self):
        row = accepted_cohost(self.event, self.cohost)
        self.client.force_authenticate(user=self.cohost)
        self.client.post(f'/api/events/{self.event.id}/cohosts/leave/')
        row.refresh_from_db()
        self.assertIsNotNone(row.left_at)

    def test_declining_records_when(self):
        row = EventCoHost.objects.create(
            event=self.event, user=self.cohost, invited_email=self.cohost.email,
            status=EventCoHost.STATUS_PENDING,
        )
        self.client.force_authenticate(user=self.cohost)
        response = self.client.post(f'/api/events/cohost-invites/{issue_invite_token(row)}/decline/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        row.refresh_from_db()
        self.assertIsNotNone(row.declined_at)

    def test_owner_can_clear_a_declined_invite(self):
        row = EventCoHost.objects.create(
            event=self.event, invited_email='gone@test.com', status=EventCoHost.STATUS_DECLINED,
        )
        self.client.force_authenticate(user=self.owner)
        response = self.client.delete(f'/api/events/{self.event.id}/cohosts/{row.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        row.refresh_from_db()
        self.assertEqual(row.status, EventCoHost.STATUS_REVOKED)


class CoHostNotificationRecipientTests(TestCase):
    """Who is emailed: the owner always, accepted co-hosts only for what they have on."""

    def setUp(self):
        self.owner = User.objects.create_user(email='n-owner@test.com', name='Owner')
        self.on = User.objects.create_user(email='n-on@test.com', name='On')
        self.off = User.objects.create_user(email='n-off@test.com', name='Off')
        self.pending = User.objects.create_user(email='n-pending@test.com', name='Pending')
        self.event = Event.objects.create(host=self.owner, slug='n-event', title='Notify Event')
        EventCoHost.objects.create(
            event=self.event, user=self.on, invited_email=self.on.email,
            status=EventCoHost.STATUS_ACCEPTED, notifications=[NOTIFY_RSVP_NEW, NOTIFY_CATALOG_RESPONSE],
        )
        EventCoHost.objects.create(
            event=self.event, user=self.off, invited_email=self.off.email,
            status=EventCoHost.STATUS_ACCEPTED, notifications=[],
        )
        EventCoHost.objects.create(
            event=self.event, user=self.pending, invited_email=self.pending.email,
            status=EventCoHost.STATUS_PENDING, notifications=[NOTIFY_RSVP_NEW],
        )

    def test_owner_then_subscribed_accepted_cohosts_only(self):
        self.assertEqual(notification_recipients(self.event, NOTIFY_RSVP_NEW), [self.owner, self.on])

    def test_owner_alone_when_nobody_is_subscribed(self):
        EventCoHost.objects.filter(user=self.on).update(notifications=[NOTIFY_RSVP_NEW])
        self.assertEqual(notification_recipients(self.event, NOTIFY_CATALOG_RESPONSE), [self.owner])

    def test_rsvp_alert_reaches_a_subscribed_cohost(self):
        from types import SimpleNamespace
        from unittest import mock

        from .views import _notify_host_rsvp

        rsvp = SimpleNamespace(name='Guest', email=None, will_attend='yes', guests_count=2, guest_id=None)
        with mock.patch('apps.events.views.send_email') as sent:
            _notify_host_rsvp(self.event, rsvp)
        self.assertEqual(
            sorted(c.kwargs['to_email'] for c in sent.call_args_list),
            [self.on.email, self.owner.email],
        )

    def test_catalog_alert_reaches_a_subscribed_cohost(self):
        from types import SimpleNamespace
        from unittest import mock

        from apps.catalog.notifications import send_catalog_response_notification

        response = SimpleNamespace(
            catalog_item=SimpleNamespace(title='Crayons', manual_instructions=''),
            event=self.event, response_type='external_click', email=None, name='Guest',
            phone='', amount=None, message='', RESPONSE_TYPE_CHOICES=[],
        )
        with mock.patch('apps.catalog.notifications.send_email') as sent:
            send_catalog_response_notification(response)
        self.assertEqual(
            sorted(c.kwargs['to_email'] for c in sent.call_args_list),
            [self.on.email, self.owner.email],
        )

    def test_a_cohost_who_chose_never_is_not_emailed(self):
        from types import SimpleNamespace
        from unittest import mock

        from apps.notifications.models import NotificationPreference

        from .views import _notify_host_rsvp

        prefs, _ = NotificationPreference.objects.get_or_create(user=self.on)
        prefs.rsvp_new = 'never'
        prefs.save()
        self.on.refresh_from_db()
        rsvp = SimpleNamespace(name='Guest', email=None, will_attend='yes', guests_count=1, guest_id=None)
        with mock.patch('apps.events.views.send_email') as sent:
            _notify_host_rsvp(self.event, rsvp)
        self.assertEqual([c.kwargs['to_email'] for c in sent.call_args_list], [self.owner.email])


class CoHostInviteLinkTests(TestCase):
    def test_invite_email_links_to_the_https_frontend(self):
        from unittest import mock

        from django.test import override_settings

        owner = User.objects.create_user(email='link-owner@test.com', name='Owner')
        event = Event.objects.create(host=owner, slug='link-event', title='Link Event')
        client = APIClient()
        client.force_authenticate(user=owner)
        with override_settings(FRONTEND_ORIGIN='https://ekfern.com'), \
                mock.patch('apps.events.cohost_views.send_email') as sent:
            response = client.post(f'/api/events/{event.id}/cohosts/', {'email': 'new@test.com'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        text = sent.call_args.args[2]
        self.assertIn('https://ekfern.com/cohost-invite/', text)
        self.assertNotIn('http://', text)
