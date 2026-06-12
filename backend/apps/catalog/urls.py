from django.urls import path

from .views import (
    CatalogDetailView,
    CatalogItemDetailView,
    CatalogItemImageUploadView,
    CatalogItemListCreateView,
    CatalogResponseDetailView,
    CatalogResponseListView,
)

# Mounted under /api/events/<event_id>/catalog/
urlpatterns = [
    path('', CatalogDetailView.as_view(), name='catalog-detail'),
    path('items/', CatalogItemListCreateView.as_view(), name='catalog-items'),
    path('items/<int:item_id>/', CatalogItemDetailView.as_view(), name='catalog-item-detail'),
    path('items/<int:item_id>/upload-image/', CatalogItemImageUploadView.as_view(), name='catalog-item-upload'),
    path('responses/', CatalogResponseListView.as_view(), name='catalog-responses'),
    path('responses/<int:response_id>/', CatalogResponseDetailView.as_view(), name='catalog-response-detail'),
]
