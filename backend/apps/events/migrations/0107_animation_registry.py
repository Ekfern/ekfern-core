from decimal import Decimal

from django.db import migrations, models
import django.utils.timezone


def seed_builtin_animations(apps, schema_editor):
    AnimationRegistryEntry = apps.get_model('events', 'AnimationRegistryEntry')
    now = django.utils.timezone.now()
    builtins = [
        {
            'slug': 'envelope_reveal',
            'name': 'Envelope Reveal',
            'description': 'Envelope opens when guests first view the invite',
            'category': 'free',
            'slot': 'opening',
            'path': 'modules/envelope-reveal',
            'module_id': 'envelope_reveal',
            'creator_name': 'Ekfern',
            'status': 'published',
            'published_at': now,
            'price': Decimal('0.00'),
        },
        {
            'slug': 'curtain_reveal',
            'name': 'Curtain Reveal',
            'description': 'Velvet curtains part from the center to reveal the invite',
            'category': 'free',
            'slot': 'opening',
            'path': 'modules/curtain-reveal',
            'module_id': 'curtain_reveal',
            'creator_name': 'Ekfern',
            'status': 'published',
            'published_at': now,
            'price': Decimal('0.00'),
        },
        {
            'slug': 'rose_petals',
            'name': 'Rose Petals',
            'description': 'Soft petals drift while guests read the invite',
            'category': 'free',
            'slot': 'experience',
            'path': 'modules/rose-petals',
            'module_id': 'rose_petals',
            'creator_name': 'Ekfern',
            'status': 'published',
            'published_at': now,
            'price': Decimal('0.00'),
        },
    ]
    for row in builtins:
        AnimationRegistryEntry.objects.update_or_create(
            slug=row['slug'],
            defaults=row,
        )


def unseed_builtin_animations(apps, schema_editor):
    AnimationRegistryEntry = apps.get_model('events', 'AnimationRegistryEntry')
    AnimationRegistryEntry.objects.filter(
        slug__in=['envelope_reveal', 'curtain_reveal', 'rose_petals'],
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0106_catalog_page_view'),
    ]

    operations = [
        migrations.CreateModel(
            name='AnimationRegistryEntry',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('slug', models.SlugField(help_text='Stable registry id (e.g. curtain_reveal).', max_length=64, unique=True)),
                ('name', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True)),
                ('category', models.CharField(
                    choices=[('free', 'Free'), ('premium', 'Premium'), ('internal', 'Internal')],
                    default='free',
                    help_text='Access control for the host frontend picker.',
                    max_length=20,
                )),
                ('slot', models.CharField(
                    choices=[('opening', 'Opening'), ('experience', 'Experience')],
                    max_length=20,
                )),
                ('path', models.CharField(
                    blank=True,
                    help_text=(
                        'MVP: optional module path note (e.g. modules/curtain-reveal). '
                        'Later: CDN URL for a package player; set module_id to that player.'
                    ),
                    max_length=2000,
                )),
                ('module_id', models.CharField(
                    help_text='Runtime loader key written into invite config (e.g. curtain_reveal).',
                    max_length=64,
                )),
                ('creator_name', models.CharField(blank=True, max_length=255)),
                ('status', models.CharField(
                    choices=[('draft', 'Draft'), ('published', 'Published'), ('disabled', 'Disabled')],
                    default='draft',
                    max_length=20,
                )),
                ('published_at', models.DateTimeField(blank=True, null=True)),
                ('price', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Animation registry entry',
                'verbose_name_plural': 'Animation registry',
                'db_table': 'animation_registry',
                'ordering': ['slot', 'name'],
            },
        ),
        migrations.AddIndex(
            model_name='animationregistryentry',
            index=models.Index(fields=['status', 'category', 'slot'], name='anim_reg_stat_cat_slot_idx'),
        ),
        migrations.AddIndex(
            model_name='animationregistryentry',
            index=models.Index(fields=['slot', 'status'], name='anim_reg_slot_status_idx'),
        ),
        migrations.RunPython(seed_builtin_animations, unseed_builtin_animations),
    ]
