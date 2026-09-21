"""
Tests for the tile data migrations (0100 poster, 0101 gallery, 0109 timer gate).

These exercise the transform functions directly rather than running the
migrations against a database. What can go wrong here is the rewriting of one
config dict - a key kept that should have been dropped, a pointer left dangling
- and that is what these pin down. The migration bodies around them are the
same batched walk used elsewhere in this app.

The walk itself has one trap worth remembering: it must evaluate every field on
a row, because `any(f(x) for x in fields)` short-circuits and silently skips
`published_config` whenever `config` changed first. That bug shipped once.
"""
import importlib

from django.test import SimpleTestCase

poster_migration = importlib.import_module(
    'apps.events.migrations.0100_rename_design_tile_to_poster'
)
gallery_migration = importlib.import_module(
    'apps.events.migrations.0101_image_tile_becomes_gallery'
)
timer_migration = importlib.import_module(
    'apps.events.migrations.0109_timer_gate_collapse'
)


class DesignToPosterTests(SimpleTestCase):
    def test_design_tiles_are_renamed(self):
        config = {'tiles': [{'id': 'a', 'type': 'design', 'order': 0, 'settings': {'src': 'x.jpg'}}]}
        self.assertTrue(poster_migration._rename_tiles(config))
        self.assertEqual(config['tiles'][0]['type'], 'poster')
        self.assertEqual(config['tiles'][0]['settings'], {'src': 'x.jpg'})

    def test_dead_greeting_cards_are_removed_and_order_closed_up(self):
        # 0087 renamed the type but left `tile-greeting-card-*` ids behind on
        # the copies it missed, so both spellings have to be recognised.
        config = {'tiles': [
            {'id': 'tile-greeting-card-1', 'type': 'design', 'order': 0},
            {'id': 'b', 'type': 'greeting-card', 'order': 1},
            {'id': 'c', 'type': 'title', 'order': 2},
            {'id': 'd', 'type': 'footer', 'order': 3},
        ]}
        self.assertTrue(poster_migration._rename_tiles(config))
        self.assertEqual([t['id'] for t in config['tiles']], ['c', 'd'])
        self.assertEqual([t['order'] for t in config['tiles']], [0, 1])

    def test_untouched_config_reports_no_change(self):
        config = {'tiles': [{'id': 'a', 'type': 'title', 'order': 0}]}
        self.assertFalse(poster_migration._rename_tiles(config))

    def test_junk_is_left_alone(self):
        self.assertFalse(poster_migration._rename_tiles(None))
        self.assertFalse(poster_migration._rename_tiles({'tiles': 'not a list'}))


class ImageToGalleryTests(SimpleTestCase):
    def test_single_src_becomes_a_one_photo_gallery(self):
        config = {'tiles': [{
            'id': 'tile-image-1', 'type': 'image', 'order': 0,
            'settings': {'src': 'photo.jpg', 'fitMode': 'fit-to-screen', 'shadow': 'md'},
        }]}
        self.assertTrue(gallery_migration._migrate_config(config))

        tile = config['tiles'][0]
        self.assertEqual(tile['type'], 'gallery')
        self.assertEqual(tile['settings']['images'], [{'id': 'tile-image-1-1', 'src': 'photo.jpg'}])
        self.assertEqual(tile['settings']['arrangement'], 'vertical')
        self.assertEqual(tile['settings']['frame'], 'none')
        # Appearance the host chose survives; the old single-image keys do not.
        self.assertEqual(tile['settings']['shadow'], 'md')
        self.assertNotIn('src', tile['settings'])
        self.assertNotIn('fitMode', tile['settings'])

    def test_overlay_keys_are_dropped(self):
        # Overlays belong to the poster. A gallery has no renderer for them, so
        # carrying them would preserve text that appears nowhere.
        config = {'tiles': [{
            'id': 'i', 'type': 'image', 'order': 0,
            'settings': {'src': 'p.jpg', 'textOverlays': [{'text': 'Save the date'}],
                         'overlayPosition': {'x': 50, 'y': 50}, 'imageFit': 'cover'},
        }]}
        gallery_migration._migrate_config(config)
        self.assertEqual(
            set(config['tiles'][0]['settings']), {'images', 'arrangement', 'frame'}
        )

    def test_a_title_overlaying_an_image_is_released(self):
        config = {'tiles': [
            {'id': 'img', 'type': 'image', 'order': 0, 'settings': {'src': 'p.jpg'}},
            {'id': 'ttl', 'type': 'title', 'order': 1, 'overlayTargetId': 'img',
             'settings': {'text': 'Anna & Ravi'}},
        ]}
        gallery_migration._migrate_config(config)
        # Without this the title would point at a tile that cannot host it and
        # would render nowhere at all.
        self.assertNotIn('overlayTargetId', config['tiles'][1])
        self.assertEqual(config['tiles'][1]['settings']['text'], 'Anna & Ravi')

    def test_a_title_overlaying_a_poster_is_left_alone(self):
        config = {'tiles': [
            {'id': 'pos', 'type': 'poster', 'order': 0, 'settings': {'src': 'card.jpg'}},
            {'id': 'ttl', 'type': 'title', 'order': 1, 'overlayTargetId': 'pos'},
            {'id': 'img', 'type': 'image', 'order': 2, 'settings': {'src': 'p.jpg'}},
        ]}
        gallery_migration._migrate_config(config)
        self.assertEqual(config['tiles'][1]['overlayTargetId'], 'pos')

    def test_empty_image_tile_becomes_an_empty_gallery(self):
        config = {'tiles': [{'id': 'i', 'type': 'image', 'order': 0, 'settings': {'src': ''}}]}
        gallery_migration._migrate_config(config)
        self.assertEqual(config['tiles'][0]['settings']['images'], [])

    def test_link_preview_source_is_renamed(self):
        for old, new in (('greeting-card', 'poster'), ('image-tile', 'gallery')):
            config = {'tiles': [], 'linkMetadata': {'previewImageSource': old, 'title': 'x'}}
            self.assertTrue(gallery_migration._migrate_config(config))
            self.assertEqual(config['linkMetadata']['previewImageSource'], new)
            self.assertEqual(config['linkMetadata']['title'], 'x')

    def test_config_without_image_tiles_reports_no_change(self):
        config = {'tiles': [{'id': 'a', 'type': 'poster', 'order': 0}]}
        self.assertFalse(gallery_migration._migrate_config(config))

    def test_junk_is_left_alone(self):
        self.assertFalse(gallery_migration._migrate_config(None))
        self.assertFalse(gallery_migration._migrate_config({'tiles': 'not a list'}))


class TimerGateCollapseTests(SimpleTestCase):
    """
    The countdown's two switches become one.

    What matters here is the missing key. `settings.enabled` absent always meant
    "show the countdown" to the checkbox that wrote it, so collapsing must not
    read absence as off and hide a timer a host can still see ticked.
    """

    def test_settings_gate_off_disables_the_tile(self):
        config = {'tiles': [{
            'id': 't', 'type': 'timer', 'order': 4, 'enabled': True,
            'settings': {'enabled': False, 'format': 'circle'},
        }]}
        self.assertTrue(timer_migration._migrate_config(config))
        tile = config['tiles'][0]
        self.assertFalse(tile['enabled'])
        self.assertNotIn('enabled', tile['settings'])
        self.assertEqual(tile['settings']['format'], 'circle')

    def test_settings_gate_on_only_drops_the_key(self):
        config = {'tiles': [{
            'id': 't', 'type': 'timer', 'order': 4, 'enabled': True,
            'settings': {'enabled': True, 'format': 'inline'},
        }]}
        self.assertTrue(timer_migration._migrate_config(config))
        tile = config['tiles'][0]
        self.assertTrue(tile['enabled'])
        self.assertNotIn('enabled', tile['settings'])

    def test_a_disabled_tile_stays_disabled_when_the_gate_was_on(self):
        config = {'tiles': [{
            'id': 't', 'type': 'timer', 'order': 4, 'enabled': False,
            'settings': {'enabled': True, 'format': 'circle'},
        }]}
        timer_migration._migrate_config(config)
        self.assertFalse(config['tiles'][0]['enabled'])

    def test_absent_gate_is_left_showing(self):
        # The shape that caused the bug: ticked box, no countdown. It must come
        # out of the migration visible, not hidden.
        config = {'tiles': [{
            'id': 't', 'type': 'timer', 'order': 4, 'enabled': True,
            'settings': {'format': 'circle'},
        }]}
        self.assertFalse(timer_migration._migrate_config(config))
        self.assertTrue(config['tiles'][0]['enabled'])

    def test_every_timer_tile_is_visited(self):
        # `any(... for ...)` here would stop at the first tile it changed.
        config = {'tiles': [
            {'id': 'a', 'type': 'timer', 'order': 0, 'enabled': True,
             'settings': {'enabled': False, 'format': 'circle'}},
            {'id': 'b', 'type': 'timer', 'order': 1, 'enabled': True,
             'settings': {'enabled': False, 'format': 'inline'}},
        ]}
        self.assertTrue(timer_migration._migrate_config(config))
        self.assertFalse(config['tiles'][0]['enabled'])
        self.assertFalse(config['tiles'][1]['enabled'])
        self.assertNotIn('enabled', config['tiles'][1]['settings'])

    def test_other_tiles_are_untouched(self):
        config = {'tiles': [
            {'id': 'f', 'type': 'feature-buttons', 'order': 0, 'enabled': True,
             'settings': {'enabled': False}},
        ]}
        self.assertFalse(timer_migration._migrate_config(config))
        self.assertTrue(config['tiles'][0]['enabled'])
        self.assertIs(config['tiles'][0]['settings']['enabled'], False)

    def test_junk_is_left_alone(self):
        self.assertFalse(timer_migration._migrate_config(None))
        self.assertFalse(timer_migration._migrate_config({'tiles': 'not a list'}))
        self.assertFalse(timer_migration._migrate_config({'tiles': [None, 'x']}))
        self.assertFalse(timer_migration._migrate_config(
            {'tiles': [{'id': 't', 'type': 'timer', 'settings': None}]}
        ))
