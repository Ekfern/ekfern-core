from decimal import Decimal

from django.db import migrations
import django.utils.timezone


def seed_water_drop(apps, schema_editor):
    AnimationRegistryEntry = apps.get_model('events', 'AnimationRegistryEntry')
    now = django.utils.timezone.now()
    AnimationRegistryEntry.objects.update_or_create(
        slug='water_drop',
        defaults={
            'name': 'Water Drop',
            'description': 'Steamy glass clears as droplets run down the invite',
            'category': 'free',
            'slot': 'opening',
            'path': 'modules/water-drop',
            'module_id': 'water_drop',
            'creator_name': 'Ekfern',
            'status': 'published',
            'published_at': now,
            'price': Decimal('0.00'),
        },
    )


def unseed_water_drop(apps, schema_editor):
    AnimationRegistryEntry = apps.get_model('events', 'AnimationRegistryEntry')
    AnimationRegistryEntry.objects.filter(slug='water_drop').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0109_timer_gate_collapse'),
    ]

    operations = [
        migrations.RunPython(seed_water_drop, unseed_water_drop),
    ]
