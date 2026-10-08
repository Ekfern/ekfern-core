from decimal import Decimal

from django.db import migrations
import django.utils.timezone


def add_opening_door(apps, schema_editor):
    AnimationRegistryEntry = apps.get_model('events', 'AnimationRegistryEntry')
    now = django.utils.timezone.now()

    AnimationRegistryEntry.objects.update_or_create(
        slug='opening_door',
        defaults={
            'name': 'Opening Door',
            'description': 'A grand door opens to reveal the invitation',
            'category': 'free',
            'slot': 'opening',
            'path': 'modules/opening-door',
            'module_id': 'opening_door',
            'creator_name': 'Ekfern',
            'status': 'published',
            'published_at': now,
            'price': Decimal('0.00'),
        },
    )


def remove_opening_door(apps, schema_editor):
    AnimationRegistryEntry = apps.get_model('events', 'AnimationRegistryEntry')
    AnimationRegistryEntry.objects.filter(slug='opening_door').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0109_timer_gate_collapse'),
    ]

    operations = [
        migrations.RunPython(
            add_opening_door,
            remove_opening_door,
        ),
    ]