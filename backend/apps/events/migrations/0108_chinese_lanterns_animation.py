from decimal import Decimal

from django.db import migrations
import django.utils.timezone


def seed_chinese_lanterns(apps, schema_editor):
    AnimationRegistryEntry = apps.get_model('events', 'AnimationRegistryEntry')
    now = django.utils.timezone.now()
    AnimationRegistryEntry.objects.update_or_create(
        slug='chinese_lanterns',
        defaults={
            'name': 'Chinese Lanterns',
            'description': 'Paper lanterns glow and rise while guests read the invite',
            'category': 'free',
            'slot': 'experience',
            'path': 'modules/chinese-lanterns',
            'module_id': 'chinese_lanterns',
            'creator_name': 'Ekfern',
            'status': 'published',
            'published_at': now,
            'price': Decimal('0.00'),
        },
    )


def unseed_chinese_lanterns(apps, schema_editor):
    AnimationRegistryEntry = apps.get_model('events', 'AnimationRegistryEntry')
    AnimationRegistryEntry.objects.filter(slug='chinese_lanterns').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0107_animation_registry'),
    ]

    operations = [
        migrations.RunPython(seed_chinese_lanterns, unseed_chinese_lanterns),
    ]
