"""
Boot-time validation for the PII registry.

The registry (see ``pii.py``) declares field names, ``subject_key`` and
``owner_path`` as plain strings. Nothing checks them against the real models,
so a field rename would boot cleanly and only blow up with ``FieldError`` /
``FieldDoesNotExist`` at export/erase time — in production, mid-request.

These Django system checks resolve every declared path against the live model
metadata at ``manage.py check`` time, turning silent field-drift into a boot
failure:

  * ``privacy.E001`` (Error)   — a registered field / subject_key / owner_path
    that does not resolve to a real model field.
  * ``privacy.W001`` (Warning) — best-effort: a model carrying a well-known PII
    column that is not registered at all.

Registered from ``PrivacyConfig.ready()`` via ``django.core.checks.register``.
"""
from django.core import checks
from django.core.exceptions import FieldDoesNotExist


# Well-known column names that almost always hold personal data. Used only by
# the best-effort W001 warning; not exhaustive by design.
KNOWN_PII_COLUMNS = frozenset({"phone", "email", "phone_snapshot", "email_snapshot"})


def _resolve_path(model, path):
    """Walk a (possibly spanning) ORM path like ``a__b__c`` field by field.

    Returns ``(True, None)`` if every segment resolves, or ``(False, reason)``
    describing the first segment that does not. Non-terminal segments must be
    relations so we can descend into the related model.
    """
    parts = path.split("__")
    current = model
    for index, part in enumerate(parts):
        try:
            field = current._meta.get_field(part)
        except FieldDoesNotExist:
            return False, (
                f"'{part}' is not a field on "
                f"{current._meta.app_label}.{current.__name__}"
            )
        is_last = index == len(parts) - 1
        if not is_last:
            related = getattr(field, "related_model", None)
            if related is None:
                return False, (
                    f"'{part}' on {current._meta.app_label}.{current.__name__} "
                    f"is not a relation, cannot span into '{parts[index + 1]}'"
                )
            current = related
    return True, None


def check_pii_registry(app_configs=None, **kwargs):
    """E001 — every registered field name, subject_key and owner_path resolves."""
    from .registry import REGISTRY

    errors = []
    for model, spec in REGISTRY.items():
        label = f"{model._meta.app_label}.{model.__name__}"

        for pii_field in spec.fields:
            try:
                model._meta.get_field(pii_field.name)
            except FieldDoesNotExist:
                errors.append(checks.Error(
                    f"PII registry field '{pii_field.name}' does not exist on {label}.",
                    hint="Fix the field name in apps/privacy/pii.py or remove the entry.",
                    obj=model,
                    id="privacy.E001",
                ))

        if spec.subject_key:
            ok, reason = _resolve_path(model, spec.subject_key)
            if not ok:
                errors.append(checks.Error(
                    f"PII registry subject_key '{spec.subject_key}' does not resolve "
                    f"for {label}: {reason}.",
                    hint="Fix subject_key in apps/privacy/pii.py.",
                    obj=model,
                    id="privacy.E001",
                ))

        if spec.owner_path:
            ok, reason = _resolve_path(model, spec.owner_path)
            if not ok:
                errors.append(checks.Error(
                    f"PII registry owner_path '{spec.owner_path}' does not resolve "
                    f"for {label}: {reason}.",
                    hint="Fix owner_path in apps/privacy/pii.py.",
                    obj=model,
                    id="privacy.E001",
                ))

    return errors


def check_unregistered_pii(app_configs=None, **kwargs):
    """W001 — best-effort scan for models with a known PII column but no registration."""
    from django.apps import apps as django_apps

    from .registry import REGISTRY

    warnings = []
    for model in django_apps.get_models():
        if model in REGISTRY:
            continue
        try:
            field_names = {f.name for f in model._meta.get_fields()}
        except Exception:
            continue
        hits = sorted(KNOWN_PII_COLUMNS & field_names)
        if hits:
            label = f"{model._meta.app_label}.{model.__name__}"
            warnings.append(checks.Warning(
                f"{label} has PII-looking column(s) {hits} but is not in the "
                f"privacy registry.",
                hint="If it holds personal data, register it in apps/privacy/pii.py; "
                     "otherwise this warning can be ignored.",
                obj=model,
                id="privacy.W001",
            ))
    return warnings
