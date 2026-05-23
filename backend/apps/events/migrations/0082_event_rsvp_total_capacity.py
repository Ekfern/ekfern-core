from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0081_add_auto_confirm_rsvp_mode'),
    ]

    operations = [
        migrations.AddField(
            model_name='event',
            name='rsvp_total_capacity',
            field=models.PositiveIntegerField(
                blank=True,
                help_text='Optional max attendance cap for registration-style RSVP (shown in host stats).',
                null=True,
            ),
        ),
    ]
