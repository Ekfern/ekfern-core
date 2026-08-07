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
    event = models.ForeignKey(
        "events.Event", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)    # append-only: no updated_at

    class Meta:
        db_table = "privacy_consent_event"
        indexes = [models.Index(fields=["subject_type", "subject_id"])]

    def __str__(self):
        return f"{self.subject_type}#{self.subject_id} {self.purpose} ({self.basis})"


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
