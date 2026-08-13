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

    def test_anonymous_guest_requires_phone(self):
        """Phone is the identifier across the product; email is optional here too."""
        r = self.client.post(self._respond_url(self.event.slug), {
            'catalog_item_id': self.item.id,
            'response_type': 'pledge',
            'name': 'Anon',
        }, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertIn('Phone number is required', str(r.data))

    def test_anonymous_guest_creates_response(self):
        r = self.client.post(self._respond_url(self.event.slug), {
            'catalog_item_id': self.item.id,
            'response_type': 'pledge',
            'name': 'Anon User',
            'phone': '9700000123',
            'country_code': '+91',
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
                    'phone': '9700000124',
                    'country_code': '+91',
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


class RsvpIdentityFollowsCredentialTest(TestCase):
    """
    Identity comes from the credential, not from the phone field.

    Before this, the number typed on the form decided whose RSVP was being
    filed. A guest holding their own invite link could submit another listed
    guest's number and the RSVP would be created against - or overwrite - that
    other guest. The form now locks the field for identified visitors; these
    tests cover the half that a removed attribute or a direct API call cannot
    get around.
    """

    def setUp(self):
        from apps.events import membership

        self.membership = membership
        self.host = User.objects.create_user(email='identity-host@test.com', name='Identity Host')
        self.event = make_event(self.host, is_public=False)
        self.client = APIClient()
        self.alice = Guest.objects.create(
            event=self.event, name='Alice', phone='+919111100001',
        )
        self.bob = Guest.objects.create(
            event=self.event, name='Bob', phone='+919111100002',
        )
        self.alice.refresh_from_db()
        self.bob.refresh_from_db()

    def _submit(self, phone, credential=''):
        return self.client.post(
            f'/api/events/{self.event.id}/rsvp/{credential}',
            {'name': 'Alice', 'phone': phone, 'country_code': '+91',
             'will_attend': 'yes', 'guests_count': 1},
            format='json',
        )

    def test_token_holder_cannot_file_under_another_guests_number(self):
        r = self._submit(self.bob.phone, credential=f'?g={self.alice.guest_token}')
        self.assertIn(r.status_code, (200, 201))

        rsvp = RSVP.objects.get(event=self.event, is_removed=False)
        self.assertEqual(rsvp.guest, self.alice, 'RSVP was attributed to the wrong guest')
        self.assertEqual(rsvp.phone, self.alice.phone, 'submitted number overrode the credential')
        self.assertFalse(
            RSVP.objects.filter(event=self.event, guest=self.bob).exists(),
            "Bob got an RSVP he did not file",
        )

    def test_pass_holder_cannot_file_under_another_guests_number(self):
        access_pass = self.membership.issue_pass(self.event, self.alice)
        r = self._submit(self.bob.phone, credential=f'?p={access_pass}')
        self.assertIn(r.status_code, (200, 201))

        rsvp = RSVP.objects.get(event=self.event, is_removed=False)
        self.assertEqual(rsvp.guest, self.alice)
        self.assertEqual(rsvp.phone, self.alice.phone)

    def test_credential_holder_cannot_overwrite_another_guests_existing_rsvp(self):
        """The phone is the RSVP's key, so this is the case that silently edits someone else."""
        bobs_rsvp = RSVP.objects.create(
            event=self.event, guest=self.bob, name='Bob', phone=self.bob.phone,
            will_attend='no', guests_count=1,
        )
        self._submit(self.bob.phone, credential=f'?g={self.alice.guest_token}')

        bobs_rsvp.refresh_from_db()
        self.assertEqual(bobs_rsvp.will_attend, 'no', "Bob's answer was changed by another guest")
        self.assertEqual(bobs_rsvp.guests_count, 1)

    def test_credential_holder_submitting_an_unlisted_number_still_lands_on_themselves(self):
        """A stale or mistyped number must not strand a guest who holds a valid credential."""
        r = self._submit('+919000000009', credential=f'?g={self.alice.guest_token}')
        self.assertIn(r.status_code, (200, 201))
        rsvp = RSVP.objects.get(event=self.event, is_removed=False)
        self.assertEqual(rsvp.guest, self.alice)
        self.assertEqual(rsvp.phone, self.alice.phone)

    def test_without_a_credential_the_guest_list_check_still_applies(self):
        """No credential: unchanged behaviour, only listed numbers get through."""
        refused = self._submit('+919000000009')
        self.assertEqual(refused.status_code, 403)

        allowed = self._submit(self.alice.phone)
        self.assertIn(allowed.status_code, (200, 201))
        self.assertEqual(RSVP.objects.get(event=self.event, is_removed=False).guest, self.alice)

    def test_token_lookup_returns_the_number_the_form_prefills(self):
        r = self.client.get(
            f'/api/events/{self.event.id}/rsvp/guest-by-token/?g={self.alice.guest_token}'
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['local_number'], '9111100001')
        self.assertEqual(r.data['country_code'], '+91')


class RegistryPhonePrimaryTest(TestCase):
    """
    Phone identifies a giver on the registry, as it does everywhere else.

    Email used to be mandatory here while the guest list only ever required a
    phone number. A host could therefore invite someone with nothing but a
    number, and that guest would be stopped at the last step of giving a gift -
    asked for the one thing nobody had ever asked them for.
    """

    def setUp(self):
        from apps.events import membership

        self.membership = membership
        self.host = User.objects.create_user(email='reg-host@test.com', name='Registry Host')
        self.event = make_event(self.host, is_public=True)
        self.client = APIClient()
        self.catalog = make_catalog(self.event)
        self.item = make_item(self.catalog)
        # Invited on a phone number only - no email anywhere, which is allowed.
        self.guest = Guest.objects.create(
            event=self.event, name='Phone Only Guest', phone='+919812345678',
        )
        self.guest.refresh_from_db()

    def _respond(self, payload, credential=''):
        return self.client.post(
            f'/api/catalog/{self.event.slug}/respond/{credential}',
            {'catalog_item_id': self.item.id, 'response_type': 'interest', **payload},
            format='json',
        )

    # -- the case that was blocked -----------------------------------------

    def test_guest_with_no_email_can_give(self):
        r = self._respond({}, credential=f'?g={self.guest.guest_token}')
        self.assertEqual(r.status_code, 201, r.data)
        response_obj = CatalogResponse.objects.get(id=r.data['id'])
        self.assertEqual(response_obj.guest, self.guest)
        self.assertEqual(response_obj.phone, self.guest.phone)
        self.assertEqual(response_obj.email, '')

    # -- anonymous givers ---------------------------------------------------

    def test_phone_is_required_and_email_is_not(self):
        missing = self._respond({'name': 'Rita'})
        self.assertEqual(missing.status_code, 400)
        self.assertIn('Phone', missing.data['error'])

        ok = self._respond({'name': 'Rita', 'phone': '9700000001', 'country_code': '+91'})
        self.assertEqual(ok.status_code, 201, ok.data)
        self.assertEqual(CatalogResponse.objects.get(id=ok.data['id']).email, '')

    def test_name_is_still_required(self):
        r = self._respond({'phone': '9700000001', 'country_code': '+91'})
        self.assertEqual(r.status_code, 400)
        self.assertIn('Name', r.data['error'])

    def test_email_is_kept_when_offered(self):
        r = self._respond({
            'name': 'Rita', 'phone': '9700000001', 'country_code': '+91',
            'email': 'rita@test.com',
        })
        self.assertEqual(CatalogResponse.objects.get(id=r.data['id']).email, 'rita@test.com')

    # -- phone as a key means normalizing it --------------------------------

    def test_number_is_normalized_so_one_person_is_one_key(self):
        """'9812345678' and '+919812345678' must not become two different givers."""
        local = self._respond({'name': 'X', 'phone': '9812345678', 'country_code': '+91'})
        e164 = self._respond({'name': 'X', 'phone': '+919812345678', 'country_code': '+91'})

        stored = {
            CatalogResponse.objects.get(id=local.data['id']).phone,
            CatalogResponse.objects.get(id=e164.data['id']).phone,
        }
        self.assertEqual(stored, {'+919812345678'})

    def test_a_listed_number_links_the_response_to_the_guest(self):
        """The host should see one person, not a gift and a guest that never meet."""
        r = self._respond({'name': 'Anything', 'phone': '9812345678', 'country_code': '+91'})
        self.assertEqual(CatalogResponse.objects.get(id=r.data['id']).guest, self.guest)

    def test_an_unlisted_number_still_gives_without_a_guest_link(self):
        r = self._respond({'name': 'Stranger', 'phone': '9700000009', 'country_code': '+91'})
        self.assertEqual(r.status_code, 201)
        self.assertIsNone(CatalogResponse.objects.get(id=r.data['id']).guest)

    def test_repeat_giving_creates_a_second_record(self):
        for _ in range(2):
            self._respond({'name': 'Rita', 'phone': '9700000001', 'country_code': '+91'})
        self.assertEqual(CatalogResponse.objects.filter(phone='+919700000001').count(), 2)

    # -- external link clicks ----------------------------------------------

    def test_click_tracking_needs_no_identity(self):
        """A tap types nothing, so demanding a name or number silently loses the count."""
        r = self.client.post(
            f'/api/catalog/{self.event.slug}/respond/',
            {'catalog_item_id': self.item.id, 'response_type': 'external_click'},
            format='json',
        )
        self.assertEqual(r.status_code, 201, r.data)
        self.assertTrue(
            CatalogResponse.objects.filter(response_type='external_click').exists()
        )

    # -- the receipt for people who gave without an email -------------------

    def test_guest_sees_only_their_own_contributions(self):
        other = Guest.objects.create(event=self.event, name='Other', phone='+919700000002')
        other.refresh_from_db()
        self._respond({}, credential=f'?g={self.guest.guest_token}')
        self._respond({}, credential=f'?g={other.guest_token}')

        r = self.client.get(
            f'/api/catalog/{self.event.slug}/my-responses/?g={self.guest.guest_token}'
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data['results']), 1)
        self.assertEqual(r.data['guest_name'], 'Phone Only Guest')
        self.assertEqual(r.data['results'][0]['item_title'], self.item.title)

    def test_contributions_reachable_with_a_pass_and_renews_it(self):
        access_pass = self.membership.issue_pass(self.event, self.guest)
        self._respond({}, credential=f'?p={access_pass}')

        r = self.client.get(f'/api/catalog/{self.event.slug}/my-responses/?p={access_pass}')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data['results']), 1)
        self.assertEqual(
            self.membership.verify_pass(self.event, r.data['access_pass']), self.guest
        )

    def test_contributions_refused_without_identity(self):
        r = self.client.get(f'/api/catalog/{self.event.slug}/my-responses/')
        self.assertEqual(r.status_code, 403)
        self.assertEqual(r.data['code'], 'guest_required')

    def test_contributions_exclude_click_tracking(self):
        self.client.post(
            f'/api/catalog/{self.event.slug}/respond/?g={self.guest.guest_token}',
            {'catalog_item_id': self.item.id, 'response_type': 'external_click'},
            format='json',
        )
        r = self.client.get(
            f'/api/catalog/{self.event.slug}/my-responses/?g={self.guest.guest_token}'
        )
        self.assertEqual(r.data['results'], [])

    # -- the host still learns who gave -------------------------------------

    def test_host_alert_identifies_a_giver_who_left_no_email(self):
        from apps.catalog.notifications import send_catalog_response_notification
        from unittest.mock import patch

        r = self._respond({}, credential=f'?g={self.guest.guest_token}')
        response_obj = CatalogResponse.objects.get(id=r.data['id'])

        with patch('apps.catalog.notifications.send_email') as send:
            send_catalog_response_notification(response_obj)

        body = ''.join(str(c) for c in send.call_args_list)
        self.assertIn('+919812345678', body)
        self.assertNotIn('()', body, 'host alert rendered empty parentheses')
