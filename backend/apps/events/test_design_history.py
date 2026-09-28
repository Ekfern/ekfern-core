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

    def test_detail_returns_the_config_and_a_readable_summary(self):
        self.client.force_authenticate(user=self.host)
        body = self.client.get(f'{self.list_url}{self.version.id}/').json()
        self.assertEqual(body['config']['customColors']['primary'], '#abcdef')
        self.assertEqual(body['summary']['customColors']['primary'], '#abcdef')
        self.assertEqual(len(body['summary']['tiles']), 2)
        self.assertEqual(body['summary']['tiles'][0]['type'], 'title')

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
