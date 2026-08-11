"""
Admin-configurable PrivacySettings singleton: erasure must read the retention
window from the DB (falling back to the setting), so ops can tune the erasure
SLA without a code deploy.
"""
from datetime import datetime

from django.core.cache import cache
from django.test import TestCase, override_settings

from apps.users.models import User
from apps.events.models import Event, Guest
from apps.privacy.models import PrivacySettings
from apps.privacy.services import erase_subject


def _make_guest(phone):
    host = User.objects.create(email=f"h{phone}@example.com", name="H")
    event = Event.objects.create(host=host, title="E", slug=f"e{phone}", event_type="wedding")
    return Guest.objects.create(event=event, name="P", phone=phone, email="g@example.com")


class PrivacySettingsTests(TestCase):
    def setUp(self):
        cache.clear()  # get_config caches for 60s; isolate tests

    @override_settings(BACKUP_RETENTION_DAYS=35)
    def test_falls_back_to_setting_when_no_row(self):
        self.assertFalse(PrivacySettings.objects.exists())
        self.assertEqual(PrivacySettings.backup_retention(), 35)

    def test_singleton_save_forces_pk_1_and_busts_cache(self):
        PrivacySettings.backup_retention()  # primes the cache with the fallback
        obj = PrivacySettings(backup_retention_days=90)
        obj.save()
        self.assertEqual(obj.pk, 1)
        # A second save updates the same row, never a second singleton.
        obj.backup_retention_days = 120
        obj.save()
        self.assertEqual(PrivacySettings.objects.count(), 1)
        self.assertEqual(PrivacySettings.backup_retention(), 120)

    def test_erase_uses_configured_retention_window(self):
        PrivacySettings(backup_retention_days=90).save()
        g = _make_guest("+910000000099")
        result = erase_subject(phone="+910000000099", actor="ops", reason="T-9")
        clear_at = datetime.fromisoformat(result["_backup_clear_at"])
        days_out = (clear_at - datetime.now(clear_at.tzinfo)).days
        # ~90 days out (allow slop for execution time).
        self.assertGreaterEqual(days_out, 88)
        self.assertLessEqual(days_out, 90)
