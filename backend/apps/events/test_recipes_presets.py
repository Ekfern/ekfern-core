"""
Catalogue invariants for recipes and style presets.

These tests are intentionally cheap and cover the contracts that broke
silently before:
  * preset font ids must exist in `KNOWN_FONT_IDS` (mirror of frontend
    FONT_OPTIONS).
  * recipe tile_sequence entries must be valid `TileType` literals.
  * recipe `fits` entries must be either ``"all"`` or a real
    `Event.EVENT_TYPE_CHOICES` key.
  * `eligible_recipes` must always return at least one recipe (the
    fallback path).
"""
from __future__ import annotations

from django.test import TestCase

from apps.events.models import Event
from apps.events.services import recipes, style_presets


VALID_TILE_TYPES = {
    "title",
    "image",
    "greeting-card",
    "timer",
    "event-details",
    "description",
    "feature-buttons",
    "footer",
    "event-carousel",
}


class StylePresetInvariants(TestCase):
    def test_all_preset_fonts_are_known(self):
        known = set(style_presets.KNOWN_FONT_IDS)
        for preset in style_presets.all_presets():
            for key in ("title_font", "body_font", "script_font"):
                font_id = preset.get(key)
                if font_id is None:
                    continue
                self.assertIn(
                    font_id, known,
                    f"preset {preset['id']!r} key {key!r} references unknown "
                    f"font id {font_id!r}",
                )

    def test_all_preset_feelings_are_allowed(self):
        allowed = set(style_presets.ALLOWED_FEELINGS)
        for preset in style_presets.all_presets():
            for feeling in preset.get("fits_feelings") or []:
                self.assertIn(
                    feeling, allowed,
                    f"preset {preset['id']!r} references unknown feeling {feeling!r}",
                )

    def test_force_dark_bg_filtered_on_light_card(self):
        # No matter what feeling we pass, no force_dark_bg preset survives
        # when is_dark_bg is False.
        for preset in style_presets.all_presets():
            if not preset.get("force_dark_bg"):
                continue
            for feeling in preset.get("fits_feelings") or []:
                eligible = style_presets.eligible_presets(
                    feeling=feeling, is_dark_bg=False,
                )
                ids = {p["id"] for p in eligible}
                self.assertNotIn(
                    preset["id"], ids,
                    f"force_dark_bg preset {preset['id']!r} leaked into "
                    f"light-card eligible list for feeling {feeling!r}",
                )

    def test_force_dark_bg_allowed_on_dark_card(self):
        for preset in style_presets.all_presets():
            if not preset.get("force_dark_bg"):
                continue
            for feeling in preset.get("fits_feelings") or []:
                eligible = style_presets.eligible_presets(
                    feeling=feeling, is_dark_bg=True,
                )
                ids = {p["id"] for p in eligible}
                self.assertIn(
                    preset["id"], ids,
                    f"force_dark_bg preset {preset['id']!r} not eligible on "
                    f"dark card for feeling {feeling!r}",
                )

    def test_eligible_presets_never_empty(self):
        # Even with a feeling/tone that no preset claims, the function must
        # return SOMETHING (sampling has a default-fallback path).
        eligible = style_presets.eligible_presets(
            feeling="nonexistent-feeling", tone="also-nonexistent",
            is_dark_bg=False,
        )
        self.assertGreater(len(eligible), 0)

    def test_every_preset_has_carousel_block(self):
        # Each preset must specify carousel styling so the generator can
        # actually vary cardStyle/Layout/Shadow per draft.
        for preset in style_presets.all_presets():
            c = preset.get("carousel")
            self.assertIsInstance(
                c, dict,
                f"preset {preset['id']!r} is missing carousel block",
            )
            for key in ("cardStyle", "cardLayout", "cardSpacing",
                       "cardShadow", "imageHeight", "imageAspectRatio"):
                self.assertIn(
                    key, c,
                    f"preset {preset['id']!r} carousel missing {key!r}",
                )

    def test_carousel_blocks_collectively_cover_variation(self):
        # Sanity: the eight presets shouldn't all share one cardStyle —
        # if they do, the auto-generator can't produce variation.
        styles = {p["carousel"]["cardStyle"] for p in style_presets.all_presets()}
        layouts = {p["carousel"]["cardLayout"] for p in style_presets.all_presets()}
        self.assertGreaterEqual(len(styles), 3, f"only {len(styles)} cardStyle values used")
        self.assertGreaterEqual(len(layouts), 2, f"only {len(layouts)} cardLayout values used")


class RecipeInvariants(TestCase):
    def test_all_recipe_tiles_are_valid(self):
        for recipe in recipes.all_recipes():
            for tile_type in recipe["tile_sequence"]:
                self.assertIn(
                    tile_type, VALID_TILE_TYPES,
                    f"recipe {recipe['id']!r} has invalid tile type {tile_type!r}",
                )

    def test_all_recipe_fits_keys_exist(self):
        valid_keys = {key for key, _label in Event.EVENT_TYPE_CHOICES}
        valid_keys.add("all")
        for recipe in recipes.all_recipes():
            for fit in recipe.get("fits") or []:
                self.assertIn(
                    fit, valid_keys,
                    f"recipe {recipe['id']!r} fits {fit!r} is not in "
                    "Event.EVENT_TYPE_CHOICES",
                )

    def test_all_recipe_overlay_strategies_valid(self):
        for recipe in recipes.all_recipes():
            self.assertIn(
                recipe["overlay_strategy"], recipes.OVERLAY_STRATEGIES,
                f"recipe {recipe['id']!r} has unknown overlay_strategy",
            )

    def test_eligible_recipes_always_returns_something(self):
        # Worst case: an event_type that no recipe explicitly fits, no quiet
        # regions, and baked text. eligible_recipes must still degrade to
        # the universal fallback rather than [].
        result = recipes.eligible_recipes(
            event_type="other",
            quiet_region_count=0,
            has_baked_text=True,
            has_sub_events=False,
        )
        self.assertGreater(len(result), 0)

    def test_baked_text_excludes_overlay_recipes(self):
        result = recipes.eligible_recipes(
            event_type="wedding",
            quiet_region_count=0,
            has_baked_text=True,
            has_sub_events=False,
        )
        for r in result:
            self.assertIn(
                r["overlay_strategy"], {"none", "banner_below", "separate_title"},
                f"baked-text card got overlay strategy {r['overlay_strategy']!r} "
                f"from recipe {r['id']!r}",
            )

    def test_recipe_ids_are_unique(self):
        ids = [r["id"] for r in recipes.all_recipes()]
        self.assertEqual(len(ids), len(set(ids)), "duplicate recipe id")

    def test_preset_ids_are_unique(self):
        ids = [p["id"] for p in style_presets.all_presets()]
        self.assertEqual(len(ids), len(set(ids)), "duplicate preset id")
