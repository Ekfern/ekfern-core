"""
Lightweight structured-log metrics for the auto-generator pipeline.

We deliberately avoid pulling in StatsD/Prometheus/Datadog SDKs here. The
deployment already ships JSON logs to CloudWatch; structured ``METRIC ...``
lines are scrape-able from there with a simple log-insights query.

Usage:

    from .metrics import emit_metric
    emit_metric("layout_generator.generate", latency_ms=4321, n_outputs=10, ...)

Output line shape (single JSON object on stdout via the ``apps.events.metrics``
logger):

    METRIC {"name": "layout_generator.generate", "ts": "2026-05-09T...",
            "fields": {"latency_ms": 4321, "n_outputs": 10, ...}}

A small number of helpers are also exposed for the most common patterns
(``measure_latency`` context manager, ``compute_percentiles``).
"""
from __future__ import annotations

import json
import logging
import time
from contextlib import contextmanager
from typing import Any, Iterable

logger = logging.getLogger("apps.events.metrics")


def _safe_jsonable(value: Any) -> Any:
    """Coerce common non-JSON-native types so the log line never raises."""
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    if isinstance(value, (list, tuple)):
        return [_safe_jsonable(v) for v in value]
    if isinstance(value, dict):
        return {str(k): _safe_jsonable(v) for k, v in value.items()}
    return str(value)


def emit_metric(name: str, **fields: Any) -> None:
    """Emit a single structured ``METRIC ...`` log line.

    Best-effort: a JSON-encoding failure or a logger backend issue must
    never break the calling path. Metrics are observability, not
    correctness.
    """
    try:
        payload = {
            "name": name,
            "fields": {k: _safe_jsonable(v) for k, v in fields.items()},
        }
        logger.info("METRIC %s", json.dumps(payload, default=str))
    except Exception:
        # A metric emission failure must never propagate. Log it without
        # arguments so we don't recurse into the same problem.
        logger.exception("[metrics] emit_metric failed for name=%s", name)


@contextmanager
def measure_latency():
    """Context manager that yields ``lambda: int(elapsed_ms)``.

    Usage:

        with measure_latency() as elapsed:
            do_thing()
        emit_metric("thing", latency_ms=elapsed())
    """
    start = time.monotonic()
    yield lambda: int((time.monotonic() - start) * 1000)


def compute_percentiles(values: Iterable[float], *, percentiles: tuple[int, ...] = (50, 95)) -> dict:
    """Return {pXX: value, ...} from a small list. Empty list → zeros.

    Lightweight enough for dashboard roll-ups (≤ a few hundred samples).
    Larger workloads should aggregate in the log pipeline instead.
    """
    sample = sorted(float(v) for v in values if v is not None)
    if not sample:
        return {f"p{p}": 0 for p in percentiles}
    out: dict[str, float] = {}
    for p in percentiles:
        if not (0 < p <= 100):
            continue
        # Linear interpolation, classic nearest-rank with smoothing for tiny n.
        rank = (p / 100.0) * (len(sample) - 1)
        lo = int(rank)
        hi = min(lo + 1, len(sample) - 1)
        frac = rank - lo
        out[f"p{p}"] = sample[lo] + (sample[hi] - sample[lo]) * frac
    return out
