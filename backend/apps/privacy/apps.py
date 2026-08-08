from django.apps import AppConfig


class PrivacyConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.privacy"
    verbose_name = "Privacy & Compliance"

    def ready(self):
        # Populate the PII registry once all app models are loaded.
        from .pii import load_registry
        load_registry()

        # Validate the registry's declared field paths at `manage.py check`
        # time, so a field rename fails the boot check instead of throwing at
        # export/erase time in production.
        from django.core.checks import register
        from .checks import check_pii_registry, check_unregistered_pii
        register(check_pii_registry)
        register(check_unregistered_pii)
