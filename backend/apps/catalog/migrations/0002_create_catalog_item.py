from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0001_create_host_catalog'),
    ]

    operations = [
        migrations.CreateModel(
            name='CatalogItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True)),
                ('image_url', models.URLField(blank=True, max_length=500, null=True)),
                ('item_type', models.CharField(
                    choices=[
                        ('contribution', 'Contribution'),
                        ('offer_addon', 'Offer / Add-on'),
                        ('info_link', 'Info / Link'),
                    ],
                    max_length=20,
                )),
                ('action_type', models.CharField(
                    choices=[
                        ('pledge_amount', 'Pledge amount'),
                        ('submit_interest', 'Submit interest'),
                        ('open_external_link', 'Open external link'),
                        ('contact_host', 'Contact host'),
                    ],
                    max_length=25,
                )),
                ('amount_type', models.CharField(
                    blank=True,
                    choices=[
                        ('none', 'No amount'),
                        ('fixed', 'Fixed amount'),
                        ('suggested', 'Suggested amounts'),
                        ('flexible', 'Flexible amount'),
                    ],
                    max_length=10,
                    null=True,
                )),
                ('fixed_amount', models.IntegerField(
                    blank=True,
                    help_text='Amount in paise (e.g. 200000 = ₹2,000)',
                    null=True,
                )),
                ('suggested_amounts', models.JSONField(
                    blank=True,
                    help_text='List of integers in paise (e.g. [50000, 100000, 200000])',
                    null=True,
                )),
                ('external_url', models.URLField(blank=True, max_length=500, null=True)),
                ('manual_instructions', models.TextField(
                    blank=True,
                    help_text='Shown to guest after form submission',
                )),
                ('status', models.CharField(
                    choices=[('published', 'Published'), ('hidden', 'Hidden')],
                    default='published',
                    max_length=10,
                )),
                ('sort_order', models.IntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('catalog', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='items',
                    to='catalog.hostcatalog',
                )),
            ],
            options={
                'db_table': 'catalog_items',
                'ordering': ['sort_order', 'id'],
            },
        ),
    ]
