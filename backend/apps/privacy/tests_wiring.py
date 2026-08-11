"""
Finding #20: the consent/audit ledgers must be written by the REAL flows —
signup, login, and RSVP submit — not just the admin command. These integration
tests exercise the endpoints and assert the ledger rows appear.
"""
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from apps.users.models import User
from apps.events.models import Event, RSVP
from apps.privacy.models import ConsentEvent, AuditEvent


class SignupConsentTests(TestCase):
    def test_signup_records_terms_and_privacy_consent(self):
        resp = APIClient().post(
            reverse("signup"),
            {"email": "newhost@example.com", "name": "New Host"},
            format="json",
        )
        self.assertIn(resp.status_code, (200, 201))
        user = User.objects.get(email="newhost@example.com")
        consents = ConsentEvent.objects.filter(subject_type="host", subject_id=user.id)
        self.assertEqual(
            set(consents.values_list("purpose", flat=True)),
            {ConsentEvent.Purpose.TERMS, ConsentEvent.Purpose.PRIVACY},
        )
        self.assertTrue(all(c.source == "signup" for c in consents))


class LoginAuditTests(TestCase):
    def test_password_login_writes_login_audit_without_pii(self):
        user = User.objects.create(email="pw@example.com", name="PW", email_verified=True)
        user.set_password("secret-123")
        user.save()

        resp = APIClient().post(
            reverse("password_login"),
            {"email": "pw@example.com", "password": "secret-123"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        audits = AuditEvent.objects.filter(
            action=AuditEvent.Action.LOGIN, actor=f"user:{user.id}"
        )
        self.assertEqual(audits.count(), 1)
        # The ledger must key on the internal id, never the raw email.
        self.assertNotIn("pw@example.com", audits.first().subject_ref)


class RSVPConsentTests(TestCase):
    def test_public_rsvp_records_guest_consent(self):
        host = User.objects.create(email="h@example.com", name="H")
        event = Event.objects.create(
            host=host, title="Party", slug="party-1", event_type="wedding",
            is_public=True, has_rsvp=True,
        )
        resp = APIClient().post(
            reverse("event-rsvp", args=[event.id]),
            {"name": "Guest A", "phone": "+919812345678", "will_attend": "yes"},
            format="json",
        )
        self.assertIn(resp.status_code, (200, 201))
        rsvp = RSVP.objects.filter(event=event).first()
        self.assertIsNotNone(rsvp)
        consent = ConsentEvent.objects.filter(
            subject_type="guest",
            purpose=ConsentEvent.Purpose.EVENT_PROCESSING,
            event_id=event.id,
            subject_id=rsvp.guest_id,
        )
        self.assertGreaterEqual(consent.count(), 1)
        self.assertEqual(consent.first().source, "rsvp_submit")
