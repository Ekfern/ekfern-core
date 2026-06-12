from django.urls import path

from .views import CatalogRespondView, PublicCatalogView

# Mounted under /api/catalog/
urlpatterns = [
    path('<slug:slug>/', PublicCatalogView.as_view(), name='public-catalog'),
    path('<slug:slug>/respond/', CatalogRespondView.as_view(), name='catalog-respond'),
]
