"""Human-friendly display names for auto-generated invite page layouts."""
from __future__ import annotations

from . import recipes as recipes_module

# Vision ``composition`` values from card_analyzer (plus human-readable hints).
_COMPOSITION_WORDS: dict[str, str] = {
    "centered": "center-balanced card",
    "top_heavy": "top-heavy artwork",
    "bottom_heavy": "bottom-heavy artwork",
    "left_heavy": "left-weighted design",
    "right_heavy": "right-weighted design",
    "edge_framed": "edge-framed layout",
    "busy": "busy detailed artwork",
    "has_baked_text": "pre-printed lettering on the card",
    "mixed": "",
}


def humanize_event_type(event_type: str) -> str:
    s = (event_type or "").strip().replace("-", "_")
    if not s:
        return "Event"
    return " ".join(part.capitalize() for part in s.split("_"))


def humanize_kebab_id(value: str) -> str:
    if not value:
        return ""
    return " ".join(w.capitalize() for w in value.replace("_", "-").split("-") if w)


def recipe_layout_blurb(recipe_id: str, *, max_chars: int = 70) -> str:
    """Short, informative phrase from curated recipe copy (not raw id)."""
    rid = (recipe_id or "").strip()
    if not rid:
        return "Custom flow"
    for r in recipes_module.all_recipes():
        if r.get("id") != rid:
            continue
        desc = (r.get("description") or "").strip()
        if not desc:
            break
        first = desc.split("+", 1)[0].strip()
        if len(first) > max_chars:
            cut = first[: max_chars - 1].rsplit(" ", 1)[0]
            first = (cut or first[: max_chars]) + "…"
        return first
    return humanize_kebab_id(rid)


def copy_headline_snippet(primary: str | None, *, max_chars: int = 44) -> str:
    """Short excerpt from invite headline (preview_alt / tooling); not primary for filenames."""
    h = (primary or "").strip()
    if not h:
        return ""
    if len(h) <= max_chars:
        return h
    cut = h[: max_chars - 1].rsplit(" ", 1)[0]
    return (cut or h[:max_chars]) + "…"


def _norm_token(value: object) -> str:
    return str(value or "").strip().lower()


def card_image_descriptor(meta: dict, *, max_chars: int = 118) -> str:
    """Noun phrase grounding the template name to vision + baked-text cues (same card for all drafts)."""
    feeling = _norm_token(meta.get("card_feeling"))
    style = _norm_token(meta.get("card_style"))
    comp_key = _norm_token(meta.get("card_composition") or meta.get("composition"))
    has_baked = bool(meta.get("has_baked_text"))

    fragments: list[str] = []

    if feeling:
        fragments.append(f"{feeling} mood")
    # “Illustrated / ornate / photographic …” mirrors what staff see on the card.
    if style and style not in ("mixed", ""):
        fragments.append(f"{style} greeting art")
    if comp_key == "has_baked_text" or (has_baked and comp_key in ("has_baked_text", "")):
        fragments.append(_COMPOSITION_WORDS["has_baked_text"])
    elif comp_key:
        mapped = _COMPOSITION_WORDS.get(comp_key)
        if mapped:
            fragments.append(mapped)
        else:
            fragments.append(comp_key.replace("_", " "))
    elif has_baked:
        fragments.append(_COMPOSITION_WORDS["has_baked_text"])

    glue = "; ".join(fragments)
    if has_baked and "pre-printed lettering" not in glue:
        fragments.append(_COMPOSITION_WORDS["has_baked_text"])

    if not fragments:
        return "Photo greeting card layout"

    out = "; ".join(fragments)
    if len(out) > max_chars:
        out = out[: max_chars - 1].rsplit("; ", 1)[0].rstrip(",; ") + "…"
    return out


def build_auto_template_name(
    *,
    event_type: str,
    meta: dict,
    is_remix: bool,
) -> str:
    """Name ties (1) host event bucket and (2) THIS card vision to (3) page structure + preset."""
    evt = humanize_event_type(event_type)
    preset_label = humanize_kebab_id(str(meta.get("preset_id") or "")) or "styled page"
    recipe_line = recipe_layout_blurb(str(meta.get("recipe_id") or ""))
    tone = _norm_token(meta.get("tone"))
    remix_tag = " · remix" if is_remix else ""

    card_story = card_image_descriptor(meta)

    # Differentiate drafts chiefly by page recipe + typography preset + wording tone pack.
    recipe_short = recipe_line
    if len(recipe_short) > 72:
        cut = recipe_short[:69].rsplit(" ", 1)[0]
        recipe_short = (cut or recipe_short[:69]) + "…"

    tone_bit = f" · {tone} wording" if tone else ""

    # Event + card vision + layout choices (reads like a curator note, not a random tag line).
    base = (
        f"{evt} invitations for {card_story} · Page: {preset_label} — {recipe_short}{tone_bit}{remix_tag}"
    ).strip()

    if len(base) <= 255:
        return base

    # Prefer keeping event + descriptor; trim structural tail.
    head = f"{evt} — {card_story}"
    tail = (
        f" · {preset_label} — {recipe_short}{tone_bit}{remix_tag}"
    ).strip()
    budget = max(255 - len(head) - 1, 40)
    if len(tail) > budget:
        tail = tail[: budget - 1].rsplit(" ", 1)[0] + "…"
    out = f"{head} —{tail}"
    if len(out) > 255:
        out = out[:252] + "…"
    return out
