from django.db import migrations, models


def populate_codes(apps, schema_editor):
    GreetingCardSample = apps.get_model('events', 'GreetingCardSample')
    for sample in GreetingCardSample.objects.all().order_by('pk'):
        if not sample.code:
            sample.code = f'DSGN-{sample.pk:04d}'
            sample.save(update_fields=['code'])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0088_greetingcardsample_thumbnail_url'),
    ]

    operations = [
        migrations.AddField(
            model_name='greetingcardsample',
            name='code',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Stable human-friendly identifier (e.g. DSGN-0042) used to link layouts to this design.',
                max_length=32,
            ),
        ),
        migrations.RunPython(populate_codes, noop_reverse),
        migrations.AlterField(
            model_name='greetingcardsample',
            name='code',
            field=models.CharField(
                blank=True,
                help_text='Stable human-friendly identifier (e.g. DSGN-0042) used to link layouts to this design.',
                max_length=32,
                unique=True,
            ),
        ),
    ]
