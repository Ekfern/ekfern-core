from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('events', '0091_greetingcardsample_aspect_ratio'),
    ]

    operations = [
        migrations.CreateModel(
            name='HostCatalog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('is_enabled', models.BooleanField(default=True)),
                ('purpose', models.CharField(
                    choices=[
                        ('gifts', 'Gifts / Contributions'),
                        ('fundraiser', 'Fundraiser'),
                        ('products_services', 'Products or Services'),
                        ('event_addons', 'Event Add-ons'),
                        ('sponsorships', 'Sponsorships'),
                        ('general', 'General Catalog'),
                    ],
                    default='general',
                    max_length=30,
                )),
                ('catalog_title', models.CharField(
                    blank=True,
                    default='',
                    help_text='Section heading shown to guests (e.g. "Our Gift Registry")',
                    max_length=100,
                )),
                ('intro_text', models.TextField(blank=True)),
                ('catalog_access_mode', models.CharField(
                    choices=[
                        ('same_as_event', 'Same as event page'),
                        ('after_rsvp', 'After RSVP is submitted'),
                        ('confirmed_only', 'Only confirmed / attending guests'),
                    ],
                    default='same_as_event',
                    max_length=20,
                )),
                ('show_on_event_page', models.BooleanField(default=True)),
                ('show_on_rsvp_confirmation', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('event', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='host_catalog',
                    to='events.event',
                )),
            ],
            options={
                'db_table': 'host_catalog',
            },
        ),
    ]
