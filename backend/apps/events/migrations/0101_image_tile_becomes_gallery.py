"""
The image tile becomes a gallery.

The image tile and the card tile had grown into the same thing: both held one
`src`, both accepted text overlays, and the card studio wrote into whichever it
found. Splitting them gives each a job. The card tile is the poster - one flyer
with words on it, renamed in 0100. This migration deals with the other half:
the image tile becomes a gallery of up to six photos, with no text overlays at
all.

The shape changes with the name. A single `src` becomes a one-item `images`
list, so an existing photo renders exactly as it did: on its own, unframed, in
a column. The overlay keys are dropped rather than carried, because nothing
renders them any more - leaving them would preserve text that no longer appears
anywhere and would read as data loss the first time someone looked.

One more thing has to move with it. A title tile can be positioned over another
tile via `overlayTargetId`; where that pointed at an image tile, it now points
at a gallery that cannot host it, and the title would render nowhere. Those
pointers are cleared, which returns the title to its normal place in the
stack - visible, in order, above the photos.

The `linkMetadata.previewImageSource` field names the tile the social preview
image comes from, and used the old vocabulary too ('greeting-card' and
'image-tile'). Those become 'poster' and 'gallery'.
"""
from django.db import migrations

OLD_TYPE = 'image'
NEW_TYPE = 'gallery'

# Overlay state belonged to the card, and the gallery has no renderer for it.
DROPPED_SETTINGS = ('textOverlays', 'overlayPosition', 'fitMode', 'imageFit')

PREVIEW_SOURCE_RENAMES = {'greeting-card': 'poster', 'image-tile': 'gallery'}


def _to_gallery(tile):
    """Rewrite one image tile in place. True when it changed."""
    if not isinstance(tile, dict) or tile.get('type') != OLD_TYPE:
        return False

    tile['type'] = NEW_TYPE
    settings = tile.get('settings')
    if not isinstance(settings, dict):
        tile['settings'] = {'images': [], 'arrangement': 'vertical', 'frame': 'none'}
        return True

    src = settings.get('src')
    images = []
    if isinstance(src, str) and src.strip():
        image = {'id': f"{tile.get('id', 'tile')}-1", 'src': src}
        caption = settings.get('caption')
        if isinstance(caption, str) and caption.strip():
            image['caption'] = caption
        images.append(image)

    settings['images'] = images
    settings.setdefault('arrangement', 'vertical')
    # A lone photo that used to sit flush on the page should keep sitting flush;
    # a frame here would be a visible change nobody asked for.
    settings.setdefault('frame', 'none')
    settings.pop('src', None)
    settings.pop('caption', None)
    for key in DROPPED_SETTINGS:
        settings.pop(key, None)
    return True


def _migrate_config(config):
    """Convert every image tile in one config. True when anything changed."""
    if not isinstance(config, dict):
        return False

    changed = False

    link_metadata = config.get('linkMetadata')
    if isinstance(link_metadata, dict):
        renamed = PREVIEW_SOURCE_RENAMES.get(link_metadata.get('previewImageSource'))
        if renamed:
            link_metadata['previewImageSource'] = renamed
            changed = True

    tiles = config.get('tiles')
    if not isinstance(tiles, list):
        return changed

    # Which tiles became galleries, so titles pointing at them can be released.
    gallery_ids = set()
    for tile in tiles:
        if _to_gallery(tile):
            changed = True
            if isinstance(tile.get('id'), str):
                gallery_ids.add(tile['id'])

    if gallery_ids:
        for tile in tiles:
            if not isinstance(tile, dict):
                continue
            if tile.get('overlayTargetId') in gallery_ids:
                tile.pop('overlayTargetId', None)
                changed = True

    return changed


def image_to_gallery(apps, schema_editor):
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
    """Forward-only: nothing renders the image tile any more."""


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0100_rename_design_tile_to_poster'),
    ]

    operations = [
        migrations.RunPython(image_to_gallery, reverse_noop),
    ]
