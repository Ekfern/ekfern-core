"""
Style presets for the Page Layout Gallery generator.

A preset bundles everything that makes one generated layout visually
distinct from another using the SAME structural recipe: palette (flat color
or hero gradient), font pairing, hero texture, and button treatment. Presets
are combined with a structural recipe (`gallery_recipes.py`) by
`gallery_layout_generator.compose_gallery_config`.

All `font` ids referenced here MUST exist in `frontend/lib/invite/fonts.ts`.
All `texture` types MUST exist in the `TextureType` union in
`frontend/lib/invite/schema.ts`. All `button_variant` values MUST exist in
`getButtonStyles` (`frontend/lib/invite/buttonStyles.ts`).

Hard rule encoded here: `hero_texture` is the ONLY texture a preset ever
specifies — it is applied inside the full-bleed hero panel only (via
DesignTileSettings.texture), never at the page level. Every generated
layout's body stays plain and legible by construction.
"""
from __future__ import annotations

from copy import deepcopy

KNOWN_FONT_IDS = (
    "helvetica", "arial", "verdana", "trebuchet-ms", "courier-new",
    "times-new-roman", "georgia", "palatino", "comic-sans-ms", "impact",
    "playfair-display", "cormorant-garamond", "lora",
    "inter", "poppins", "open-sans",
    "great-vibes", "dancing-script", "pacifico",
    "montserrat", "raleway",
)

FONT_FAMILY_MAP: dict[str, str] = {
    "georgia": "Georgia, serif",
    "playfair-display": "'Playfair Display', serif",
    "cormorant-garamond": "'Cormorant Garamond', serif",
    "lora": "'Lora', serif",
    "inter": "Inter, system-ui, sans-serif",
    "montserrat": "'Montserrat', sans-serif",
    "raleway": "'Raleway', sans-serif",
}

_TEXTURE_TYPES = {
    "none", "paper-grain", "linen", "canvas", "parchment",
    "vintage-paper", "silk", "marble", "grain",
}

_BUTTON_VARIANTS = {
    "classic", "gloss", "soft", "metal", "raised",
    "glow", "bracket", "ornate", "glass", "link",
}
_BUTTON_RADII = {"sharp", "subtle", "round", "pill"}
_THEME_IDS = {"minimal-ivory", "classic-noir", "emerald-mist", "warm-parchment", "carbon"}


_PRESETS: list[dict] = [
    {
        "id": "blush-grain",
        "name": "Blush Grain",
        "theme_id": "minimal-ivory",
        "page_background_color": "#FFFFFF",
        "font_color": "#111111",
        "primary_color": "#D9654F",
        "muted_color": "#6B7280",
        "hero_gradient": "linear-gradient(160deg, #FDF2F0 0%, #F4A896 55%, #D9654F 100%)",
        "hero_texture": {"type": "grain", "intensity": 35},
        "title_font": "inter",
        "body_font": "inter",
        "button_variant": "bracket",
        "button_radius": "sharp",
    },
    {
        "id": "ink-forest",
        "name": "Ink Forest",
        "theme_id": "carbon",
        "page_background_color": "#0F2E22",
        "font_color": "#F5F5F0",
        "primary_color": "#8FD9B0",
        "muted_color": "#7FA396",
        "hero_gradient": None,
        "hero_texture": {"type": "none", "intensity": 0},
        "title_font": "montserrat",
        "body_font": "inter",
        "button_variant": "link",
        "button_radius": "round",
    },
    {
        "id": "violet-glass",
        "name": "Violet Glass",
        "theme_id": "classic-noir",
        "page_background_color": "#15131C",
        "font_color": "#FFFFFF",
        "primary_color": "#FFFFFF",
        "muted_color": "#D8D3FF",
        "hero_gradient": "linear-gradient(135deg, #2B0B6B 0%, #5A1FB0 40%, #1447E6 100%)",
        "hero_texture": {"type": "grain", "intensity": 22},
        "title_font": "inter",
        "body_font": "inter",
        "button_variant": "glass",
        "button_radius": "pill",
    },
    {
        "id": "wine-reserve",
        "name": "Wine Reserve",
        "theme_id": "minimal-ivory",
        "page_background_color": "#FAFAF8",
        "font_color": "#1A1A1A",
        "primary_color": "#8C2F39",
        "muted_color": "#8A8A85",
        "hero_gradient": None,
        "hero_texture": {"type": "none", "intensity": 0},
        "title_font": "playfair-display",
        "body_font": "inter",
        "button_variant": "classic",
        "button_radius": "pill",
    },
    {
        "id": "velvet-night",
        "name": "Velvet Night",
        "theme_id": "classic-noir",
        "page_background_color": "#15131C",
        "font_color": "#F2F0F5",
        "primary_color": "#C9A7F2",
        "muted_color": "#8B86A3",
        "hero_gradient": "linear-gradient(160deg, #1B1626 0%, #2E1F4D 50%, #120F1A 100%)",
        "hero_texture": {"type": "grain", "intensity": 45},
        "title_font": "cormorant-garamond",
        "body_font": "inter",
        "button_variant": "glass",
        "button_radius": "pill",
    },
    {
        "id": "golden-hour",
        "name": "Golden Hour",
        "theme_id": "warm-parchment",
        "page_background_color": "#FFFBF5",
        "font_color": "#241A0E",
        "primary_color": "#B8720A",
        "muted_color": "#9C8770",
        "hero_gradient": "linear-gradient(160deg, #FFE9C7 0%, #F5B860 55%, #B8720A 100%)",
        "hero_texture": {"type": "grain", "intensity": 30},
        "title_font": "georgia",
        "body_font": "inter",
        "button_variant": "gloss",
        "button_radius": "round",
    },
    {
        "id": "slate-modern",
        "name": "Slate Modern",
        "theme_id": "carbon",
        "page_background_color": "#2A2E35",
        "font_color": "#F0F1F3",
        "primary_color": "#5B8DBF",
        "muted_color": "#8B93A0",
        "hero_gradient": None,
        "hero_texture": {"type": "none", "intensity": 0},
        "title_font": "raleway",
        "body_font": "inter",
        "button_variant": "metal",
        "button_radius": "round",
    },
    {
        "id": "rose-parchment",
        "name": "Rose Parchment",
        "theme_id": "warm-parchment",
        "page_background_color": "#F7EFE9",
        "font_color": "#2E2016",
        "primary_color": "#B8846B",
        "muted_color": "#9B8A7C",
        "hero_gradient": "linear-gradient(160deg, #F0DCD3 0%, #E4C4B6 55%, #C99A83 100%)",
        "hero_texture": {"type": "parchment", "intensity": 40},
        "title_font": "cormorant-garamond",
        "body_font": "lora",
        "button_variant": "soft",
        "button_radius": "subtle",
    },
]


def font_family(font_id: str | None, fallback: str = "inter") -> str:
    if font_id and font_id in FONT_FAMILY_MAP:
        return FONT_FAMILY_MAP[font_id]
    return FONT_FAMILY_MAP.get(fallback, "Inter, system-ui, sans-serif")


def _validate_presets() -> None:
    known_fonts = set(KNOWN_FONT_IDS)
    seen_ids: set[str] = set()
    for p in _PRESETS:
        pid = p.get("id")
        if not pid or pid in seen_ids:
            raise RuntimeError(f"gallery_style_presets: duplicate or missing id {pid!r}")
        seen_ids.add(pid)
        for key in ("title_font", "body_font"):
            font_id = p.get(key)
            if font_id and font_id not in known_fonts:
                raise RuntimeError(
                    f"gallery_style_presets: preset {pid!r} references unknown font id "
                    f"{font_id!r} (key={key})"
                )
        if p.get("theme_id") not in _THEME_IDS:
            raise RuntimeError(
                f"gallery_style_presets: preset {pid!r} theme_id={p.get('theme_id')!r} "
                f"not in {sorted(_THEME_IDS)}"
            )
        variant = p.get("button_variant")
        if variant not in _BUTTON_VARIANTS:
            raise RuntimeError(
                f"gallery_style_presets: preset {pid!r} button_variant={variant!r} "
                f"not in {sorted(_BUTTON_VARIANTS)}"
            )
        radius = p.get("button_radius")
        if radius not in _BUTTON_RADII:
            raise RuntimeError(
                f"gallery_style_presets: preset {pid!r} button_radius={radius!r} "
                f"not in {sorted(_BUTTON_RADII)}"
            )
        texture = (p.get("hero_texture") or {}).get("type")
        if texture not in _TEXTURE_TYPES:
            raise RuntimeError(
                f"gallery_style_presets: preset {pid!r} hero_texture.type={texture!r} "
                f"not in {sorted(_TEXTURE_TYPES)}"
            )


_validate_presets()


def all_presets() -> list[dict]:
    return [deepcopy(p) for p in _PRESETS]
