"""
Integration tests for the Page Layout Auto-Generator pipeline.

Mocks the LLM-touching seams (card_analyzer.analyze_card,
copy_generator.generate_copy_variants, palette.extract_palette) so the suite
exercises the full sampling + composition path without any network calls.

Coverage focus:
  - generate_options returns exactly N drafts for valid input
  - Every tile in every draft is a valid TileType
  - Every config has the keys frontend applyLayout requires
  - force_dark_bg presets never sampled on a light card
  - Baked-text cards never paired with overlay-strategy recipes
  - Seed produces deterministic output (same seed = same drafts)
"""
from __future__ import annotations

from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase

from apps.events.services import layout_generator, recipes, style_presets


# Mirror of `TileType` in `frontend/lib/invite/schema.ts`. Tests must fail
# loudly if the generator emits something the frontend can't render.
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

# Keys that `frontend/lib/invite/applyLayout.ts` and `migrateConfig` rely on.
REQUIRED_CONFIG_KEYS = {"themeId", "tiles"}


def _fake_palette_light():
    return {
        "bg": "#FFFFFF",
        "text": "#1F1B16",
        "accent": "#A6815B",
        "muted": "#6B5F52",
        "is_dark_bg": False,
        "dominant": ["#FFFFFF", "#A6815B", "#6B5F52", "#E8DCC9", "#F0EDE5"],
        "dominant_colors": ["#FFFFFF", "#A6815B", "#6B5F52", "#E8DCC9", "#F0EDE5"],
    }


def _fake_palette_dark():
    return {
        "bg": "#0E0F14",
        "text": "#FFFFFF",
        "accent": "#E55A9E",
        "muted": "#A7A8AD",
        "is_dark_bg": True,
        "dominant_colors": ["#0E0F14", "#E55A9E", "#A7A8AD"],
    }


def _fake_card_analysis_with_quiet_regions(**overrides):
    base = {
        "composition": "centered",
        "visual_style": "floral",
        "dominant_feeling": "romantic",
        "has_baked_text": False,
        "suggested_accent_hex": "#A6815B",
        "suggested_page_bg_palette": [],
        "bg_lightness_preference": "match",
        "best_text_placement": "middle",
        "notes": "test card",
        "quiet_regions": [
            {
                "x": 20, "y": 30, "width": 60, "height": 25,
                "text_color": "dark", "purpose": "title",
            },
            {
                "x": 25, "y": 65, "width": 50, "height": 15,
                "text_color": "dark", "purpose": "date",
            },
        ],
    }
    base.update(overrides)
    return base


def _fake_card_analysis_baked_text(**overrides):
    base = _fake_card_analysis_with_quiet_regions()
    base["has_baked_text"] = True
    base["quiet_regions"] = []
    base.update(overrides)
    return base


def _fake_copy_variants(n=8):
    tones = ["elegant", "romantic", "playful", "warm", "celebratory", "modern", "traditional", "rustic"]
    return [
        {
            "primary": f"Title {i}",
            "secondary": f"On the {i}th of June",
            "tertiary": f"Tertiary line {i}",
            "tone": tones[i % len(tones)],
            "notes": "",
        }
        for i in range(n)
    ]


class _PipelinePatcher:
    """Wrap the three external seams with one context manager.

    Lets each test focus on inputs/outputs rather than mock plumbing.
    """

    def __init__(
        self,
        *,
        palette_data,
        card_analysis,
        copy_variants,
    ):
        self.palette_data = palette_data
        self.card_analysis = card_analysis
        self.copy_variants = copy_variants
        self._patches = []

    def __enter__(self):
        self._patches = [
            patch.object(
                layout_generator.palette, "extract_palette",
                return_value=self.palette_data,
            ),
            patch.object(
                layout_generator.card_analyzer, "analyze_card",
                return_value=self.card_analysis,
            ),
            patch.object(
                layout_generator.copy_generator, "generate_copy_variants",
                return_value=self.copy_variants,
            ),
        ]
        for p in self._patches:
            p.start()
        return self

    def __exit__(self, exc_type, exc, tb):
        for p in self._patches:
            p.stop()


class GenerateOptionsTests(TestCase):
    """End-to-end tests for `layout_generator.generate_options`."""

    def _run(
        self,
        *,
        palette_data=None,
        card_analysis=None,
        copy_variants=None,
        event_type="wedding",
        n_outputs=10,
        seed=42,
        has_sub_events=False,
    ):
        palette_data = palette_data or _fake_palette_light()
        card_analysis = card_analysis or _fake_card_analysis_with_quiet_regions()
        copy_variants = copy_variants or _fake_copy_variants()
        with _PipelinePatcher(
            palette_data=palette_data,
            card_analysis=card_analysis,
            copy_variants=copy_variants,
        ):
            return layout_generator.generate_options(
                card_url="https://test.example.com/card.jpg",
                event_type=event_type,
                concept="A simple wedding invite.",
                user=None,
                request_id="req-test-1",
                n_outputs=n_outputs,
                has_sub_events=has_sub_events,
                seed=seed,
            )

    def test_returns_exact_n_drafts(self):
        result = self._run(n_outputs=10)
        self.assertEqual(len(result["drafts"]), 10)

    def test_all_drafts_have_valid_tiles_only(self):
        result = self._run(n_outputs=10)
        for draft in result["drafts"]:
            tiles = draft["config"].get("tiles") or []
            self.assertTrue(tiles, "every draft should have at least one tile")
            for tile in tiles:
                self.assertIn(
                    tile["type"],
                    VALID_TILE_TYPES,
                    f"tile type {tile['type']!r} not in TileType union",
                )

    def test_required_config_keys_present(self):
        result = self._run(n_outputs=5)
        for draft in result["drafts"]:
            cfg = draft["config"]
            for key in REQUIRED_CONFIG_KEYS:
                self.assertIn(key, cfg, f"config missing required key {key!r}")
            self.assertIn("customColors", cfg)
            self.assertIn("customFonts", cfg)
            self.assertIn("tileSetComplete", cfg)
            self.assertTrue(cfg["tileSetComplete"])

    def test_vision_bg_palette_rotates_page_backgrounds_across_drafts(self):
        """Option A: cached vision returns 3 swatches; drafts should not all share one bg."""
        result = self._run(
            n_outputs=9,
            seed=101,
            card_analysis=_fake_card_analysis_with_quiet_regions(
                suggested_page_bg_palette=[
                    "#E8F0FE",
                    "#FFF4E6",
                    "#EDE4D9",
                ],
                bg_lightness_preference="match",
            ),
        )
        bgs = {
            (d["config"].get("customColors") or {}).get("backgroundColor", "").upper()
            for d in result["drafts"]
        }
        bgs.discard("")
        self.assertGreaterEqual(
            len(bgs),
            3,
            f"expected ≥3 distinct page backgrounds, got {sorted(bgs)!r}",
        )

    def test_baked_text_card_uses_no_overlay_recipes(self):
        result = self._run(
            card_analysis=_fake_card_analysis_baked_text(),
            n_outputs=10,
        )
        non_overlay = {"none", "banner_below", "separate_title"}
        for draft in result["drafts"]:
            strategy = draft["meta"]["overlay_strategy"]
            self.assertIn(
                strategy,
                non_overlay,
                f"baked-text card was paired with overlay strategy {strategy!r}",
            )

    def test_force_dark_bg_preset_skipped_on_light_card(self):
        # Drive the sampler hard with many outputs so any leakage shows up.
        result = self._run(palette_data=_fake_palette_light(), n_outputs=15)
        for draft in result["drafts"]:
            preset_id = draft["meta"]["preset_id"]
            preset = next(p for p in style_presets.all_presets() if p["id"] == preset_id)
            self.assertFalse(
                preset.get("force_dark_bg") and not False,  # explicit: light card
                f"force_dark_bg preset {preset_id!r} sampled on a light card",
            )

    def test_seeded_run_is_deterministic(self):
        first = self._run(seed=12345, n_outputs=10)
        second = self._run(seed=12345, n_outputs=10)
        first_keys = [
            (d["meta"]["recipe_id"], d["meta"]["preset_id"], d["meta"]["tone"])
            for d in first["drafts"]
        ]
        second_keys = [
            (d["meta"]["recipe_id"], d["meta"]["preset_id"], d["meta"]["tone"])
            for d in second["drafts"]
        ]
        self.assertEqual(first_keys, second_keys)

    def test_card_analysis_summary_returned(self):
        result = self._run(n_outputs=3)
        summary = result.get("card_analysis_summary")
        self.assertIsNotNone(summary)
        self.assertEqual(summary["composition"], "centered")
        self.assertEqual(summary["dominant_feeling"], "romantic")
        self.assertEqual(summary["quiet_region_count"], 2)

    def test_event_type_filters_recipes(self):
        result = self._run(event_type="corporate_event", n_outputs=5)
        # corporate_event should preferentially pick corporate-tagged recipes.
        # At minimum, no recipe with 'fits' restricted to wedding-only should
        # appear (e.g. 'overlay-hero-with-timer' fits wedding+life events).
        all_recipes = {r["id"]: r for r in recipes.all_recipes()}
        for draft in result["drafts"]:
            rid = draft["meta"]["recipe_id"]
            recipe = all_recipes[rid]
            fits = recipe.get("fits") or []
            self.assertTrue(
                "all" in fits or "corporate_event" in fits,
                f"recipe {rid!r} fits={fits} appeared for corporate_event",
            )

    def test_n_outputs_clamped_to_valid_range(self):
        # generate_options clamps to [1, 15] silently.
        result = self._run(n_outputs=999)
        self.assertLessEqual(len(result["drafts"]), 15)
        result = self._run(n_outputs=0)
        self.assertGreaterEqual(len(result["drafts"]), 1)


class ComposeConfigTests(TestCase):
    """Direct tests for `compose_config` / `build_overlays`."""

    def setUp(self):
        self.palette = _fake_palette_light()
        self.card = _fake_card_analysis_with_quiet_regions()
        self.copy = {
            "primary": "Anna & Ben",
            "secondary": "December 12, 2026",
            "tertiary": "Reception to follow",
            "tone": "romantic",
            "notes": "",
        }
        self.preset = next(
            p for p in style_presets.all_presets() if p["id"] == "ivory-romance"
        )

    def test_compose_config_emits_overlays_for_full_overlay(self):
        recipe = next(
            r for r in recipes.all_recipes()
            if r["overlay_strategy"] == "full_overlay"
        )
        config, warnings = layout_generator.compose_config(
            card_url="https://test.example.com/card.jpg",
            card_analysis=self.card,
            palette_data=self.palette,
            recipe=recipe,
            preset=self.preset,
            copy=self.copy,
        )
        # find the greeting-card tile and verify overlays were attached
        gc_tiles = [t for t in config["tiles"] if t["type"] == "greeting-card"]
        self.assertEqual(len(gc_tiles), 1)
        overlays = gc_tiles[0]["settings"].get("textOverlays") or []
        self.assertTrue(overlays, "full_overlay recipe should produce overlays")

    def test_compose_config_no_overlay_for_baked_text(self):
        # Pick a 'none' strategy recipe — overlays must be empty regardless.
        recipe = next(
            r for r in recipes.all_recipes()
            if r["overlay_strategy"] == "none"
        )
        baked = _fake_card_analysis_baked_text()
        config, warnings = layout_generator.compose_config(
            card_url="https://test.example.com/card.jpg",
            card_analysis=baked,
            palette_data=self.palette,
            recipe=recipe,
            preset=self.preset,
            copy=self.copy,
        )
        gc_tiles = [t for t in config["tiles"] if t["type"] == "greeting-card"]
        self.assertEqual(len(gc_tiles), 1)
        self.assertEqual(gc_tiles[0]["settings"].get("textOverlays") or [], [])

    def test_compose_config_uses_palette_for_colors(self):
        recipe = next(r for r in recipes.all_recipes() if r["id"] == "card-then-title")
        config, _ = layout_generator.compose_config(
            card_url="https://test.example.com/card.jpg",
            card_analysis=self.card,
            palette_data=self.palette,
            recipe=recipe,
            preset=self.preset,
            copy=self.copy,
        )
        cc = config.get("customColors") or {}
        self.assertEqual(cc.get("backgroundColor"), self.palette["bg"])
        self.assertEqual(cc.get("primaryColor"), self.palette["accent"])
