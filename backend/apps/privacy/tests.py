from datetime import date, datetime
from unittest.mock import patch

from django.test import TestCase

from apps.users.models import User
from apps.events.models import Event, Guest
from apps.catalog.models import HostCatalog, CatalogItem, CatalogResponse
from apps.privacy.registry import REGISTRY, Retention
from apps.privacy.services import (
    anonymize_instance,
    pseudonymize_instance,
    erase_subject,
    export_for_subject,
    collect_for_subject,
    _cascades_into_financial,
)
from apps.privacy.helpers import record_consent, audit
from apps.privacy.models import ConsentEvent, AuditEvent


def _make_guest(phone="+910000000001", email="g@example.com"):
    host = User.objects.create(email=f"host{phone}@example.com", name="Host")
    event = Event.objects.create(host=host, title="E", slug=f"e{phone}", event_type="wedding")
    return Guest.objects.create(event=event, name="Priya", phone=phone, email=email)


def _make_catalog_response(event, *, email, amount=250000, name="Donor", phone=""):
    # HostCatalog is OneToOne with Event, so reuse it when a test makes several
    # responses for the same event.
    catalog, _ = HostCatalog.objects.get_or_create(event=event)
    item = CatalogItem.objects.create(
        catalog=catalog,
        title="Honeymoon fund",
        item_type="contribution",
        action_type="pledge_amount",
    )
    return CatalogResponse.objects.create(
        catalog_item=item,
        event=event,
        name=name,
        email=email,
        phone=phone,
        response_type="pledge",
        amount=amount,
    )


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


class CascadeGuardTests(TestCase):
    """F1 — a hard erase must never let a CASCADE take out FINANCIAL rows."""

    def test_user_cascades_into_financial_guest_does_not(self):
        self.assertTrue(_cascades_into_financial(User))
        self.assertFalse(_cascades_into_financial(Guest))

    def test_hard_erase_host_keeps_financial_row_and_pseudonymizes_identity(self):
        host = User.objects.create(email="host@example.com", name="Host")
        event = Event.objects.create(host=host, title="E", slug="e-fin", event_type="wedding")
        # A pledge under the host's event — deleting the host would CASCADE
        # User -> Event -> CatalogResponse and destroy this row.
        resp = _make_catalog_response(event, email="donor@example.com", amount=250000)

        result = erase_subject(email="host@example.com", hard=True)

        # The host row survives (refused hard-delete, pseudonymized instead).
        host.refresh_from_db()
        self.assertTrue(host.email.startswith("anon_"))
        self.assertEqual(host.name, "Removed")
        self.assertEqual(result["User"]["mode"], "pseudonymized")

        # The FINANCIAL row is untouched: still present, amount intact.
        resp.refresh_from_db()
        self.assertTrue(CatalogResponse.objects.filter(id=resp.id).exists())
        self.assertEqual(resp.amount, 250000)


class IdempotencyTests(TestCase):
    """F6 — erasing twice yields the same pseudonym (HASH/TOMBSTONE no-ops)."""

    def test_double_erase_is_stable(self):
        g = _make_guest(phone="+910000000020", email="stable@example.com")

        erase_subject(phone="+910000000020")
        g.refresh_from_db()
        first_phone, first_name = g.phone, g.name

        # Re-collect by the *pseudonymized* value would miss it, so re-run the
        # scrub directly to prove the transform itself is idempotent.
        pseudonymize_instance(g)
        g.refresh_from_db()

        self.assertEqual(g.phone, first_phone)   # HASH did not re-hash
        self.assertEqual(g.name, first_name)     # TOMBSTONE stayed "Removed"
        self.assertTrue(first_phone.startswith("anon_"))


class IdentityLinkingTests(TestCase):
    """F8 — resolving one identifier reaches rows keyed by the other."""

    def test_collect_by_email_includes_phone_keyed_rows(self):
        _make_guest(phone="+910000000030", email="linked@example.com")
        found = collect_for_subject(email="linked@example.com")
        # Guest is phone-keyed; supplying only the email must still reach it.
        self.assertIn(Guest, found)
        self.assertTrue(found[Guest].filter(phone="+910000000030").exists())

    def test_collect_by_phone_includes_email_keyed_rows(self):
        host = User.objects.create(email="linked2@example.com", name="Host")
        event = Event.objects.create(host=host, title="E", slug="e-link2", event_type="wedding")
        Guest.objects.create(event=event, name="P", phone="+910000000031", email="linked2@example.com")
        # CatalogResponse is email-keyed; supplying only a phone must reach it.
        _make_catalog_response(event, email="linked2@example.com")
        found = collect_for_subject(phone="+910000000031")
        self.assertIn(CatalogResponse, found)


class MatchedTotalTests(TestCase):
    """F7 — zero-match requests are distinguishable from real ones."""

    def test_export_matched_zero_on_unknown(self):
        data = export_for_subject(email="nobody@example.com")
        self.assertEqual(data["_matched"], 0)

    def test_erase_matched_reports_rows(self):
        _make_guest(phone="+910000000040", email="known@example.com")
        result = erase_subject(phone="+910000000040")
        self.assertGreater(result["_matched"], 0)


class AttributionTests(TestCase):
    """CONTRACT C — actor/reason thread into the audit ledger; F2/F3 shape."""

    def test_erase_writes_start_and_complete_audits_with_pseudonym(self):
        _make_guest(phone="+910000000050", email="who@example.com")
        before = AuditEvent.objects.filter(action="erase").count()
        erase_subject(phone="+910000000050", actor="admin:42", reason="dsr-123")
        erase_audits = AuditEvent.objects.filter(action="erase")
        # Two records: one written before mutation (F3 pre-audit), one after.
        self.assertEqual(erase_audits.count() - before, 2)
        # The raw phone must never appear in the immutable subject_ref.
        for a in erase_audits:
            self.assertNotIn("+910000000050", a.subject_ref)
            self.assertTrue(a.subject_ref.startswith("anon_"))


class BackupAndCacheTests(TestCase):
    """Finding #17: erasure must bust the CDN/app cache of affected public
    pages and record the backup-clearance horizon (the true erasure SLA)."""

    def test_affected_event_slugs_from_guest(self):
        from apps.privacy.services import _affected_event_slugs
        g = _make_guest(phone="+910000000060")
        collected = collect_for_subject(phone="+910000000060")
        self.assertIn(g.event.slug, _affected_event_slugs(collected))

    def test_erase_invalidates_cache_and_reports_backup_sla(self):
        g = _make_guest(phone="+910000000061")
        slug = g.event.slug
        with patch("apps.events.views.invalidate_invite_page_cache") as inv, \
             patch("apps.events.views.invalidate_cloudfront_cache_immediate") as cf:
            result = erase_subject(phone="+910000000061", actor="ops", reason="T-1")
        # Affected public page busted in both Django cache and CloudFront.
        inv.assert_any_call(slug)
        cf.assert_any_call(slug)
        self.assertIn(slug, result["_caches_invalidated"])
        # Backup-clearance horizon is a real future timestamp.
        clear_at = datetime.fromisoformat(result["_backup_clear_at"])
        self.assertGreater(clear_at, datetime.now(clear_at.tzinfo))

    def test_cache_failure_never_breaks_erase(self):
        _make_guest(phone="+910000000062")
        with patch("apps.events.views.invalidate_invite_page_cache",
                   side_effect=RuntimeError("edge down")), \
             patch("apps.events.views.invalidate_cloudfront_cache_immediate"):
            # Must still complete and pseudonymize the row despite cache errors.
            result = erase_subject(phone="+910000000062", actor="ops", reason="T-2")
        self.assertEqual(result["_caches_invalidated"], [])
        from apps.events.models import Guest
        self.assertFalse(Guest.objects.filter(phone="+910000000062").exists())
