"""
Email alerts for the LLM cost-safety stack.

Two alert types:

  * ``cost_threshold``     — fires when daily or monthly spend crosses
                             ``LLM_COST_ALERT_THRESHOLD_PCT`` of the
                             corresponding cap (default 80%).
  * ``kill_switch_tripped`` — fires when a request is rejected because a
                              cost cap is fully exhausted.

Both are de-duplicated via Django cache so a stuck condition does not spam
the alert mailbox. Dedup window: 6 hours per (alert_type, window_key).
The alert is best-effort — if the cache or email backend fails, the safety
stack still works (the alert just doesn't go out).
"""
from __future__ import annotations

import logging

from django.core.cache import cache

logger = logging.getLogger(__name__)


_DEDUP_TTL_SECONDS = 6 * 60 * 60  # 6 hours


def _send_email_safe(*, subject: str, title: str, rows, advice: str) -> None:
    from apps.events.models import LLMPlatformSettings

    target = (LLMPlatformSettings.get_config()['cost_alert_email'] or "").strip()
    if not target:
        logger.info("[llm_alert] no LLM_COST_ALERT_EMAIL configured; would send: %s", subject)
        return
    try:
        from apps.common import emails
        from apps.common.email_backend import send_email
        rendered = emails.ops_alert(title=title, subject=subject, rows=rows, advice=advice)
        send_email(
            to_email=target, subject=rendered.subject,
            body_text=rendered.text, body_html=rendered.html,
        )
    except Exception:
        logger.exception("[llm_alert] failed to send alert email to %s", target)


def alert_cost_threshold(
    *,
    window: str,           # 'daily' or 'monthly'
    spend_usd: float,
    cap_usd: float,
    threshold_pct: int,
    window_key: str,       # e.g. '2026-05-08' or '2026-05'
) -> None:
    """Fire an alert if spend has crossed the configured threshold."""
    if cap_usd <= 0:
        return
    pct = int((spend_usd / cap_usd) * 100)
    if pct < threshold_pct:
        return

    dedup_key = f"llm_alert:threshold:{window}:{window_key}"
    if cache.get(dedup_key):
        return
    try:
        cache.set(dedup_key, True, _DEDUP_TTL_SECONDS)
    except Exception:
        pass

    subject = (
        f"[Ekfern] LLM {window} spend at {pct}% of cap "
        f"(${spend_usd:.2f} of ${cap_usd:.2f})"
    )
    _send_email_safe(
        subject=subject,
        title=f"LLM {window} spend is at {pct}% of its cap",
        rows=[
            ('Window', f"{window} ({window_key})"),
            ('Spend so far', f"${spend_usd:.4f}"),
            ('Cap', f"${cap_usd:.2f}"),
            ('Threshold', f"{threshold_pct}%"),
        ],
        advice=(
            "If this looks unexpected, disable generation in Django Admin → "
            "LLM Platform Settings (or set LLM_GENERATION_ENABLED=False in env) "
            "to halt all generation immediately while you investigate."
        ),
    )


def alert_kill_switch_tripped(
    *,
    reason: str,
    window: str,
    spend_usd: float,
    cap_usd: float,
    window_key: str,
) -> None:
    """Fire an alert when a cap is fully exhausted and requests are blocked."""
    dedup_key = f"llm_alert:kill:{window}:{window_key}"
    if cache.get(dedup_key):
        return
    try:
        cache.set(dedup_key, True, _DEDUP_TTL_SECONDS)
    except Exception:
        pass

    subject = (
        f"[Ekfern] LLM {window} cost cap reached — generation auto-halted"
    )
    _send_email_safe(
        subject=subject,
        title=f"LLM {window} cost cap reached. Generation is halted.",
        rows=[
            ('Reason', reason),
            ('Window', f"{window} ({window_key})"),
            ('Spend', f"${spend_usd:.4f}"),
            ('Cap', f"${cap_usd:.2f}"),
        ],
        advice=(
            "All generate requests now return 429 until the window rolls over or "
            "the cap is raised. Raise the cap in Django Admin → LLM Platform "
            f"Settings, or set LLM_{window.upper()}_COST_CAP_USD in the environment, "
            "then restart workers if you rely on env-only config."
        ),
    )
