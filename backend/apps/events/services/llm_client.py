"""
Thin Anthropic SDK wrapper for the Page Layout Auto-Generator.

This module is the single place where the platform talks to an external LLM.
Every call goes through the cost & abuse safety stack:

  1. Hard token caps per request (independent of LLM behaviour)
  2. Per-call wall-clock timeout
  3. Bounded retry/backoff on JSON parse + transient errors
  4. Persistent `LLMUsageLedger` write before returning (success OR failure,
     including cache hits)
  5. Real-token cost computation from the provider response — never an estimate

Provider switching: keep prompts, schemas, caching, and ledger writes
provider-agnostic; only the body of `_call_anthropic` changes if we move
off Anthropic.
"""
from __future__ import annotations

import base64
import json
import logging
import re
import time
from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Optional

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


class LLMError(Exception):
    """Base error for LLM-client failures that should bubble to the caller."""


class LLMConfigurationError(LLMError):
    """Missing/invalid configuration prevents any LLM call."""


class LLMTokenCapExceeded(LLMError):
    """Caller asked for more tokens than the configured hard cap allows."""


class LLMTimeoutError(LLMError):
    """Provider call exceeded `LLM_REQUEST_TIMEOUT_SECONDS`."""


class LLMTransportError(LLMError):
    """5xx, network blip, or rate-limit from the provider."""


class LLMResponseParseError(LLMError):
    """Provider returned data that we could not coerce to JSON."""


@dataclass
class LLMResult:
    """Outcome of one LLM call. `parsed` is the JSON-decoded response body."""
    parsed: Any
    input_tokens: int
    output_tokens: int
    cost_usd: Decimal
    model: str
    operation: str  # 'vision' | 'text'
    cache_hit: bool = False


# ---------------------------------------------------------------------------
# Cost helpers
# ---------------------------------------------------------------------------

def _price_per_token(price_per_mtok_usd: float) -> Decimal:
    """Convert dollar-per-million-tokens to dollar-per-token as Decimal."""
    return Decimal(str(price_per_mtok_usd)) / Decimal(1_000_000)


def compute_cost_usd(input_tokens: int, output_tokens: int) -> Decimal:
    """Cost of a single call given real token counts from the provider."""
    in_price = _price_per_token(settings.LLM_INPUT_PRICE_PER_MTOK_USD)
    out_price = _price_per_token(settings.LLM_OUTPUT_PRICE_PER_MTOK_USD)
    cost = (Decimal(input_tokens) * in_price) + (Decimal(output_tokens) * out_price)
    # Round to 6 decimal places (matches LLMUsageLedger.cost_usd precision).
    return cost.quantize(Decimal("0.000001"))


# ---------------------------------------------------------------------------
# Ledger helper
# ---------------------------------------------------------------------------

def write_ledger(
    *,
    user,
    request_id: str,
    operation: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    cost_usd: Decimal,
    cache_hit: bool,
    success: bool,
    error: str = "",
    metadata: Optional[dict] = None,
) -> None:
    """Persist one row to `LLMUsageLedger`. Never raises — best effort only.

    The ledger is the source of truth for cost caps; if it fails to write we
    log loudly so ops notice, but we do not break the request. The risk of a
    silent ledger gap is real but small (Postgres outage), and is mitigated
    by Layer 8 (provider-side workspace cap) and Layer 7 (alerting).
    """
    try:
        # Imported lazily to avoid app-loading order issues.
        from apps.events.models import LLMUsageLedger
        LLMUsageLedger.objects.create(
            user=user,
            request_id=request_id or "",
            operation=operation,
            provider="anthropic",
            model=model,
            input_tokens=int(input_tokens or 0),
            output_tokens=int(output_tokens or 0),
            cost_usd=cost_usd,
            cache_hit=cache_hit,
            success=success,
            error=(error or "")[:5000],
            metadata=metadata or {},
        )
    except Exception:
        logger.exception(
            "[llm_client] FAILED to write LLMUsageLedger row "
            "(request_id=%s, operation=%s, success=%s). "
            "Cost cap accounting may be inaccurate until ops investigates.",
            request_id, operation, success,
        )


# ---------------------------------------------------------------------------
# Anthropic adapter
# ---------------------------------------------------------------------------

def _client():
    """Lazy-construct the Anthropic SDK client. Raises if API key missing."""
    api_key = settings.ANTHROPIC_API_KEY
    if not api_key:
        raise LLMConfigurationError(
            "ANTHROPIC_API_KEY is not set. Generation endpoints must short-"
            "circuit before reaching the LLM client."
        )
    try:
        import anthropic
    except ImportError as exc:
        raise LLMConfigurationError(
            "anthropic SDK not installed. Add `anthropic` to requirements.txt."
        ) from exc
    return anthropic.Anthropic(
        api_key=api_key,
        timeout=settings.LLM_REQUEST_TIMEOUT_SECONDS,
    )


_JSON_FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.DOTALL)


def _extract_json(raw: str) -> Any:
    """Pull a JSON object/array out of a raw model response.

    Handles three common shapes:
      1. The whole string is valid JSON.
      2. The model wrapped JSON in a ```json ... ``` fence.
      3. The model emitted a single JSON object/array surrounded by prose;
         we extract the first {...} or [...] balanced span.
    """
    if not raw:
        raise LLMResponseParseError("Empty response from provider")
    candidate = raw.strip()
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        pass

    fence = _JSON_FENCE_RE.search(candidate)
    if fence:
        try:
            return json.loads(fence.group(1))
        except json.JSONDecodeError:
            pass

    for opener, closer in (("{", "}"), ("[", "]")):
        start = candidate.find(opener)
        end = candidate.rfind(closer)
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(candidate[start : end + 1])
            except json.JSONDecodeError:
                continue

    raise LLMResponseParseError(
        f"Could not parse JSON from response (first 200 chars): {candidate[:200]!r}"
    )


def _enforce_token_caps(operation: str, max_tokens: int) -> None:
    """Reject calls whose configured output exceeds the operation's cap."""
    cap = (
        settings.LLM_VISION_MAX_OUTPUT_TOKENS
        if operation == "vision"
        else settings.LLM_TEXT_MAX_OUTPUT_TOKENS
    )
    if max_tokens > cap:
        raise LLMTokenCapExceeded(
            f"{operation}: requested max_tokens={max_tokens} exceeds cap={cap}"
        )


def _call_anthropic(
    *,
    operation: str,
    model: str,
    system: str,
    content: list[dict],
    max_tokens: int,
    request_id: str,
    user,
    metadata: dict,
) -> LLMResult:
    """Make one call to Anthropic with retries + ledger writes."""
    from .metrics import emit_metric

    _enforce_token_caps(operation, max_tokens)

    client = _client()
    last_err: Optional[Exception] = None
    backoff = 0.5
    max_attempts = 3  # original + 2 retries; matches plan ceiling

    for attempt in range(1, max_attempts + 1):
        attempt_start = time.monotonic()
        attempt_metadata = dict(metadata, attempt=attempt)
        try:
            try:
                response = client.messages.create(
                    model=model,
                    max_tokens=max_tokens,
                    system=system,
                    messages=[{"role": "user", "content": content}],
                )
            except Exception as exc:  # SDK exceptions
                lower = type(exc).__name__.lower()
                if "timeout" in lower:
                    raise LLMTimeoutError(str(exc)) from exc
                if "rate" in lower or "overload" in lower or "apistatus" in lower:
                    raise LLMTransportError(str(exc)) from exc
                raise

            parts = getattr(response, "content", None) or []
            text = ""
            for part in parts:
                if getattr(part, "type", None) == "text":
                    text += getattr(part, "text", "") or ""
            usage = getattr(response, "usage", None)
            input_tokens = int(getattr(usage, "input_tokens", 0) or 0)
            output_tokens = int(getattr(usage, "output_tokens", 0) or 0)
            cost = compute_cost_usd(input_tokens, output_tokens)

            try:
                parsed = _extract_json(text)
            except LLMResponseParseError as exc:
                last_err = exc
                # Log the parse failure as a successful call from a billing
                # standpoint (we still got charged) before retrying.
                write_ledger(
                    user=user,
                    request_id=request_id,
                    operation=operation,
                    model=model,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    cost_usd=cost,
                    cache_hit=False,
                    success=False,
                    error=f"JSON parse failure: {exc}",
                    metadata=attempt_metadata,
                )
                emit_metric(
                    "llm.call",
                    request_id=request_id,
                    operation=operation,
                    model=model,
                    attempt=attempt,
                    status="parse_error",
                    latency_ms=int((time.monotonic() - attempt_start) * 1000),
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                )
                if attempt < max_attempts:
                    # Tighten the system prompt to coerce JSON-only output.
                    system = (
                        system
                        + "\n\nCRITICAL: respond with ONLY valid JSON. "
                        "No prose, no explanation, no code fences."
                    )
                    time.sleep(backoff)
                    backoff *= 2
                    continue
                raise

            attempt_latency_ms = int((time.monotonic() - attempt_start) * 1000)
            write_ledger(
                user=user,
                request_id=request_id,
                operation=operation,
                model=model,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                cost_usd=cost,
                cache_hit=False,
                success=True,
                metadata=dict(attempt_metadata, latency_ms=attempt_latency_ms),
            )
            emit_metric(
                "llm.call",
                request_id=request_id,
                operation=operation,
                model=model,
                attempt=attempt,
                status="success",
                latency_ms=attempt_latency_ms,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                image_source_mode=metadata.get("image_source_mode"),
            )
            return LLMResult(
                parsed=parsed,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                cost_usd=cost,
                model=model,
                operation=operation,
                cache_hit=False,
            )

        except (LLMTimeoutError, LLMTransportError) as exc:
            last_err = exc
            write_ledger(
                user=user,
                request_id=request_id,
                operation=operation,
                model=model,
                input_tokens=0,
                output_tokens=0,
                cost_usd=Decimal("0"),
                cache_hit=False,
                success=False,
                error=f"{type(exc).__name__}: {exc}",
                metadata=attempt_metadata,
            )
            emit_metric(
                "llm.call",
                request_id=request_id,
                operation=operation,
                model=model,
                attempt=attempt,
                status="transport_error",
                latency_ms=int((time.monotonic() - attempt_start) * 1000),
                error=type(exc).__name__,
            )
            if attempt < max_attempts:
                time.sleep(backoff)
                backoff *= 2
                continue
            raise
        except LLMResponseParseError:
            # Already retried above; bubble out cleanly.
            raise
        except Exception as exc:
            # Unexpected — record and re-raise.
            write_ledger(
                user=user,
                request_id=request_id,
                operation=operation,
                model=model,
                input_tokens=0,
                output_tokens=0,
                cost_usd=Decimal("0"),
                cache_hit=False,
                success=False,
                error=f"{type(exc).__name__}: {exc}",
                metadata=attempt_metadata,
            )
            emit_metric(
                "llm.call",
                request_id=request_id,
                operation=operation,
                model=model,
                attempt=attempt,
                status="error",
                latency_ms=int((time.monotonic() - attempt_start) * 1000),
                error=type(exc).__name__,
            )
            raise LLMError(str(exc)) from exc

    # Defensive: should be unreachable because each branch above raises.
    raise LLMError(f"LLM call exhausted retries: {last_err!r}")


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

_VISION_BASE64_MAX_BYTES = 5 * 1024 * 1024  # Anthropic vision max per image
_VISION_ALLOWED_MEDIA_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}


def _build_vision_image_part(image_url: str) -> tuple[dict, str]:
    """Return an Anthropic image content part plus the source mode used.

    Anthropic's vision API rejects ``http://`` URLs ("Only HTTPS URLs are
    supported."). To keep local development functional, we transparently fall
    back to fetching the image ourselves and embedding it as base64. For
    HTTPS-hosted cards (S3/CloudFront in production) we keep using the URL
    source so we don't pay the egress cost twice.

    Both branches go through ``validate_image_url`` first so a malicious
    ``image_url`` cannot trick the backend into fetching internal addresses
    (SSRF) — even Anthropic's URL-mode call counts because Anthropic resolves
    DNS at request time and we don't want to be the source of an
    open-redirect either.

    Returns ``(content_part, source_mode)`` where ``source_mode`` is either
    ``"url"`` or ``"base64"`` for telemetry/logging.
    """
    from .url_safety import UnsafeUrlError, validate_image_url

    try:
        validate_image_url(image_url, context="vision image")
    except UnsafeUrlError as exc:
        raise LLMError(str(exc)) from exc

    if image_url.startswith("https://"):
        return (
            {"type": "image", "source": {"type": "url", "url": image_url}},
            "url",
        )

    try:
        resp = requests.get(
            image_url,
            timeout=int(settings.LLM_IMAGE_FETCH_TIMEOUT_SECONDS),
            stream=False,
        )
        resp.raise_for_status()
    except requests.RequestException as exc:
        raise LLMError(
            f"Could not fetch image at {image_url} for base64 embed: {exc}"
        ) from exc

    body = resp.content or b""
    if len(body) == 0:
        raise LLMError(f"Image at {image_url} is empty.")
    if len(body) > _VISION_BASE64_MAX_BYTES:
        raise LLMError(
            f"Image at {image_url} is {len(body) // 1024} KB which exceeds the "
            f"{_VISION_BASE64_MAX_BYTES // 1024} KB cap for base64 embed."
        )

    media_type = (resp.headers.get("Content-Type") or "").split(";", 1)[0].strip().lower()
    if media_type not in _VISION_ALLOWED_MEDIA_TYPES:
        # Fallback by extension; default to jpeg if uncertain.
        lower_url = image_url.lower()
        if lower_url.endswith(".png"):
            media_type = "image/png"
        elif lower_url.endswith(".gif"):
            media_type = "image/gif"
        elif lower_url.endswith(".webp"):
            media_type = "image/webp"
        else:
            media_type = "image/jpeg"

    encoded = base64.b64encode(body).decode("ascii")
    return (
        {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": media_type,
                "data": encoded,
            },
        },
        "base64",
    )


def vision_json(
    *,
    prompt: str,
    image_url: str,
    request_id: str,
    user,
    metadata: Optional[dict] = None,
    max_tokens: Optional[int] = None,
) -> LLMResult:
    """Vision call returning parsed JSON.

    Accepts any HTTP/HTTPS URL. HTTPS URLs are forwarded as-is so Anthropic
    can fetch them directly (cheap path). HTTP / non-HTTPS URLs (typical for
    local dev) are fetched server-side and embedded as base64, because the
    Anthropic vision API only accepts HTTPS URLs in `source.url`.
    """
    cap = max_tokens or settings.LLM_VISION_MAX_OUTPUT_TOKENS
    system = (
        "You are a careful visual analyst. Respond with VALID JSON ONLY — no "
        "prose, no markdown, no code fences."
    )
    image_part, source_mode = _build_vision_image_part(image_url)
    content = [
        image_part,
        {"type": "text", "text": prompt},
    ]
    return _call_anthropic(
        operation="vision",
        model=settings.LLM_VISION_MODEL,
        system=system,
        content=content,
        max_tokens=cap,
        request_id=request_id,
        user=user,
        metadata=dict(metadata or {}, image_url=image_url, image_source_mode=source_mode),
    )


def text_json(
    *,
    prompt: str,
    request_id: str,
    user,
    metadata: Optional[dict] = None,
    max_tokens: Optional[int] = None,
    system_extra: str = "",
) -> LLMResult:
    """Plain text call returning parsed JSON."""
    cap = max_tokens or settings.LLM_TEXT_MAX_OUTPUT_TOKENS
    system = (
        "You are a tasteful invitation copywriter. Respond with VALID JSON "
        "ONLY — no prose, no markdown, no code fences."
    )
    if system_extra:
        system = f"{system}\n\n{system_extra}"
    content = [{"type": "text", "text": prompt}]
    return _call_anthropic(
        operation="text",
        model=settings.LLM_TEXT_MODEL,
        system=system,
        content=content,
        max_tokens=cap,
        request_id=request_id,
        user=user,
        metadata=metadata or {},
    )
