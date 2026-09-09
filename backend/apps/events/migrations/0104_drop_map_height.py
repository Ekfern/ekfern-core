"""
The map has no height of its own any more.

A height in pixels cannot be predictable. The same 400px is a third of a laptop
screen and half a phone, so a host who set it once could not know what a guest
would see - and the value was seeded into every tile as 260 whether or not
anyone chose it, which made "the default" and "the host's decision" the same
byte. Improving the default reached nobody, because every tile already had one
written down.

The map is now a share of the screen, like the photographs above it. This drops
the stored key so nothing is left claiming to configure something that no longer
reads it.

Forward-only, and safe to run twice: the key is simply absent afterwards.
"""
from django.db import migrations


def _strip_height(config):
    """Remove `height` from directions tiles. True when anything changed."""
    if not isinstance(config, dict):
        return False
    tiles = config.get('tiles')
    if not isinstance(tiles, list):
        return False

    changed = False
    for tile in tiles:
        if not isinstance(tile, dict) or tile.get('type') != 'directions':
            continue
        settings = tile.get('settings')
        if isinstance(settings, dict) and 'height' in settings:
            del settings['height']
            changed = True
    return changed


def drop_map_height(apps, schema_editor):
    batch_size = 500

    def walk(model, fields):
        queryset = model.objects.order_by('pk')
        last_pk = 0
        while True:
            batch = list(queryset.filter(pk__gt=last_pk)[:batch_size])
            if not batch:
                break
            dirty = []
            for row in batch:
                # Every field is evaluated: `any(... for ...)` would stop at the
                # first change and leave the rest of the row behind.
                touched = [_strip_height(getattr(row, field)) for field in fields]
                if any(touched):
                    dirty.append(row)
            if dirty:
                model.objects.bulk_update(dirty, list(fields))
            last_pk = batch[-1].pk

    walk(apps.get_model('events', 'InvitePage'), ('config', 'published_config'))
    walk(apps.get_model('events', 'InvitePageLayout'), ('config',))
    # The copy the page editor reads. Easy to forget, and forgetting it is how
    # tiles have ended up invisible to hosts before.
    walk(apps.get_model('events', 'Event'), ('page_config',))


def reverse_noop(apps, schema_editor):
    """Forward-only: nothing reads a map height any more."""


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0103_gallery_arrangements'),
    ]

    operations = [
        migrations.RunPython(drop_map_height, reverse_noop),
    ]
