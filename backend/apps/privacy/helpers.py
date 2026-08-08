"""
The only sanctioned way to write to the append-only ledgers. Call these from
the real touch-points: consent at signup / RSVP submit, audit on
access / export / erase / login.
"""
from .models import ConsentEvent, AuditEvent


def record_consent(subject_type, subject_id, purpose, basis, *,
                   policy_version="", source="", event=None):
    """Append one consent record. Never updates an existing row.

    ``event`` may be an Event instance or None; only its id is stored (the
    ledger keeps a plain integer, not a FK, so Event deletion can't mutate it).
    """
    return ConsentEvent.objects.create(
        subject_type=subject_type,
        subject_id=subject_id,
        purpose=purpose,
        basis=basis,
        policy_version=policy_version,
        source=source,
        event_id=event.id if event is not None else None,
    )


def audit(actor, action, *, target=None, subject_ref="", ip=None, metadata=None):
    """Append one audit record for a sensitive action.

    ``metadata`` is stored flat in ``AuditEvent.metadata`` (not double-nested).
    """
    return AuditEvent.objects.create(
        actor=str(actor),
        action=action,
        target_model=type(target).__name__ if target is not None else "",
        target_id=str(getattr(target, "id", "")) if target is not None else "",
        subject_ref=subject_ref,
        ip=ip,
        metadata=metadata or {},
    )


# --- Touch-point wiring -----------------------------------------------------
# Thin, self-guarding wrappers the real flows (signup / login / RSVP) call so a
# ledger write can never break the user-facing action. Each swallows its own
# errors: an audit/consent failure must not fail a login or an RSVP.

def record_signup_consent(user, *, source="signup", policy_version=""):
    """A host agreed to Terms + Privacy when they created their account."""
    try:
        for purpose in (ConsentEvent.Purpose.TERMS, ConsentEvent.Purpose.PRIVACY):
            record_consent(
                "host", user.id, purpose, ConsentEvent.Basis.CONSENT,
                policy_version=policy_version, source=source,
            )
    except Exception:
        pass


def record_login(user, *, ip=None):
    """A successful authentication. subject_ref is the internal user id (never
    the raw email), so the ledger holds no PII."""
    try:
        audit(f"user:{user.id}", AuditEvent.Action.LOGIN,
              subject_ref=f"user:{user.id}", ip=ip)
    except Exception:
        pass


def record_rsvp_consent(event, guest_id, *, source="rsvp_submit"):
    """A guest submitted an RSVP, consenting to their data being processed to
    run the event. Keyed to the Guest row; a no-op if there is no guest id."""
    if not guest_id:
        return
    try:
        record_consent(
            "guest", guest_id, ConsentEvent.Purpose.EVENT_PROCESSING,
            ConsentEvent.Basis.CONSENT, source=source, event=event,
        )
    except Exception:
        pass
