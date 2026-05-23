from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0083_event_rsvp_block_on_full_capacity'),
    ]

    operations = [
        migrations.AddField(
            model_name='event',
            name='rsvp_require_sub_event_selection',
            field=models.BooleanField(
                default=False,
                help_text='PER_SUBEVENT only: guests must select at least one session before submitting a Yes RSVP.',
            ),
        ),
    ]
