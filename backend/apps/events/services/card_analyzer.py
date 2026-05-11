"""
Vision analysis of a greeting card.

Wraps a single Claude Vision call that returns a structured JSON description
of the card's composition, mood, and "quiet regions" (areas where text can
be placed legibly). Result is cached by card image URL with a long TTL so
the same card is never paid for twice within the cache window.

Cache hits write a `cache_hit=True, cost_usd=0` row to `LLMUsageLedger` so
the cost dashboard accurately reflects how often analysis is amortised.
"""
from __future__ import annotations

import hashlib
import logging
import re
from decimal import Decimal
from typing import Any, Optional

from django.conf import settings
from django.core.cache import cache

from .llm_client import (
    LLMError,
    LLMResponseParseError,
    LLMResult,
    vision_json,
    write_ledger,
)

logger = logging.getLogger(__name__)


# Bumped on each schema-changing prompt edit so old cache entries don't
# pollute newer generations.
_CACHE_VERSION = "v2"


VISION_PROMPT = """\
Analyze this greeting card image and return a single JSON object describing
its composition. The card is the background of an invitation page; we will
place title, names, date, and venue text on top of it.

Required JSON shape (no other keys, no extra prose):

{
  "composition": "string — one of: 'centered', 'top_heavy', 'bottom_heavy', 'left_heavy', 'right_heavy', 'edge_framed', 'busy', 'has_baked_text'",
  "visual_style": "string — one of: 'floral', 'minimal', 'illustrated', 'photographic', 'geometric', 'ornate', 'whimsical', 'mixed'",
  "dominant_feeling": "string — one of: 'romantic', 'celebratory', 'serene', 'playful', 'elegant', 'modern', 'rustic', 'traditional'",
  "has_baked_text": true_or_false,
  "quiet_regions": [
    {
      "x": int_0_to_100,
      "y": int_0_to_100,
      "width": int_0_to_100,
      "height": int_0_to_100,
      "text_color": "string — one of: 'light', 'dark'",
      "purpose": "string — one of: 'title', 'names', 'date', 'venue', 'flexible'"
    }
  ],
  "suggested_accent_hex": "string — '#RRGGBB' hex of a color from the card that would work as a button/accent",
  "suggested_page_bg_palette": [
    "exactly three DISTINCT '#RRGGBB' hex strings for the invitation PAGE background (the area around/below the card), not the card itself"
  ],
  "bg_lightness_preference": "string — one of: 'lighter', 'match', 'darker' — should the page bg feel slightly lighter than these swatches, exactly as given, or slightly darker for contrast with a light card",
  "best_text_placement": "string — one of: 'top', 'middle', 'bottom', 'overlay-bottom-banner', 'below-card'",
  "notes": "string — at most 240 chars; one sentence on what makes this card work or where it's tricky"
}

Rules:
- Coordinates are 9:16 frame relative (x/y top-left of region, width/height in % of frame).
- If the card already has baked-in title text (e.g. a poster), set has_baked_text=true and return quiet_regions=[]; the generator will place text BELOW the card.
- If the card is purely decorative with no obvious text zones, suggest 1-2 conservative regions in the actual quiet space.
- Never invent regions. Empty quiet_regions is acceptable and useful information.
- suggested_page_bg_palette: three REAL six-digit hex colours drawn from visible areas of the card (paper, sky, margins, washes) — harmonious but not identical. They will rotate across generated layout variants so the page feels varied while staying on-brand with the artwork.
- Output ONLY the JSON object. No markdown, no commentary.
"""

_HEX_6_RE = re.compile(r"^#([0-9A-Fa-f]{6})$")


def _normalize_hex6(raw: Any) -> Optional[str]:
    if raw is None:
        return None
    s = str(raw).strip()
    m = _HEX_6_RE.match(s)
    if m:
        return f"#{m.group(1).upper()}"
    return None


def _clean_suggested_page_bg_palette(parsed: dict) -> list[str]:
    """Return up to 5 unique validated #RRGGBB strings from model output."""
    raw = parsed.get("suggested_page_bg_palette")
    out: list[str] = []
    seen: set[str] = set()
    if isinstance(raw, list):
        for item in raw:
            if len(out) >= 5:
                break
            hx = _normalize_hex6(item)
            if hx and hx not in seen:
                seen.add(hx)
                out.append(hx)
    return out


def _cache_key(image_url: str) -> str:
    digest = hashlib.sha256(image_url.encode("utf-8")).hexdigest()[:32]
    return f"llm:card_vision:{_CACHE_VERSION}:{digest}"


def _validate(parsed: Any) -> dict:
    """Light schema check + clamp coordinates to [0, 100]."""
    if not isinstance(parsed, dict):
        raise LLMResponseParseError(f"Expected object, got {type(parsed).__name__}")

    out: dict[str, Any] = {
        "composition": str(parsed.get("composition", "centered")),
        "visual_style": str(parsed.get("visual_style", "mixed")),
        "dominant_feeling": str(parsed.get("dominant_feeling", "elegant")),
        "has_baked_text": bool(parsed.get("has_baked_text", False)),
        "suggested_accent_hex": "",
        "best_text_placement": str(parsed.get("best_text_placement", "below-card")),
        "notes": str(parsed.get("notes", "") or "")[:240],
    }
    out["suggested_accent_hex"] = _normalize_hex6(parsed.get("suggested_accent_hex")) or ""

    pals = _clean_suggested_page_bg_palette(parsed)
    out["suggested_page_bg_palette"] = pals[:5]

    pref = str(parsed.get("bg_lightness_preference", "match") or "").lower().strip()
    if pref not in ("lighter", "match", "darker"):
        pref = "match"
    out["bg_lightness_preference"] = pref

    raw_regions = parsed.get("quiet_regions") or []
    if not isinstance(raw_regions, list):
        raw_regions = []

    cleaned = []
    for region in raw_regions:
        if not isinstance(region, dict):
            continue
        try:
            x = max(0, min(100, int(region.get("x", 0))))
            y = max(0, min(100, int(region.get("y", 0))))
            w = max(0, min(100, int(region.get("width", 0))))
            h = max(0, min(100, int(region.get("height", 0))))
        except (TypeError, ValueError):
            continue
        if w <= 0 or h <= 0:
            continue
        # Clamp so x+w / y+h never exceed 100.
        w = min(w, 100 - x)
        h = min(h, 100 - y)
        text_color = str(region.get("text_color", "dark")).lower()
        if text_color not in ("light", "dark"):
            text_color = "dark"
        purpose = str(region.get("purpose", "flexible")).lower()
        if purpose not in ("title", "names", "date", "venue", "flexible"):
            purpose = "flexible"
        cleaned.append(
            {
                "x": x,
                "y": y,
                "width": w,
                "height": h,
                "text_color": text_color,
                "purpose": purpose,
            }
        )

    out["quiet_regions"] = cleaned
    if out["has_baked_text"]:
        # Hard rule: baked-text cards do NOT get overlays even if the model
        # also returned regions; we trust the boolean.
        out["quiet_regions"] = []
    return out


def analyze_card(
    *,
    image_url: str,
    request_id: str,
    user,
    metadata: Optional[dict] = None,
    use_cache: bool = True,
) -> dict:
    """Return a structured analysis dict for the given card URL.

    Cache key is derived from the image URL (S3 URLs are immutable in our
    pipeline, so this is safe). On cache hit we still emit a ledger row with
    `cache_hit=True` so the dashboard tracks every "would-have-been-paid" call.
    """
    if not image_url:
        raise ValueError("image_url is required")

    cache_key = _cache_key(image_url)
    if use_cache:
        cached = cache.get(cache_key)
        if cached is not None:
            logger.debug("[card_analyzer] cache HIT for %s", image_url)
            write_ledger(
                user=user,
                request_id=request_id,
                operation="vision",
                model=settings.LLM_VISION_MODEL,
                input_tokens=0,
                output_tokens=0,
                cost_usd=Decimal("0"),
                cache_hit=True,
                success=True,
                metadata=dict(metadata or {}, image_url=image_url, cache_key=cache_key),
            )
            try:
                from .metrics import emit_metric
                emit_metric(
                    "llm.call",
                    request_id=request_id,
                    operation="vision",
                    model=settings.LLM_VISION_MODEL,
                    attempt=0,
                    status="cache_hit",
                    latency_ms=0,
                )
            except Exception:
                pass
            return cached

    try:
        result: LLMResult = vision_json(
            prompt=VISION_PROMPT,
            image_url=image_url,
            request_id=request_id,
            user=user,
            metadata=metadata,
        )
    except LLMError:
        # Bubble up; the view layer turns this into a clean 502/503.
        raise

    cleaned = _validate(result.parsed)
    try:
        cache.set(cache_key, cleaned, settings.LLM_VISION_CACHE_TTL_SECONDS)
    except Exception:
        # Cache failure is not fatal — we already paid for the call.
        logger.warning("[card_analyzer] cache.set failed for %s", image_url, exc_info=True)
    return cleaned
