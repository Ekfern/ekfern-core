"""
The gallery keeps two arrangements: stacked and grid.

It offered four ways to lay photos out - vertical, horizontal, grid - which is
three answers to a question that only has two. A gallery either tells a story
one photograph at a time, or shows the set at once. `stacked` does the first,
now as sticky prints that pile up as a guest scrolls; `grid` does the second, as
a row that fills and wraps and stays centred at any count.

The mapping keeps each gallery doing what it did. `vertical` was a single column
of photographs, which is what `stacked` is; `horizontal` was a wrapping row,
which is what `grid` is.

Nothing visible moves for anyone. Every gallery in the database is `vertical`
and holds at most one photo, and a single photo renders identically either way -
there is nothing for it to stack against.
"""
from django.db import migrations

ARRANGEMENT_MAP = {
    'vertical': 'stacked',
    'horizontal': 'grid',
}


def _migrate_config(config):
    """Rewrite gallery arrangements in one config. True when anything changed."""
    if not isinstance(config, dict):
        return False
    tiles = config.get('tiles')
    if not isinstance(tiles, list):
        return False

    changed = False
    for tile in tiles:
        if not isinstance(tile, dict) or tile.get('type') != 'gallery':
            continue
        settings = tile.get('settings')
        if not isinstance(settings, dict):
            continue
        replacement = ARRANGEMENT_MAP.get(settings.get('arrangement'))
        if replacement:
            settings['arrangement'] = replacement
            changed = True
    return changed


def to_two_arrangements(apps, schema_editor):
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
    # The copy the page editor reads. Easy to forget, and forgetting it is how
    # tiles have ended up invisible to hosts before.
    walk(apps.get_model('events', 'Event'), ('page_config',))


def reverse_noop(apps, schema_editor):
    """Forward-only: nothing renders the old arrangements any more."""


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0102_record_invite_config_help_text'),
    ]

    operations = [
        migrations.RunPython(to_two_arrangements, reverse_noop),
    ]
