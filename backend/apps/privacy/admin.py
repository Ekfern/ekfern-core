"""
Admin for the privacy app. Registers the tunable PrivacySettings singleton on
the project's custom admin site, mirroring WhatsAppSettings / LLMPlatformSettings.

The append-only ledgers (ConsentEvent / AuditEvent) are intentionally NOT
registered for editing — they must never be mutated through the admin.
"""
from django.contrib import admin

from apps.users.admin import admin_site
from .models import PrivacySettings


class PrivacySettingsAdmin(admin.ModelAdmin):
    fieldsets = [
        (
            "Data retention",
            {
                "fields": ["backup_retention_days"],
                "description": (
                    "Erasure clears the primary database and CDN immediately, but "
                    "point-in-time backups and replicas keep a copy until this window "
                    "passes. Set this to match your real RDS/PITR retention — it is the "
                    "erasure SLA reported to data subjects. When no row exists the app "
                    "falls back to the BACKUP_RETENTION_DAYS environment setting."
                ),
            },
        ),
        (
            "Audit",
            {
                "fields": ["updated_by", "updated_at"],
                "classes": ["collapse"],
            },
        ),
    ]
    readonly_fields = ["updated_at"]

    def has_add_permission(self, request):
        # Singleton: only allow creating the row if it doesn't exist yet.
        return not PrivacySettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False

    def save_model(self, request, obj, form, change):
        obj.updated_by = request.user
        super().save_model(request, obj, form, change)

    def changelist_view(self, request, extra_context=None):
        # Jump straight to the single row's edit page (create it on first view).
        obj, _ = PrivacySettings.objects.get_or_create(pk=1)
        return self.change_view(request, str(obj.pk), extra_context=extra_context)


admin_site.register(PrivacySettings, PrivacySettingsAdmin)
