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


class GuestMembershipPassTest(TestCase):
    """
    A guest who proves membership by phone must be able to reach the registry.

    The reported failure: an invited guest completed the RSVP on a private event
    using the generic invite link, clicked through to the registry, and was told
    "This is a private event. Use your invite link to access." He was on the
    guest list and had just proved it - but RSVP accepted a phone match while
    the catalog accepted only an invite token, so the proof did not travel.
    """

    def setUp(self):
        from apps.events import membership

        self.membership = membership
        self.host = User.objects.create_user(email='pass-host@test.com', name='Pass Host')
        self.event = make_event(self.host, is_public=False)
        self.client = APIClient()
        self.guest = Guest.objects.create(
            event=self.event, name='Invited Guest', phone='+919812345678',
        )
        self.guest.refresh_from_db()
        self.catalog = make_catalog(self.event)
        make_item(self.catalog)

    def _verify(self, phone='9812345678'):
        return self.client.post(
            f'/api/events/invite/{self.event.slug}/verify-phone/',
            {'phone': phone, 'country_code': '+91'},
            format='json',
        )

    # -- the pass itself ---------------------------------------------------

    def test_pass_round_trips_to_the_same_guest(self):
        access_pass = self.membership.issue_pass(self.event, self.guest)
        self.assertEqual(self.membership.verify_pass(self.event, access_pass), self.guest)

    def test_pass_expires(self):
        from django.core import signing

        access_pass = self.membership.issue_pass(self.event, self.guest)
        real_unsign = signing.TimestampSigner.unsign

        def expired(self_signer, value, max_age=None):
            raise signing.SignatureExpired('too old')

        signing.TimestampSigner.unsign = expired
        try:
            self.assertIsNone(self.membership.verify_pass(self.event, access_pass))
        finally:
            signing.TimestampSigner.unsign = real_unsign

    def test_pass_from_another_event_is_rejected(self):
        other_event = make_event(self.host, is_public=False)
        other_guest = Guest.objects.create(
            event=other_event, name='Other', phone='+919812345678',
        )
        foreign_pass = self.membership.issue_pass(other_event, other_guest)
        self.assertIsNone(self.membership.verify_pass(self.event, foreign_pass))

    def test_tampered_pass_is_rejected(self):
        access_pass = self.membership.issue_pass(self.event, self.guest)
        self.assertIsNone(self.membership.verify_pass(self.event, access_pass + 'x'))

    def test_removed_guest_pass_stops_working(self):
        access_pass = self.membership.issue_pass(self.event, self.guest)
        self.guest.is_removed = True
        self.guest.save(update_fields=['is_removed'])
        self.assertIsNone(self.membership.verify_pass(self.event, access_pass))

    # -- verification endpoint ---------------------------------------------

    def test_verify_phone_returns_a_pass_for_a_listed_number(self):
        r = self._verify()
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['name'], 'Invited Guest')
        self.assertEqual(
            self.membership.verify_pass(self.event, r.data['access_pass']), self.guest
        )

    def test_verify_phone_does_not_leak_the_invite_token(self):
        """The pass replaces the token here: momentary proof, not standing access."""
        r = self._verify()
        self.assertNotIn('guest_token', r.data)
        self.assertNotIn(self.guest.guest_token, str(r.data))

    def test_verify_phone_rejects_a_number_not_on_the_list(self):
        r = self._verify(phone='9000000001')
        self.assertEqual(r.status_code, 404)
        self.assertEqual(r.data['error'], self.membership.GUEST_NOT_FOUND_MESSAGE)

    def test_verify_phone_response_is_never_cached(self):
        self.assertIn('no-store', self._verify()['Cache-Control'])

    # -- the catalog gate --------------------------------------------------

    def test_private_catalog_refuses_a_visitor_with_no_credential(self):
        r = self.client.get(f'/api/catalog/{self.event.slug}/')
        self.assertEqual(r.status_code, 403)
        # The code is what lets the page offer a phone step instead of a dead end.
        self.assertEqual(r.data['code'], 'private_event')

    def test_private_catalog_accepts_a_pass(self):
        access_pass = self.membership.issue_pass(self.event, self.guest)
        r = self.client.get(f'/api/catalog/{self.event.slug}/?p={access_pass}')
        self.assertEqual(r.status_code, 200)

    def test_private_catalog_still_accepts_an_invite_token(self):
        r = self.client.get(f'/api/catalog/{self.event.slug}/?g={self.guest.guest_token}')
        self.assertEqual(r.status_code, 200)

    def test_catalog_rejects_a_pass_minted_for_another_event(self):
        other_event = make_event(self.host, is_public=False)
        other_guest = Guest.objects.create(
            event=other_event, name='Other', phone='+919700000000',
        )
        foreign_pass = self.membership.issue_pass(other_event, other_guest)
        r = self.client.get(f'/api/catalog/{self.event.slug}/?p={foreign_pass}')
        self.assertEqual(r.status_code, 403)

    def test_catalog_renews_the_pass_on_each_visit(self):
        """Sliding window: browsing must not expire mid-decision."""
        access_pass = self.membership.issue_pass(self.event, self.guest)
        r = self.client.get(f'/api/catalog/{self.event.slug}/?p={access_pass}')
        renewed = r.data['access_pass']
        self.assertTrue(renewed)
        self.assertEqual(self.membership.verify_pass(self.event, renewed), self.guest)

    def test_token_holders_are_not_issued_a_pass(self):
        r = self.client.get(f'/api/catalog/{self.event.slug}/?g={self.guest.guest_token}')
        self.assertIsNone(r.data['access_pass'])

    def test_giving_a_gift_works_with_a_pass_and_attributes_it_to_the_guest(self):
        access_pass = self.membership.issue_pass(self.event, self.guest)
        item = CatalogItem.objects.filter(catalog=self.catalog).first()
        r = self.client.post(
            f'/api/catalog/{self.event.slug}/respond/?p={access_pass}',
            {'catalog_item_id': item.id, 'response_type': 'interest', 'email': 'g@test.com'},
            format='json',
        )
        self.assertEqual(r.status_code, 201)
        response_obj = CatalogResponse.objects.get(id=r.data['id'])
        self.assertEqual(response_obj.guest, self.guest)
        self.assertEqual(response_obj.name, 'Invited Guest')

    # -- the journey that was broken ---------------------------------------

    def test_rsvp_by_phone_then_registry_without_being_asked_again(self):
        """End to end: generic link, verify at RSVP, reach the registry."""
        check = self.client.post(
            f'/api/events/{self.event.id}/rsvp/check/phone/',
            {'phone': '9812345678', 'country_code': '+91'},
            format='json',
        )
        self.assertEqual(check.status_code, 200)
        access_pass = check.data['access_pass']
        self.assertTrue(access_pass)
        # The RSVP lookup must not hand back a permanent key either.
        self.assertNotIn('guest_token', check.data)

        self.client.post(
            f'/api/events/{self.event.id}/rsvp/',
            {'name': 'Invited Guest', 'phone': '+919812345678',
             'will_attend': 'yes', 'guests_count': 1},
            format='json',
        )

        registry = self.client.get(f'/api/catalog/{self.event.slug}/?p={access_pass}')
        self.assertEqual(registry.status_code, 200, 'verified guest was refused at the registry')

    def test_pass_issued_after_an_rsvp_already_exists(self):
        """The returning-guest branch serves a different serializer - it must still mint one."""
        RSVP.objects.create(
            event=self.event, guest=self.guest, name=self.guest.name,
            phone=self.guest.phone, will_attend='yes', guests_count=1,
        )
        check = self.client.post(
            f'/api/events/{self.event.id}/rsvp/check/phone/',
            {'phone': '9812345678', 'country_code': '+91'},
            format='json',
        )
        self.assertEqual(check.status_code, 200)
        self.assertEqual(check.data['found_in'], 'rsvp')
        self.assertEqual(
            self.membership.verify_pass(self.event, check.data['access_pass']), self.guest
        )
