from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0091_greetingcardsample_aspect_ratio'),
    ]

    operations = [
        migrations.AlterField(
            model_name='event',
            name='has_registry',
            field=models.BooleanField(
                default=True,
                help_text='Kept in sync with host_catalog.is_enabled. '
                          'Write via the catalog API, not directly.',
            ),
        ),
    ]
