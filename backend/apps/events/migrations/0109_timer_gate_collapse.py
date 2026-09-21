"""
The countdown gets one switch instead of two.

A timer tile carried two independent on/off flags. `tile.enabled` is the one
every tile has - the checkbox in the editor's tile list, and the flag both
renderers filter on. `settings.enabled` was a second gate, read only by the
timer's own component, and the two disagreed about a missing value: the
settings checkbox drew itself from `enabled !== false`, so an absent key looked
ticked, while the renderer required a truthy `enabled` and drew nothing. Tiles
saved without the key - several creation paths produced them - showed a ticked
"Show countdown" box and no countdown, with nothing in the UI to explain it.

The second flag also bought nothing. Its one distinguishing behaviour was a
grey "Timer disabled" placeholder, rendered only when the component was asked
for its non-preview form, and nothing ever asked: both the guest renderer and
the editor go through TilePreview, which always passes `preview`.

So `settings.enabled` goes, and `tile.enabled` is the only gate. A host who had
switched the countdown off inside the panel had their tile still listed as
enabled; flipping that tile off here is what keeps their invitation looking the
way they left it. Every other value - true, or absent - already meant "show
it", so those tiles keep `tile.enabled` exactly as it is and only lose the key.
"""
from django.db import migrations

TIMER_TYPE = 'timer'


def _collapse_gate(tile):
    """Fold one timer tile's settings gate into the tile gate. True when changed."""
    if not isinstance(tile, dict) or tile.get('type') != TIMER_TYPE:
        return False

    settings = tile.get('settings')
    if not isinstance(settings, dict) or 'enabled' not in settings:
        return False

    # Only an explicit False hid the countdown; true and absent both showed it.
    if settings.pop('enabled') is False:
        tile['enabled'] = False

    return True


def _migrate_config(config):
    """Collapse every timer tile in one config. True when anything changed."""
    if not isinstance(config, dict):
        return False

    tiles = config.get('tiles')
    if not isinstance(tiles, list):
        return False

    # Listed, not generated: `any(...)` would stop at the first tile it changed.
    return any([_collapse_gate(tile) for tile in tiles])


def collapse_timer_gate(apps, schema_editor):
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
                touched = [_migrate_config(getattr(row, field)) for field in fields]
                if any(touched):
                    dirty.append(row)
            if dirty:
                model.objects.bulk_update(dirty, list(fields))
            last_pk = batch[-1].pk

    walk(apps.get_model('events', 'InvitePage'), ('config', 'published_config'))
    walk(apps.get_model('events', 'InvitePageLayout'), ('config',))
    # The copy the page editor reads. Easy to forget and it has been forgotten
    # before, which is how tiles ended up invisible to hosts.
    walk(apps.get_model('events', 'Event'), ('page_config',))


def reverse_noop(apps, schema_editor):
    """Forward-only: nothing reads the settings gate any more."""


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0108_chinese_lanterns_animation'),
    ]

    operations = [
        migrations.RunPython(collapse_timer_gate, reverse_noop),
    ]
