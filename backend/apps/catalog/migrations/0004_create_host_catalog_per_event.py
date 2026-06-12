from django.db import migrations


def create_host_catalog_for_existing_events(apps, schema_editor):
    Event = apps.get_model('events', 'Event')
    HostCatalog = apps.get_model('catalog', 'HostCatalog')

    batch_size = 500
    last_pk = 0
    while True:
        batch = list(Event.objects.filter(pk__gt=last_pk).order_by('pk')[:batch_size])
        if not batch:
            break
        for event in batch:
            HostCatalog.objects.get_or_create(
                event=event,
                defaults={'is_enabled': event.has_registry},
            )
        last_pk = batch[-1].pk


def reverse_noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0003_create_catalog_response'),
        ('events', '0091_greetingcardsample_aspect_ratio'),
    ]

    operations = [
        migrations.RunPython(
            create_host_catalog_for_existing_events,
            reverse_noop,
        ),
    ]
