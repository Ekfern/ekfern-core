"""
Structural recipes for the Page Layout Gallery generator.

Unlike `recipes.py` (which drives the card-vision auto-generator and requires
a host-uploaded photo + LLM-detected "quiet regions" to place text on), these
recipes describe pre-Design-step STARTER layouts: no card image exists yet,
so composition is built entirely from tile structure + a full-bleed hero
panel that gracefully shows a designed color/gradient fill until the host
adds their own photo in the Design step (see DesignTileSettings.isLayoutHero).

Each recipe is a static, deterministic dict — no LLM, no vision, no cost.
`gallery_layout_generator.compose_gallery_config(recipe, preset)` combines a
recipe (structure) with a preset (color/font/texture/button treatment, see
`gallery_style_presets.py`) into a full InviteConfig.

Hard rules encoded structurally here (learned the hard way over several
design-review rounds on this project):
  - A layout either has ONE full-bleed hero zone (texture/gradient confined
    to it) or none at all — never texture spread across the whole page.
  - The CTA (feature-buttons tile) is either a decisive card (bordered/glass)
    or fully borderless — never a naked, ambiguous button on a busy surface.
  - Every recipe sets exactly one flourish (eyebrow XOR a decorative date
    treatment), never both, to avoid the "busy AND generic" combination.
"""
from __future__ import annotations

from copy import deepcopy

# Valid cta_style values — drives FeatureButtonsTileSettings.ctaCardStyle and,
# when 'glass', also EventDetailsTileSettings.borderStyle so the date/location
# block and the RSVP buttons read as one connected card cluster.
CTA_STYLES = {"none", "bordered", "glass"}

_RECIPES: list[dict] = [
    {
        "id": "hero-card-body",
        "name": "Cover",
        "description": "Full-bleed photo/color hero, plain body below, a decisive bordered RSVP card.",
        "has_hero": True,
        "hero_aspect_ratio": "4 / 5",
        "tile_sequence": ["poster", "title", "event-details", "feature-buttons", "description", "footer"],
        "title_align": "left",
        "title_size": "xlarge",
        "use_eyebrow": False,
        "date_layout": "day-prominent",
        "cta_style": "bordered",
        "spacing": "normal",
        "weight": 1.2,
    },
    {
        "id": "hero-glass-cluster",
        "name": "Poster Card",
        "description": "Full-bleed moody hero (texture confined to it), calm body, one frosted glass card for date+RSVP.",
        "has_hero": True,
        "hero_aspect_ratio": "4 / 5",
        "tile_sequence": ["poster", "title", "description", "event-details", "feature-buttons", "footer"],
        "title_align": "center",
        "title_size": "xlarge",
        "use_eyebrow": True,
        "date_layout": "single-line",
        "cta_style": "glass",
        "spacing": "spacious",
        "weight": 1.0,
    },
    {
        "id": "no-hero-editorial",
        "name": "Editorial Type",
        "description": "No photo needed — big asymmetric type, oversized day-number as the graphic device, borderless CTA.",
        "has_hero": False,
        "hero_aspect_ratio": None,
        "tile_sequence": ["title", "event-details", "description", "feature-buttons", "footer"],
        "title_align": "left",
        "title_size": "xlarge",
        "use_eyebrow": False,
        "date_layout": "day-prominent",
        "cta_style": "none",
        "spacing": "spacious",
        "weight": 1.0,
    },
    {
        "id": "no-hero-centered-minimal",
        "name": "Centered Minimal",
        "description": "No photo, centered restrained type, small eyebrow kicker, borderless CTA — quiet and confident.",
        "has_hero": False,
        "hero_aspect_ratio": None,
        "tile_sequence": ["title", "description", "event-details", "feature-buttons", "footer"],
        "title_align": "center",
        "title_size": "large",
        "use_eyebrow": True,
        "date_layout": "single-line",
        "cta_style": "none",
        "spacing": "spacious",
        "weight": 0.8,
    },
]


def all_recipes() -> list[dict]:
    return [deepcopy(r) for r in _RECIPES]


_VALID_TILE_TYPES = {"poster", "title", "event-details", "description", "feature-buttons", "footer"}


def _validate_recipes() -> None:
    seen_ids: set[str] = set()
    for r in _RECIPES:
        rid = r.get("id")
        if not rid or rid in seen_ids:
            raise RuntimeError(f"gallery_recipes: duplicate or missing id {rid!r}")
        seen_ids.add(rid)
        cta = r.get("cta_style")
        if cta not in CTA_STYLES:
            raise RuntimeError(
                f"gallery_recipes: recipe {rid!r} cta_style={cta!r} not in {sorted(CTA_STYLES)}"
            )
        if r.get("has_hero") and not r.get("hero_aspect_ratio"):
            raise RuntimeError(
                f"gallery_recipes: recipe {rid!r} has_hero=True but no hero_aspect_ratio set"
            )
        seq = r.get("tile_sequence") or []
        if not seq:
            raise RuntimeError(f"gallery_recipes: recipe {rid!r} has no tile_sequence")
        for t in seq:
            if t not in _VALID_TILE_TYPES:
                raise RuntimeError(
                    f"gallery_recipes: recipe {rid!r} tile_sequence has unknown type {t!r}"
                )
        has_design_tile = "poster" in seq
        if bool(r.get("has_hero")) != has_design_tile:
            raise RuntimeError(
                f"gallery_recipes: recipe {rid!r} has_hero={r.get('has_hero')} but "
                f"tile_sequence design-tile presence is {has_design_tile} — must match"
            )


_validate_recipes()
