"""
Short-lived cache for the remix workflow.

A remix lets staff regenerate variations of a previous ``generate_options``
session without paying for a fresh vision + copy LLM call. To pull this off
we cache:

  - The card-analysis dict (vision is already cached by `card_analyzer`,
    but we re-cache here keyed by ``request_id`` for explicit lookup).
  - The full list of ``copy_variants`` returned by `copy_generator`.
  - The original ``card_url``, ``event_type``, ``concept``, and
    ``palette`` snapshot — so the remix view doesn't have to ask the
    client to re-supply them.

Cache backend: Django's default cache (locmem in tests, Redis in prod).
TTL is short by design (1 hour default). Long-lived persistence happens
through the existing ``LLMUsageLedger`` and ``InvitePageLayout`` rows.
"""
from __future__ import annotations

import logging
from typing import Optional

from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)


_CACHE_PREFIX = "auto_gen:remix"


def _ttl() -> int:
    return int(getattr(settings, "LLM_REMIX_CACHE_TTL_SECONDS", 60 * 60))


def _key(request_id: str) -> str:
    return f"{_CACHE_PREFIX}:{request_id}"


def store(*, request_id: str, payload: dict) -> None:
    """Persist a generation snapshot for later remix.

    ``payload`` should contain at minimum: ``card_url``, ``event_type``,
    ``concept``, ``card_analysis``, ``copy_variants``, ``palette``,
    ``has_sub_events``. Missing keys are not validated here — the consumer
    decides what to do with a partial payload.
    """
    if not request_id:
        return
    try:
        cache.set(_key(request_id), payload, _ttl())
    except Exception:
        logger.exception(
            "[remix_cache] failed to store snapshot for request_id=%s", request_id,
        )


def fetch(request_id: str) -> Optional[dict]:
    if not request_id:
        return None
    try:
        return cache.get(_key(request_id))
    except Exception:
        logger.exception(
            "[remix_cache] failed to read snapshot for request_id=%s", request_id,
        )
        return None
