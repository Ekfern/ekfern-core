"""
Catalog views are their own metric.

Opening the registry used to register as an invitation view, because the
catalog page fetches the invite payload for its title, banner and guest name.
The invite number absorbed registry traffic and the catalog had no number of
its own.
"""
from __future__ import annotations

from datetime import timedelta

from django.test import Client, TestCase
from django.utils import timezone

from apps.catalog.models import HostCatalog
from apps.events.models import (
    CatalogPageView,
    Event,
    Guest,
    INVITE_VIEW_DEDUPE_MINUTES,
    InvitePage,
)
from apps.users.models import User


class CatalogPageViewTests(TestCase):
    def setUp(self):
        user = User.objects.create(email="host-cat@example.com", name="Host")
        self.event = Event.objects.create(
            host=user, slug="cat", title="Meera & Arjun", is_public=True,
            has_registry=True,
        )
        self.guest = Guest.objects.create(
            event=self.event, name="Asha", phone="+919800000009", guest_token="tok-cat",
        )
        # A HostCatalog is created for the event by a signal; just enable it.
        catalog, _ = HostCatalog.objects.get_or_create(event=self.event)
        catalog.is_enabled = True
        catalog.save(update_fields=['is_enabled'])
        InvitePage.objects.create(
            event=self.event, slug="cat", config={"tiles": []},
            published_config={"theme": {"primaryColor": "#C0431B"}},
            is_published=True, published_at=timezone.now(),
        )
        self.url = f"/api/catalog/cat/?g={self.guest.guest_token}"

    def test_opening_the_catalog_records_a_catalog_view(self):
        self.assertEqual(Client().get(self.url).status_code, 200)
        self.assertEqual(CatalogPageView.objects.filter(event=self.event).count(), 1)

    def test_repeat_loads_in_one_window_count_once(self):
        client = Client()
        for _ in range(10):
            client.get(self.url)
        self.assertEqual(CatalogPageView.objects.filter(event=self.event).count(), 1)

    def test_a_later_window_records_a_second_view(self):
        client = Client()
        client.get(self.url)
        row = CatalogPageView.objects.get(event=self.event)
        row.view_bucket = row.view_bucket - timedelta(minutes=INVITE_VIEW_DEDUPE_MINUTES)
        row.save(update_fields=["view_bucket"])
        client.get(self.url)
        self.assertEqual(CatalogPageView.objects.filter(event=self.event).count(), 2)

    def test_the_response_carries_the_invite_theme(self):
        body = Client().get(self.url).json()
        self.assertEqual(body["invite_theme"], {"primaryColor": "#C0431B"})

    def test_an_anonymous_visitor_records_nothing(self):
        # A public event can be browsed with no token; a row attributable to
        # nobody would neither dedupe nor tell the host anything.
        self.assertEqual(Client().get("/api/catalog/cat/").status_code, 200)
        self.assertEqual(CatalogPageView.objects.count(), 0)
