"""
Data-subject and tenant operations, driven entirely by the PII registry:

  * collect_for_subject / collect_for_owner — find every record about a person,
    or owned by a host (the same resolver the change-management "who's affected"
    query and the retention job reuse). ``collect_for_subject`` links identity
    across phone/email so erasing by one identifier reaches rows keyed by the
    other.
  * export_for_subject — a portability dump.
  * pseudonymize_instance / erase_subject — erasure that honours retention. The
    deterministic peppered hash is *pseudonymization*, not anonymization: it is
    reversible-by-correlation, so a FINANCIAL record (and anything whose deletion
    would cascade into one) is pseudonymized-in-place rather than hard-deleted,
    keeping tax/accounting rows intact; genuine contact data is removed.

``anonymize_instance`` is kept as a backward-compatible alias for
``pseudonymize_instance``.
"""
import hashlib
from datetime import timedelta

from django.conf import settings
from django.db import models as dj_models
from django.db import transaction
from django.utils import timezone

from .registry import REGISTRY, Retention, Scrub
from .helpers import audit


_ANON_SENTINEL = "anon_"
_TOMBSTONE = "Removed"


def _blank_value(field):
    """A NOT-NULL-safe 'empty' value for a model field: None only where the
    column allows it, else the type's empty ('' for text, {} for JSON). For a
    NOT-NULL field with no safe empty (Integer/Boolean/Decimal/...), refuse
    loudly rather than return None and trip an IntegrityError at save time."""
    if field.null:
        return None
    if isinstance(field, dj_models.JSONField):
        return {}
    if isinstance(field, (dj_models.CharField, dj_models.TextField)):
        return ""
    raise ValueError(
        f"Scrub.NULL unsupported for NOT-NULL field "
        f"{field.model.__name__}.{field.name} ({type(field).__name__}); "
        f"pick a different scrub"
    )


def _pseudonym(value) -> str | None:
    """Peppered, non-reversible pseudonym. The pepper matters: phone numbers are
    low-entropy and a bare hash would be brute-forceable. Prefers a dedicated
    PRIVACY_PEPPER, falling back to SECRET_KEY when it is not configured."""
    if not value:
        return value
    pepper = getattr(settings, "PRIVACY_PEPPER", None) or settings.SECRET_KEY
    # Keep the pseudonym short enough for narrow columns (e.g. phone = varchar(20)).
    # The pepper — not the length — is what makes it non-reversible.
    digest = hashlib.sha256((pepper + str(value)).encode()).hexdigest()[:12]
    return f"{_ANON_SENTINEL}{digest}"


def _apply_scrub(value, how: Scrub, field):
    if how == Scrub.NULL:
        return _blank_value(field)
    if how == Scrub.TOMBSTONE:
        # Idempotent: an already-tombstoned value stays put.
        if value == _TOMBSTONE:
            return value
        return _TOMBSTONE
    if how == Scrub.HASH:
        # Idempotent: re-hashing an already-pseudonymized value would produce a
        # *different* pseudonym on a second erase, so leave sentinels alone.
        if isinstance(value, str) and value.startswith(_ANON_SENTINEL):
            return value
        return _pseudonym(value)
    return value  # KEEP


def _financial_models() -> set:
    """Models whose registry retention is FINANCIAL (kept, never hard-deleted)."""
    return {m for m, s in REGISTRY.items() if s.retention == Retention.FINANCIAL}


def _cascades_into_financial(model) -> bool:
    """True if deleting a row of ``model`` would CASCADE-delete into any model
    the registry classifies as FINANCIAL. BFS over reverse relations, following
    only those whose ``on_delete`` is CASCADE. This guards against, e.g.,
    deleting a User (OPERATIONAL) cascading User -> Event -> CatalogResponse
    (FINANCIAL) and destroying rows the retention policy promises to keep."""
    financial = _financial_models()
    if not financial:
        return False
    seen = {model}
    queue = [model]
    while queue:
        current = queue.pop()
        for rel in current._meta.related_objects:
            if getattr(rel, "on_delete", None) is not dj_models.CASCADE:
                continue
            child = rel.related_model
            if child in financial:
                return True
            if child not in seen:
                seen.add(child)
                queue.append(child)
    return False


def _resolve_identity(phone=None, email=None):
    """Link a subject across identifiers. Guest/RSVP rows carry BOTH a phone and
    an email, so given only one we can discover the other and reach rows keyed by
    it. Returns ({phones}, {emails}) — a subject may legitimately map to several
    of each, so both are sets."""
    phones = {phone} if phone else set()
    emails = {email} if email else set()

    # Import here to avoid an import cycle at module load (registry is wired up
    # in PrivacyConfig.ready()).
    from apps.events.models import Guest, RSVP

    def _others(model, filter_key, want):
        return set(
            model.objects.filter(**{filter_key: want})
            .exclude(**{f"{value_field}__isnull": True})
            .exclude(**{value_field: ""})
            .values_list(value_field, flat=True)
        )

    if phone and not email:
        value_field = "email"
        for model in (Guest, RSVP):
            emails |= _others(model, "phone", phone)
    elif email and not phone:
        value_field = "phone"
        for model in (Guest, RSVP):
            phones |= _others(model, "email", email)

    return phones, emails


def collect_for_subject(*, phone=None, email=None):
    """{Model: queryset} of every record ABOUT this person, across events.

    Resolves the subject's full identity first (a phone can reveal an email and
    vice-versa via Guest/RSVP rows), then matches every registered model by its
    own subject_key against the *whole* resolved id set — so erasing by only an
    email still reaches phone-keyed rows.

    A model's subject_key may be a literal column (``phone``, ``email``), a
    snapshot column (``phone_snapshot``, ``to``), or a spanning ORM path
    (``guest__phone``). We match every keyed model against the combined
    phone+email value set: a phone-bearing column only ever holds phone values
    and an email column only email values, so mixing the set is harmless and a
    dual-purpose column like ``to`` correctly matches either."""
    phones, emails = _resolve_identity(phone=phone, email=email)
    values = list(phones | emails)
    out = {}
    if not values:
        return out
    for model, spec in REGISTRY.items():
        key = spec.subject_key
        if not key:
            continue  # owner-only models are reached via collect_for_owner
        out[model] = model.objects.filter(**{f"{key}__in": values})
    return out


def _affected_event_slugs(collected) -> set:
    """Event slugs whose PUBLIC invite page could still be serving data about
    this subject (e.g. a public contributor/guest name). Gathered BEFORE any
    mutation so hard-deleted rows still resolve. Per-guest tokened views bypass
    the cache, so the only cached surface at risk is the event-level page — we
    therefore only look at models with a direct ``event`` FK."""
    from apps.events.models import Event
    slugs = set()
    for model, qs in collected.items():
        try:
            field = model._meta.get_field("event")
        except Exception:
            continue
        if not getattr(field, "is_relation", False) or field.related_model is not Event:
            continue
        slugs |= set(
            qs.exclude(event__isnull=True).values_list("event__slug", flat=True)
        )
    return {s for s in slugs if s}


def _invalidate_caches(slugs) -> list:
    """Bust the Django cache + CloudFront edge for each affected event's invite
    page. Cache invalidation must never break an erasure — the DB write is the
    source of truth and a stale edge entry expires on its own TTL — so every
    call is guarded. Returns the slugs actually invalidated."""
    if not slugs:
        return []
    from apps.events.views import (
        invalidate_invite_page_cache,
        invalidate_cloudfront_cache_immediate,
    )
    done = []
    for slug in slugs:
        try:
            invalidate_invite_page_cache(slug)
            invalidate_cloudfront_cache_immediate(slug)
            done.append(slug)
        except Exception:
            pass
    return done


def collect_for_owner(host):
    """{Model: queryset} of every record a host OWNS (they're the controller)."""
    out = {}
    for model, spec in REGISTRY.items():
        if spec.owner_path:
            out[model] = model.objects.filter(**{spec.owner_path: host})
    return out


def export_for_subject(*, phone=None, email=None, actor="system", reason=""):
    """Portability: everything held about a person, per model.

    ``_matched`` is the total number of rows found, so a caller can tell a real
    zero-data subject from a typo'd identifier. The ledger records only a
    pseudonym of the identifier, never the raw PII."""
    data = {}
    matched = 0
    for model, qs in collect_for_subject(phone=phone, email=email).items():
        cols = [f.name for f in REGISTRY[model].fields] + ["id"]
        rows = list(qs.values(*cols))
        data[model.__name__] = rows
        matched += len(rows)
    data["_matched"] = matched
    audit(
        actor,
        "export",
        subject_ref=_pseudonym(phone or email or ""),
        metadata={"reason": reason, "matched": matched},
    )
    return data


def pseudonymize_instance(obj) -> None:
    """Scrub the registered PII fields of one row in place, per its scrub spec,
    and persist ONLY those columns (so we don't re-run e.g. User's password
    hasher or Guest's token-retry, or bump unrelated timestamps)."""
    spec = REGISTRY[type(obj)]
    if not spec.fields:
        return  # e.g. page-view rows: PII is the guest linkage, no own columns
    for f in spec.fields:
        field = obj._meta.get_field(f.name)
        setattr(obj, f.name, _apply_scrub(getattr(obj, f.name), f.scrub, field))
    obj.save(update_fields=[f.name for f in spec.fields])


# Backward-compat alias: the deterministic peppered hash is pseudonymization,
# not anonymization, but other code still imports the old name.
anonymize_instance = pseudonymize_instance


def erase_subject(*, phone=None, email=None, hard=False, actor="system", reason=""):
    """Erasure request. FINANCIAL rows — and any row whose deletion would cascade
    into a FINANCIAL model — are always kept-but-pseudonymized; other rows are
    pseudonymized (default) or hard-deleted when ``hard`` is set.

    The mutation runs inside a single transaction, bracketed by two ledger
    records: a 'start' audit written BEFORE any change (so a mid-loop crash
    still leaves a trace) and a 'complete' audit after. ``_matched`` reports the
    total rows found so a caller can detect a zero-match (typo'd) request. The
    ledger stores only a pseudonym of the identifier, never raw PII.

    Erasure clears the primary DB immediately AND busts the CDN/app cache of any
    affected public invite page. It CANNOT reach point-in-time backups and read
    replicas — those retain the pre-erase copy until the backup-retention window
    (``settings.BACKUP_RETENTION_DAYS``) elapses. ``_backup_clear_at`` records
    the date after which no copy survives; that date is the true erasure SLA to
    state in the privacy policy."""
    subject_ref = _pseudonym(phone or email or "")
    collected = collect_for_subject(phone=phone, email=email)
    matched = sum(qs.count() for qs in collected.values())
    # Resolve affected public pages BEFORE mutating (hard-deleted rows vanish).
    affected_slugs = _affected_event_slugs(collected)
    # Retention window is admin-configurable (DB singleton), falling back to the
    # BACKUP_RETENTION_DAYS setting and then 35.
    from .models import PrivacySettings
    retention_days = PrivacySettings.backup_retention()
    backup_clear_at = (timezone.now() + timedelta(days=retention_days)).isoformat()

    # Pre-audit BEFORE mutating: a crash part-way through still leaves a record.
    audit(
        actor,
        "erase",
        subject_ref=subject_ref,
        metadata={"phase": "start", "hard": hard, "reason": reason, "matched": matched},
    )

    result = {}
    with transaction.atomic():
        for model, qs in collected.items():
            spec = REGISTRY[model]
            keep = spec.retention == Retention.FINANCIAL
            # Never let a hard delete silently take out FINANCIAL rows via a
            # cascade; fall back to pseudonymization instead.
            will_delete = hard and not keep and not _cascades_into_financial(model)
            count = 0
            for obj in qs:
                if will_delete:
                    obj.delete()
                else:
                    pseudonymize_instance(obj)
                count += 1
            result[model.__name__] = {
                "count": count,
                "mode": "deleted" if will_delete else "pseudonymized",
            }
    # After the DB commit, bust the cache/CDN for affected public pages so PII
    # doesn't linger at the edge. Best-effort; never rolls back the erase.
    invalidated = _invalidate_caches(affected_slugs)

    result["_matched"] = matched
    result["_backup_clear_at"] = backup_clear_at
    result["_caches_invalidated"] = invalidated

    audit(
        actor,
        "erase",
        subject_ref=subject_ref,
        metadata={
            "phase": "complete",
            "hard": hard,
            "reason": reason,
            "backup_clear_at": backup_clear_at,
            "caches_invalidated": invalidated,
            "result": result,
        },
    )
    return result
