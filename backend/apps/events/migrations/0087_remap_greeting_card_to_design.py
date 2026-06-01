from django.db import migrations


def _remap_tiles(config):
    """Rename any greeting-card tile to design in place. Returns True if changed."""
    if not isinstance(config, dict):
        return False
    tiles = config.get('tiles')
    if not isinstance(tiles, list):
        return False
    changed = False
    for tile in tiles:
        if isinstance(tile, dict) and tile.get('type') == 'greeting-card':
            tile['type'] = 'design'
            changed = True
    return changed


def remap_greeting_card_to_design(apps, schema_editor):
    """
    Rename the legacy 'greeting-card' tile type to 'design' across every stored
    config. The frontend renamed this tile type (commit 043ed3b) but never
    migrated the data, so guests saw a missing hero and hosts saw a blank tile.

    Covers all three JSON stores that can hold tiles:
      - InvitePage.config (host draft)
      - InvitePage.published_config (live snapshot served to guests)
      - InvitePageLayout.config (layout library applied to events)

    Batched to avoid long locks and idempotent (re-runs find nothing to change).
    Only rows that actually change are written back.
    """
    InvitePage = apps.get_model('events', 'InvitePage')
    InvitePageLayout = apps.get_model('events', 'InvitePageLayout')

    batch_size = 500

    # InvitePage: both draft and published snapshot.
    qs = InvitePage.objects.order_by('pk')
    last_pk = 0
    while True:
        batch = list(qs.filter(pk__gt=last_pk)[:batch_size])
        if not batch:
            break
        dirty = []
        for page in batch:
            config_changed = _remap_tiles(page.config)
            published_changed = _remap_tiles(page.published_config)
            if config_changed or published_changed:
                dirty.append(page)
        if dirty:
            InvitePage.objects.bulk_update(dirty, ['config', 'published_config'])
        last_pk = batch[-1].pk

    # InvitePageLayout: the library that applyLayout copies into events.
    layout_qs = InvitePageLayout.objects.order_by('pk')
    last_pk = 0
    while True:
        batch = list(layout_qs.filter(pk__gt=last_pk)[:batch_size])
        if not batch:
            break
        dirty = []
        for layout in batch:
            if _remap_tiles(layout.config):
                dirty.append(layout)
        if dirty:
            InvitePageLayout.objects.bulk_update(dirty, ['config'])
        last_pk = batch[-1].pk


def reverse_noop(apps, schema_editor):
    """Reverse is a no-op; the rename is forward-only data cleanup."""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0086_backfill_published_config'),
    ]

    operations = [
        migrations.RunPython(remap_greeting_card_to_design, reverse_noop),
    ]
