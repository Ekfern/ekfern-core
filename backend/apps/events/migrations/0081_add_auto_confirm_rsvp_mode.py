from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0080_add_corporate_event_types'),
    ]

    operations = [
        migrations.AlterField(
            model_name='event',
            name='rsvp_experience_mode',
            field=models.CharField(
                max_length=20,
                choices=[
                    ('standard', 'Standard RSVP'),
                    ('sub_event', 'Sub-event RSVP'),
                    ('slot_based', 'Slot-based RSVP'),
                    ('auto_confirm', 'Confirm attendance'),
                ],
                default='standard',
                help_text='Canonical RSVP mode used for host settings and guest rendering.',
            ),
        ),
    ]
