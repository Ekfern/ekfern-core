"""
Append-only compliance ledgers. These record things that cannot be
reconstructed after the fact — consent given, and sensitive access — so they
must exist from day one. Write only via ``helpers.record_consent`` /
``helpers.audit``; never expose update or delete in normal flows.
"""
from django.db import models


class ConsentEvent(models.Model):
    """One immutable record each time a subject grants/records a lawful basis."""

    class Purpose(models.TextChoices):
        TERMS = "terms", "Terms of Service"
        PRIVACY = "privacy", "Privacy Policy"
        EVENT_PROCESSING = "event_processing", "Guest data for running an event"
        MARKETING = "marketing", "Marketing"

    class Basis(models.TextChoices):
        CONSENT = "consent", "Consent"
        CONTRACT = "contract", "Contract"
        LEGITIMATE_INTEREST = "legitimate_interest", "Legitimate interest"
        LEGAL_OBLIGATION = "legal_obligation", "Legal obligation"

    subject_type = models.CharField(max_length=16)          # "host" | "guest"
    subject_id = models.BigIntegerField()
    purpose = models.CharField(max_length=32, choices=Purpose.choices)
    basis = models.CharField(max_length=32, choices=Basis.choices)
    policy_version = models.CharField(max_length=32, blank=True)
    source = models.CharField(max_length=32)                # "signup" | "rsvp_submit" | "import"
    # Plain integer, NOT a ForeignKey: deleting an Event must never mutate an
    # immutable ledger row (a SET_NULL cascade would be a write on delete).
    event_id = models.BigIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)    # append-only: no updated_at

    class Meta:
        db_table = "privacy_consent_event"
        indexes = [models.Index(fields=["subject_type", "subject_id"])]

    def __str__(self):
        return f"{self.subject_type}#{self.subject_id} {self.purpose} ({self.basis})"

    def save(self, *args, **kwargs):
        if self.pk is not None:
            raise RuntimeError("ConsentEvent is append-only; updates are not allowed")
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise RuntimeError("ConsentEvent is append-only; deletes are not allowed")


class AuditEvent(models.Model):
    """One immutable record of a sensitive action on personal data."""

    class Action(models.TextChoices):
        ACCESS = "access", "Access"
        EXPORT = "export", "Export"
        ERASE = "erase", "Erase"
        ANONYMIZE = "anonymize", "Anonymize"
        LOGIN = "login", "Login"
        PERMISSION = "permission_change", "Permission change"
        NOTIFY = "notify", "Notify"

    actor = models.CharField(max_length=64)                 # user id, or "system"
    action = models.CharField(max_length=32, choices=Action.choices)
    target_model = models.CharField(max_length=64, blank=True)
    target_id = models.CharField(max_length=64, blank=True)
    subject_ref = models.CharField(max_length=128, blank=True)  # phone/email/host it concerned
    metadata = models.JSONField(default=dict, blank=True)
    ip = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "privacy_audit_event"
        indexes = [
            models.Index(fields=["action", "created_at"]),
            models.Index(fields=["target_model", "target_id"]),
        ]

    def __str__(self):
        return f"{self.action} by {self.actor} @ {self.created_at:%Y-%m-%d %H:%M}"

    def save(self, *args, **kwargs):
        if self.pk is not None:
            raise RuntimeError("AuditEvent is append-only; updates are not allowed")
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise RuntimeError("AuditEvent is append-only; deletes are not allowed")


class PrivacySettings(models.Model):
    """Singleton (pk=1) — operationally-tunable privacy knobs edited by
    super-admins in Django admin. Unlike the ledgers above this is mutable
    config, not an append-only record. When no row exists, ``get_config``
    falls back to ``django.conf.settings`` (environment), matching the
    WhatsAppSettings / LLMPlatformSettings pattern used elsewhere.
    """

    backup_retention_days = models.PositiveIntegerField(
        default=35,
        help_text=(
            "Point-in-time backup / read-replica retention window, in days. "
            "Erasure clears the primary DB and CDN immediately, but backups keep "
            "the pre-erase copy until this many days pass — so this is the TRUE "
            "erasure SLA reported to data subjects. MUST match the actual "
            "RDS/PITR retention configured in infrastructure."
        ),
    )
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        "users.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="+",
    )

    class Meta:
        db_table = "privacy_settings"
        verbose_name = "Privacy Settings"
        verbose_name_plural = "Privacy Settings"

    def __str__(self):
        return f"Privacy Settings (backup retention {self.backup_retention_days}d)"

    def save(self, *args, **kwargs):
        from django.core.cache import cache
        self.pk = 1  # Singleton — always pk=1
        super().save(*args, **kwargs)
        cache.delete("privacy_settings")

    @classmethod
    def get_config(cls) -> dict:
        """Cached config dict from DB, or settings fallback. Never raises."""
        from django.conf import settings as dj_settings
        from django.core.cache import cache

        cached = cache.get("privacy_settings")
        if cached is not None:
            return cached
        try:
            obj = cls.objects.get(pk=1)
            config = {"backup_retention_days": int(obj.backup_retention_days)}
        except cls.DoesNotExist:
            config = {
                "backup_retention_days": int(
                    getattr(dj_settings, "BACKUP_RETENTION_DAYS", 35)
                )
            }
        cache.set("privacy_settings", config, 60)
        return config

    @classmethod
    def backup_retention(cls) -> int:
        """Effective backup-retention window in days (DB → settings → 35)."""
        return cls.get_config()["backup_retention_days"]
