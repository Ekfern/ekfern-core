"""
Tests for append-only ledger immutability and helper contracts.
Kept separate from tests.py (owned by another agent).
"""
from django.test import TestCase

from apps.users.models import User
from apps.events.models import Event
from apps.privacy.models import ConsentEvent, AuditEvent
from apps.privacy.helpers import record_consent, audit


class LedgerImmutabilityTests(TestCase):
    def test_consent_update_raises(self):
        c = record_consent(
            "host", 1, ConsentEvent.Purpose.TERMS, ConsentEvent.Basis.CONSENT, source="signup"
        )
        c.source = "import"
        with self.assertRaises(RuntimeError):
            c.save()

    def test_audit_update_raises(self):
        a = audit("system", AuditEvent.Action.ACCESS, subject_ref="+910000000001")
        a.subject_ref = "changed"
        with self.assertRaises(RuntimeError):
            a.save()

    def test_consent_delete_raises(self):
        c = record_consent(
            "host", 1, ConsentEvent.Purpose.TERMS, ConsentEvent.Basis.CONSENT, source="signup"
        )
        with self.assertRaises(RuntimeError):
            c.delete()

    def test_audit_delete_raises(self):
        a = audit("system", AuditEvent.Action.ACCESS, subject_ref="+910000000001")
        with self.assertRaises(RuntimeError):
            a.delete()


class ConsentEventLinkTests(TestCase):
    def test_event_id_stored_and_survives_event_delete(self):
        host = User.objects.create(email="host-ledger@example.com", name="Host")
        event = Event.objects.create(host=host, title="E", slug="e-ledger", event_type="wedding")
        event_pk = event.id

        c = record_consent(
            "host", host.id, ConsentEvent.Purpose.EVENT_PROCESSING,
            ConsentEvent.Basis.CONTRACT, source="signup", event=event,
        )
        self.assertEqual(c.event_id, event_pk)

        event.delete()

        c.refresh_from_db()
        # Ledger row is intact and still references the (now-deleted) event id.
        self.assertTrue(ConsentEvent.objects.filter(id=c.id).exists())
        self.assertEqual(c.event_id, event_pk)

    def test_event_none_stores_null(self):
        c = record_consent(
            "host", 1, ConsentEvent.Purpose.TERMS, ConsentEvent.Basis.CONSENT,
            source="signup", event=None,
        )
        self.assertIsNone(c.event_id)


class AuditMetadataTests(TestCase):
    def test_metadata_stored_flat(self):
        a = audit(
            "system", AuditEvent.Action.EXPORT,
            subject_ref="+910000000001", metadata={"k": "v"},
        )
        a.refresh_from_db()
        self.assertEqual(a.metadata, {"k": "v"})

    def test_metadata_defaults_to_empty_dict(self):
        a = audit("system", AuditEvent.Action.ACCESS)
        a.refresh_from_db()
        self.assertEqual(a.metadata, {})
