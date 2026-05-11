"""
Palette extraction for the Page Layout Auto-Generator.

Pure-Python, deterministic, zero external API cost. Given a card image URL:
  * Fetches the image with a hard 5s timeout (configurable).
  * Pulls the dominant + 5-color palette via `colorthief`.
  * Computes a luma-based readable text color (light/dark) and an accent.
  * Returns hex strings ready to drop into an `InviteConfig.customColors`.

Falls back gracefully on fetch/decode failure: returns a neutral palette so
the generator can still proceed with a "safe default" look. The caller can
inspect the `success` flag to decide whether to surface a warning to staff.
"""
from __future__ import annotations

import io
import logging
import re
from dataclasses import asdict, dataclass
from typing import Optional

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


# Conservative neutral palette used when image fetch / decode fails. Maps
# loosely to ``Minimal Ivory`` in the legacy theme list — reads well on any
# greeting card we have in the library today.
_FALLBACK_PALETTE = {
    "bg": "#FFFFFF",
    "text": "#1F1B16",
    "accent": "#A6815B",
    "muted": "#6B5F52",
    "dominant": ["#FFFFFF", "#A6815B", "#1F1B16", "#E8DCC9", "#6B5F52"],
    "is_dark_bg": False,
    "success": False,
}


@dataclass
class Palette:
    bg: str
    text: str
    accent: str
    muted: str
    dominant: list[str]
    is_dark_bg: bool
    success: bool

    def as_dict(self) -> dict:
        return asdict(self)


def _hex(rgb: tuple[int, int, int]) -> str:
    r, g, b = (max(0, min(255, int(c))) for c in rgb)
    return f"#{r:02X}{g:02X}{b:02X}"


_HEX_PARSE = re.compile(r"^#([0-9A-Fa-f]{6})$")


def parse_hex_rgb(s: Optional[str]) -> Optional[tuple[int, int, int]]:
    """Parse ``#RRGGBB`` to RGB tuple, or ``None`` if invalid."""
    if not s or not isinstance(s, str):
        return None
    m = _HEX_PARSE.match(s.strip())
    if not m:
        return None
    h = m.group(1)
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def _blend_channels(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    t = max(0.0, min(1.0, t))
    return tuple(max(0, min(255, int(round(a[i] + (b[i] - a[i]) * t)))) for i in range(3))


def adjust_page_bg_hex_for_lightness(bg_hex: str, preference: str) -> str:
    """Nudge a page background hex toward white or black per vision preference."""
    rgb = parse_hex_rgb(bg_hex)
    if rgb is None:
        return bg_hex
    if preference == "lighter":
        rgb = _blend_channels(rgb, (255, 255, 255), 0.22)
    elif preference == "darker":
        rgb = _blend_channels(rgb, (26, 26, 26), 0.18)
    return _hex(rgb)


def with_page_background(base: dict, bg_hex: str) -> dict:
    """Copy a palette dict with a new ``bg`` and recomputed readable text colours."""
    out = dict(base)
    rgb = parse_hex_rgb(bg_hex)
    if rgb is None:
        return out
    is_dark = _luma(rgb) < 100
    out["bg"] = _hex(rgb)
    out["text"] = _readable_text(rgb)
    out["muted"] = _muted(rgb, on_dark=is_dark)
    out["is_dark_bg"] = is_dark
    return out


def effective_palette_variation(
    base_palette: dict,
    card_analysis: dict,
    draft_index: int,
) -> dict:
    """Choose page background for one draft: vision palette + colorthief fallback.

    Reuses ``suggested_page_bg_palette`` and ``bg_lightness_preference`` from the
    single cached vision call (Option A — zero extra LLM cost). Rotates through
    model swatches plus colorthief ``dominant`` entries so consecutive drafts
    get visually distinct backgrounds.
    """
    preference = str(card_analysis.get("bg_lightness_preference") or "match").lower()
    if preference not in ("lighter", "match", "darker"):
        preference = "match"

    candidates: list[str] = []
    seen: set[str] = set()
    for hx in card_analysis.get("suggested_page_bg_palette") or []:
        if not isinstance(hx, str):
            continue
        cand = hx.strip().upper()
        if cand.startswith("#") and len(cand) == 7 and parse_hex_rgb(cand) and cand not in seen:
            seen.add(cand)
            candidates.append(cand)

    dom_list = base_palette.get("dominant") or base_palette.get("dominant_colors") or []
    for hx in dom_list:
        if not isinstance(hx, str):
            continue
        cand = hx.strip().upper()
        if parse_hex_rgb(cand) and cand not in seen:
            seen.add(cand)
            candidates.append(cand)

    base_bg = (base_palette.get("bg") or "#FFFFFF").strip().upper()
    if parse_hex_rgb(base_bg) and base_bg not in seen:
        candidates.append(base_bg)

    if not candidates:
        candidates = ["#FFFFFF"]

    chosen_raw = candidates[draft_index % len(candidates)]
    adjusted = adjust_page_bg_hex_for_lightness(chosen_raw, preference)
    return with_page_background(base_palette, adjusted)


def _luma(rgb: tuple[int, int, int]) -> float:
    """Perceived luminance per ITU-R BT.601. Range: 0 (black) — 255 (white)."""
    r, g, b = rgb
    return 0.299 * r + 0.587 * g + 0.114 * b


def _readable_text(rgb: tuple[int, int, int]) -> str:
    """Pick #1F1B16 (warm near-black) on light bg, #FFFFFF on dark bg."""
    return "#FFFFFF" if _luma(rgb) < 140 else "#1F1B16"


def _muted(rgb: tuple[int, int, int], on_dark: bool) -> str:
    """Mid-tone gray that contrasts with the chosen text color."""
    return "#C7BEB1" if on_dark else "#6B5F52"


def _fetch_image_bytes(image_url: str, timeout_s: int) -> Optional[bytes]:
    try:
        resp = requests.get(image_url, timeout=timeout_s, stream=True)
        resp.raise_for_status()
        # Defensive size cap: 15 MB. Greeting cards in the library are well
        # under 1 MB; this guards against accidental huge uploads.
        max_bytes = 15 * 1024 * 1024
        chunks = []
        total = 0
        for chunk in resp.iter_content(chunk_size=64 * 1024):
            if not chunk:
                continue
            total += len(chunk)
            if total > max_bytes:
                logger.warning(
                    "[palette] image_url=%s exceeded size cap (%d bytes); aborting fetch",
                    image_url, max_bytes,
                )
                return None
            chunks.append(chunk)
        return b"".join(chunks)
    except requests.RequestException as exc:
        logger.warning("[palette] fetch failed for %s: %s", image_url, exc)
        return None


def extract_palette(image_url: str) -> dict:
    """Return a palette dict for the given card URL. Never raises."""
    if not image_url:
        return dict(_FALLBACK_PALETTE)

    timeout = settings.LLM_IMAGE_FETCH_TIMEOUT_SECONDS
    blob = _fetch_image_bytes(image_url, timeout_s=timeout)
    if blob is None:
        return dict(_FALLBACK_PALETTE)

    try:
        from colorthief import ColorThief  # type: ignore

        thief = ColorThief(io.BytesIO(blob))
        # quality=10 is colorthief's default; trades accuracy for ~10x speed.
        dominant = thief.get_color(quality=10)
        try:
            palette = thief.get_palette(color_count=6, quality=10)
        except Exception:
            palette = [dominant]

        # Drop the dominant from the palette to avoid duplicate; cap to 5.
        secondary = [c for c in palette if c != dominant][:5]
        if not secondary:
            secondary = [dominant]

        bg_rgb = dominant
        is_dark = _luma(bg_rgb) < 100
        text_hex = _readable_text(bg_rgb)
        accent_rgb = secondary[0]
        # If accent has poor contrast against bg, hop to the next palette
        # entry that does. Preserves "card mood" without sacrificing read.
        for cand in secondary:
            if abs(_luma(cand) - _luma(bg_rgb)) > 60:
                accent_rgb = cand
                break

        return Palette(
            bg=_hex(bg_rgb),
            text=text_hex,
            accent=_hex(accent_rgb),
            muted=_muted(bg_rgb, on_dark=is_dark),
            dominant=[_hex(bg_rgb), *(_hex(c) for c in secondary[:4])],
            is_dark_bg=is_dark,
            success=True,
        ).as_dict()
    except Exception as exc:
        logger.warning("[palette] colorthief failed for %s: %s", image_url, exc)
        return dict(_FALLBACK_PALETTE)
