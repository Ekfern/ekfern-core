from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0087_remap_greeting_card_to_design'),
    ]

    operations = [
        migrations.AddField(
            model_name='greetingcardsample',
            name='thumbnail_url',
            field=models.URLField(
                blank=True,
                help_text='Small derivative (e.g. ~360px wide) used in the catalog grid. Falls back to background_image_url when empty.',
                max_length=500,
            ),
        ),
    ]
