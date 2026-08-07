"""
Data-subject and tenant operations, driven entirely by the PII registry:

  * collect_for_subject / collect_for_owner — find every record about a person,
    or owned by a host (the same resolver the change-management "who's affected"
    query and the retention job reuse).
  * export_for_subject — a portability dump.
  * anonymize_instance / erase_subject — erasure that honours retention: a
    FINANCIAL record is pseudonymized (kept for tax/accounting) even under a
    hard-delete request; contact data is truly removed.
"""
import hashlib

from django.conf import settings
from django.db import models as dj_models

from .registry import REGISTRY, Retention, Scrub
from .helpers import audit


def _blank_value(field):
    """A NOT-NULL-safe 'empty' value for a model field: None only where the
    column allows it, else the type's empty ('' for text, {} for JSON)."""
    if field.null:
        return None
    if isinstance(field, dj_models.JSONField):
        return {}
    if isinstance(field, (dj_models.CharField, dj_models.TextField)):
        return ""
    return None


def _pseudonym(value) -> str | None:
    """Peppered, non-reversible pseudonym. The pepper (SECRET_KEY) matters:
    phone numbers are low-entropy and a bare hash would be brute-forceable."""
    if not value:
        return value
    # Keep the pseudonym short enough for narrow columns (e.g. phone = varchar(20)).
    # The pepper (SECRET_KEY) — not the length — is what makes it non-reversible.
    digest = hashlib.sha256((settings.SECRET_KEY + str(value)).encode()).hexdigest()[:12]
    return f"anon_{digest}"


def _apply_scrub(value, how: Scrub, field):
    if how == Scrub.NULL:
        return _blank_value(field)
    if how == Scrub.TOMBSTONE:
        return "Removed"
    if how == Scrub.HASH:
        return _pseudonym(value)
    return value  # KEEP


def collect_for_subject(*, phone=None, email=None):
    """{Model: queryset} of every record ABOUT this person, across events.
    Matches each model by its own subject_key using whichever id is supplied."""
    ids = {"phone": phone, "email": email}
    out = {}
    for model, spec in REGISTRY.items():
        key = spec.subject_key
        if key and ids.get(key):
            out[model] = model.objects.filter(**{key: ids[key]})
    return out


def collect_for_owner(host):
    """{Model: queryset} of every record a host OWNS (they're the controller)."""
    out = {}
    for model, spec in REGISTRY.items():
        if spec.owner_path:
            out[model] = model.objects.filter(**{spec.owner_path: host})
    return out


def export_for_subject(*, phone=None, email=None):
    """Portability: everything held about a person, per model."""
    data = {}
    for model, qs in collect_for_subject(phone=phone, email=email).items():
        cols = [f.name for f in REGISTRY[model].fields] + ["id"]
        data[model.__name__] = list(qs.values(*cols))
    audit("system", "export", subject_ref=phone or email or "")
    return data


def anonymize_instance(obj) -> None:
    spec = REGISTRY[type(obj)]
    for f in spec.fields:
        field = obj._meta.get_field(f.name)
        setattr(obj, f.name, _apply_scrub(getattr(obj, f.name), f.scrub, field))
    obj.save()


def erase_subject(*, phone=None, email=None, hard=False):
    """Erasure request. FINANCIAL rows are always kept-but-pseudonymized;
    other rows are anonymized (default) or hard-deleted when ``hard`` is set."""
    result = {}
    for model, qs in collect_for_subject(phone=phone, email=email).items():
        keep = REGISTRY[model].retention == Retention.FINANCIAL
        count = 0
        for obj in qs:
            if hard and not keep:
                obj.delete()
            else:
                anonymize_instance(obj)
            count += 1
        result[model.__name__] = {
            "count": count,
            "mode": "deleted" if (hard and not keep) else "anonymized",
        }
    audit("system", "erase", subject_ref=phone or email or "",
          metadata={"hard": hard, "result": result})
    return result
