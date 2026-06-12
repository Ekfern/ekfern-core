#!/usr/bin/env python
"""
Standalone seed script
Run with: python manage_seed.py
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'registry_backend.settings')
django.setup()

from apps.users.models import User
from apps.events.models import Event
from apps.catalog.models import CatalogItem, HostCatalog
from django.utils import timezone
from datetime import timedelta

# Create demo host with a known password for testing
DEMO_PASSWORD = 'demo1234'
host, created = User.objects.get_or_create(
    email='demo@example.com',
    defaults={'name': 'Demo Host', 'is_active': True}
)
host.set_password(DEMO_PASSWORD)
host.save(update_fields=['password'])
print(f"Host: {host.email} ({'created' if created else 'exists'}), password: {DEMO_PASSWORD}")

# Create demo event
event, created = Event.objects.get_or_create(
    slug='demo-wedding',
    defaults={
        'host': host,
        'title': 'John & Jane Wedding',
        'event_type': 'wedding',
        'date': timezone.now().date() + timedelta(days=30),
        'city': 'Mumbai',
        'is_public': True,
    }
)
print(f"Event: {event.title} ({'created' if created else 'exists'})")

# Create demo catalog
catalog, _ = HostCatalog.objects.get_or_create(
    event=event,
    defaults={
        'is_enabled': True,
        'purpose': 'gifts',
        'catalog_title': 'Our Gift Registry',
        'intro_text': 'Celebrate with us by contributing to something meaningful.',
    },
)
print(f"Catalog: {'created' if _ else 'exists'}")

# Create demo catalog items
items_data = [
    {
        'title': 'Honeymoon Fund',
        'description': 'Help us create memories on our first trip together.',
        'item_type': 'contribution',
        'action_type': 'pledge_amount',
        'amount_type': 'suggested',
        'suggested_amounts': [50000, 100000, 200000, 500000],  # ₹500, ₹1k, ₹2k, ₹5k
        'sort_order': 0,
    },
    {
        'title': 'Kitchen Appliances',
        'description': 'A complete set of kitchen appliances for our new home.',
        'item_type': 'contribution',
        'action_type': 'pledge_amount',
        'amount_type': 'fixed',
        'fixed_amount': 750000,  # ₹7,500
        'sort_order': 1,
    },
    {
        'title': 'Sponsor a Table',
        'description': 'Sponsor a table and support a local charity we love.',
        'item_type': 'offer_addon',
        'action_type': 'submit_interest',
        'amount_type': 'none',
        'sort_order': 2,
    },
]

for item_data in items_data:
    item, created = CatalogItem.objects.get_or_create(
        catalog=catalog,
        title=item_data['title'],
        defaults={k: v for k, v in item_data.items() if k != 'title'},
    )
    print(f"Item: {item.title} ({'created' if created else 'exists'})")

print("\n✅ Seed data created successfully!")
print(f"\nPublic catalog URL: http://localhost:3000/catalog/{event.slug}")
print(f"Host login: http://localhost:3000/host/login")
print(f"Demo email: {host.email}")
print(f"Demo password: {DEMO_PASSWORD}")

