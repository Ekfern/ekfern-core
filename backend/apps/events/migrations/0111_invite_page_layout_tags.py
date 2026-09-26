from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0110_water_drop_animation'),
    ]

    operations = [
        migrations.AddField(
            model_name='invitepagelayout',
            name='tags',
            field=models.JSONField(
                blank=True,
                default=list,
                help_text=(
                    'Layout-level tags, e.g. ["wedding", "image-hero", "playful"]. '
                    "Separate from the linked design's own tags."
                ),
            ),
        ),
    ]
