"""
Tests for events views fixes
"""
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.db import connection
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient
from rest_framework import status
from apps.events.models import Event, Guest, RSVP, InvitePage, MessageTemplate, SubEvent, GuestSubEventInvite, BookingSchedule, BookingSlot, SlotBooking, GreetingCardSample, InvitePageLayout
from django.core.cache import cache
from apps.events.serializers import GuestSerializer

User = get_user_model()


class EventViewSetGuestsTestCase(TestCase):
    """Test guests() GET returns active guest list."""
    
    def setUp(self):
        cache.clear()  # Clear cache before each test
        self.client = APIClient()
        self.host = User.objects.create_user(email='host@test.com', name='Test Host')
        self.client.force_authenticate(user=self.host)
        self.event = Event.objects.create(
            host=self.host,
            slug='test-event',
            title='Test Event',
            is_public=True
        )
    
    def test_guests_endpoint_returns_only_active_guest_records(self):
        """GET /guests returns only non-removed Guest records."""
        active_guest = Guest.objects.create(
            event=self.event,
            name='Active Guest',
            phone='+919876543210',
            is_removed=False,
        )
        Guest.objects.create(
            event=self.event,
            name='Removed Guest',
            phone='+911234567890',
            is_removed=True,
        )

        # RSVP rows should not affect guests() response shape.
        RSVP.objects.create(
            event=self.event,
            name='RSVP Only',
            phone='+919999999999',
            will_attend='yes',
            is_removed=False,
            guest=None,
        )

        response = self.client.get(f'/api/events/{self.event.id}/guests/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertTrue(isinstance(data, list))
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['id'], active_guest.id)


class EventRsvpExperienceModeTestCase(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.host = User.objects.create_user(email='host-mode@test.com', name='Mode Host')
        self.client.force_authenticate(user=self.host)
        self.event = Event.objects.create(
            host=self.host,
            slug='mode-event',
            title='Mode Event',
            is_public=True,
            has_rsvp=True,
        )

    def test_default_mode_is_standard_and_ready_when_rsvp_enabled(self):
        response = self.client.get(f'/api/events/{self.event.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data['rsvp_experience_mode'], 'standard')
        self.assertTrue(data['rsvp_mode_readiness']['ready'])
        self.assertFalse(data['mode_switch_locked'])
        self.assertEqual(data['mode_switch_lock_reasons'], [])

    def test_mode_switch_locked_payload_after_live_rsvp(self):
        RSVP.objects.create(
            event=self.event,
            name='Live Guest',
            phone='+911111111111',
            will_attend='yes',
            is_removed=False,
        )
        response = self.client.get(f'/api/events/{self.event.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertTrue(data['mode_switch_locked'])
        self.assertTrue(any('RSVP' in r for r in data['mode_switch_lock_reasons']))

    def test_mode_switch_locked_payload_after_confirmed_slot_booking(self):
        schedule = BookingSchedule.objects.create(
            event=self.event,
            is_enabled=True,
            allow_direct_bookings=True,
            timezone=self.event.timezone,
        )
        now = timezone.now()
        slot = BookingSlot.objects.create(
            event=self.event,
            schedule=schedule,
            slot_date=now.date(),
            start_at=now + timedelta(hours=1),
            end_at=now + timedelta(hours=2),
            label='Slot',
            capacity_total=2,
            status=BookingSlot.STATUS_AVAILABLE,
        )
        SlotBooking.objects.create(
            event=self.event,
            slot=slot,
            phone_snapshot='+919999999001',
            seats_booked=1,
            source=SlotBooking.SOURCE_DIRECT,
            status=SlotBooking.STATUS_CONFIRMED,
        )
        response = self.client.get(f'/api/events/{self.event.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertTrue(data['mode_switch_locked'])
        self.assertTrue(any('slot' in r.lower() for r in data['mode_switch_lock_reasons']))

    def test_sub_event_mode_is_incomplete_without_rsvp_enabled_sub_event(self):
        response = self.client.patch(
            f'/api/events/{self.event.id}/',
            {'rsvp_experience_mode': 'sub_event'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()['rsvp_experience_mode'], 'sub_event')
        self.assertFalse(response.json()['rsvp_mode_readiness']['ready'])

    def test_slot_mode_readiness_requires_enabled_schedule_and_active_slot(self):
        response = self.client.patch(
            f'/api/events/{self.event.id}/',
            {'rsvp_experience_mode': 'slot_based'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.json()['rsvp_mode_readiness']['ready'])

        schedule = BookingSchedule.objects.create(
            event=self.event,
            is_enabled=True,
            allow_direct_bookings=True,
            timezone=self.event.timezone,
        )
        now = timezone.now()
        BookingSlot.objects.create(
            event=self.event,
            schedule=schedule,
            slot_date=now.date(),
            start_at=now + timedelta(hours=1),
            end_at=now + timedelta(hours=2),
            label='Available slot',
            capacity_total=2,
            status=BookingSlot.STATUS_AVAILABLE,
        )

        response = self.client.get(f'/api/events/{self.event.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()['rsvp_experience_mode'], 'slot_based')
        self.assertTrue(response.json()['rsvp_mode_readiness']['ready'])

    def test_mode_switch_blocked_after_live_rsvp(self):
        RSVP.objects.create(
            event=self.event,
            name='Live Guest',
            phone='+911111111111',
            will_attend='yes',
            is_removed=False,
        )
        response = self.client.patch(
            f'/api/events/{self.event.id}/',
            {'rsvp_experience_mode': 'sub_event'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('rsvp_experience_mode', response.json())


class EventPatchNonRsvpFieldsIsolationTestCase(TestCase):
    """PATCH without RSVP mutation keys must not rewrite event_structure or rsvp_mode."""

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.host = User.objects.create_user(email='host-patch-iso@test.com', name='Patch Host')
        self.client.force_authenticate(user=self.host)
        self.event = Event.objects.create(
            host=self.host,
            slug='patch-iso-event',
            title='Patch Iso Event',
            is_public=True,
            has_rsvp=True,
            event_structure='ENVELOPE',
            rsvp_mode='PER_SUBEVENT',
            rsvp_experience_mode=Event.RSVP_EXPERIENCE_MODE_SUB_EVENT,
        )

    def test_patch_has_rsvp_only_preserves_legacy_rsvp_fields(self):
        response = self.client.patch(
            f'/api/events/{self.event.id}/',
            {'has_rsvp': False},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.event.refresh_from_db()
        self.assertFalse(self.event.has_rsvp)
        self.assertEqual(self.event.event_structure, 'ENVELOPE')
        self.assertEqual(self.event.rsvp_mode, 'PER_SUBEVENT')
        self.assertEqual(self.event.rsvp_experience_mode, Event.RSVP_EXPERIENCE_MODE_SUB_EVENT)


class BookingScheduleStatusDatesTestCase(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.host = User.objects.create_user(email='host-schedule-dates@test.com', name='Schedule Dates Host')
        self.client.force_authenticate(user=self.host)
        self.event = Event.objects.create(
            host=self.host,
            slug='schedule-dates-event',
            title='Schedule Dates Event',
            is_public=True,
            has_rsvp=True,
            rsvp_experience_mode='slot_based',
        )

    def test_status_dates_track_active_and_paused_transitions(self):
        initial = self.client.get(f'/api/events/{self.event.id}/booking-schedule/')
        self.assertEqual(initial.status_code, status.HTTP_200_OK)
        initial_data = initial.json()
        self.assertIsNotNone(initial_data.get('status_changed_at'))

        activated = self.client.put(
            f'/api/events/{self.event.id}/booking-schedule/',
            {**initial_data, 'is_enabled': True},
            format='json',
        )
        self.assertEqual(activated.status_code, status.HTTP_200_OK)
        activated_data = activated.json()
        self.assertTrue(activated_data['is_enabled'])
        self.assertIsNotNone(activated_data.get('status_changed_at'))

        paused = self.client.put(
            f'/api/events/{self.event.id}/booking-schedule/',
            {**activated_data, 'is_enabled': False},
            format='json',
        )
        self.assertEqual(paused.status_code, status.HTTP_200_OK)
        paused_data = paused.json()
        self.assertFalse(paused_data['is_enabled'])
        self.assertIsNotNone(paused_data.get('status_changed_at'))
        self.assertNotEqual(paused_data.get('status_changed_at'), activated_data.get('status_changed_at'))


class MessageTemplateViewSetTestCase(TestCase):
    """Test fix B: perform_update() handles missing name in PATCH"""
    
    def setUp(self):
        cache.clear()  # Clear cache before each test
        self.client = APIClient()
        self.host = User.objects.create_user(email='host@test.com', name='Test Host')
        self.client.force_authenticate(user=self.host)
        self.event = Event.objects.create(
            host=self.host,
            slug='test-event',
            title='Test Event',
            is_public=True
        )
        self.template = MessageTemplate.objects.create(
            event=self.event,
            name='Original Template',
            message_type='TEXT',
            template_text='Hello {name}!'
        )
    
    def test_patch_without_name_does_not_crash(self):
        """Test that PATCH without name field doesn't crash"""
        # PATCH without name field (URL pattern is /api/events/whatsapp-templates/{id}/)
        response = self.client.patch(
            f'/api/events/whatsapp-templates/{self.template.id}/',
            {'template_text': 'Updated text'},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.template.refresh_from_db()
        self.assertEqual(self.template.name, 'Original Template')  # Should keep original name
        self.assertEqual(self.template.template_text, 'Updated text')
    
    def test_patch_without_name_still_checks_duplicates(self):
        """Test that duplicate name check still works when name not provided"""
        # Create another template
        other_template = MessageTemplate.objects.create(
            event=self.event,
            name='Other Template',
            message_type='TEXT',
            template_text='Other text'
        )
        
        # Try to PATCH without name - should use existing name and check duplicates
        # This should succeed since we're using the same template's existing name
        response = self.client.patch(
            f'/api/events/whatsapp-templates/{self.template.id}/',
            {'template_text': 'Updated text'},
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class PublicInviteViewSetTestCase(TestCase):
    """Test fix D: PublicInviteViewSet does NOT auto-publish unpublished invite pages"""
    
    def setUp(self):
        cache.clear()  # Clear cache before each test
        self.client = APIClient()
        self.host = User.objects.create_user(email='host@test.com', name='Test Host')
        self.event = Event.objects.create(
            host=self.host,
            slug='test-event',
            title='Test Event',
            is_public=True
        )
    
    def test_unpublished_invite_page_returns_coming_soon(self):
        """Unpublished (existing) invite page returns a 200 coming_soon payload, not 404, and is never auto-published."""
        # Create unpublished invite page
        invite_page = InvitePage.objects.create(
            event=self.event,
            slug=self.event.slug.lower(),
            is_published=False
        )
        
        # Try to access it (public invite endpoint)
        response = self.client.get(f'/api/events/invite/{invite_page.slug}/')
        
        # Should return a branded Coming Soon placeholder (HTTP 200), not a 404
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data.get('status'), 'coming_soon')
        
        # Verify it's still unpublished (never auto-published)
        invite_page.refresh_from_db()
        self.assertFalse(invite_page.is_published)

    def test_missing_invite_page_returns_404(self):
        """A truly missing slug (no invite page, no event) still returns 404."""
        response = self.client.get('/api/events/invite/does-not-exist-slug/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_published_invite_page_works(self):
        """Test that published invite page still works"""
        # Create published invite page
        invite_page = InvitePage.objects.create(
            event=self.event,
            slug=self.event.slug.lower(),
            is_published=True
        )
        
        # Try to access it (public invite endpoint)
        response = self.client.get(f'/api/events/invite/{invite_page.slug}/')
        
        # Should succeed
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_publish_snapshots_draft_and_draft_edits_stay_private(self):
        """Publish copies config -> published_config; later draft edits do not reach guests until re-publish, while host preview sees the draft."""
        invite_page = InvitePage.objects.create(
            event=self.event,
            slug=self.event.slug.lower(),
            is_published=False,
            config={'themeId': 'classic-noir', 'tiles': []},
        )

        # Host publishes via the API -> snapshot taken
        self.client.force_authenticate(user=self.host)
        publish_resp = self.client.post(
            f'/api/events/invite/{invite_page.slug}/publish/',
            {'is_published': True},
            format='json',
        )
        self.assertEqual(publish_resp.status_code, status.HTTP_200_OK)
        invite_page.refresh_from_db()
        self.assertTrue(invite_page.is_published)
        self.assertIsNotNone(invite_page.published_at)
        self.assertEqual(invite_page.published_config, invite_page.config)

        # Host edits the draft via the design endpoint
        design_resp = self.client.put(
            f'/api/events/{self.event.id}/design/',
            {'page_config': {'themeId': 'modern-minimal', 'tiles': []}},
            format='json',
        )
        self.assertEqual(design_resp.status_code, status.HTTP_200_OK)
        invite_page.refresh_from_db()
        self.assertEqual(invite_page.config['themeId'], 'modern-minimal')
        # Published snapshot is unchanged by a draft save
        self.assertEqual(invite_page.published_config['themeId'], 'classic-noir')

        # A guest still sees the PUBLISHED config (no guest token, no preview)
        guest_client = APIClient()
        guest_resp = guest_client.get(f'/api/events/invite/{invite_page.slug}/')
        self.assertEqual(guest_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(guest_resp.data['config']['themeId'], 'classic-noir')

        # The host preview sees the latest DRAFT
        preview_resp = self.client.get(f'/api/events/invite/{invite_page.slug}/?preview=true')
        self.assertEqual(preview_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(preview_resp.data['config']['themeId'], 'modern-minimal')

    def test_pull_back_retains_snapshot_and_shows_coming_soon(self):
        """Pulling back keeps published_config/published_at and serves guests a Coming Soon page."""
        invite_page = InvitePage.objects.create(
            event=self.event,
            slug=self.event.slug.lower(),
            is_published=False,
            config={'themeId': 'classic-noir', 'tiles': []},
        )
        self.client.force_authenticate(user=self.host)
        self.client.post(
            f'/api/events/invite/{invite_page.slug}/publish/',
            {'is_published': True},
            format='json',
        )
        # Pull back
        pull_back = self.client.post(
            f'/api/events/invite/{invite_page.slug}/publish/',
            {'is_published': False},
            format='json',
        )
        self.assertEqual(pull_back.status_code, status.HTTP_200_OK)
        invite_page.refresh_from_db()
        self.assertFalse(invite_page.is_published)
        # Snapshot retained so re-publish is instant
        self.assertIsNotNone(invite_page.published_config)
        self.assertIsNotNone(invite_page.published_at)

        # Guests now see a Coming Soon placeholder
        guest_client = APIClient()
        guest_resp = guest_client.get(f'/api/events/invite/{invite_page.slug}/')
        self.assertEqual(guest_resp.status_code, status.HTTP_200_OK)
        self.assertEqual(guest_resp.data.get('status'), 'coming_soon')


class CreateRSVPEnvelopeTestCase(TestCase):
    """Test fix E: create_rsvp() ENVELOPE returns 201 if any new RSVP created, else 200"""
    
    def setUp(self):
        cache.clear()  # Clear cache before each test
        self.client = APIClient()
        self.host = User.objects.create_user(email='host@test.com', name='Test Host')
        self.event = Event.objects.create(
            host=self.host,
            slug='test-event',
            title='Test Event',
            is_public=True,
            event_structure='ENVELOPE',
            rsvp_mode='PER_SUBEVENT',
            rsvp_experience_mode='sub_event',
            has_rsvp=True
        )
        self.sub_event1 = SubEvent.objects.create(
            event=self.event,
            title='Sub Event 1',
            start_at=timezone.now() + timedelta(days=1),
            rsvp_enabled=True,
            is_public_visible=True,
        )
        self.sub_event2 = SubEvent.objects.create(
            event=self.event,
            title='Sub Event 2',
            start_at=timezone.now() + timedelta(days=2),
            rsvp_enabled=True,
            is_public_visible=True,
        )
    
    def test_new_rsvp_returns_201(self):
        """Test that creating new RSVPs returns 201"""
        response = self.client.post(
            f'/api/events/{self.event.id}/rsvp/',
            {
                'name': 'Test Guest',
                'phone': '+911234567890',
                'will_attend': 'yes',
                'selectedSubEventIds': [self.sub_event1.id, self.sub_event2.id]
            },
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
    
    def test_update_existing_rsvp_returns_200(self):
        """Test that updating existing RSVPs returns 200"""
        # Create existing RSVPs
        RSVP.objects.create(
            event=self.event,
            sub_event=self.sub_event1,
            name='Test Guest',
            phone='+911234567890',
            will_attend='yes'
        )
        RSVP.objects.create(
            event=self.event,
            sub_event=self.sub_event2,
            name='Test Guest',
            phone='+911234567890',
            will_attend='yes'
        )

        # Create MAIN RSVP first (so the next call is a pure update, not partially creating new rows)
        RSVP.objects.create(
            event=self.event,
            sub_event=None,
            name='Test Guest',
            phone='+911234567890',
            will_attend='yes'
        )
        
        # Update them
        response = self.client.post(
            f'/api/events/{self.event.id}/rsvp/',
            {
                'name': 'Test Guest',
                'phone': '+911234567890',
                'will_attend': 'no',
                'selectedSubEventIds': [self.sub_event1.id, self.sub_event2.id]
            },
            format='json'
        )
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_no_selection_allowed_for_no_applies_to_all(self):
        """PER_SUBEVENT: empty selectedSubEventIds should still create/update MAIN RSVP (sub_event=NULL) only"""
        response = self.client.post(
            f'/api/events/{self.event.id}/rsvp/',
            {
                'name': 'Test Guest',
                'phone': '+911234567890',
                'will_attend': 'no',
                'selectedSubEventIds': []  # explicitly empty
            },
            format='json'
        )

        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_201_CREATED])
        self.assertTrue(isinstance(response.data, list))
        # Should return only MAIN RSVP
        self.assertEqual(len(response.data), 1)
        self.assertIsNone(response.data[0].get('sub_event'))
        self.assertIsNone(response.data[0].get('sub_event_id'))

    def test_selected_subevents_creates_main_plus_selected(self):
        """PER_SUBEVENT: selecting sub-events creates/updates MAIN RSVP plus selected sub-event RSVPs"""
        response = self.client.post(
            f'/api/events/{self.event.id}/rsvp/',
            {
                'name': 'Test Guest',
                'phone': '+911234567890',
                'will_attend': 'yes',
                'selectedSubEventIds': [self.sub_event1.id]
            },
            format='json'
        )

        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_201_CREATED])
        self.assertTrue(isinstance(response.data, list))
        # main + 1 selected sub-event
        self.assertEqual(len(response.data), 2)

    def test_required_session_blocks_yes_without_selection(self):
        self.event.rsvp_require_sub_event_selection = True
        self.event.save(update_fields=['rsvp_require_sub_event_selection'])
        response = self.client.post(
            f'/api/events/{self.event.id}/rsvp/',
            {
                'name': 'Test Guest',
                'phone': '+911234567890',
                'will_attend': 'yes',
                'selectedSubEventIds': [],
            },
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data.get('errorCode'), 'SESSION_REQUIRED')

    def test_required_session_allows_no_without_selection(self):
        self.event.rsvp_require_sub_event_selection = True
        self.event.save(update_fields=['rsvp_require_sub_event_selection'])
        response = self.client.post(
            f'/api/events/{self.event.id}/rsvp/',
            {
                'name': 'Test Guest',
                'phone': '+911234567890',
                'will_attend': 'no',
                'selectedSubEventIds': [],
            },
            format='json'
        )
        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_201_CREATED])
    
    def test_mixed_new_and_existing_returns_201(self):
        """Test that if any new RSVP is created, return 201 even if some exist"""
        # Create one existing RSVP
        RSVP.objects.create(
            event=self.event,
            sub_event=self.sub_event1,
            name='Test Guest',
            phone='+911234567890',
            will_attend='yes'
        )
        
        # Create RSVP for both sub-events (one new, one existing)
        response = self.client.post(
            f'/api/events/{self.event.id}/rsvp/',
            {
                'name': 'Test Guest',
                'phone': '+911234567890',
                'will_attend': 'yes',
                'selectedSubEventIds': [self.sub_event1.id, self.sub_event2.id]
            },
            format='json'
        )
        
        # Should return 201 because at least one new RSVP was created
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)


class CreateRSVPEnvelopeOneTapAllTestCase(TestCase):
    """ONE_TAP_ALL should allow MAIN RSVP even when guest has no sub-event invites"""

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.host = User.objects.create_user(email='host2@test.com', name='Test Host 2')
        self.event = Event.objects.create(
            host=self.host,
            slug='test-event-one-tap',
            title='Test Event One Tap',
            is_public=True,
            event_structure='ENVELOPE',
            rsvp_mode='ONE_TAP_ALL',
            rsvp_experience_mode='sub_event',
            has_rsvp=True
        )
        self.sub_event1 = SubEvent.objects.create(
            event=self.event,
            title='Sub Event 1',
            start_at=timezone.now() + timedelta(days=1),
            rsvp_enabled=True,
            is_public_visible=True,
        )
        self.guest = Guest.objects.create(
            event=self.event,
            name='Guest A',
            phone='+911234567890',
            is_removed=False
        )

    def test_no_invites_still_allows_main_rsvp(self):
        response = self.client.post(
            f'/api/events/{self.event.id}/rsvp/',
            {
                'name': 'Guest A',
                'phone': '+911234567890',
                'will_attend': 'yes',
            },
            format='json'
        )
        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_201_CREATED])
        self.assertTrue(isinstance(response.data, list))
        self.assertEqual(len(response.data), 1)
        self.assertIsNone(response.data[0].get('sub_event'))
        self.assertIsNone(response.data[0].get('sub_event_id'))

    def test_with_invite_creates_main_plus_subevent(self):
        GuestSubEventInvite.objects.create(guest=self.guest, sub_event=self.sub_event1)
        response = self.client.post(
            f'/api/events/{self.event.id}/rsvp/',
            {
                'name': 'Guest A',
                'phone': '+911234567890',
                'will_attend': 'yes',
            },
            format='json'
        )
        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_201_CREATED])
        self.assertTrue(isinstance(response.data, list))
        # main + 1 allowed sub-event
        self.assertEqual(len(response.data), 2)
        self.assertIsNone(response.data[0].get('sub_event'))
        self.assertEqual(response.data[1].get('sub_event_id'), self.sub_event1.id)

    def test_public_open_does_not_fan_out_subevents(self):
        """ONE_TAP_ALL open link: main RSVP only, no sub-event rows without guest assignments."""
        response = self.client.post(
            f'/api/events/{self.event.id}/rsvp/',
            {
                'name': 'Open Guest',
                'phone': '+919876543210',
                'will_attend': 'yes',
            },
            format='json'
        )
        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_201_CREATED])
        self.assertEqual(len(response.data), 1)
        self.assertIsNone(response.data[0].get('sub_event_id'))


class CreateRSVPCustomFieldsWritebackTestCase(TestCase):
    """RSVP custom_fields should be saved on MAIN RSVP and (optionally) copied into Guest.custom_fields."""

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.host = User.objects.create_user(email='host-cf@test.com', name='Host CF')
        self.event = Event.objects.create(
            host=self.host,
            slug='test-event-cf',
            title='Test Event CF',
            is_public=True,
            event_structure='ENVELOPE',
            rsvp_mode='PER_SUBEVENT',
            rsvp_experience_mode='sub_event',
            has_rsvp=True,
            page_config={
                'rsvpForm': {
                    'version': 1,
                    'writeBackToGuest': True,
                    'customFields': [{'key': 'diet', 'enabled': True, 'type': 'select'}],
                    'systemFields': {'notes': {'enabled': False}},
                }
            },
            custom_fields_metadata={'diet': {'display_label': 'Diet'}},
        )
        self.sub_event1 = SubEvent.objects.create(
            event=self.event,
            title='Sub Event 1',
            start_at=timezone.now() + timedelta(days=1),
            rsvp_enabled=True,
            is_public_visible=True,
        )
        self.guest = Guest.objects.create(
            event=self.event,
            name='Guest CF',
            phone='+911234567890',
            is_removed=False,
            custom_fields={}
        )
        GuestSubEventInvite.objects.create(guest=self.guest, sub_event=self.sub_event1)

    def test_custom_fields_saved_on_main_and_written_back_to_guest(self):
        response = self.client.post(
            f'/api/events/{self.event.id}/rsvp/',
            {
                'name': 'Guest CF',
                'phone': '+911234567890',
                'will_attend': 'yes',
                'selectedSubEventIds': [self.sub_event1.id],
                'custom_fields': {'diet': 'Vegetarian'},
            },
            format='json'
        )
        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_201_CREATED])
        self.assertTrue(isinstance(response.data, list))

        # MAIN RSVP should include custom_fields, sub-event RSVP should not (default behavior)
        main = next((r for r in response.data if r.get('sub_event_id') is None), None)
        sub = next((r for r in response.data if r.get('sub_event_id') == self.sub_event1.id), None)
        self.assertIsNotNone(main)
        self.assertIsNotNone(sub)
        self.assertEqual(main.get('custom_fields', {}).get('diet'), 'Vegetarian')
        self.assertFalse('custom_fields' in sub and sub.get('custom_fields'), "Sub-event RSVP should not store custom_fields by default")

        self.guest.refresh_from_db()
        self.assertEqual(self.guest.custom_fields.get('diet'), 'Vegetarian')


class InvitePageCacheTestCase(TestCase):
    """Test cache functionality for invite pages"""
    
    def setUp(self):
        cache.clear()  # Clear cache before each test
        self.client = APIClient()
        self.host = User.objects.create_user(email='host@test.com', name='Test Host')
        self.event = Event.objects.create(
            host=self.host,
            slug='test-event',
            title='Test Event',
            is_public=True,
            event_structure='SIMPLE'
        )
    
    def get_cache_key(self, slug, invite_page=None):
        """Helper to build the version-scoped cache key (matches the view).

        Pass `invite_page` for published pages so the key includes the current
        updated_at version segment; omit it to get the unversioned base key.
        """
        from apps.events.views import get_invite_page_cache_key
        version = None
        if invite_page is not None:
            invite_page.refresh_from_db(fields=['updated_at'])
            version = invite_page.updated_at.timestamp()
        return get_invite_page_cache_key(slug, version=version)
    
    def test_cache_hit_for_published_page(self):
        """Test that published invite page is cached and subsequent requests hit cache"""
        # Create published invite page
        invite_page = InvitePage.objects.create(
            event=self.event,
            slug=self.event.slug.lower(),
            is_published=True,
            config={'themeId': 'classic-noir'}
        )
        
        cache_key = self.get_cache_key(invite_page.slug, invite_page)
        
        # First request - should be cache MISS
        self.assertIsNone(cache.get(cache_key))
        response1 = self.client.get(f'/api/events/invite/{invite_page.slug}/')
        self.assertEqual(response1.status_code, status.HTTP_200_OK)
        
        # Verify cache was set under the version-scoped key
        cached_data = cache.get(cache_key)
        self.assertIsNotNone(cached_data, "Cache should be set after first request")
        
        # Second request - cache HIT. Exactly one query: the lightweight
        # updated_at version lookup that precedes the cache check.
        with self.assertNumQueries(1):
            response2 = self.client.get(f'/api/events/invite/{invite_page.slug}/')
        
        self.assertEqual(response2.status_code, status.HTTP_200_OK)
        # Verify responses match
        self.assertEqual(response1.json(), response2.json())
    
    def test_cache_miss_for_unpublished_page(self):
        """Unpublished invite pages return coming_soon and are never cached."""
        # Create unpublished invite page
        invite_page = InvitePage.objects.create(
            event=self.event,
            slug=self.event.slug.lower(),
            is_published=False
        )
        
        cache_key = self.get_cache_key(invite_page.slug)
        
        # Make multiple requests
        for _ in range(3):
            response = self.client.get(f'/api/events/invite/{invite_page.slug}/')
            # Should return a Coming Soon placeholder (200), not a 404
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertEqual(response.data.get('status'), 'coming_soon')
            # Cache should never be set for unpublished pages
            self.assertIsNone(cache.get(cache_key))
    
    def test_cache_bypass_for_guest_token(self):
        """Test that guest token requests bypass cache"""
        # Create published invite page
        invite_page = InvitePage.objects.create(
            event=self.event,
            slug=self.event.slug.lower(),
            is_published=True
        )
        
        # Create guest with token
        guest = Guest.objects.create(
            event=self.event,
            name='Test Guest',
            phone='+911234567890',
            guest_token='test-token-123'
        )
        
        cache_key = self.get_cache_key(invite_page.slug)
        
        # Make request with guest token
        response1 = self.client.get(f'/api/events/invite/{invite_page.slug}/?g=test-token-123')
        self.assertEqual(response1.status_code, status.HTTP_200_OK)
        
        # Cache should not be set for guest token requests
        # Public cache should not exist
        self.assertIsNone(cache.get(cache_key))
        
        # Make another request with guest token - should hit database (not cached)
        response2 = self.client.get(f'/api/events/invite/{invite_page.slug}/?g=test-token-123')
        self.assertEqual(response2.status_code, status.HTTP_200_OK)
        # Both should have guest context
        self.assertIn('guest_context', response1.json())
        self.assertIn('guest_context', response2.json())
    
    def test_cache_invalidation_on_update(self):
        """Updating the page bumps updated_at, rotating the version-scoped cache
        key so the next request always serves fresh content (globally, without
        relying on per-container cache.delete)."""
        # Create published invite page
        invite_page = InvitePage.objects.create(
            event=self.event,
            slug=self.event.slug.lower(),
            is_published=True,
            config={'themeId': 'classic-noir'}
        )
        
        # First request - cache MISS, then cached under the v1 key
        response1 = self.client.get(f'/api/events/invite/{invite_page.slug}/')
        self.assertEqual(response1.status_code, status.HTTP_200_OK)
        self.assertEqual(response1.json()['config']['themeId'], 'classic-noir')
        self.assertIsNotNone(cache.get(self.get_cache_key(invite_page.slug, invite_page)))
        
        # Update invite page config (bumps updated_at -> new version key)
        invite_page.config = {'themeId': 'modern-minimal'}
        invite_page.save(update_fields=['config', 'updated_at'])
        
        # Next request must reflect the new config (fresh, not the stale cache)
        response2 = self.client.get(f'/api/events/invite/{invite_page.slug}/')
        self.assertEqual(response2.status_code, status.HTTP_200_OK)
        self.assertEqual(response2.json()['config']['themeId'], 'modern-minimal')
        self.assertNotEqual(response1.json(), response2.json())
    
    def test_cache_invalidation_on_publish(self):
        """Publishing/unpublishing is reflected immediately via the version-scoped key."""
        # Create unpublished invite page
        invite_page = InvitePage.objects.create(
            event=self.event,
            slug=self.event.slug.lower(),
            is_published=False
        )
        
        # Unpublished -> guests get a Coming Soon placeholder (not the live page)
        before = self.client.get(f'/api/events/invite/{invite_page.slug}/')
        self.assertEqual(before.status_code, status.HTTP_200_OK)
        self.assertEqual(before.data.get('status'), 'coming_soon')
        
        # Publish it
        invite_page.is_published = True
        invite_page.save(update_fields=['is_published', 'updated_at'])
        
        # First request after publish - cache MISS, served fresh (full invite, not coming_soon)
        response1 = self.client.get(f'/api/events/invite/{invite_page.slug}/')
        self.assertEqual(response1.status_code, status.HTTP_200_OK)
        self.assertNotEqual(response1.data.get('status'), 'coming_soon')
        
        # Second request - cache HIT (same version)
        response2 = self.client.get(f'/api/events/invite/{invite_page.slug}/')
        self.assertEqual(response2.status_code, status.HTTP_200_OK)
        self.assertEqual(response1.json(), response2.json())
        
        # Unpublish it -> guests get the Coming Soon placeholder again
        invite_page.is_published = False
        invite_page.save(update_fields=['is_published', 'updated_at'])
        after = self.client.get(f'/api/events/invite/{invite_page.slug}/')
        self.assertEqual(after.status_code, status.HTTP_200_OK)
        self.assertEqual(after.data.get('status'), 'coming_soon')
    
    def test_cache_invalidation_on_subevent_change(self):
        """Test that cache is invalidated when sub-events change"""
        # Create published invite page with ENVELOPE event
        self.event.event_structure = 'ENVELOPE'
        self.event.save(update_fields=['event_structure'])
        
        invite_page = InvitePage.objects.create(
            event=self.event,
            slug=self.event.slug.lower(),
            is_published=True
        )
        
        # First request - cache MISS, then cached under the current version key
        response1 = self.client.get(f'/api/events/invite/{invite_page.slug}/')
        self.assertEqual(response1.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(cache.get(self.get_cache_key(invite_page.slug, invite_page)))
        
        # Capture the version before the sub-event change
        invite_page.refresh_from_db(fields=['updated_at'])
        version_before = invite_page.updated_at
        
        # Add sub-event - signal should touch InvitePage.updated_at (version bump)
        SubEvent.objects.create(
            event=self.event,
            title='Test Sub Event',
            start_at=timezone.now() + timedelta(days=1),
            is_public_visible=True
        )
        
        # Version must have advanced so the next request rotates to a fresh key
        invite_page.refresh_from_db(fields=['updated_at'])
        self.assertGreater(
            invite_page.updated_at, version_before,
            "Sub-event change should bump InvitePage.updated_at (cache version)",
        )
        
        # Next request should be served fresh (200)
        response2 = self.client.get(f'/api/events/invite/{invite_page.slug}/')
        self.assertEqual(response2.status_code, status.HTTP_200_OK)
    
    def test_cache_ttl_expiration(self):
        """Test that cache TTL works correctly"""
        # Create published invite page
        invite_page = InvitePage.objects.create(
            event=self.event,
            slug=self.event.slug.lower(),
            is_published=True
        )
        
        cache_key = self.get_cache_key(invite_page.slug, invite_page)
        
        # First request - cache MISS, then cached with TTL
        response1 = self.client.get(f'/api/events/invite/{invite_page.slug}/')
        self.assertEqual(response1.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(cache.get(cache_key))
        
        # Manually delete cache (simulating TTL expiration)
        cache.delete(cache_key)
        self.assertIsNone(cache.get(cache_key))
        
        # Next request should be cache MISS (cache expired)
        response2 = self.client.get(f'/api/events/invite/{invite_page.slug}/')
        self.assertEqual(response2.status_code, status.HTTP_200_OK)
        # Cache should be set again
        self.assertIsNotNone(cache.get(cache_key))
    
    def test_query_optimization_with_only(self):
        """Test that query optimization with only() loads only required fields"""
        # Create published invite page
        invite_page = InvitePage.objects.create(
            event=self.event,
            slug=self.event.slug.lower(),
            is_published=True,
            config={'themeId': 'classic-noir'}
        )
        
        # Make request and bound query count.
        # Current serializer computes several event-derived fields and RSVP count,
        # so this endpoint executes multiple queries even for SIMPLE events.
        # +1 for the lightweight updated_at version lookup that precedes caching.
        with CaptureQueriesContext(connection) as queries:
            response = self.client.get(f'/api/events/invite/{invite_page.slug}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertLessEqual(len(queries), 9, f"Expected <=9 queries, got {len(queries)}")
        data = response.json()
        
        # Verify response has expected fields (from serializer)
        self.assertIn('id', data)
        self.assertIn('slug', data)
        self.assertIn('config', data)
        self.assertIn('event_structure', data)
        self.assertIn('rsvp_mode', data)
        
        # Verify that Event fields are accessible (proving select_related worked)
        self.assertEqual(data['event_structure'], 'SIMPLE')
        self.assertEqual(data['rsvp_mode'], 'ONE_TAP_ALL')


class SlotBookingTestCase(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.host = User.objects.create_user(email='slot-host@test.com', name='Slot Host')
        self.event = Event.objects.create(
            host=self.host,
            slug='slot-event',
            title='Slot Event',
            is_public=True,
            has_rsvp=True,
            rsvp_experience_mode='slot_based',
        )
        self.schedule = BookingSchedule.objects.create(
            event=self.event,
            is_enabled=True,
            allow_direct_bookings=True,
            timezone=self.event.timezone,
        )
        now = timezone.now()
        self.slot = BookingSlot.objects.create(
            event=self.event,
            schedule=self.schedule,
            slot_date=now.date(),
            start_at=now + timedelta(hours=1),
            end_at=now + timedelta(hours=2),
            label='Morning',
            capacity_total=2,
            status=BookingSlot.STATUS_AVAILABLE,
        )

    def test_create_booking_success_with_capacity(self):
        payload = {
            'slotId': self.slot.id,
            'seatsBooked': 1,
            'name': 'Guest One',
            'phone': '+919999999991',
            'email': 'guest1@test.com',
            'idempotencyKey': 'test-key-1',
        }
        response = self.client.post(f'/api/events/{self.event.id}/slot-bookings/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(SlotBooking.objects.filter(event=self.event).count(), 1)
        self.assertTrue(RSVP.objects.filter(event=self.event, phone='+919999999991').exists())
        rsvp = RSVP.objects.get(event=self.event, phone='+919999999991')
        self.assertEqual(rsvp.guests_count, 1)

    def test_create_booking_persists_notes_and_custom_fields_to_rsvp(self):
        payload = {
            'slotId': self.slot.id,
            'seatsBooked': 2,
            'name': 'Guest Notes',
            'phone': '+919999999981',
            'email': 'guest-notes@test.com',
            'notes': 'Vegetarian meal requested',
            'custom_fields': {'meal_pref': 'veg', 'parking': True},
            'idempotencyKey': 'notes-key-1',
        }
        response = self.client.post(f'/api/events/{self.event.id}/slot-bookings/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        rsvp = RSVP.objects.get(event=self.event, phone='+919999999981')
        self.assertEqual(rsvp.will_attend, 'yes')
        self.assertEqual(rsvp.guests_count, 2)
        self.assertEqual(rsvp.notes, 'Vegetarian meal requested')
        self.assertEqual(rsvp.custom_fields.get('meal_pref'), 'veg')
        self.assertTrue(rsvp.custom_fields.get('parking'))

    def test_create_booking_rejects_invalid_custom_fields_shape(self):
        payload = {
            'slotId': self.slot.id,
            'seatsBooked': 1,
            'name': 'Invalid CF',
            'phone': '+919999999971',
            'custom_fields': ['invalid'],
            'idempotencyKey': 'notes-key-invalid',
        }
        response = self.client.post(f'/api/events/{self.event.id}/slot-bookings/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.json().get('error'), 'custom_fields must be an object')

    def test_create_booking_returns_409_when_full(self):
        SlotBooking.objects.create(
            event=self.event,
            slot=self.slot,
            phone_snapshot='+919999999992',
            seats_booked=2,
            source=SlotBooking.SOURCE_DIRECT,
            status=SlotBooking.STATUS_CONFIRMED,
        )
        payload = {
            'slotId': self.slot.id,
            'seatsBooked': 1,
            'name': 'Guest Two',
            'phone': '+919999999993',
        }
        response = self.client.post(f'/api/events/{self.event.id}/slot-bookings/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.json().get('errorCode'), 'INSUFFICIENT_CAPACITY')

    def test_create_booking_idempotent_replay_returns_same_booking(self):
        payload = {
            'slotId': self.slot.id,
            'seatsBooked': 1,
            'name': 'Guest Replay',
            'phone': '+919999999994',
            'idempotencyKey': 'same-key',
        }
        first = self.client.post(f'/api/events/{self.event.id}/slot-bookings/', payload, format='json')
        second = self.client.post(f'/api/events/{self.event.id}/slot-bookings/', payload, format='json')
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(first.json().get('bookingId'), second.json().get('bookingId'))

    def test_create_booking_requires_slot_id_and_phone(self):
        response = self.client.post(
            f'/api/events/{self.event.id}/slot-bookings/',
            {'phone': '+919999999995'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.json().get('error'), 'slotId and phone are required')

    def test_create_booking_rejects_non_positive_seats(self):
        response = self.client.post(
            f'/api/events/{self.event.id}/slot-bookings/',
            {'slotId': self.slot.id, 'phone': '+919999999996', 'seatsBooked': 0},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.json().get('error'), 'seatsBooked must be >= 1')

    def test_direct_slot_booking_creates_form_submission_guest_and_links_rsvp(self):
        payload = {
            'slotId': self.slot.id,
            'seatsBooked': 1,
            'name': 'Direct Slot Guest',
            'phone': '+919999999990',
            'email': 'direct-slot@test.com',
            'idempotencyKey': 'direct-slot-key-1',
        }
        response = self.client.post(
            f'/api/events/{self.event.id}/slot-bookings/',
            payload,
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        guest = Guest.objects.get(event=self.event, phone=payload['phone'])
        self.assertEqual(guest.source, 'form_submission')

        booking = SlotBooking.objects.get(
            event=self.event,
            phone_snapshot=payload['phone'],
            status=SlotBooking.STATUS_CONFIRMED,
        )
        self.assertEqual(booking.guest_id, guest.id)

        rsvp = RSVP.objects.get(
            event=self.event,
            phone=payload['phone'],
            sub_event__isnull=True,
            is_removed=False,
        )
        self.assertEqual(rsvp.guest_id, guest.id)
        self.assertEqual(rsvp.will_attend, 'yes')

        serialized_guest = GuestSerializer(guest).data
        self.assertEqual(serialized_guest['slot_booking_status'], 'confirmed')
        self.assertEqual(serialized_guest['slot_booking_selected_slot_label'], self.slot.label)
        self.assertEqual(serialized_guest['slot_booking_slot_date'], str(self.slot.slot_date))

    def test_guest_serializer_resolves_slot_booking_with_phone_format_mismatch(self):
        """Legacy or mismatched snapshots (spaces) still tie to the guest row."""
        guest = Guest.objects.create(
            event=self.event,
            name='Mismatch Guest',
            phone='+917328501799',
            source='form_submission',
        )
        SlotBooking.objects.create(
            event=self.event,
            slot=self.slot,
            guest=None,
            phone_snapshot='+91 7328501799',
            name_snapshot='',
            seats_booked=1,
            source=SlotBooking.SOURCE_DIRECT,
            status=SlotBooking.STATUS_CONFIRMED,
        )
        data = GuestSerializer(guest).data
        self.assertEqual(data['slot_booking_status'], 'confirmed')
        self.assertEqual(data['slot_booking_selected_slot_label'], self.slot.label)

    def test_guest_serializer_resolves_slot_booking_plus_prefix_vs_digits_only_snapshot(self):
        """+91… on guest and 91… without + on snapshot must still match."""
        guest = Guest.objects.create(
            event=self.event,
            name='Plus Guest',
            phone='+919777777001',
            source='form_submission',
        )
        SlotBooking.objects.create(
            event=self.event,
            slot=self.slot,
            guest=None,
            phone_snapshot='919777777001',
            name_snapshot='',
            seats_booked=1,
            source=SlotBooking.SOURCE_DIRECT,
            status=SlotBooking.STATUS_CONFIRMED,
        )
        data = GuestSerializer(guest).data
        self.assertEqual(data['slot_booking_status'], 'confirmed')
        self.assertEqual(data['slot_booking_selected_slot_label'], self.slot.label)

    def test_guest_serializer_resolves_slot_booking_national_vs_full_digits(self):
        """10-digit national number stored on snapshot vs full E.164 on guest."""
        guest = Guest.objects.create(
            event=self.event,
            name='National Guest',
            phone='+919666666002',
            source='form_submission',
        )
        SlotBooking.objects.create(
            event=self.event,
            slot=self.slot,
            guest=None,
            phone_snapshot='9666666002',
            name_snapshot='',
            seats_booked=1,
            source=SlotBooking.SOURCE_DIRECT,
            status=SlotBooking.STATUS_CONFIRMED,
        )
        data = GuestSerializer(guest).data
        self.assertEqual(data['slot_booking_status'], 'confirmed')

    def test_guest_serializer_uses_time_fallback_when_slot_label_blank(self):
        now = timezone.now()
        unlabeled = BookingSlot.objects.create(
            event=self.event,
            schedule=self.schedule,
            slot_date=now.date(),
            start_at=now + timedelta(hours=5),
            end_at=now + timedelta(hours=6),
            label='',
            capacity_total=5,
            status=BookingSlot.STATUS_AVAILABLE,
        )
        guest = Guest.objects.create(
            event=self.event,
            name='Unlabeled Slot Guest',
            phone='+919555555001',
            source='form_submission',
        )
        SlotBooking.objects.create(
            event=self.event,
            slot=unlabeled,
            guest=guest,
            phone_snapshot=guest.phone,
            name_snapshot='',
            seats_booked=1,
            source=SlotBooking.SOURCE_DIRECT,
            status=SlotBooking.STATUS_CONFIRMED,
        )
        data = GuestSerializer(guest).data
        self.assertEqual(data['slot_booking_status'], 'confirmed')
        self.assertTrue(data['slot_booking_selected_slot_label'])
        self.assertIn('–', data['slot_booking_selected_slot_label'])

    def test_guest_serializer_surfaces_rsvp_notes(self):
        guest = Guest.objects.create(
            event=self.event,
            name='Notes Guest',
            phone='+919888888881',
            source='form_submission',
        )
        RSVP.objects.create(
            event=self.event,
            sub_event=None,
            name='Notes Guest',
            phone=guest.phone,
            email='',
            will_attend='yes',
            guests_count=2,
            guest=guest,
            notes='Please seat near the door',
        )
        data = GuestSerializer(guest).data
        self.assertEqual(data['rsvp_notes'], 'Please seat near the door')

    def test_create_booking_normalizes_phone_from_spaced_input(self):
        payload = {
            'slotId': self.slot.id,
            'seatsBooked': 1,
            'name': 'Spaced Guest',
            'phone': '+91 73285 01799',
            'country_code': '+91',
            'idempotencyKey': 'spaced-phone-1',
        }
        response = self.client.post(f'/api/events/{self.event.id}/slot-bookings/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        guest = Guest.objects.get(event=self.event, phone='+917328501799')
        booking = SlotBooking.objects.get(event=self.event, guest=guest, status=SlotBooking.STATUS_CONFIRMED)
        self.assertEqual(booking.phone_snapshot, '+917328501799')

    def test_guest_source_defaults_to_manual_for_existing_guests(self):
        guest = Guest.objects.create(
            event=self.event,
            name='Legacy Guest',
            phone='+919999999899',
            is_removed=False,
        )
        self.assertEqual(guest.source, 'manual')

    def test_standard_rsvp_creates_form_submission_guest_source_when_phone_not_invited(self):
        standard_event = Event.objects.create(
            host=self.host,
            slug='standard-source-event',
            title='Standard Source Event',
            is_public=True,
            has_rsvp=True,
            event_structure='SIMPLE',
            rsvp_experience_mode=Event.RSVP_EXPERIENCE_MODE_STANDARD,
        )

        payload = {
            'name': 'Direct Standard Guest',
            'phone': '+919999999880',
            'email': 'direct-standard@test.com',
            'will_attend': 'yes',
            'guests_count': 2,
            'notes': '',
            'custom_fields': {},
        }

        response = self.client.post(
            f'/api/events/{standard_event.id}/rsvp/',
            payload,
            format='json',
        )

        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_201_CREATED])

        guest = Guest.objects.get(event=standard_event, phone=payload['phone'])
        self.assertEqual(guest.source, 'form_submission')

        rsvp = RSVP.objects.get(
            event=standard_event,
            phone=payload['phone'],
            sub_event__isnull=True,
            is_removed=False,
        )
        self.assertEqual(rsvp.guest_id, guest.id)

    def test_create_booking_rejects_slot_from_another_event(self):
        other_host = User.objects.create_user(email='other-host@test.com', name='Other Host')
        other_event = Event.objects.create(
            host=other_host,
            slug='other-slot-event',
            title='Other Slot Event',
            is_public=True,
            has_rsvp=True,
        )
        other_schedule = BookingSchedule.objects.create(
            event=other_event,
            is_enabled=True,
            allow_direct_bookings=True,
            timezone=other_event.timezone,
        )
        now = timezone.now()
        other_slot = BookingSlot.objects.create(
            event=other_event,
            schedule=other_schedule,
            slot_date=now.date(),
            start_at=now + timedelta(hours=3),
            end_at=now + timedelta(hours=4),
            label='Other',
            capacity_total=2,
            status=BookingSlot.STATUS_AVAILABLE,
        )

        response = self.client.post(
            f'/api/events/{self.event.id}/slot-bookings/',
            {'slotId': other_slot.id, 'phone': '+919999999997'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.json().get('error'), 'Slot not found')

    def test_create_booking_rejects_when_direct_bookings_disabled(self):
        self.schedule.allow_direct_bookings = False
        self.schedule.save(update_fields=['allow_direct_bookings', 'updated_at'])

        response = self.client.post(
            f'/api/events/{self.event.id}/slot-bookings/',
            {'slotId': self.slot.id, 'phone': '+919999999998'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.json().get('error'), 'Direct booking is disabled for this event')

    def test_create_booking_rejects_when_schedule_disabled(self):
        self.schedule.is_enabled = False
        self.schedule.save(update_fields=['is_enabled', 'updated_at'])

        response = self.client.post(
            f'/api/events/{self.event.id}/slot-bookings/',
            {'slotId': self.slot.id, 'phone': '+919999999989'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.json().get('error'), 'Bookings are currently paused for this event.')

    def test_create_booking_rejects_unavailable_and_hidden_and_sold_out_slots(self):
        for slot_status in [BookingSlot.STATUS_UNAVAILABLE, BookingSlot.STATUS_HIDDEN, BookingSlot.STATUS_SOLD_OUT]:
            slot = BookingSlot.objects.create(
                event=self.event,
                schedule=self.schedule,
                slot_date=self.slot.slot_date,
                start_at=self.slot.start_at + timedelta(hours=slot_status == BookingSlot.STATUS_HIDDEN),
                end_at=self.slot.end_at + timedelta(hours=slot_status == BookingSlot.STATUS_HIDDEN),
                label=f'Status {slot_status}',
                capacity_total=5,
                status=slot_status,
            )
            response = self.client.post(
                f'/api/events/{self.event.id}/slot-bookings/',
                {'slotId': slot.id, 'phone': f'+91999999{100 + len(slot_status)}'},
                format='json',
            )
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertEqual(response.json().get('error'), 'Slot is not available')

    def test_create_booking_idempotency_key_with_different_payload_replays_existing_booking(self):
        first_payload = {
            'slotId': self.slot.id,
            'seatsBooked': 1,
            'name': 'Guest Replay',
            'phone': '+919999999988',
            'idempotencyKey': 'payload-mismatch-key',
        }
        second_payload = {
            'slotId': self.slot.id,
            'seatsBooked': 2,
            'name': 'Different Name',
            'phone': '+919999999977',
            'idempotencyKey': 'payload-mismatch-key',
        }

        first = self.client.post(f'/api/events/{self.event.id}/slot-bookings/', first_payload, format='json')
        second = self.client.post(f'/api/events/{self.event.id}/slot-bookings/', second_payload, format='json')

        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(first.json().get('bookingId'), second.json().get('bookingId'))
        self.assertEqual(SlotBooking.objects.filter(event=self.event).count(), 1)

    def test_slot_mode_allows_explicit_decline_via_rsvp_endpoint(self):
        payload = {
            'name': 'Decline Guest',
            'phone': '+919888888888',
            'will_attend': 'no',
            'guests_count': 1,
        }
        response = self.client.post(f'/api/events/{self.event.id}/rsvp/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(SlotBooking.objects.filter(event=self.event).count(), 0)
        rsvp = RSVP.objects.filter(event=self.event, phone='+919888888888').first()
        self.assertIsNotNone(rsvp)
        self.assertEqual(rsvp.will_attend, 'no')

    def test_slot_mode_rejects_yes_on_rsvp_endpoint_without_booking(self):
        payload = {
            'name': 'Attend Without Slot',
            'phone': '+919777777777',
            'will_attend': 'yes',
            'guests_count': 1,
        }
        response = self.client.post(f'/api/events/{self.event.id}/rsvp/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('choose a slot', response.json().get('error', '').lower())


class GreetingCardSampleCatalogTestCase(TestCase):
    """Pagination + server-side search for the greeting-card catalog API."""

    def setUp(self):
        self.client = APIClient()
        self.host = User.objects.create_user(email='catalog-host@test.com', name='Catalog Host')
        self.client.force_authenticate(user=self.host)
        # 30 active samples → spans two pages at page_size=24.
        for i in range(30):
            GreetingCardSample.objects.create(
                name=f'Sample {i:02d}',
                description='floral wedding card' if i < 5 else 'plain',
                background_image_url=f'https://cdn.test/greeting-cards/{i}.jpg',
                tags=['floral', 'wedding'] if i < 5 else ['minimal'],
                sort_order=i,
            )

    def test_list_returns_paginated_envelope(self):
        response = self.client.get('/api/events/greeting-card-samples/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertEqual(body['count'], 30)
        self.assertEqual(len(body['results']), 24)
        self.assertIsNotNone(body['next'])
        # thumbnail_url is part of the serialized shape.
        self.assertIn('thumbnail_url', body['results'][0])

    def test_page_size_query_param_capped(self):
        response = self.client.get('/api/events/greeting-card-samples/?page_size=100')
        body = response.json()
        # max_page_size caps at 60, so all 30 fit on one page.
        self.assertEqual(len(body['results']), 30)
        self.assertIsNone(body['next'])

    def test_second_page(self):
        response = self.client.get('/api/events/greeting-card-samples/?page=2')
        body = response.json()
        self.assertEqual(len(body['results']), 6)
        self.assertIsNone(body['next'])

    def test_server_search_matches_tags_and_description(self):
        response = self.client.get('/api/events/greeting-card-samples/?q=floral')
        body = response.json()
        self.assertEqual(body['count'], 5)
        for result in body['results']:
            self.assertIn('floral', result['tags'])

    def test_tags_filter(self):
        response = self.client.get('/api/events/greeting-card-samples/?tags=minimal')
        body = response.json()
        self.assertEqual(body['count'], 25)

    def test_non_staff_excludes_inactive(self):
        GreetingCardSample.objects.create(
            name='Hidden', background_image_url='https://cdn.test/h.jpg', is_active=False,
        )
        response = self.client.get('/api/events/greeting-card-samples/?page_size=60')
        body = response.json()
        self.assertEqual(body['count'], 30)


class GreetingCardUploadThumbnailTestCase(TestCase):
    """Upload endpoint generates and returns a thumbnail_url."""

    def setUp(self):
        self.client = APIClient()
        self.staff = User.objects.create_user(email='staff@test.com', name='Staff')
        self.staff.is_staff = True
        self.staff.save(update_fields=['is_staff'])
        self.client.force_authenticate(user=self.staff)

    def _png_bytes(self):
        import io
        from PIL import Image
        img = Image.new('RGB', (1200, 1600), color=(120, 80, 200))
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        return buf.getvalue()

    def test_upload_returns_url_and_thumbnail_url(self):
        from unittest import mock
        from django.core.files.uploadedfile import SimpleUploadedFile

        upload = SimpleUploadedFile('card.png', self._png_bytes(), content_type='image/png')

        # Avoid real S3/disk: return a deterministic URL per stored key.
        def fake_store(content, key, content_type):
            return f'https://cdn.test/{key}'

        with mock.patch('apps.events.views._store_greeting_card_bytes', side_effect=fake_store):
            response = self.client.post(
                '/api/events/greeting-card-samples/upload-image/',
                {'image': upload},
                format='multipart',
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertIn('url', body)
        self.assertTrue(body['url'].startswith('https://cdn.test/greeting-cards/'))
        # A thumbnail was generated for this static PNG.
        self.assertTrue(body['thumbnail_url'].startswith('https://cdn.test/greeting-cards/thumbs/'))
        self.assertTrue(body['thumbnail_url'].endswith('.webp'))

    def test_non_staff_cannot_upload(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        non_staff = User.objects.create_user(email='nonstaff@test.com', name='No')
        self.client.force_authenticate(user=non_staff)
        upload = SimpleUploadedFile('card.png', self._png_bytes(), content_type='image/png')
        response = self.client.post(
            '/api/events/greeting-card-samples/upload-image/',
            {'image': upload},
            format='multipart',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class DesignCodeLayoutFilterTestCase(TestCase):
    """Design code (GreetingCardSample.code) drives layout filtering via the FK."""

    def setUp(self):
        self.client = APIClient()
        self.staff = User.objects.create_user(email='dc-staff@test.com', name='DC Staff')
        self.staff.is_staff = True
        self.staff.save(update_fields=['is_staff'])

        self.design_a = GreetingCardSample.objects.create(
            name='Design A', background_image_url='https://cdn.test/a.jpg',
        )
        self.design_b = GreetingCardSample.objects.create(
            name='Design B', background_image_url='https://cdn.test/b.jpg',
        )
        # Two published+public layouts for A, one for B, one unlinked.
        self.layout_a1 = InvitePageLayout.objects.create(
            name='A1', card_sample=self.design_a, visibility='public', status='published',
            created_by=self.staff,
        )
        self.layout_a2 = InvitePageLayout.objects.create(
            name='A2', card_sample=self.design_a, visibility='public', status='published',
            created_by=self.staff,
        )
        self.layout_b1 = InvitePageLayout.objects.create(
            name='B1', card_sample=self.design_b, visibility='public', status='published',
            created_by=self.staff,
        )
        self.layout_unlinked = InvitePageLayout.objects.create(
            name='Unlinked', visibility='public', status='published', created_by=self.staff,
        )

    def test_code_is_auto_generated(self):
        self.assertTrue(self.design_a.code.startswith('DSGN-'))
        self.assertNotEqual(self.design_a.code, self.design_b.code)

    def test_design_code_filter_returns_only_linked_layouts(self):
        host = User.objects.create_user(email='dc-host@test.com', name='DC Host')
        self.client.force_authenticate(user=host)
        response = self.client.get(
            f'/api/events/invite-page-layouts/?design_code={self.design_a.code}'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        names = sorted(item['name'] for item in response.json())
        self.assertEqual(names, ['A1', 'A2'])

    def test_card_code_in_serialized_layout(self):
        self.client.force_authenticate(user=self.staff)
        response = self.client.get(
            f'/api/events/invite-page-layouts/?design_code={self.design_b.code}'
        )
        body = response.json()
        self.assertEqual(len(body), 1)
        self.assertEqual(body[0]['card_code'], self.design_b.code)

    def test_no_filter_returns_all_published_public(self):
        host = User.objects.create_user(email='dc-host2@test.com', name='DC Host2')
        self.client.force_authenticate(user=host)
        response = self.client.get('/api/events/invite-page-layouts/')
        self.assertEqual(len(response.json()), 4)

