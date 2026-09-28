"""Design history: snapshots, session folding, retention, and read-only access."""
import json
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.users.models import User

from .design_history import record_design_version
from .models import Event, EventCoHost, EventDesignVersion


def config(n=1, colour='#111111'):
    return {'tiles': [{'id': f't{i}', 'type': 'title', 'enabled': True} for i in range(n)],
            'customColors': {'primary': colour}}


class RecordDesignVersionTests(TestCase):
    def setUp(self):
        self.host = User.objects.create_user(email='dh-host@test.com', name='Host')
        self.other = User.objects.create_user(email='dh-other@test.com', name='Other')
        self.event = Event.objects.create(host=self.host, slug='dh-event', title='DH Event')

    def versions(self):
        return EventDesignVersion.objects.filter(event=self.event).order_by('-created_at')

    def test_a_burst_of_saves_folds_into_one_version(self):
        # Autosave fires every 1.5s; without folding an afternoon is hundreds of rows.
        for i in range(1, 6):
            record_design_version(self.event, config(i), saved_by=self.host)
        self.assertEqual(self.versions().count(), 1)
        self.assertEqual(len(self.versions().first().config['tiles']), 5)

    def test_a_different_person_starts_a_new_version(self):
        record_design_version(self.event, config(1), saved_by=self.host)
        record_design_version(self.event, config(2), saved_by=self.other)
        self.assertEqual(self.versions().count(), 2)

    def test_an_old_session_is_not_folded_into(self):
        first = record_design_version(self.event, config(1), saved_by=self.host)
        EventDesignVersion.objects.filter(id=first.id).update(
            created_at=timezone.now() - timedelta(minutes=30)
        )
        record_design_version(self.event, config(2), saved_by=self.host)
        self.assertEqual(self.versions().count(), 2)

    def test_a_labelled_version_is_kept_separate(self):
        record_design_version(self.event, config(1), saved_by=self.host,
                              label=EventDesignVersion.LABEL_PUBLISHED)
        record_design_version(self.event, config(2), saved_by=self.host)
        self.assertEqual(self.versions().count(), 2)

    def test_size_is_recorded(self):
        v = record_design_version(self.event, config(3), saved_by=self.host)
        self.assertEqual(v.size_bytes, len(json.dumps(config(3))))

    def test_history_is_trimmed_to_the_size_budget(self):
        big = {'blob': 'x' * (EventDesignVersion.MAX_TOTAL_BYTES // 3)}
        for i in range(6):
            v = record_design_version(self.event, dict(big, n=i), saved_by=self.host,
                                      label=f'forced-{i}')
            EventDesignVersion.objects.filter(id=v.id).update(
                created_at=timezone.now() - timedelta(minutes=10 * (6 - i))
            )
        record_design_version(self.event, {'final': True}, saved_by=self.host, label='last')
        total = sum(v.size_bytes for v in self.versions())
        self.assertLessEqual(total, EventDesignVersion.MAX_TOTAL_BYTES)
        self.assertGreaterEqual(self.versions().count(), 1)

    def test_recording_never_breaks_the_save_it_records(self):
        # Unserialisable config: history must swallow it, not raise.
        self.assertIsNone(record_design_version(self.event, {'bad': object()}, saved_by=self.host))


class DesignHistoryApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.host = User.objects.create_user(email='dha-host@test.com', name='Host')
        self.cohost = User.objects.create_user(email='dha-co@test.com', name='Co')
        self.stranger = User.objects.create_user(email='dha-x@test.com', name='X')
        self.event = Event.objects.create(host=self.host, slug='dha-event', title='DHA Event')
        self.version = record_design_version(self.event, config(2, '#abcdef'), saved_by=self.host)
        self.list_url = f'/api/events/{self.event.id}/design/versions/'

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
