"""
Rename the design tile to poster, and finish a rename that was left half-done.

The tile has been renamed twice. It started as `greeting-card`, became `design`
in migration 0087, and is now `poster` - the name that says what it is: a flyer
the host composes in the card studio and places on the invitation. `design` was
a poor name because it collides with the Design step of the wizard, which does
something else entirely.

Doing this now is deliberate. There are no live invites, so the cost of the
rename is at its lowest it will ever be, and the alternative was a permanent
mismatch between what the UI calls the tile and what the code and data call it.

This also repairs 0087. That migration covered InvitePage.config,
InvitePage.published_config and InvitePageLayout.config, but not
Event.page_config - which holds its own copy of the invite config and is what
the page editor reads. Three greeting-card tiles were still sitting there with
no renderer, invisible in the editor and dropped by its known-types whitelist.
Both legacy names are handled here so nothing is left behind a third time.
"""
from django.db import migrations

RENAMED_TYPE = 'design'
NEW_TYPE = 'poster'

# greeting-card tiles are not renamed, they are removed. 0087 was meant to
# rename them and missed Event.page_config, so these have had no renderer for
# months: invisible in the editor, dropped by its known-types whitelist, absent
# from every invitation. Promoting them to posters now would make a card a host
# has not seen in a long time reappear on their page unannounced. They are dead
# rows, and dead rows should be removed rather than resurrected.
#
# Tiles migrated by 0087 before it stopped keep ids of the form
# `tile-greeting-card-*`, which is what identifies them after the type itself
# has been rewritten.
REMOVED_TYPE = 'greeting-card'


def _is_dead_greeting_card(tile):
    """A greeting-card tile, by type or by the id 0087 left behind."""
    if not isinstance(tile, dict):
        return False
    if tile.get('type') == REMOVED_TYPE:
        return True
    return str(tile.get('id', '')).startswith('tile-greeting-card-')


def _rename_tiles(config):
    """Drop dead greeting-cards, rename design to poster. True when changed."""
    if not isinstance(config, dict):
        return False
    tiles = config.get('tiles')
    if not isinstance(tiles, list):
        return False

    kept = [tile for tile in tiles if not _is_dead_greeting_card(tile)]
    changed = len(kept) != len(tiles)

    for tile in kept:
        if isinstance(tile, dict) and tile.get('type') == RENAMED_TYPE:
            tile['type'] = NEW_TYPE
            changed = True

    if changed:
        # Close the gap left by anything removed.
        for index, tile in enumerate(kept):
            if isinstance(tile, dict):
                tile['order'] = index
        config['tiles'] = kept
    return changed


def rename_design_to_poster(apps, schema_editor):
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
                # Every field must be evaluated: `any(... for ...)` would
                # short-circuit and leave published_config untouched whenever
                # config had already changed.
                touched = [_rename_tiles(getattr(row, field)) for field in fields]
                if any(touched):
                    dirty.append(row)
            if dirty:
                model.objects.bulk_update(dirty, list(fields))
            last_pk = batch[-1].pk

    walk(apps.get_model('events', 'InvitePage'), ('config', 'published_config'))
    walk(apps.get_model('events', 'InvitePageLayout'), ('config',))
    # The copy the page editor reads, and the one 0087 forgot.
    walk(apps.get_model('events', 'Event'), ('page_config',))


def reverse_noop(apps, schema_editor):
    """Forward-only: the frontend no longer has a renderer for the old names."""


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0099_extract_directions_tile'),
    ]

    operations = [
        migrations.RunPython(rename_design_to_poster, reverse_noop),
    ]
