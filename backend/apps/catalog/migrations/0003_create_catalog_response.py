from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0002_create_catalog_item'),
        ('events', '0091_greetingcardsample_aspect_ratio'),
    ]

    operations = [
        migrations.CreateModel(
            name='CatalogResponse',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255)),
                ('email', models.EmailField(max_length=254)),
                ('phone', models.CharField(blank=True, max_length=20)),
                ('response_type', models.CharField(
                    choices=[
                        ('pledge', 'Pledge'),
                        ('interest', 'Interest'),
                        ('external_click', 'External click'),
                        ('host_message', 'Host message'),
                    ],
                    max_length=20,
                )),
                ('amount', models.IntegerField(
                    blank=True,
                    help_text='Amount in paise',
                    null=True,
                )),
                ('message', models.TextField(blank=True)),
                ('status', models.CharField(
                    choices=[
                        ('new', 'New'),
                        ('contacted', 'Contacted'),
                        ('confirmed', 'Confirmed'),
                        ('completed', 'Completed'),
                        ('cancelled', 'Cancelled'),
                    ],
                    default='new',
                    max_length=15,
                )),
                ('source', models.CharField(
                    choices=[
                        ('event_page', 'Event page'),
                        ('rsvp_confirmation', 'RSVP confirmation'),
                    ],
                    default='event_page',
                    max_length=20,
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('catalog_item', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='responses',
                    to='catalog.catalogitem',
                )),
                ('event', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='catalog_responses',
                    to='events.event',
                )),
                ('guest', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='catalog_responses',
                    to='events.guest',
                )),
            ],
            options={
                'db_table': 'catalog_responses',
                'ordering': ['-created_at'],
            },
        ),
    ]
