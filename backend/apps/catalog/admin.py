from apps.users.admin import admin_site

from .models import CatalogItem, CatalogResponse, HostCatalog


class HostCatalogAdmin:
    list_display = ['event', 'is_enabled', 'purpose', 'catalog_access_mode', 'updated_at']
    list_filter = ['is_enabled', 'purpose', 'catalog_access_mode']
    search_fields = ['event__title', 'event__slug']
    readonly_fields = ['created_at', 'updated_at']


class CatalogItemAdmin:
    list_display = ['title', 'catalog', 'item_type', 'action_type', 'status', 'sort_order']
    list_filter = ['status', 'item_type', 'action_type']
    search_fields = ['title', 'description']
    readonly_fields = ['created_at', 'updated_at']


class CatalogResponseAdmin:
    list_display = ['name', 'email', 'catalog_item', 'response_type', 'amount', 'status', 'created_at']
    list_filter = ['status', 'response_type', 'source']
    search_fields = ['name', 'email', 'message']
    readonly_fields = ['created_at', 'updated_at']


from django.contrib.admin import ModelAdmin  # noqa: E402

admin_site.register(HostCatalog, type('HostCatalogAdmin', (ModelAdmin,), dict(HostCatalogAdmin.__dict__)))
admin_site.register(CatalogItem, type('CatalogItemAdmin', (ModelAdmin,), dict(CatalogItemAdmin.__dict__)))
admin_site.register(CatalogResponse, type('CatalogResponseAdmin', (ModelAdmin,), dict(CatalogResponseAdmin.__dict__)))
