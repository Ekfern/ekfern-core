"""
What changed between two versions of an invite design.

A version on its own answers "what was it set to". That is only half of what a
host needs: to put something back by hand they have to know *which* setting
moved and *what it was*. So each version is described by its difference from the
one before it - the location of the change, and the change.

Values are summarised, not dumped. A hex code or a line of copy is worth showing
in full; a nested settings object is reported as changed, because a wall of JSON
is not something anyone can act on.
"""

MAX_VALUE_CHARS = 60

#: Top-level config keys worth reporting, and how to name them to a host.
TOP_LEVEL_LABELS = {
    'customColors': 'Colours',
    'customFonts': 'Fonts',
    'texture': 'Texture',
    'pageBorder': 'Page border',
    'pageFrame': 'Page frame',
    'background_url': 'Background image',
    'animation': 'Animation',
}

#: Tile settings worth naming individually rather than reporting as "settings".
NAMED_TILE_FIELDS = {
    'text': 'text',
    'title': 'title',
    'subtitle': 'subtitle',
    'description': 'description',
    'location': 'location',
    'date': 'date',
    'time': 'time',
    'dressCode': 'dress code',
    'imageUrl': 'image',
    'label': 'label',
}


def _short(value):
    """A value a host can read: scalars in full-ish, structures merely named."""
    if value is None:
        return '—'
    if isinstance(value, bool):
        return 'on' if value else 'off'
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, str):
        text = value.strip()
        if len(text) > MAX_VALUE_CHARS:
            return text[: MAX_VALUE_CHARS - 1] + '…'
        return text or '—'
    if isinstance(value, (list, tuple)):
        return f'{len(value)} item{"" if len(value) == 1 else "s"}'
    if isinstance(value, dict):
        return 'settings'
    return str(value)


def _tile_name(tile):
    """Name a tile the way the host sees it, falling back to its type."""
    if not isinstance(tile, dict):
        return 'section'
    settings = tile.get('settings') or {}
    for key in ('title', 'text', 'label'):
        value = settings.get(key)
        if isinstance(value, str) and value.strip():
            return f'{tile.get("type") or "section"} “{_short(value)}”'
    return str(tile.get('type') or 'section')


def _diff_mapping(before, after, prefix, changes):
    """Report per-key differences between two small settings objects."""
    before = before if isinstance(before, dict) else {}
    after = after if isinstance(after, dict) else {}
    for key in sorted(set(before) | set(after)):
        old, new = before.get(key), after.get(key)
        if old != new:
            changes.append({'location': f'{prefix} · {key}', 'from': _short(old), 'to': _short(new)})


def diff_configs(before, after):
    """
    Readable differences between two configs, newest state as ``after``.

    Returns ``[{location, from, to}]``. An empty list means the two are
    equivalent as far as anything a host can see.
    """
    before = before or {}
    after = after or {}
    changes = []

    for key, label in TOP_LEVEL_LABELS.items():
        old, new = before.get(key), after.get(key)
        if old == new:
            continue
        if isinstance(old, dict) or isinstance(new, dict):
            _diff_mapping(old, new, label, changes)
        else:
            changes.append({'location': label, 'from': _short(old), 'to': _short(new)})

    _diff_tiles(before.get('tiles') or [], after.get('tiles') or [], changes)
    return changes


def _diff_tiles(before_tiles, after_tiles, changes):
    before_by_id = {t.get('id'): t for t in before_tiles if isinstance(t, dict) and t.get('id')}
    after_by_id = {t.get('id'): t for t in after_tiles if isinstance(t, dict) and t.get('id')}

    for tile_id, tile in after_by_id.items():
        if tile_id not in before_by_id:
            changes.append({'location': _tile_name(tile), 'from': '—', 'to': 'added'})

    for tile_id, tile in before_by_id.items():
        if tile_id not in after_by_id:
            changes.append({'location': _tile_name(tile), 'from': 'present', 'to': 'removed'})

    for tile_id, new_tile in after_by_id.items():
        old_tile = before_by_id.get(tile_id)
        if old_tile is None or old_tile == new_tile:
            continue
        name = _tile_name(new_tile)

        if bool(old_tile.get('enabled', True)) != bool(new_tile.get('enabled', True)):
            changes.append({
                'location': name,
                'from': 'shown' if old_tile.get('enabled', True) else 'hidden',
                'to': 'shown' if new_tile.get('enabled', True) else 'hidden',
            })

        old_settings = old_tile.get('settings') or {}
        new_settings = new_tile.get('settings') or {}
        for key in sorted(set(old_settings) | set(new_settings)):
            old, new = old_settings.get(key), new_settings.get(key)
            if old == new:
                continue
            label = NAMED_TILE_FIELDS.get(key, key)
            changes.append({'location': f'{name} · {label}', 'from': _short(old), 'to': _short(new)})

    old_order = [t.get('id') for t in before_tiles if isinstance(t, dict)]
    new_order = [t.get('id') for t in after_tiles if isinstance(t, dict)]
    if set(old_order) == set(new_order) and old_order != new_order:
        changes.append({'location': 'Section order', 'from': 'previous order', 'to': 'reordered'})
