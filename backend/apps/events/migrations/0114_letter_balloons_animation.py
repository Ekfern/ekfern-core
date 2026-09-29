from decimal import Decimal

from django.db import migrations
import django.utils.timezone


def seed_letter_balloons(apps, schema_editor):
    AnimationRegistryEntry = apps.get_model('events', 'AnimationRegistryEntry')
    now = django.utils.timezone.now()
    AnimationRegistryEntry.objects.update_or_create(
        slug='letter_balloons',
        defaults={
            'name': 'Letter Balloons',
            'description': 'Balloons with Marathi letters float up; tap one and it zips away with a squeak',
            'category': 'free',
            'slot': 'experience',
            'path': 'modules/letter-balloons',
            'module_id': 'letter_balloons',
            'creator_name': 'Ekfern',
            'status': 'published',
            'published_at': now,
            'price': Decimal('0.00'),
        },
    )


def unseed_letter_balloons(apps, schema_editor):
    AnimationRegistryEntry = apps.get_model('events', 'AnimationRegistryEntry')
    AnimationRegistryEntry.objects.filter(slug='letter_balloons').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0113_event_versions'),
    ]

    operations = [
        migrations.RunPython(seed_letter_balloons, unseed_letter_balloons),
    ]
