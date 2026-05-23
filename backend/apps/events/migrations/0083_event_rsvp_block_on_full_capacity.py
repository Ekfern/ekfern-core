from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0082_event_rsvp_total_capacity'),
    ]

    operations = [
        migrations.AddField(
            model_name='event',
            name='rsvp_block_on_full_capacity',
            field=models.BooleanField(
                default=False,
                help_text='When enabled with a total capacity, block new yes/confirm RSVPs once full.',
            ),
        ),
    ]
