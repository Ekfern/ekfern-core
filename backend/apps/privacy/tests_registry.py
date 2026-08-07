"""
Tests for the PII registry contents (FIX 1) and the boot-time validating
system checks (FIX 2). Kept separate from tests.py, which other agents own.
"""
from dataclasses import replace

from django.test import SimpleTestCase

from apps.events.models import (
    SlotBooking,
    CampaignRecipient,
    AttributionClick,
    InvitePageView,
    RSVPPageView,
)
from apps.notifications.models import (
    NotificationLog,
    NotificationQueue,
    StaffNotificationRecipient,
)
from apps.privacy.registry import REGISTRY, Retention, PIIField, Category, Scrub
from apps.privacy.checks import check_pii_registry, check_unregistered_pii


class RegistrySpecTests(SimpleTestCase):
    """The models added in FIX 1 are registered with sane subject/owner paths."""

    EXPECTED = {
        SlotBooking: ("phone_snapshot", "event__host", Retention.CONTACT),
        CampaignRecipient: ("phone", "campaign__event__host", Retention.CONTACT),
        AttributionClick: ("guest__phone", "event__host", Retention.BEHAVIORAL),
        InvitePageView: ("guest__phone", "event__host", Retention.BEHAVIORAL),
        RSVPPageView: ("guest__phone", "event__host", Retention.BEHAVIORAL),
        NotificationLog: ("to", None, Retention.OPERATIONAL),
        NotificationQueue: (None, "user", Retention.OPERATIONAL),
        StaffNotificationRecipient: ("email", None, Retention.OPERATIONAL),
    }

    def test_models_registered_with_expected_paths(self):
        for model, (subject_key, owner_path, retention) in self.EXPECTED.items():
            self.assertIn(model, REGISTRY, f"{model.__name__} not registered")
            spec = REGISTRY[model]
            self.assertEqual(spec.subject_key, subject_key, model.__name__)
            self.assertEqual(spec.owner_path, owner_path, model.__name__)
            self.assertEqual(spec.retention, retention, model.__name__)

    def test_every_spec_has_a_linkage(self):
        # Every registered model must be reachable either by subject or by owner.
        for model, spec in REGISTRY.items():
            self.assertTrue(
                spec.subject_key or spec.owner_path,
                f"{model.__name__} has neither subject_key nor owner_path",
            )

    def test_financial_retention_reserved_for_amount_bearing_models(self):
        # None of the FIX 1 models are financial.
        for model in self.EXPECTED:
            self.assertNotEqual(REGISTRY[model].retention, Retention.FINANCIAL)


class CheckPIIRegistryTests(SimpleTestCase):
    """The privacy.E001 check resolves every real registry path, and catches drift."""

    def test_real_registry_has_no_errors(self):
        errors = check_pii_registry()
        self.assertEqual(errors, [], f"unexpected registry errors: {errors}")

    def test_bogus_field_name_is_reported(self):
        original = REGISTRY[SlotBooking]
        bogus = replace(
            original,
            fields=list(original.fields) + [
                PIIField("does_not_exist", Category.CONTACT, Scrub.NULL),
            ],
        )
        REGISTRY[SlotBooking] = bogus
        try:
            errors = check_pii_registry()
        finally:
            REGISTRY[SlotBooking] = original
        self.assertTrue(
            any(e.id == "privacy.E001" and "does_not_exist" in e.msg for e in errors),
            f"expected an E001 for the bogus field, got: {errors}",
        )

    def test_bogus_subject_key_path_is_reported(self):
        original = REGISTRY[AttributionClick]
        bogus = replace(original, subject_key="guest__nope")
        REGISTRY[AttributionClick] = bogus
        try:
            errors = check_pii_registry()
        finally:
            REGISTRY[AttributionClick] = original
        self.assertTrue(
            any(e.id == "privacy.E001" and "guest__nope" in e.msg for e in errors),
            f"expected an E001 for the bogus subject_key, got: {errors}",
        )

    def test_bogus_owner_path_is_reported(self):
        original = REGISTRY[SlotBooking]
        bogus = replace(original, owner_path="event__no_such_host")
        REGISTRY[SlotBooking] = bogus
        try:
            errors = check_pii_registry()
        finally:
            REGISTRY[SlotBooking] = original
        self.assertTrue(
            any(e.id == "privacy.E001" and "no_such_host" in e.msg for e in errors),
            f"expected an E001 for the bogus owner_path, got: {errors}",
        )


class CheckUnregisteredPIITests(SimpleTestCase):
    """W001 is best-effort and non-fatal; it should not fire for the known columns
    now that every model carrying them is registered."""

    def test_returns_only_warnings(self):
        results = check_unregistered_pii()
        for w in results:
            self.assertEqual(w.id, "privacy.W001")
            # Warnings never fail `manage.py check` (ERROR level is 40).
            self.assertLess(w.level, 40)
