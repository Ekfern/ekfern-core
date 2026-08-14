"""
Move the map out of Event Details and into a Directions tile of its own.

The map was an optional field inside a tile that already carried 23 settings,
below the fold and behind a checkbox that stayed disabled until a separate
field validated. Of the hosts who had filled in a location, roughly one in
twelve ever ended up with a map on the page.

For every config that has map data, this inserts a Directions tile directly
after the Event Details tile it came from and strips the map keys out. A host
who had the map switched on keeps it, in the same position; a host who typed an
address but never switched it on keeps the address in a disabled tile rather
than losing what they wrote.
"""
from django.db import migrations

MAP_KEYS = ('mapUrl', 'coordinates', 'showMap', 'mapZoom', 'locationVerified')


def _extract(config):
    """Return (config, changed) with map data moved to its own tile."""
    if not isinstance(config, dict):
        return config, False

    tiles = config.get('tiles')
    if not isinstance(tiles, list):
        return config, False

    result = []
    changed = False

    for tile in tiles:
        result.append(tile)
        if not isinstance(tile, dict) or tile.get('type') != 'event-details':
            continue

        settings = tile.get('settings')
        if not isinstance(settings, dict):
            continue
        if not any(settings.get(key) for key in ('mapUrl', 'coordinates')):
            # Nothing to move; still drop any stale flags left behind.
            if any(key in settings for key in MAP_KEYS):
                for key in MAP_KEYS:
                    settings.pop(key, None)
                changed = True
            continue

        directions_settings = {
            'mapUrl': settings.get('mapUrl', ''),
            'height': 260,
        }
        if settings.get('coordinates'):
            directions_settings['coordinates'] = settings['coordinates']
        if settings.get('locationVerified') is not None:
            directions_settings['locationVerified'] = settings['locationVerified']

        result.append({
            'id': f"tile-directions-{tile.get('id', 'migrated')}",
            'type': 'directions',
            # Only visible if the map was actually being shown. An address the
            # host never displayed stays with them, switched off.
            'enabled': bool(settings.get('showMap')) and tile.get('enabled', True) is not False,
            'order': 0,  # renumbered below
            'settings': directions_settings,
        })

        for key in MAP_KEYS:
            settings.pop(key, None)
        changed = True

    if changed:
        for index, tile in enumerate(result):
            if isinstance(tile, dict):
                tile['order'] = index
        config['tiles'] = result

    return config, changed


def extract_directions(apps, schema_editor):
    InvitePage = apps.get_model('events', 'InvitePage')

    # Event.page_config is the copy the page editor reads - see 0098.
    Event = apps.get_model('events', 'Event')
    for event in Event.objects.exclude(page_config={}).iterator():
        value, changed = _extract(event.page_config)
        if changed:
            event.page_config = value
            event.save(update_fields=['page_config'])
    for page in InvitePage.objects.all().iterator():
        touched = []
        for field in ('config', 'published_config'):
            value, changed = _extract(getattr(page, field))
            if changed:
                setattr(page, field, value)
                touched.append(field)
        if touched:
            page.save(update_fields=touched)

    for model_name in ('InvitePageLayout', 'InviteDesignTemplate'):
        try:
            model = apps.get_model('events', model_name)
        except LookupError:
            continue
        for row in model.objects.all().iterator():
            value, changed = _extract(row.config)
            if changed:
                row.config = value
                row.save(update_fields=['config'])


def noop_reverse(apps, schema_editor):
    """Not reversed: folding the tile back would discard any edits made to it."""


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0098_bake_theme_into_configs'),
    ]

    operations = [
        migrations.RunPython(extract_directions, noop_reverse),
    ]
