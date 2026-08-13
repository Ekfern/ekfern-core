from django.urls import path

from .views import CatalogRespondView, MyCatalogResponsesView, PublicCatalogView

# Mounted under /api/catalog/
urlpatterns = [
    path('<slug:slug>/', PublicCatalogView.as_view(), name='public-catalog'),
    path('<slug:slug>/respond/', CatalogRespondView.as_view(), name='catalog-respond'),
    path('<slug:slug>/my-responses/', MyCatalogResponsesView.as_view(), name='catalog-my-responses'),
]
