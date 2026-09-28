"""Design history: snapshots, session folding, retention, and read-only access."""
import json
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.users.models import User

from .design_history import record_event_version
from .models import Event, EventCoHost, EventVersion


def config(n=1, colour='#111111'):
    return {'tiles': [{'id': f't{i}', 'type': 'title', 'enabled': True} for i in range(n)],
            'customColors': {'primary': colour}}


class RecordDesignVersionTests(TestCase):
    def setUp(self):
        self.host = User.objects.create_user(email='dh-host@test.com', name='Host')
        self.other = User.objects.create_user(email='dh-other@test.com', name='Other')
        self.event = Event.objects.create(host=self.host, slug='dh-event', title='DH Event')

    def versions(self):
        return EventVersion.objects.filter(event=self.event).order_by('-created_at')

    def save(self, cfg, **kwargs):
        self.event.page_config = cfg
        self.event.save(update_fields=['page_config'])
        return record_event_version(self.event, **kwargs)

    def test_a_burst_of_saves_folds_into_one_version(self):
        # Autosave fires every 1.5s; without folding an afternoon is hundreds of rows.
        for i in range(1, 6):
            self.save(config(i), saved_by=self.host)
        self.assertEqual(self.versions().count(), 1)
        self.assertEqual(len(self.versions().first().config['tiles']), 5)

    def test_a_different_person_starts_a_new_version(self):
        self.save(config(1), saved_by=self.host)
        self.save(config(2), saved_by=self.other)
        self.assertEqual(self.versions().count(), 2)

    def test_an_old_session_is_not_folded_into(self):
        first = self.save(config(1), saved_by=self.host)
        EventVersion.objects.filter(id=first.id).update(
            created_at=timezone.now() - timedelta(minutes=30)
        )
        self.save(config(2), saved_by=self.host)
        self.assertEqual(self.versions().count(), 2)

    def test_a_labelled_version_is_kept_separate(self):
        self.save(config(1), saved_by=self.host,
                              label=EventVersion.LABEL_PUBLISHED)
        self.save(config(2), saved_by=self.host)
        self.assertEqual(self.versions().count(), 2)

    def test_size_covers_the_design_and_the_details(self):
        # Retention budgets by bytes, so the figure has to account for
        # everything a version stores, not just the design half of it.
        v = self.save(config(3), saved_by=self.host)
        self.assertEqual(v.size_bytes, len(json.dumps({'config': v.config, 'details': v.details})))
        self.assertGreater(v.size_bytes, len(json.dumps(config(3))))

    def test_history_is_trimmed_to_the_size_budget(self):
        big = {'blob': 'x' * (EventVersion.MAX_TOTAL_BYTES // 3)}
        for i in range(6):
            v = self.save(dict(big, n=i), saved_by=self.host, label=f'forced-{i}')
            EventVersion.objects.filter(id=v.id).update(
                created_at=timezone.now() - timedelta(minutes=10 * (6 - i))
            )
        self.save({'final': True}, saved_by=self.host, label='last')
        total = sum(v.size_bytes for v in self.versions())
        self.assertLessEqual(total, EventVersion.MAX_TOTAL_BYTES)
        self.assertGreaterEqual(self.versions().count(), 1)

    def test_recording_never_breaks_the_save_it_records(self):
        # Unserialisable config: history must swallow it, not raise.
        self.event.page_config = {'bad': object()}
        self.assertIsNone(record_event_version(self.event, saved_by=self.host))


class DesignHistoryApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.host = User.objects.create_user(email='dha-host@test.com', name='Host')
        self.cohost = User.objects.create_user(email='dha-co@test.com', name='Co')
        self.stranger = User.objects.create_user(email='dha-x@test.com', name='X')
        self.event = Event.objects.create(
            host=self.host, slug='dha-event', title='DHA Event',
            page_config=config(2, '#abcdef'),
        )
        self.version = record_event_version(self.event, saved_by=self.host)
        self.list_url = f'/api/events/{self.event.id}/versions/'

    def test_host_sees_the_list_without_configs(self):
        self.client.force_authenticate(user=self.host)
        body = self.client.get(self.list_url).json()
        self.assertEqual(len(body['results']), 1)
        self.assertEqual(body['results'][0]['saved_by'], 'Host')
        # The list stays light: configs are fetched one at a time.
        self.assertNotIn('config', body['results'][0])

    def test_detail_returns_a_readable_summary_and_not_the_config(self):
        self.client.force_authenticate(user=self.host)
        body = self.client.get(f'{self.list_url}{self.version.id}/').json()
        self.assertEqual(body['summary']['customColors']['primary'], '#abcdef')
        self.assertEqual(len(body['summary']['tiles']), 2)
        self.assertEqual(body['summary']['tiles'][0]['type'], 'title')
        # Nothing renders a stored version, so the config itself never ships.
        self.assertNotIn('config', body)

    def test_a_cohost_can_read_history(self):
        EventCoHost.objects.create(
            event=self.event, user=self.cohost, invited_email=self.cohost.email,
            status=EventCoHost.STATUS_ACCEPTED, capabilities=['manage_guests'],
        )
        self.client.force_authenticate(user=self.cohost)
        self.assertEqual(self.client.get(self.list_url).status_code, status.HTTP_200_OK)

    def test_a_stranger_cannot(self):
        self.client.force_authenticate(user=self.stranger)
        self.assertEqual(self.client.get(self.list_url).status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(
            self.client.get(f'{self.list_url}{self.version.id}/').status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_there_is_no_restore_endpoint(self):
        self.client.force_authenticate(user=self.host)
        response = self.client.post(f'{self.list_url}{self.version.id}/restore/')
        self.assertIn(response.status_code, (status.HTTP_404_NOT_FOUND, status.HTTP_405_METHOD_NOT_ALLOWED))


class DesignDiffTests(TestCase):
    """Each version is described by the location of its changes and the changes."""

    def setUp(self):
        from .design_diff import diff_configs
        self.diff = diff_configs

    def at(self, changes, location):
        return next((c for c in changes if c['location'] == location), None)

    def test_a_colour_change_names_the_setting_and_both_values(self):
        changes = self.diff(
            {'customColors': {'primary': '#C8B8A2'}},
            {'customColors': {'primary': '#1E4620'}},
        )
        c = self.at(changes, 'Colours · primary')
        self.assertEqual((c['from'], c['to']), ('#C8B8A2', '#1E4620'))

    def test_tile_copy_change_is_located_by_the_tile(self):
        before = {'tiles': [{'id': 'a', 'type': 'title', 'settings': {'text': "You're Invited"}}]}
        after = {'tiles': [{'id': 'a', 'type': 'title', 'settings': {'text': 'Join us'}}]}
        c = self.at(self.diff(before, after), 'title “You’re Invited” · text')
        if c is None:  # name comes from the new tile
            c = self.at(self.diff(before, after), 'title “Join us” · text')
        self.assertEqual((c['from'], c['to']), ("You're Invited", 'Join us'))

    def test_hiding_a_tile_reads_as_shown_to_hidden(self):
        before = {'tiles': [{'id': 'a', 'type': 'timer', 'enabled': True}]}
        after = {'tiles': [{'id': 'a', 'type': 'timer', 'enabled': False}]}
        c = self.at(self.diff(before, after), 'timer')
        self.assertEqual((c['from'], c['to']), ('shown', 'hidden'))

    def test_added_and_removed_tiles(self):
        before = {'tiles': [{'id': 'a', 'type': 'title'}]}
        after = {'tiles': [{'id': 'b', 'type': 'footer'}]}
        changes = self.diff(before, after)
        self.assertEqual(self.at(changes, 'footer')['to'], 'added')
        self.assertEqual(self.at(changes, 'title')['to'], 'removed')

    def test_reordering_is_reported_once_not_as_every_tile_moving(self):
        before = {'tiles': [{'id': 'a', 'type': 'title'}, {'id': 'b', 'type': 'footer'}]}
        after = {'tiles': [{'id': 'b', 'type': 'footer'}, {'id': 'a', 'type': 'title'}]}
        changes = self.diff(before, after)
        self.assertIsNotNone(self.at(changes, 'Section order'))
        self.assertEqual(len(changes), 1)

    def test_long_values_are_truncated_rather_than_dumped(self):
        before = {'tiles': [{'id': 'a', 'type': 'description', 'settings': {'text': 'x'}}]}
        after = {'tiles': [{'id': 'a', 'type': 'description', 'settings': {'text': 'y' * 400}}]}
        c = self.diff(before, after)[0]
        self.assertLess(len(c['to']), 80)
        self.assertTrue(c['to'].endswith('…'))

    def test_nested_settings_are_named_not_dumped(self):
        before = {'texture': {'type': 'none'}}
        after = {'texture': {'type': 'paper', 'intensity': 40}}
        changes = self.diff(before, after)
        self.assertTrue(any(c['location'].startswith('Texture') for c in changes))
        self.assertFalse(any('{' in c['to'] for c in changes))

    def test_identical_configs_report_nothing(self):
        cfg = {'customColors': {'primary': '#fff'}, 'tiles': [{'id': 'a', 'type': 'title'}]}
        self.assertEqual(self.diff(cfg, dict(cfg)), [])


class EventDetailsInTheSameTimelineTests(TestCase):
    """A changed date belongs in the same history as a changed colour."""

    def setUp(self):
        self.client = APIClient()
        self.host = User.objects.create_user(email='det-host@test.com', name='Host')
        self.event = Event.objects.create(
            host=self.host, slug='det-event', title='Original Title', city='Mumbai',
        )
        self.client.force_authenticate(user=self.host)

    def versions(self):
        return EventVersion.objects.filter(event=self.event).order_by('-created_at')

    def test_editing_details_records_a_version(self):
        response = self.client.patch(
            f'/api/events/{self.event.id}/', {'title': 'Renamed Event'}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self.versions().count(), 1)
        self.assertEqual(self.versions().first().details['title'], 'Renamed Event')

    def test_the_change_names_the_field_and_both_values(self):
        record_event_version(self.event, saved_by=self.host, label='first')
        self.event.title = 'Renamed Event'
        self.event.save(update_fields=['title'])
        record_event_version(self.event, saved_by=self.host, label='second')

        newest = self.versions().first()
        body = self.client.get(f'/api/events/{self.event.id}/versions/{newest.id}/').json()
        change = next(c for c in body['changes'] if c['location'] == 'Event title')
        self.assertEqual((change['from'], change['to']), ('Original Title', 'Renamed Event'))

    def test_a_version_captures_design_and_details_together(self):
        self.event.page_config = {'customColors': {'primary': '#fff'}}
        self.event.save(update_fields=['page_config'])
        v = record_event_version(self.event, saved_by=self.host)
        self.assertEqual(v.details['city'], 'Mumbai')
        self.assertEqual(v.config['customColors']['primary'], '#fff')

    def test_toggles_read_as_on_and_off(self):
        record_event_version(self.event, saved_by=self.host, label='before')
        self.event.has_rsvp = False
        self.event.save(update_fields=['has_rsvp'])
        record_event_version(self.event, saved_by=self.host, label='after')
        newest = self.versions().first()
        body = self.client.get(f'/api/events/{self.event.id}/versions/{newest.id}/').json()
        change = next(c for c in body['changes'] if c['location'] == 'RSVP')
        self.assertEqual((change['from'], change['to']), ('on', 'off'))
