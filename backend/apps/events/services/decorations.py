"""
Corner decoration sets for the Page Layout Auto-Generator.

A "decoration set" is a curated bundle of corner image URLs (top-left,
top-right, bottom-left, bottom-right) plus a ``fits`` list describing which
card feelings or visual styles the set complements. ``compose_config``
samples one set per draft so every generated layout can ship a tasteful
4-corner flourish without any LLM cost.

Sets default to symmetric SVG ornaments hosted under
``/decorations/<file>.svg`` in the Next.js ``public/`` folder. Symmetry lets
the same asset URL go in all four corners — the renderer's
``object-left-top`` / ``object-right-top`` / ``object-left-bottom`` /
``object-right-bottom`` positioning handles placement.

Adding a new set?
  - Drop the SVG/PNG in ``frontend/public/decorations/``.
  - Add a row to ``_DECORATION_SETS`` below.
  - Reference the new ``id`` from the ``decoration_pool`` of any preset.

The ``"none"`` set is a real entry, not ``None`` — it lets a preset say
"sometimes I don't want decorations" without making the field optional.
"""
from __future__ import annotations

import random
from copy import deepcopy
from typing import Optional


# Public URL prefix served by Next.js. SVGs live in `frontend/public/decorations/`.
_PUBLIC_PREFIX = "/decorations"


def _all_corners(asset: str) -> dict:
    """Build a 4-corner dict that points all corners at the same asset URL."""
    return {
        "topLeft": asset,
        "topRight": asset,
        "bottomLeft": asset,
        "bottomRight": asset,
    }


def _two_corners(asset: str, *, top_only: bool = False) -> dict:
    """A subtler variant: only top corners (or bottom) get the flourish."""
    if top_only:
        return {"topLeft": asset, "topRight": asset}
    return {"bottomLeft": asset, "bottomRight": asset}


_DECORATION_SETS: list[dict] = [
    {
        "id": "none",
        "fits": ["modern", "serene", "minimal", "elegant"],
        "corners": {},  # No decorations.
    },
    {
        "id": "paisley-spot",
        "fits": ["romantic", "traditional", "elegant", "intimate"],
        "corners": _all_corners(f"{_PUBLIC_PREFIX}/paisley-spot.svg"),
    },
    {
        "id": "leaf-spray",
        "fits": ["rustic", "warm", "celebratory", "romantic"],
        "corners": _all_corners(f"{_PUBLIC_PREFIX}/leaf-spray.svg"),
    },
    {
        "id": "leaf-spray-top",
        "fits": ["rustic", "warm", "intimate"],
        "corners": _two_corners(f"{_PUBLIC_PREFIX}/leaf-spray.svg", top_only=True),
    },
    {
        "id": "geometric-star",
        "fits": ["modern", "elegant", "celebratory"],
        "corners": _all_corners(f"{_PUBLIC_PREFIX}/geometric-star.svg"),
    },
    {
        "id": "art-deco-fan",
        "fits": ["traditional", "elegant", "celebratory"],
        "corners": _all_corners(f"{_PUBLIC_PREFIX}/art-deco-fan.svg"),
    },
    {
        "id": "floral-rosette",
        "fits": ["romantic", "playful", "celebratory", "warm"],
        "corners": _all_corners(f"{_PUBLIC_PREFIX}/floral-rosette.svg"),
    },
    {
        "id": "minimal-dot",
        "fits": ["modern", "serene", "minimal", "elegant"],
        "corners": _all_corners(f"{_PUBLIC_PREFIX}/minimal-dot.svg"),
    },
]


_SET_INDEX = {s["id"]: s for s in _DECORATION_SETS}


def all_decoration_sets() -> list[dict]:
    return [deepcopy(s) for s in _DECORATION_SETS]


def get_set(set_id: str) -> Optional[dict]:
    s = _SET_INDEX.get(set_id)
    return deepcopy(s) if s else None


def pick_decoration_set(
    *,
    preset: dict,
    feeling: str | None,
    rng: random.Random,
) -> dict:
    """Choose a decoration set for one (preset, card feeling) combination.

    The preset's ``decoration_pool`` is the candidate list; if that is
    missing or empty we fall back to ``["none"]`` (no flourishes — safer
    than picking something visually mismatched).

    When the card feeling overlaps with a candidate set's ``fits`` list,
    those candidates are weighted higher in the draw so that, say, a
    ``romantic`` card preferentially gets ``floral-rosette`` over
    ``geometric-star`` even though both are in the pool.
    """
    pool_ids = preset.get("decoration_pool") or ["none"]
    candidates = [s for s in (_SET_INDEX.get(pid) for pid in pool_ids) if s]
    if not candidates:
        return deepcopy(_SET_INDEX["none"])

    weights: list[float] = []
    target = (feeling or "").lower().strip()
    for s in candidates:
        fits = {f.lower() for f in s.get("fits") or []}
        weights.append(2.0 if target and target in fits else 1.0)

    chosen = rng.choices(candidates, weights=weights, k=1)[0]
    return deepcopy(chosen)
