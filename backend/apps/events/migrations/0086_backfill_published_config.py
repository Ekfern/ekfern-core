from django.db import migrations


def backfill_published_config(apps, schema_editor):
    """
    Seed published_config from config for every currently-published invite page.

    Guests still read the live snapshot (which equals config at this point), so
    making published_config == config is invisible. Done in batches to avoid long
    locks, and idempotent so it can be re-run safely.
    """
    InvitePage = apps.get_model('events', 'InvitePage')

    batch_size = 500
    qs = InvitePage.objects.filter(
        is_published=True,
        published_config__isnull=True,
    ).order_by('pk')

    last_pk = 0
    while True:
        batch = list(qs.filter(pk__gt=last_pk)[:batch_size])
        if not batch:
            break
        for page in batch:
            page.published_config = page.config
            page.published_at = page.updated_at
        InvitePage.objects.bulk_update(batch, ['published_config', 'published_at'])
        last_pk = batch[-1].pk


def reverse_noop(apps, schema_editor):
    """Reverse is a no-op; dropping the columns happens in the schema migration."""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0085_invitepage_published_config'),
    ]

    operations = [
        migrations.RunPython(backfill_published_config, reverse_noop),
    ]
