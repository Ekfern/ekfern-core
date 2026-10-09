"""run_lifecycle_transitions: records each moment once, and warns hosts before anything closes."""
from datetime import date, timedelta
from io import StringIO
from unittest import mock

from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone

from apps.events import lifecycle
from apps.events.models import Event, EventLifecycleSettings, EventLifecycleTransition, MessageCampaign
from apps.users.models import User

SEND = 'apps.events.management.commands.run_lifecycle_transitions.send_email'


class LifecycleJobTests(TestCase):
    def setUp(self):
        cache.clear()
        self.host = User.objects.create_user(email='job-host@test.com', name='Host')

    def make(self, days_ago, **fields):
        return Event.objects.create(host=self.host, slug=f'job-{Event.objects.count()}', title='Party',
                                    has_registry=True, date=date.today() - timedelta(days=days_ago), **fields)

    def run_job(self):
        call_command('run_lifecycle_transitions', stdout=StringIO())

    def kinds(self, event):
        return sorted(EventLifecycleTransition.objects.filter(event=event).values_list('kind', flat=True))

    def enforce(self):
        EventLifecycleSettings.objects.update_or_create(pk=1, defaults={'enforce_link_off': True})
        cache.clear()

    def test_a_fresh_ending_is_recorded_and_the_host_told_once(self):
        event = self.make(days_ago=1)
        with mock.patch(SEND) as send:
            self.run_job()
            self.run_job()
        self.assertEqual(send.call_count, 1)
        self.assertIn('what happens next', send.call_args.args[1])
        self.assertEqual(self.kinds(event), ['ended', 'ended_summary'])

    def test_old_endings_are_recorded_without_mailing_anyone(self):
        event = self.make(days_ago=90)
        with mock.patch(SEND) as send:
            self.run_job()
        send.assert_not_called()
        self.assertIn('ended', self.kinds(event))

    def test_the_host_is_warned_a_week_before_gifts_close(self):
        event = self.make(days_ago=25)  # gifts close on day 30
        with mock.patch(SEND) as send:
            self.run_job()
        subjects = [c.args[1] for c in send.call_args_list]
        self.assertTrue(any(s.startswith('Gifts close on') for s in subjects), subjects)
        self.assertIn('warned_catalog', self.kinds(event))

    def test_no_gift_warning_after_the_host_closed_them(self):
        self.make(days_ago=25, catalog_closed_at=timezone.now() - timedelta(days=3))
        with mock.patch(SEND) as send:
            self.run_job()
        self.assertFalse(any(c.args[1].startswith('Gifts close') for c in send.call_args_list))

    def test_no_link_warning_while_enforcement_is_off(self):
        event = self.make(days_ago=60)
        with mock.patch(SEND):
            self.run_job()
        event.refresh_from_db()
        self.assertIsNone(event.host_warned_link_off_at)
        self.assertTrue(lifecycle.link_active(event))

    def test_turning_enforcement_on_warns_first_and_switches_off_a_week_later(self):
        event = self.make(days_ago=90)
        self.enforce()
        with mock.patch(SEND) as send:
            self.run_job()
        self.assertTrue(any('stops working' in c.args[1] for c in send.call_args_list))
        event.refresh_from_db()
        self.assertIsNotNone(event.host_warned_link_off_at)
        self.assertTrue(lifecycle.link_active(event), 'the link stays on through the notice period')
        self.assertNotIn('archived', self.kinds(event))

        later = timezone.now() + timedelta(days=8)
        with mock.patch(SEND), mock.patch('django.utils.timezone.now', return_value=later), \
                mock.patch('apps.events.views.invalidate_cloudfront_cache_immediate') as purge:
            self.run_job()
        self.assertIn('archived', self.kinds(event))
        self.assertEqual(lifecycle.phase(Event.objects.get(pk=event.pk), later), lifecycle.ARCHIVED)

    def test_a_failed_warning_is_retried_and_the_link_stays_on(self):
        event = self.make(days_ago=90)
        self.enforce()
        with mock.patch(SEND, side_effect=RuntimeError('SES down')):
            self.run_job()
        event.refresh_from_db()
        self.assertIsNone(event.host_warned_link_off_at)
        self.assertNotIn('warned_link', self.kinds(event))
        with mock.patch(SEND) as send:
            self.run_job()
        self.assertTrue(send.called)

    def test_dry_run_changes_nothing(self):
        event = self.make(days_ago=1)
        with mock.patch(SEND) as send:
            call_command('run_lifecycle_transitions', '--dry-run', stdout=StringIO())
        send.assert_not_called()
        self.assertEqual(self.kinds(event), [])


class CampaignSuppressionTests(TestCase):
    def setUp(self):
        cache.clear()
        host = User.objects.create_user(email='camp-host@test.com', name='Host')
        self.event = Event.objects.create(host=host, slug='camp', title='Camp',
                                          date=date.today() - timedelta(days=2))

    def campaign(self, guest_filter):
        return MessageCampaign.objects.create(event=self.event, name='c', guest_filter=guest_filter,
                                              channel=MessageCampaign.CHANNEL_EMAIL, subject='s', message_body='b')

    def dispatch(self, campaign):
        from apps.events.tasks import dispatch_campaign
        with mock.patch('apps.events.tasks._run_email_campaign') as run:
            dispatch_campaign.now(campaign.id)
        campaign.refresh_from_db()
        return run.called

    def test_an_rsvp_chaser_is_not_sent_after_rsvp_closes(self):
        campaign = self.campaign(MessageCampaign.FILTER_RSVP_PENDING)
        self.assertFalse(self.dispatch(campaign))
        self.assertEqual(campaign.status, MessageCampaign.STATUS_CANCELLED)

    def test_a_message_to_people_who_said_yes_still_goes(self):
        self.assertTrue(self.dispatch(self.campaign(MessageCampaign.FILTER_RSVP_YES)))
