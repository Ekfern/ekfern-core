"""
URL configuration for registry_backend project.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from apps.common.views import health_check, log_to_cloudwatch_endpoint, custom_404_handler
from apps.users.admin import admin_site
from apps.events.views import attribution_redirect
from apps.events.admin_layout_views import (
    generate_page_layouts,
    publish_page_layout,
    bulk_publish_page_layouts,
    llm_usage_summary,
    list_recipes_and_presets,
    remix_page_layouts,
    save_review_drafts,
)

urlpatterns = [
    path('q/<str:token>/', attribution_redirect, name='public-attribution-redirect'),
    # Page Layout Auto-Generator (superuser-only). Registered BEFORE
    # `admin_site.urls` so its routes shadow the Django-admin namespace.
    path('api/admin/page-layouts/generate/', generate_page_layouts, name='admin-page-layouts-generate'),
    path('api/admin/page-layouts/remix/', remix_page_layouts, name='admin-page-layouts-remix'),
    path('api/admin/page-layouts/save-review-drafts/', save_review_drafts, name='admin-page-layouts-save-review'),
    path('api/admin/page-layouts/bulk-publish/', bulk_publish_page_layouts, name='admin-page-layouts-bulk-publish'),
    path('api/admin/page-layouts/recipes/', list_recipes_and_presets, name='admin-page-layouts-recipes'),
    path('api/admin/page-layouts/<int:layout_id>/publish/', publish_page_layout, name='admin-page-layouts-publish'),
    path('api/admin/llm-usage/summary/', llm_usage_summary, name='admin-llm-usage-summary'),
    path('api/admin/', admin_site.urls),  # Use custom admin site with better error messages (moved to /api/admin/ for ALB routing)
    # Analytics is now handled by admin_site.urls at /api/admin/analytics/
    path('health', health_check, name='health'),
    path('api/health', health_check, name='api-health'),
    path('api/logs/cloudwatch/', log_to_cloudwatch_endpoint, name='cloudwatch-log'),
    path('api/auth/', include('apps.users.urls')),
    path('api/events/', include('apps.events.urls')),
    path('api/catalog/', include('apps.catalog.public_urls')),
    path('api/notifications/', include('apps.notifications.urls')),
]

# WhiteNoise handles static files in production, so we don't need static() helper
# Only serve media files in development (production should use S3)
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# Custom error handlers - ensure API endpoints return JSON, not HTML
handler404 = custom_404_handler

