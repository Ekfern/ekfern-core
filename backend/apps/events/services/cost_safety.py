"""
Cost & abuse safety stack for the Page Layout Auto-Generator.

This module is the gatekeeper that every generate request must pass through
BEFORE any LLM call is made. It implements the layered defense described in
the plan:

  Layer 2 — Application kill-switch and quotas
              kill_switch / per-user rate limit / per-user daily / monthly
              / concurrency mutex / idempotency
  Layer 3 — Global cost caps + pre-flight estimate
  Layer 7 — Alerting hooks

Layer 1 (authorization), Layer 4 (caching), Layer 5 (retry/timeout in
llm_client), Layer 6 (persistent ledger), and Layer 8 (provider-side caps)
live elsewhere.

The single public entrypoint is `enforce_safety_stack(...)` which raises
`SafetyStackError` (with an HTTP status hint) on the first failed check
and returns a `SafetyContext` on success.
"""
from __future__ import annotations

import json
import logging
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import timedelta
from decimal import Decimal
from typing import Any, Iterator, Optional

from django.conf import settings
from django.core.cache import cache
from django.db.models import Sum
from django.utils import timezone

from . import alerting

logger = logging.getLogger(__name__)


# Pre-flight cost estimate is computed from real settings every request via
# ``estimate_max_request_cost_usd()``. A safety multiplier keeps us ahead of
# minor token-count drift / model regressions without false-positive trips.
_PREFLIGHT_SAFETY_MULTIPLIER = Decimal("1.2")


def estimate_max_request_cost_usd() -> Decimal:
    """Worst-case cost of a single ``generate_options`` call.

    Computed from the configured token caps and per-token prices so that any
    change to ``LLM_VISION_MAX_*``, ``LLM_TEXT_MAX_*``, or
    ``LLM_INPUT/OUTPUT_PRICE_PER_MTOK_USD`` automatically flows into the
    pre-flight check. A 20% safety margin guards against drift between the
    cap and what Anthropic actually counts.
    """
    from .llm_client import compute_cost_usd

    vision_cost = compute_cost_usd(
        int(settings.LLM_VISION_MAX_INPUT_TOKENS or 0),
        int(settings.LLM_VISION_MAX_OUTPUT_TOKENS or 0),
    )
    text_cost = compute_cost_usd(
        int(settings.LLM_TEXT_MAX_INPUT_TOKENS or 0),
        int(settings.LLM_TEXT_MAX_OUTPUT_TOKENS or 0),
    )
    return ((vision_cost + text_cost) * _PREFLIGHT_SAFETY_MULTIPLIER).quantize(
        Decimal("0.000001")
    )

# Idempotency cache TTL. Same request_id within this window returns the
# cached previous response without re-invoking the LLM.
IDEMPOTENCY_CACHE_SECONDS = 60

# Per-user concurrency lock TTL. Long enough to cover the slowest possible
# generation (~10s + retry backoffs), short enough that a crashed worker
# doesn't permanently lock the user out.
CONCURRENCY_LOCK_TTL_SECONDS = 90

# Per-user rate-limit lock TTL — equal to the configured cooldown.
def _rate_limit_seconds() -> int:
    rpm = max(1, int(settings.LLM_GENERATION_RATE_LIMIT_PER_MIN or 1))
    return max(1, 60 // rpm)


class SafetyStackError(Exception):
    """Raised when a safety check fails. Carries a suggested HTTP status."""

    def __init__(
        self,
        message: str,
        *,
        status_code: int,
        code: str,
        retry_after_seconds: Optional[int] = None,
        details: Optional[dict] = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.retry_after_seconds = retry_after_seconds
        self.details = details or {}


@dataclass
class SafetyContext:
    """Bundle returned by `enforce_safety_stack` and consumed by the view."""

    request_id: str
    user_id: int
    concurrency_lock_key: Optional[str] = None
    daily_spend_usd: Decimal = Decimal("0")
    monthly_spend_usd: Decimal = Decimal("0")
    daily_user_count: int = 0
    monthly_user_count: int = 0
    cached_response: Optional[Any] = field(default=None, repr=False)


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------

def _today_window_key() -> str:
    return timezone.localdate().isoformat()


def _month_window_key() -> str:
    return timezone.localdate().strftime("%Y-%m")


def _aggregate_ledger() -> dict:
    """One DB hit, returns daily + monthly totals (cost + count) for ALL users."""
    from apps.events.models import LLMUsageLedger

    now = timezone.now()
    start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
    start_of_month = start_of_day.replace(day=1)

    base = LLMUsageLedger.objects.filter(success=True, cache_hit=False)
    daily_qs = base.filter(created_at__gte=start_of_day).aggregate(total=Sum("cost_usd"))
    monthly_qs = base.filter(created_at__gte=start_of_month).aggregate(total=Sum("cost_usd"))
    return {
        "daily_spend": Decimal(daily_qs.get("total") or 0),
        "monthly_spend": Decimal(monthly_qs.get("total") or 0),
        "start_of_day": start_of_day,
        "start_of_month": start_of_month,
    }


def _aggregate_user_counts(user_id: int, *, since_day, since_month) -> tuple[int, int]:
    """Distinct generations made by this user today / this month.

    A "generation" is approximated by the number of unique request_ids in
    the ledger window (each generate request makes 2 calls — vision and
    text — but shares one request_id).
    """
    from apps.events.models import LLMUsageLedger

    daily_count = (
        LLMUsageLedger.objects.filter(
            user_id=user_id,
            created_at__gte=since_day,
            cache_hit=False,
        )
        .values("request_id")
        .distinct()
        .count()
    )
    monthly_count = (
        LLMUsageLedger.objects.filter(
            user_id=user_id,
            created_at__gte=since_month,
            cache_hit=False,
        )
        .values("request_id")
        .distinct()
        .count()
    )
    return daily_count, monthly_count


# ---------------------------------------------------------------------------
# Concurrency lock
# ---------------------------------------------------------------------------

def _acquire_user_lock(user_id: int) -> Optional[str]:
    """Cache-based mutex preventing the same user from running two
    generations in parallel. Returns the lock key on success, None if
    already held."""
    key = f"llm_gen_concurrency:{user_id}"
    try:
        # ``add`` returns False if the key already exists.
        acquired = cache.add(key, "1", CONCURRENCY_LOCK_TTL_SECONDS)
    except Exception:
        # If cache is dead, prefer to allow the request rather than block all
        # generation. Higher layers (rate limit / cost caps) still apply.
        logger.warning("[cost_safety] cache.add failed for %s; skipping concurrency guard", key)
        return None
    return key if acquired else None


def release_user_lock(lock_key: Optional[str]) -> None:
    if not lock_key:
        return
    try:
        cache.delete(lock_key)
    except Exception:
        logger.warning("[cost_safety] cache.delete failed for %s", lock_key)


@contextmanager
def acquire_user_concurrency(user_id: int) -> Iterator[Optional[str]]:
    """Context manager: acquire on enter, release on exit.

    Raises ``SafetyStackError`` if the lock is already held by another
    in-flight request from the same user.
    """
    lock_key = _acquire_user_lock(user_id)
    if lock_key is None:
        # Already held — but we couldn't tell whether cache is broken vs busy.
        # Distinguish by trying to read the key; if present, busy.
        key = f"llm_gen_concurrency:{user_id}"
        held = False
        try:
            held = cache.get(key) is not None
        except Exception:
            held = False
        if held:
            raise SafetyStackError(
                "Another generation is already in progress for this user.",
                status_code=429,
                code="concurrency_in_use",
                retry_after_seconds=CONCURRENCY_LOCK_TTL_SECONDS,
            )
        # Cache failure path: continue without a lock.
        yield None
        return
    try:
        yield lock_key
    finally:
        release_user_lock(lock_key)


# ---------------------------------------------------------------------------
# Idempotency
# ---------------------------------------------------------------------------

def _idempotency_key(user_id: int, request_id: str) -> str:
    return f"llm_gen_idem:{user_id}:{request_id}"


def store_idempotent_response(user_id: int, request_id: str, response: dict) -> None:
    """Cache the response so a duplicate request_id within the TTL gets the same body."""
    if not request_id:
        return
    try:
        cache.set(
            _idempotency_key(user_id, request_id),
            json.dumps(response, default=str),
            IDEMPOTENCY_CACHE_SECONDS,
        )
    except Exception:
        logger.warning("[cost_safety] failed to cache idempotent response for %s", request_id)


def _load_idempotent_response(user_id: int, request_id: str) -> Optional[Any]:
    if not request_id:
        return None
    try:
        raw = cache.get(_idempotency_key(user_id, request_id))
    except Exception:
        return None
    if not raw:
        return None
    try:
        return json.loads(raw)
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Rate limit
# ---------------------------------------------------------------------------

def _check_rate_limit(user_id: int) -> None:
    key = f"llm_gen_rate:{user_id}"
    ttl = _rate_limit_seconds()
    try:
        if not cache.add(key, "1", ttl):
            raise SafetyStackError(
                "You're generating too quickly. Please wait a moment and try again.",
                status_code=429,
                code="rate_limit_per_minute",
                retry_after_seconds=ttl,
            )
    except SafetyStackError:
        raise
    except Exception:
        # Cache failure: allow but log. Other layers still bound spend.
        logger.warning("[cost_safety] rate-limit cache.add failed for %s; skipping", key)


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def enforce_safety_stack(
    *,
    user,
    request_id: str,
) -> SafetyContext:
    """Run every Layer 2 / Layer 3 safety check.

    Order matters — cheap checks first so we fail fast and never query the
    DB or hit the cache when an early gate already rejects.

    Returns a `SafetyContext` carrying spend snapshots that the caller can
    surface in the response (for "Today: $X.XX" widgets) and the
    concurrency lock key the view should release on exit.

    Raises `SafetyStackError` on any failure.
    """
    if not user or not getattr(user, "is_authenticated", False):
        raise SafetyStackError(
            "Authentication required.", status_code=401, code="not_authenticated"
        )
    if not getattr(user, "is_superuser", False):
        raise SafetyStackError(
            "Superuser access required.", status_code=403, code="not_superuser"
        )

    from apps.events.models import LLMPlatformSettings

    llm_cfg = LLMPlatformSettings.get_config()
    if not llm_cfg["generation_enabled"]:
        raise SafetyStackError(
            "LLM generation is currently disabled (kill-switch off).",
            status_code=503,
            code="kill_switch_off",
        )

    if not settings.ANTHROPIC_API_KEY:
        raise SafetyStackError(
            "ANTHROPIC_API_KEY is not configured. Provision the secret before enabling generation.",
            status_code=503,
            code="missing_api_key",
        )

    # Idempotency: short-circuit BEFORE rate limit so a page refresh doesn't
    # incur a fresh rate-limit lockout.
    cached = _load_idempotent_response(user.id, request_id)
    if cached is not None:
        return SafetyContext(
            request_id=request_id,
            user_id=user.id,
            cached_response=cached,
        )

    _check_rate_limit(user.id)

    # Aggregate ledger ONCE for all subsequent checks.
    agg = _aggregate_ledger()
    daily_spend = agg["daily_spend"]
    monthly_spend = agg["monthly_spend"]

    daily_cap = Decimal(str(llm_cfg["daily_cost_cap_usd"]))
    monthly_cap = Decimal(str(llm_cfg["monthly_cost_cap_usd"]))

    # Layer 3 — global caps (pre-flight). The headroom estimate is recomputed
    # every request so price/token-cap settings changes take effect without
    # a code deploy.
    preflight = estimate_max_request_cost_usd()
    if daily_spend + preflight > daily_cap:
        alerting.alert_kill_switch_tripped(
            reason="daily cap would be exceeded",
            window="daily",
            spend_usd=float(daily_spend),
            cap_usd=float(daily_cap),
            window_key=_today_window_key(),
        )
        raise SafetyStackError(
            (
                f"Daily LLM cost cap nearly reached "
                f"(${float(daily_spend):.4f} of ${float(daily_cap):.2f}). "
                "Generation paused until tomorrow."
            ),
            status_code=429,
            code="daily_cost_cap",
            retry_after_seconds=24 * 60 * 60,
            details={"spend_usd": float(daily_spend), "cap_usd": float(daily_cap)},
        )
    if monthly_spend + preflight > monthly_cap:
        alerting.alert_kill_switch_tripped(
            reason="monthly cap would be exceeded",
            window="monthly",
            spend_usd=float(monthly_spend),
            cap_usd=float(monthly_cap),
            window_key=_month_window_key(),
        )
        raise SafetyStackError(
            (
                f"Monthly LLM cost cap nearly reached "
                f"(${float(monthly_spend):.4f} of ${float(monthly_cap):.2f}). "
                "Generation paused until next month."
            ),
            status_code=429,
            code="monthly_cost_cap",
            retry_after_seconds=7 * 24 * 60 * 60,
            details={"spend_usd": float(monthly_spend), "cap_usd": float(monthly_cap)},
        )

    # Threshold alert (warn at 80% but DON'T block).
    threshold = int(settings.LLM_COST_ALERT_THRESHOLD_PCT or 80)
    alerting.alert_cost_threshold(
        window="daily",
        spend_usd=float(daily_spend),
        cap_usd=float(daily_cap),
        threshold_pct=threshold,
        window_key=_today_window_key(),
    )
    alerting.alert_cost_threshold(
        window="monthly",
        spend_usd=float(monthly_spend),
        cap_usd=float(monthly_cap),
        threshold_pct=threshold,
        window_key=_month_window_key(),
    )

    # Per-user quotas
    daily_user, monthly_user = _aggregate_user_counts(
        user.id,
        since_day=agg["start_of_day"],
        since_month=agg["start_of_month"],
    )
    if daily_user >= int(settings.LLM_GENERATION_DAILY_PER_USER):
        raise SafetyStackError(
            (
                f"You've reached your daily generation limit "
                f"({daily_user} of {settings.LLM_GENERATION_DAILY_PER_USER})."
            ),
            status_code=429,
            code="user_daily_limit",
            retry_after_seconds=24 * 60 * 60,
        )
    if monthly_user >= int(settings.LLM_GENERATION_MONTHLY_PER_USER):
        raise SafetyStackError(
            (
                f"You've reached your monthly generation limit "
                f"({monthly_user} of {settings.LLM_GENERATION_MONTHLY_PER_USER})."
            ),
            status_code=429,
            code="user_monthly_limit",
            retry_after_seconds=7 * 24 * 60 * 60,
        )

    return SafetyContext(
        request_id=request_id,
        user_id=user.id,
        daily_spend_usd=daily_spend,
        monthly_spend_usd=monthly_spend,
        daily_user_count=daily_user,
        monthly_user_count=monthly_user,
    )


# ---------------------------------------------------------------------------
# Read-only summary for the cost dashboard
# ---------------------------------------------------------------------------

def get_usage_summary(*, user=None, days: int = 30) -> dict:
    """Return a snapshot for the in-app cost dashboard.

    Includes today/MTD spend, current caps, kill-switch state, top spenders,
    and a daily breakdown for the last `days` days.
    """
    from apps.events.models import LLMPlatformSettings, LLMUsageLedger

    agg = _aggregate_ledger()
    threshold = int(settings.LLM_COST_ALERT_THRESHOLD_PCT or 80)

    llm_cfg = LLMPlatformSettings.get_config()
    daily_cap = float(llm_cfg["daily_cost_cap_usd"])
    monthly_cap = float(llm_cfg["monthly_cost_cap_usd"])

    days = max(1, min(int(days or 30), 90))
    since = timezone.now() - timedelta(days=days)

    # Daily breakdown: all calls (success only, non-cached) bucketed by date.
    base = LLMUsageLedger.objects.filter(
        success=True, cache_hit=False, created_at__gte=since,
    )
    daily_breakdown_qs = (
        base.extra(select={"day": "date(created_at)"})
        .values("day")
        .annotate(total=Sum("cost_usd"))
        .order_by("day")
    )
    daily_breakdown = [
        {"day": str(r["day"]), "cost_usd": float(r["total"] or 0)}
        for r in daily_breakdown_qs
    ]

    top_spenders_qs = (
        base.values("user_id")
        .annotate(total=Sum("cost_usd"))
        .order_by("-total")[:10]
    )
    top_spenders = [
        {"user_id": r["user_id"], "cost_usd": float(r["total"] or 0)}
        for r in top_spenders_qs
        if r["user_id"]
    ]

    recent = (
        LLMUsageLedger.objects.order_by("-created_at")
        .values(
            "id", "user_id", "operation", "model", "input_tokens",
            "output_tokens", "cost_usd", "cache_hit", "success",
            "created_at", "request_id",
        )[:50]
    )
    recent_calls = [
        {
            "id": r["id"],
            "user_id": r["user_id"],
            "operation": r["operation"],
            "model": r["model"],
            "input_tokens": r["input_tokens"],
            "output_tokens": r["output_tokens"],
            "cost_usd": float(r["cost_usd"] or 0),
            "cache_hit": r["cache_hit"],
            "success": r["success"],
            "created_at": r["created_at"].isoformat() if r["created_at"] else None,
            "request_id": r["request_id"],
        }
        for r in recent
    ]

    user_block: dict = {}
    if user is not None and getattr(user, "id", None):
        u_daily, u_monthly = _aggregate_user_counts(
            user.id,
            since_day=agg["start_of_day"],
            since_month=agg["start_of_month"],
        )
        user_block = {
            "daily_count": u_daily,
            "monthly_count": u_monthly,
            "daily_quota": int(settings.LLM_GENERATION_DAILY_PER_USER),
            "monthly_quota": int(settings.LLM_GENERATION_MONTHLY_PER_USER),
        }

    health = _compute_health_metrics(days=min(days, 7))

    return {
        "kill_switch_enabled": bool(llm_cfg["generation_enabled"]),
        "api_key_configured": bool(settings.ANTHROPIC_API_KEY),
        "models": {
            "vision": settings.LLM_VISION_MODEL,
            "text": settings.LLM_TEXT_MODEL,
        },
        "daily": {
            "spend_usd": float(agg["daily_spend"]),
            "cap_usd": daily_cap,
            "pct": int((float(agg["daily_spend"]) / daily_cap) * 100) if daily_cap else 0,
        },
        "monthly": {
            "spend_usd": float(agg["monthly_spend"]),
            "cap_usd": monthly_cap,
            "pct": int((float(agg["monthly_spend"]) / monthly_cap) * 100) if monthly_cap else 0,
        },
        "alert_threshold_pct": threshold,
        "daily_breakdown": daily_breakdown,
        "top_spenders": top_spenders,
        "recent_calls": recent_calls,
        "rate_limit_per_minute": int(settings.LLM_GENERATION_RATE_LIMIT_PER_MIN),
        "user": user_block,
        "health": health,
    }


def _compute_health_metrics(*, days: int = 7) -> dict:
    """Aggregate generation latency, error rate, and cache-hit rate.

    Pulls from ``LLMUsageLedger`` (which has both successful and failed
    rows, plus cache-hit rows). Latency is taken from ledger metadata when
    present (the metrics module records ``latency_ms`` on each row's
    metadata since structured logs aren't queryable from inside Django).

    Returns zeros for any metric that has no rows in the window — the
    dashboard renders these as "no data yet" rather than blowing up.
    """
    from apps.events.models import LLMUsageLedger

    days = max(1, int(days or 7))
    since = timezone.now() - timedelta(days=days)
    rows = list(
        LLMUsageLedger.objects.filter(created_at__gte=since)
        .values("operation", "success", "cache_hit", "metadata", "request_id")
    )

    if not rows:
        return {
            "window_days": days,
            "vision": {"total": 0, "errors": 0, "error_rate_pct": 0,
                       "cache_hit_pct": 0, "p50_ms": 0, "p95_ms": 0},
            "text": {"total": 0, "errors": 0, "error_rate_pct": 0,
                     "cache_hit_pct": 0, "p50_ms": 0, "p95_ms": 0},
            "generations": {"count": 0, "fallback_pct": 0},
        }

    out: dict[str, dict] = {"vision": {}, "text": {}}
    for op in ("vision", "text"):
        op_rows = [r for r in rows if r["operation"] == op]
        total = len(op_rows)
        errors = sum(1 for r in op_rows if not r["success"])
        cache_hits = sum(1 for r in op_rows if r["cache_hit"])
        latencies = []
        for r in op_rows:
            md = r.get("metadata") or {}
            lm = md.get("latency_ms") if isinstance(md, dict) else None
            if isinstance(lm, (int, float)) and lm >= 0:
                latencies.append(int(lm))
        try:
            from .metrics import compute_percentiles
            pcts = compute_percentiles(latencies, percentiles=(50, 95))
        except Exception:
            pcts = {"p50": 0, "p95": 0}
        out[op] = {
            "total": total,
            "errors": errors,
            "error_rate_pct": int((errors / total) * 100) if total else 0,
            "cache_hit_pct": int((cache_hits / total) * 100) if total else 0,
            "p50_ms": int(pcts.get("p50", 0)),
            "p95_ms": int(pcts.get("p95", 0)),
        }

    # Generation-level fallback rate. Each ``generate_options`` call writes
    # ledger rows under one ``request_id``; we approximate "generation count"
    # by distinct request_ids that have at least one text-op row, and
    # fallback rate via metadata.fallback_count summed across rows.
    distinct_request_ids: set[str] = {
        r["request_id"]
        for r in rows
        if r["operation"] == "text" and r["request_id"]
    }
    out["generations"] = {
        "count": len(distinct_request_ids),
        # Fallback % is intentionally left at 0 here — the layout_generator
        # emits this as a structured log line (METRIC layout_generator.generate
        # ... fallback_count=N). Reading it requires log aggregation, not the
        # ledger. Surfaced as 0 so the dashboard pane stays consistent until
        # the log pipeline is wired in.
        "fallback_pct": 0,
    }
    out["window_days"] = days
    return out
