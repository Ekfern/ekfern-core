"""
Turn Event Details' lone dress code into the first of its Good to know answers.

Event Details now carries `goodToKnow`: the answers to what guests ask the host
the week before - dress code, stay, parking, food, who to call - each a line of
text with an optional link. The dress code was the only one of those that had a
field, so a host who filled it in gets it back as a Dress code answer in the
same tile, in the same place. The old `dressCode` key goes everywhere, empty or
not.
"""
from django.db import migrations


def _convert(config):
    """Return (config, changed) with each dress code moved into goodToKnow."""
    if not isinstance(config, dict):
        return config, False
    tiles = config.get('tiles')
    if not isinstance(tiles, list):
        return config, False

    changed = False
    for tile in tiles:
        if not isinstance(tile, dict) or tile.get('type') != 'event-details':
            continue
        settings = tile.get('settings')
        if not isinstance(settings, dict) or 'dressCode' not in settings:
            continue

        dress_code = settings.pop('dressCode')
        changed = True
        text = dress_code.strip() if isinstance(dress_code, str) else ''
        if not text:
            continue  # An empty key, now gone; nothing to carry.

        items = settings.get('goodToKnow')
        if not isinstance(items, list):
            items = []
        if not any(isinstance(i, dict) and i.get('kind') == 'dress' for i in items):
            items.insert(0, {'id': f"gtk-dress-{tile.get('id', 'migrated')}", 'kind': 'dress', 'text': text})
        settings['goodToKnow'] = items

    return config, changed


def dress_code_into_good_to_know(apps, schema_editor):
    Event = apps.get_model('events', 'Event')
    for event in Event.objects.exclude(page_config={}).iterator():
        value, changed = _convert(event.page_config)
        if changed:
            event.page_config = value
            event.save(update_fields=['page_config'])

    # Every field on a row is converted - `any(...)` would stop at the first
    # change and silently skip published_config.
    InvitePage = apps.get_model('events', 'InvitePage')
    for page in InvitePage.objects.all().iterator():
        touched = []
        for field in ('config', 'published_config'):
            value, changed = _convert(getattr(page, field))
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
            value, changed = _convert(row.config)
            if changed:
                row.config = value
                row.save(update_fields=['config'])


def noop_reverse(apps, schema_editor):
    """Not reversed: the answers may have been edited since."""


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0116_cohost_reminder_sent_at'),
    ]

    operations = [
        migrations.RunPython(dress_code_into_good_to_know, noop_reverse),
    ]
