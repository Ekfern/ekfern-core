"""
Composer for the Page Layout Gallery generator.

`compose_gallery_config(recipe, preset)` combines a structural recipe
(`gallery_recipes.py`) with a style preset (`gallery_style_presets.py`) into
a full ``InviteConfig`` dict, ready to save as an ``InvitePageLayout.config``.

No LLM, no card image, no vision analysis — purely deterministic, so calling
this for every (recipe × preset) pair is cheap and can run in a management
command to populate the gallery with many distinct starter layouts at once.
"""
from __future__ import annotations

import uuid
from typing import Optional

from . import gallery_style_presets as presets_mod

SEED_DATE = "2025-06-14"


def _new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def _tile_design(*, order: int, recipe: dict, preset: dict) -> dict:
    settings: dict = {
        "frameMode": "full-bleed",
        "aspectRatio": recipe["hero_aspect_ratio"],
        "isLayoutHero": True,
    }
    gradient = preset.get("hero_gradient")
    if gradient:
        settings["backgroundGradient"] = gradient
    texture = preset.get("hero_texture") or {"type": "none", "intensity": 0}
    if texture.get("type") != "none":
        settings["texture"] = texture
    return {
        "id": _new_id("tile-design"),
        "type": "poster",
        "enabled": True,
        "order": order,
        "settings": settings,
    }


def _tile_title(*, order: int, recipe: dict, preset: dict) -> dict:
    settings: dict = {
        "text": "Event Title",
        "size": recipe["title_size"],
        "textAlign": recipe["title_align"],
    }
    if recipe.get("use_eyebrow"):
        settings["eyebrow"] = "YOU'RE INVITED"
    return {
        "id": _new_id("tile-title"),
        "type": "title",
        "enabled": True,
        "order": order,
        "settings": settings,
    }


def _tile_event_details(*, order: int, recipe: dict, preset: dict) -> dict:
    cta_style = recipe["cta_style"]
    settings: dict = {
        "location": "",
        "date": SEED_DATE,
        "textAlign": recipe["title_align"],
        "dateLayout": recipe["date_layout"],
        "buttonVariant": preset["button_variant"],
        "buttonRadius": preset["button_radius"],
    }
    if cta_style == "glass":
        settings["borderStyle"] = "glass"
    else:
        settings["borderStyle"] = "none"
        settings["backgroundColor"] = "transparent"
    return {
        "id": _new_id("tile-event-details"),
        "type": "event-details",
        "enabled": True,
        "order": order,
        "settings": settings,
    }


def _tile_description(*, order: int, recipe: dict, preset: dict) -> dict:
    align = recipe["title_align"]
    text = {
        "left": "An evening, thoughtfully gathered.",
        "center": "Join us for an evening to remember.",
    }.get(align, "Join us for an evening to remember.")
    settings: dict = {
        "content": f'<p style="text-align: {align}">{text}</p>',
        "textAlign": align,
    }
    return {
        "id": _new_id("tile-description"),
        "type": "description",
        "enabled": True,
        "order": order,
        "settings": settings,
    }


def _tile_feature_buttons(*, order: int, recipe: dict, preset: dict) -> dict:
    cta_style = recipe["cta_style"]
    settings: dict = {
        "rsvpLabel": "RSVP",
        "buttonVariant": preset["button_variant"],
        "buttonRadius": preset["button_radius"],
    }
    if cta_style != "none":
        settings["ctaCardStyle"] = cta_style
        settings["ctaCardShadow"] = True
        if cta_style == "bordered":
            settings["ctaCardBackgroundColor"] = "#FFFFFF"
            settings["ctaCardBorderColor"] = "rgba(0,0,0,0.08)"
            settings["ctaCardLabel"] = "RSVP"
    return {
        "id": _new_id("tile-feature-buttons"),
        "type": "feature-buttons",
        "enabled": True,
        "order": order,
        "settings": settings,
    }


def _tile_footer(*, order: int, recipe: dict, preset: dict) -> dict:
    return {
        "id": _new_id("tile-footer"),
        "type": "footer",
        "enabled": True,
        "order": order,
        "settings": {"text": "Made with care.", "showDivider": False},
    }


_TILE_BUILDERS = {
    "poster": _tile_design,
    "title": _tile_title,
    "event-details": _tile_event_details,
    "description": _tile_description,
    "feature-buttons": _tile_feature_buttons,
    "footer": _tile_footer,
}


def compose_gallery_config(recipe: dict, preset: dict) -> dict:
    """Build a full InviteConfig for one (recipe, preset) combination."""
    tiles: list[dict] = []
    for order, tile_type in enumerate(recipe["tile_sequence"]):
        builder = _TILE_BUILDERS[tile_type]
        tiles.append(builder(order=order, recipe=recipe, preset=preset))

    custom_colors: dict = {
        "backgroundColor": preset["page_background_color"],
        "fontColor": preset["font_color"],
        "primaryColor": preset["primary_color"],
        "mutedColor": preset["muted_color"],
    }

    config: dict = {
        "customColors": custom_colors,
        "customFonts": {
            "titleFont": presets_mod.font_family(preset.get("title_font")),
            "bodyFont": presets_mod.font_family(preset.get("body_font"), fallback="inter"),
        },
        "texture": {"type": "none"},
        "spacing": recipe["spacing"],
        "tiles": tiles,
    }
    return config


def compose_name(recipe: dict, preset: dict) -> str:
    return f"{preset['name']} {recipe['name']}"


def compose_description(recipe: dict, preset: dict) -> str:
    return recipe["description"]
