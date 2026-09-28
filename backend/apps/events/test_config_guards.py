"""The page config stores image references, never image bytes."""
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.users.models import User

from .config_guards import (
    MAX_DATA_URI_CHARS,
    collect_oversized_data_uris,
    find_oversized_data_uris,
)
from .models import Event


def oversized_data_uri():
    return 'data:image/jpeg;base64,' + ('A' * (MAX_DATA_URI_CHARS + 1))


class FindOversizedDataUrisTests(TestCase):
    def test_finds_them_however_deeply_nested(self):
        config = {
            'background_url': oversized_data_uri(),
            'tiles': [
                {'id': 'a', 'settings': {'imageUrl': 'https://cdn.example.com/a.jpg'}},
                {'id': 'b', 'settings': {'imageUrl': oversized_data_uri()}},
            ],
        }
        found = find_oversized_data_uris(config)
        self.assertEqual(len(found), 2)
        self.assertTrue(any('background_url' in f for f in found))
        self.assertTrue(any('tiles[1]' in f for f in found))

    def test_small_inline_svgs_are_allowed(self):
        # Decorative textures and map styles are legitimately inline.
        config = {'texture': {'url': "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>"}}
        self.assertEqual(find_oversized_data_uris(config), [])

    def test_ordinary_urls_are_allowed(self):
        config = {'background_url': 'https://cdn.ekfern.com/events/1/bg.jpg', 'tiles': []}
        self.assertEqual(find_oversized_data_uris(config), [])

    def test_empty_config_is_fine(self):
        self.assertEqual(find_oversized_data_uris({}), [])


class UpdateDesignRejectsEmbeddedImagesTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.host = User.objects.create_user(email='cfg-host@test.com', name='Host')
        self.event = Event.objects.create(host=self.host, slug='cfg-event', title='Config Event')
        self.client.force_authenticate(user=self.host)
        self.url = f'/api/events/{self.event.id}/design/'

    def test_embedded_image_is_rejected_and_nothing_is_stored(self):
        response = self.client.put(
            self.url,
            {'page_config': {'background_url': oversized_data_uri()}},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('background_url', ' '.join(response.json()['fields']))
        self.event.refresh_from_db()
        self.assertEqual(self.event.page_config, {})

    def test_a_config_of_references_still_saves(self):
        response = self.client.put(
            self.url,
            {'page_config': {'background_url': 'https://cdn.ekfern.com/bg.jpg', 'tiles': []}},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.event.refresh_from_db()
        self.assertEqual(self.event.page_config['background_url'], 'https://cdn.ekfern.com/bg.jpg')

    def test_a_legacy_event_can_still_be_saved(self):
        # The editor sends the whole config back on every save, so an event that
        # already carries base64 must not become uneditable.
        legacy = oversized_data_uri()
        self.event.page_config = {'background_url': legacy, 'tiles': []}
        self.event.save(update_fields=['page_config'])
        response = self.client.put(
            self.url,
            {'page_config': {'background_url': legacy, 'tiles': [{'id': 'x'}]}},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.event.refresh_from_db()
        self.assertEqual(len(self.event.page_config['tiles']), 1)

    def test_a_new_embedded_image_is_still_refused_on_a_legacy_event(self):
        self.event.page_config = {'background_url': oversized_data_uri()}
        self.event.save(update_fields=['page_config'])
        response = self.client.put(
            self.url,
            {'page_config': {'hero': {'src': oversized_data_uri() + 'different'}}},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
