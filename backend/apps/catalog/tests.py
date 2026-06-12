from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.events.models import Event, Guest, RSVP
from apps.catalog.models import CatalogItem, CatalogResponse, HostCatalog

User = get_user_model()


def make_event(host, is_public=True, has_registry=True):
    import random, string
    slug = ''.join(random.choices(string.ascii_lowercase, k=8))
    return Event.objects.create(
        host=host, slug=slug, title='Test Event',
        is_public=is_public, has_registry=has_registry,
    )


def make_catalog(event, access_mode='same_as_event'):
    catalog, _ = HostCatalog.objects.get_or_create(
        event=event,
        defaults={'is_enabled': True, 'catalog_access_mode': access_mode},
    )
    if catalog.catalog_access_mode != access_mode or not catalog.is_enabled:
        catalog.is_enabled = True
        catalog.catalog_access_mode = access_mode
        catalog.save(update_fields=['is_enabled', 'catalog_access_mode', 'updated_at'])
    return catalog


def make_item(catalog, action_type='pledge_amount'):
    return CatalogItem.objects.create(
        catalog=catalog, title='Test Item',
        item_type='contribution', action_type=action_type,
        amount_type='flexible', status='published',
    )


class HostCatalogCRUDTest(TestCase):
    def setUp(self):
        self.host = User.objects.create_user(email='host@test.com', name='Host')
        self.other = User.objects.create_user(email='other@test.com', name='Other')
        self.event = make_event(self.host)
        self.catalog = make_catalog(self.event)
        self.client = APIClient()

    def test_owner_can_get_catalog(self):
        self.client.force_authenticate(self.host)
        r = self.client.get(f'/api/events/{self.event.id}/catalog/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['id'], self.catalog.id)

    def test_non_owner_cannot_patch_catalog(self):
        self.client.force_authenticate(self.other)
        r = self.client.patch(f'/api/events/{self.event.id}/catalog/', {'is_enabled': False})
        self.assertEqual(r.status_code, 403)

    def test_patch_syncs_has_registry(self):
        self.client.force_authenticate(self.host)
        r = self.client.patch(f'/api/events/{self.event.id}/catalog/', {'is_enabled': False}, format='json')
        self.assertEqual(r.status_code, 200)
        self.event.refresh_from_db()
        self.assertFalse(self.event.has_registry)


class CatalogAccessTest(TestCase):
    def setUp(self):
        self.host = User.objects.create_user(email='host2@test.com', name='Host 2')
        self.event = make_event(self.host)
        self.client = APIClient()

        self.guest = Guest.objects.create(
            event=self.event, name='Guest One', phone='+919999900001',
        )
        self.guest.refresh_from_db()

    def _catalog_url(self, slug, token=None):
        url = f'/api/catalog/{slug}/'
        if token:
            url += f'?g={token}'
        return url

    def test_after_rsvp_denied_without_rsvp(self):
        catalog = make_catalog(self.event, access_mode='after_rsvp')
        make_item(catalog)
        r = self.client.get(self._catalog_url(self.event.slug, self.guest.guest_token))
        self.assertEqual(r.status_code, 403)
        self.assertEqual(r.data['code'], 'rsvp_required')

    def test_after_rsvp_allowed_with_rsvp(self):
        catalog = make_catalog(self.event, access_mode='after_rsvp')
        make_item(catalog)
        RSVP.objects.create(
            event=self.event, guest=self.guest,
            name=self.guest.name, phone=self.guest.phone,
            will_attend='maybe',
        )
        r = self.client.get(self._catalog_url(self.event.slug, self.guest.guest_token))
        self.assertEqual(r.status_code, 200)

    def test_confirmed_only_denied_for_no_rsvp(self):
        catalog = make_catalog(self.event, access_mode='confirmed_only')
        make_item(catalog)
        r = self.client.get(self._catalog_url(self.event.slug, self.guest.guest_token))
        self.assertEqual(r.status_code, 403)
        self.assertEqual(r.data['code'], 'confirmed_required')

    def test_confirmed_only_denied_for_will_attend_no(self):
        catalog = make_catalog(self.event, access_mode='confirmed_only')
        make_item(catalog)
        RSVP.objects.create(
            event=self.event, guest=self.guest,
            name=self.guest.name, phone=self.guest.phone,
            will_attend='no',
        )
        r = self.client.get(self._catalog_url(self.event.slug, self.guest.guest_token))
        self.assertEqual(r.status_code, 403)
        self.assertEqual(r.data['code'], 'confirmed_required')

    def test_confirmed_only_allowed_for_will_attend_yes(self):
        catalog = make_catalog(self.event, access_mode='confirmed_only')
        make_item(catalog)
        RSVP.objects.create(
            event=self.event, guest=self.guest,
            name=self.guest.name, phone=self.guest.phone,
            will_attend='yes',
        )
        r = self.client.get(self._catalog_url(self.event.slug, self.guest.guest_token))
        self.assertEqual(r.status_code, 200)


class CatalogResponseCreateTest(TestCase):
    def setUp(self):
        self.host = User.objects.create_user(email='host3@test.com', name='Host 3')
        self.event = make_event(self.host)
        self.catalog = make_catalog(self.event)
        self.item = make_item(self.catalog)
        self.client = APIClient()

        self.guest = Guest.objects.create(
            event=self.event, name='Guest A', phone='+919999900002',
            email='guesta@test.com',
        )
        self.guest.refresh_from_db()

    def _respond_url(self, slug, token=None):
        url = f'/api/catalog/{slug}/respond/'
        if token:
            url += f'?g={token}'
        return url

    def test_anonymous_guest_requires_email(self):
        r = self.client.post(self._respond_url(self.event.slug), {
            'catalog_item_id': self.item.id,
            'response_type': 'pledge',
            'name': 'Anon',
        }, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertIn('Email is required', str(r.data))

    def test_anonymous_guest_creates_response(self):
        r = self.client.post(self._respond_url(self.event.slug), {
            'catalog_item_id': self.item.id,
            'response_type': 'pledge',
            'name': 'Anon User',
            'email': 'anon@test.com',
            'amount': 100000,
        }, format='json')
        self.assertEqual(r.status_code, 201)
        resp = CatalogResponse.objects.get(id=r.data['id'])
        self.assertIsNone(resp.guest)
        self.assertEqual(resp.amount, 100000)

    def test_identified_guest_populates_guest_id(self):
        RSVP.objects.create(
            event=self.event, guest=self.guest,
            name=self.guest.name, phone=self.guest.phone,
            will_attend='yes',
        )
        r = self.client.post(
            self._respond_url(self.event.slug, self.guest.guest_token),
            {'catalog_item_id': self.item.id, 'response_type': 'interest'},
            format='json',
        )
        self.assertEqual(r.status_code, 201)
        resp = CatalogResponse.objects.get(id=r.data['id'])
        self.assertEqual(resp.guest_id, self.guest.id)
        self.assertEqual(resp.email, self.guest.email)

    def test_response_source_invite_and_qr(self):
        for source in ('invite', 'qr', 'direct'):
            r = self.client.post(
                self._respond_url(self.event.slug),
                {
                    'catalog_item_id': self.item.id,
                    'response_type': 'interest',
                    'name': 'Test User',
                    'email': f'{source}@test.com',
                    'source': source,
                },
                format='json',
            )
            self.assertEqual(r.status_code, 201, source)
            resp = CatalogResponse.objects.get(id=r.data['id'])
            self.assertEqual(resp.source, source)
