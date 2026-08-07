from django.apps import AppConfig


class PrivacyConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.privacy"
    verbose_name = "Privacy & Compliance"

    def ready(self):
        # Populate the PII registry once all app models are loaded.
        from .pii import load_registry
        load_registry()
