from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0004_create_host_catalog_per_event'),
    ]

    operations = [
        migrations.AlterField(
            model_name='catalogresponse',
            name='source',
            field=models.CharField(
                choices=[
                    ('event_page', 'Event page'),
                    ('rsvp_confirmation', 'RSVP confirmation'),
                    ('invite', 'Invite'),
                    ('direct', 'Direct link'),
                    ('qr', 'QR code'),
                ],
                default='direct',
                max_length=20,
            ),
        ),
    ]
