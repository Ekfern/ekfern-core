"""
The only sanctioned way to write to the append-only ledgers. Call these from
the real touch-points: consent at signup / RSVP submit, audit on
access / export / erase / login.
"""
from .models import ConsentEvent, AuditEvent


def record_consent(subject_type, subject_id, purpose, basis, *,
                   policy_version="", source="", event=None):
    """Append one consent record. Never updates an existing row."""
    return ConsentEvent.objects.create(
        subject_type=subject_type,
        subject_id=subject_id,
        purpose=purpose,
        basis=basis,
        policy_version=policy_version,
        source=source,
        event=event,
    )


def audit(actor, action, *, target=None, subject_ref="", ip=None, **metadata):
    """Append one audit record for a sensitive action."""
    return AuditEvent.objects.create(
        actor=str(actor),
        action=action,
        target_model=type(target).__name__ if target is not None else "",
        target_id=str(getattr(target, "id", "")) if target is not None else "",
        subject_ref=subject_ref,
        ip=ip,
        metadata=metadata,
    )
