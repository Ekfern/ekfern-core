from datetime import date

from django.test import TestCase

from apps.users.models import User
from apps.events.models import Event, Guest
from apps.catalog.models import CatalogResponse
from apps.privacy.registry import REGISTRY, Retention
from apps.privacy.services import anonymize_instance, erase_subject, collect_for_subject
from apps.privacy.helpers import record_consent, audit
from apps.privacy.models import ConsentEvent, AuditEvent


def _make_guest(phone="+910000000001", email="g@example.com"):
    host = User.objects.create(email=f"host{phone}@example.com", name="Host")
    event = Event.objects.create(host=host, title="E", slug=f"e{phone}", event_type="wedding")
    return Guest.objects.create(event=event, name="Priya", phone=phone, email=email)


class RegistryTests(TestCase):
    def test_core_models_registered(self):
        names = {m.__name__ for m in REGISTRY}
        self.assertTrue({"User", "Guest", "RSVP", "CatalogResponse"} <= names)

    def test_guest_pii_fields_present(self):
        from apps.events.models import Guest
        fields = {f.name for f in REGISTRY[Guest].fields}
        self.assertTrue({"name", "phone", "email", "custom_fields"} <= fields)

    def test_catalog_response_is_financial(self):
        # Drives the "preserve on erasure" branch.
        self.assertEqual(REGISTRY[CatalogResponse].retention, Retention.FINANCIAL)


class AnonymizeTests(TestCase):
    def test_anonymize_scrubs_by_strategy(self):
        g = _make_guest(phone="+910000000009", email="x@example.com")
        anonymize_instance(g)
        g.refresh_from_db()
        self.assertEqual(g.name, "Removed")            # tombstone
        self.assertTrue(g.phone.startswith("anon_"))   # peppered hash
        self.assertIsNone(g.email)                     # null


class EraseTests(TestCase):
    def test_hard_erase_removes_contact_rows(self):
        g = _make_guest(phone="+910000000010")
        erase_subject(phone="+910000000010", hard=True)
        self.assertFalse(Guest.objects.filter(id=g.id).exists())

    def test_subject_resolver_matches_by_key(self):
        _make_guest(phone="+910000000011")
        found = collect_for_subject(phone="+910000000011")
        self.assertIn(Guest, found)


class LedgerTests(TestCase):
    def test_consent_and_audit_append(self):
        record_consent("host", 1, ConsentEvent.Purpose.TERMS, ConsentEvent.Basis.CONSENT, source="signup")
        audit("system", AuditEvent.Action.ACCESS, subject_ref="+910000000001")
        self.assertEqual(ConsentEvent.objects.count(), 1)
        self.assertEqual(AuditEvent.objects.count(), 1)
