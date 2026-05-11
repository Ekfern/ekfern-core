"""
Superuser-only HTTP endpoints for the Page Layout Auto-Generator.

Routes (all behind ``IsSuperUser``):

  POST /api/admin/page-layouts/generate            — synchronous generation (previews only)
  POST /api/admin/page-layouts/remix               — resample without LLM cost (previews only)
  POST /api/admin/page-layouts/save-review-drafts  — persist a shortlist to ``InvitePageLayout``
  POST /api/admin/page-layouts/<id>/publish        — flip a single draft
  POST /api/admin/page-layouts/bulk-publish        — flip many drafts
  GET  /api/admin/llm-usage/summary                — cost dashboard data
  GET  /api/admin/page-layouts/recipes             — diagnostic catalogue

These are intentionally separate from `InvitePageLayoutViewSet` because:
  1. They require `IsSuperUser`, not `IsAuthenticated`+is_staff.
  2. They drive an external paid API and need the full safety stack.
  3. Their lifecycle (create-as-draft / publish) is one-step, not full CRUD.

The view layer's job is small: validate input → run the safety stack →
call ``layout_generator.generate_options(...)`` → return **ephemeral** draft
payloads (nothing is written to ``InvitePageLayout`` until staff POST
``save-review-drafts`` with a shortlist). Publish flows operate only on
persisted rows.
"""
from __future__ import annotations

import logging
import uuid

from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.common.permissions import IsSuperUser

from .models import InvitePageLayout, GreetingCardSample
from .serializers import InvitePageLayoutSerializer
from .services import (
    cost_safety,
    layout_generator,
    recipes as recipes_module,
    style_presets as style_presets_module,
    template_naming,
)
from .services.cost_safety import SafetyStackError
from .services.llm_client import LLMError
from .services.url_safety import UnsafeUrlError, validate_image_url

logger = logging.getLogger(__name__)

# Max layouts one "save for review" POST may create at once.
_MAX_SAVE_REVIEW_DRAFTS = 15


def _ephemeral_draft_row(
    index: int,
    draft: dict,
    *,
    card_url: str,
    event_type: str,
) -> dict:
    """Build one draft for the API response without creating a DB row."""
    config = draft["config"]
    meta = draft.get("meta") or {}
    is_remix = bool(meta.get("remix"))
    name = template_naming.build_auto_template_name(
        event_type=event_type,
        meta=meta,
        is_remix=is_remix,
    )
    description = (meta.get("copy_notes") or "")[:480]
    head_snip = (meta.get("copy_headline") or "").strip()
    if head_snip:
        preview_alt = f'{event_type} invite layout — "{head_snip}"'[:255]
    else:
        preview_alt = (
            f"{event_type} remix layout" if is_remix else f"{event_type} auto-generated layout"
        )
    return {
        "id": None,
        "persisted": False,
        "name": name,
        "description": description,
        "thumbnail": (card_url or "")[:2000],
        "preview_alt": preview_alt[:255],
        "meta": meta,
        "index": index,
        "config": config,
        "status": "draft",
        "visibility": "internal",
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _safety_error_response(exc: SafetyStackError) -> Response:
    body = {
        "error": str(exc),
        "code": exc.code,
        "details": exc.details,
    }
    headers = {}
    if exc.retry_after_seconds:
        headers["Retry-After"] = str(int(exc.retry_after_seconds))
    return Response(body, status=exc.status_code, headers=headers)


def _ensure_card_in_library(layout: InvitePageLayout, user) -> tuple[GreetingCardSample | None, bool]:
    """Guarantee the card referenced by a *published* layout exists in the library.

    Auto-generated drafts can reference S3 URLs that were uploaded ad-hoc and never
    registered in `GreetingCardSample`. If we let those layouts go live without a
    matching library entry, three things break:

      1. The card image is an orphan — vulnerable to S3 cleanup jobs that prune
         "unreferenced" objects.
      2. The host card-picker will not show this card to other hosts, even though
         a published layout is using it.
      3. There is no audit trail of every card we ship.

    This function is a *find-or-create*: if the URL already exists in the library
    we leave it alone (curated cards keep their staff-edited names, tags, overlays).
    Otherwise we register the URL with safe defaults derived from the layout itself.
    Failures here are logged but never block the publish — preserving the asset is
    best-effort, not a hard guarantee for callers.

    Returns ``(sample, created)``; ``sample`` is ``None`` only when the layout has
    no thumbnail to register.
    """
    card_url = (layout.thumbnail or "").strip()
    if not card_url:
        return None, False

    try:
        existing = GreetingCardSample.objects.filter(background_image_url=card_url).first()
        if existing:
            return existing, False

        # Best-effort tag derivation from legacy "event | …" auto names.
        derived_tag = ""
        if layout.name and " | " in layout.name:
            head = layout.name.split(" | ", 1)[0].strip().lower()
            if 0 < len(head) <= 64:
                derived_tag = head

        sample_name = f"{layout.name[:140]} (auto-saved)"[:200]
        sample = GreetingCardSample.objects.create(
            name=sample_name,
            description="Auto-saved when a page layout that referenced this card was published.",
            background_image_url=card_url,
            text_overlays=[],
            tags=[derived_tag] if derived_tag else [],
            sort_order=0,
            is_active=True,
            created_by=user,
        )
        logger.info(
            "[ensure_card_in_library] auto-saved GreetingCardSample id=%s for "
            "InvitePageLayout id=%s (url=%s)",
            sample.id, layout.id, card_url,
        )
        return sample, True
    except Exception:
        # Never block a publish on this. Log loudly and move on.
        logger.exception(
            "[ensure_card_in_library] failed to auto-save card for layout id=%s url=%s",
            layout.id, card_url,
        )
        return None, False


def _validate_payload(data: dict) -> dict:
    """Light schema validation; raises 400-mappable ValueError on failure."""
    card_url = (data.get("card_url") or "").strip()
    event_type = (data.get("event_type") or "").strip()
    concept = (data.get("concept") or "").strip()
    n_outputs = data.get("n_outputs", 10)
    request_id = (data.get("request_id") or "").strip()
    has_sub_events = bool(data.get("has_sub_events", False))
    seed = data.get("seed")

    if not card_url:
        raise ValueError("card_url is required.")
    if not event_type:
        raise ValueError("event_type is required.")
    if not card_url.startswith(("http://", "https://")):
        raise ValueError("card_url must be a fully-qualified URL.")
    try:
        validate_image_url(card_url, context="card_url")
    except UnsafeUrlError as exc:
        raise ValueError(str(exc)) from exc
    try:
        n_outputs = int(n_outputs)
    except (TypeError, ValueError):
        raise ValueError("n_outputs must be an integer between 1 and 15.")
    if n_outputs < 1 or n_outputs > 15:
        raise ValueError("n_outputs must be between 1 and 15.")
    if len(concept) > 500:
        concept = concept[:500]
    if not request_id:
        request_id = uuid.uuid4().hex
    if seed is not None:
        try:
            seed = int(seed)
        except (TypeError, ValueError):
            seed = None

    return {
        "card_url": card_url,
        "event_type": event_type,
        "concept": concept,
        "n_outputs": n_outputs,
        "request_id": request_id,
        "has_sub_events": has_sub_events,
        "seed": seed,
    }


# ---------------------------------------------------------------------------
# POST /api/admin/page-layouts/generate
# ---------------------------------------------------------------------------

@api_view(["POST"])
@permission_classes([IsSuperUser])
def generate_page_layouts(request):
    """Synchronous generation endpoint. Blocks ~5–60s.

    Returns draft previews only (``persisted: false``, ``id: null``).
    Use ``POST save-review-drafts`` to write a shortlist into
    ``InvitePageLayout`` for the Page Layout Studio.
    """
    try:
        payload = _validate_payload(request.data or {})
    except ValueError as exc:
        return Response({"error": str(exc), "code": "invalid_input"}, status=400)

    try:
        ctx = cost_safety.enforce_safety_stack(
            user=request.user,
            request_id=payload["request_id"],
        )
    except SafetyStackError as exc:
        return _safety_error_response(exc)

    # Idempotent replay
    if ctx.cached_response is not None:
        return Response(ctx.cached_response, status=200)

    # Optional sanity hint: log if card_url isn't a known greeting card.
    try:
        if not GreetingCardSample.objects.filter(background_image_url=payload["card_url"]).exists():
            logger.info(
                "[generate_page_layouts] card_url %s not in GreetingCardSample library; "
                "proceeding anyway (request_id=%s, user=%s).",
                payload["card_url"], payload["request_id"], request.user.id,
            )
    except Exception:
        pass

    # Concurrency mutex: at most one in-flight generation per user.
    try:
        with cost_safety.acquire_user_concurrency(request.user.id):
            try:
                result = layout_generator.generate_options(
                    card_url=payload["card_url"],
                    event_type=payload["event_type"],
                    concept=payload["concept"],
                    user=request.user,
                    request_id=payload["request_id"],
                    n_outputs=payload["n_outputs"],
                    has_sub_events=payload["has_sub_events"],
                    seed=payload["seed"],
                )
            except LLMError as exc:
                logger.warning(
                    "[generate_page_layouts] LLM error request_id=%s: %s",
                    payload["request_id"], exc,
                )
                return Response(
                    {
                        "error": "LLM provider failed. No drafts were created.",
                        "code": "llm_error",
                        "detail": str(exc),
                    },
                    status=502,
                )
            except Exception as exc:
                logger.exception(
                    "[generate_page_layouts] unexpected failure request_id=%s",
                    payload["request_id"],
                )
                return Response(
                    {
                        "error": "Generation failed. No drafts were created.",
                        "code": "internal_error",
                        "detail": str(exc),
                    },
                    status=500,
                )

            drafts = result.get("drafts") or []
            if not drafts:
                return Response(
                    {"error": "No drafts could be generated for this card and event type.",
                     "code": "no_drafts"},
                    status=422,
                )

            session_id = uuid.uuid4().hex
            created_rows = [
                _ephemeral_draft_row(
                    index,
                    draft,
                    card_url=payload["card_url"],
                    event_type=payload["event_type"],
                )
                for index, draft in enumerate(drafts, start=1)
            ]

            response_body = {
                "session_id": session_id,
                "request_id": payload["request_id"],
                "card_url": payload["card_url"],
                "event_type": payload["event_type"],
                "drafts": created_rows,
                "card_analysis_summary": result.get("card_analysis_summary"),
                "palette": result.get("palette"),
                "spend_snapshot": {
                    "daily_usd": float(ctx.daily_spend_usd),
                    "monthly_usd": float(ctx.monthly_spend_usd),
                    "user_daily_count": ctx.daily_user_count,
                    "user_monthly_count": ctx.monthly_user_count,
                },
            }

            cost_safety.store_idempotent_response(
                request.user.id, payload["request_id"], response_body
            )
            return Response(response_body, status=201)

    except SafetyStackError as exc:
        return _safety_error_response(exc)


# ---------------------------------------------------------------------------
# POST /api/admin/page-layouts/remix
# ---------------------------------------------------------------------------

@api_view(["POST"])
@permission_classes([IsSuperUser])
def remix_page_layouts(request):
    """Resample a previous generation without paying for fresh LLM calls.

    Body (JSON):
      - ``parent_request_id`` (required) — the ``request_id`` of the prior
        generate-call whose vision + copy snapshot we want to reuse.
      - ``request_id`` (optional) — idempotency/dedup key for THIS remix.
      - ``n_outputs`` (default 10, max 15)
      - ``seed`` (optional int) — drives sampling deterministically.
      - ``lock_recipe_id`` / ``lock_preset_id`` / ``lock_copy_idx`` —
        any subset; locked dimensions stay constant across all drafts.

    Behaviour:
      - Returned drafts are previews only (``persisted: false``). Use
        ``save-review-drafts`` to persist a shortlist to the studio.
      - Vision + copy LLM calls are skipped — the cached snapshot is reused.
      - Sampling, composition, decoration selection still run.
      - All cost-safety layers still apply (kill-switch, caps, quotas).
    """
    data = request.data or {}
    parent_request_id = (data.get("parent_request_id") or "").strip()
    if not parent_request_id:
        return Response(
            {"error": "parent_request_id is required.", "code": "invalid_input"},
            status=400,
        )

    try:
        n_outputs = int(data.get("n_outputs", 10))
    except (TypeError, ValueError):
        return Response(
            {"error": "n_outputs must be an integer.", "code": "invalid_input"},
            status=400,
        )
    if not (1 <= n_outputs <= 15):
        return Response(
            {"error": "n_outputs must be between 1 and 15.", "code": "invalid_input"},
            status=400,
        )

    request_id = (data.get("request_id") or "").strip() or uuid.uuid4().hex
    seed = data.get("seed")
    if seed is not None:
        try:
            seed = int(seed)
        except (TypeError, ValueError):
            seed = None
    lock_recipe_id = (data.get("lock_recipe_id") or "").strip() or None
    lock_preset_id = (data.get("lock_preset_id") or "").strip() or None
    lock_copy_idx = data.get("lock_copy_idx")

    try:
        ctx = cost_safety.enforce_safety_stack(user=request.user, request_id=request_id)
    except SafetyStackError as exc:
        return _safety_error_response(exc)

    if ctx.cached_response is not None:
        return Response(ctx.cached_response, status=200)

    try:
        with cost_safety.acquire_user_concurrency(request.user.id):
            try:
                result = layout_generator.remix_options(
                    parent_request_id=parent_request_id,
                    user=request.user,
                    request_id=request_id,
                    n_outputs=n_outputs,
                    seed=seed,
                    lock_recipe_id=lock_recipe_id,
                    lock_preset_id=lock_preset_id,
                    lock_copy_idx=lock_copy_idx,
                )
            except ValueError as exc:
                return Response(
                    {"error": str(exc), "code": "invalid_input"},
                    status=400,
                )
            except Exception as exc:
                logger.exception(
                    "[remix_page_layouts] unexpected failure request_id=%s parent=%s",
                    request_id, parent_request_id,
                )
                return Response(
                    {
                        "error": "Remix failed. No drafts were created.",
                        "code": "internal_error",
                        "detail": str(exc),
                    },
                    status=500,
                )

            drafts = result.get("drafts") or []
            if not drafts:
                return Response(
                    {
                        "error": "No drafts could be generated for these locks.",
                        "code": "no_drafts",
                    },
                    status=422,
                )

            session_id = uuid.uuid4().hex
            from .services.remix_cache import fetch as _fetch_snapshot
            snapshot = _fetch_snapshot(request_id) or {}
            card_url = snapshot.get("card_url") or ""
            event_type = snapshot.get("event_type") or "event"

            created_rows = [
                _ephemeral_draft_row(
                    index,
                    draft,
                    card_url=card_url,
                    event_type=event_type,
                )
                for index, draft in enumerate(drafts, start=1)
            ]

            response_body = {
                "session_id": session_id,
                "request_id": request_id,
                "parent_request_id": parent_request_id,
                "card_url": card_url,
                "event_type": event_type,
                "drafts": created_rows,
                "card_analysis_summary": result.get("card_analysis_summary"),
                "palette": result.get("palette"),
                "remix": True,
                "spend_snapshot": {
                    "daily_usd": float(ctx.daily_spend_usd),
                    "monthly_usd": float(ctx.monthly_spend_usd),
                    "user_daily_count": ctx.daily_user_count,
                    "user_monthly_count": ctx.monthly_user_count,
                },
            }
            cost_safety.store_idempotent_response(
                request.user.id, request_id, response_body
            )
            return Response(response_body, status=201)
    except SafetyStackError as exc:
        return _safety_error_response(exc)


# ---------------------------------------------------------------------------
# POST /api/admin/page-layouts/save-review-drafts
# ---------------------------------------------------------------------------

def _validate_save_review_payload(data: dict) -> dict:
    """Parse save-for-review body. Raises ValueError on invalid input."""
    card_url = (data.get("card_url") or "").strip()
    event_type = (data.get("event_type") or "").strip()
    raw_drafts = data.get("drafts")

    if not card_url:
        raise ValueError("card_url is required.")
    if not event_type:
        raise ValueError("event_type is required.")
    if not card_url.startswith(("http://", "https://")):
        raise ValueError("card_url must be a fully-qualified URL.")
    try:
        validate_image_url(card_url, context="save_review_card_url")
    except UnsafeUrlError as exc:
        raise ValueError(str(exc)) from exc

    if not isinstance(raw_drafts, list) or len(raw_drafts) == 0:
        raise ValueError("drafts must be a non-empty list.")

    cleaned: list[dict] = []
    for entry in raw_drafts:
        if not isinstance(entry, dict):
            raise ValueError("Each draft must be an object.")
        cfg = entry.get("config")
        if not isinstance(cfg, dict):
            raise ValueError("Each draft requires a config object.")
        meta = entry.get("meta") if isinstance(entry.get("meta"), dict) else {}
        nm = (entry.get("name") or "").strip()
        if not nm:
            is_remix = bool(meta.get("remix"))
            nm = template_naming.build_auto_template_name(
                event_type=event_type,
                meta=meta,
                is_remix=is_remix,
            )
        thumb = (entry.get("thumbnail") or "").strip() or card_url
        prev_alt = (entry.get("preview_alt") or "").strip()
        if not prev_alt:
            prev_alt = (
                f"{event_type} remix layout" if meta.get("remix") else f"{event_type} auto-generated layout"
            )
        cleaned.append({
            "name": nm[:255],
            "description": (meta.get("copy_notes") or "")[:480],
            "thumbnail": thumb[:2000],
            "preview_alt": prev_alt[:255],
            "config": cfg,
            "meta": meta,
            "client_index": entry.get("index"),
        })

    if len(cleaned) > _MAX_SAVE_REVIEW_DRAFTS:
        raise ValueError(f"Too many drafts (max {_MAX_SAVE_REVIEW_DRAFTS}).")

    return {"card_url": card_url, "event_type": event_type, "drafts": cleaned}


@api_view(["POST"])
@permission_classes([IsSuperUser])
def save_review_drafts(request):
    """Persist selected ephemeral AI drafts as internal studio rows."""
    try:
        payload = _validate_save_review_payload(request.data or {})
    except ValueError as exc:
        return Response({"error": str(exc), "code": "invalid_input"}, status=400)

    created: list[dict] = []
    with transaction.atomic():
        for payload_index, row in enumerate(payload["drafts"], start=1):
            layout = InvitePageLayout.objects.create(
                name=row["name"],
                description=row["description"],
                thumbnail=row["thumbnail"],
                preview_alt=row["preview_alt"],
                config=row["config"],
                visibility="internal",
                status="draft",
                created_by=request.user,
            )
            meta = row["meta"]
            created.append(
                {
                    "id": layout.id,
                    "persisted": True,
                    "name": layout.name,
                    "description": layout.description,
                    "thumbnail": layout.thumbnail,
                    "preview_alt": layout.preview_alt,
                    "meta": meta,
                    "index": row["client_index"] if row["client_index"] is not None else payload_index,
                    "config": layout.config,
                    "status": layout.status,
                    "visibility": layout.visibility,
                }
            )

    return Response(
        {"saved": created, "count": len(created), "request_id": uuid.uuid4().hex},
        status=201,
    )


# ---------------------------------------------------------------------------
# POST /api/admin/page-layouts/<id>/publish
# ---------------------------------------------------------------------------

@api_view(["POST"])
@permission_classes([IsSuperUser])
def publish_page_layout(request, layout_id: int):
    """Flip a single draft to ``status='published', visibility='public'``."""
    layout = get_object_or_404(InvitePageLayout, pk=layout_id)
    new_name = (request.data.get("name") or "").strip()
    visibility = (request.data.get("visibility") or "public").strip()
    if visibility not in {"public", "premium", "internal"}:
        return Response({"error": "visibility must be one of public/premium/internal."}, status=400)

    with transaction.atomic():
        layout.status = "published"
        layout.visibility = visibility
        if new_name:
            layout.name = new_name[:255]
        layout.updated_by = request.user
        layout.save(update_fields=["status", "visibility", "name", "updated_by", "updated_at"])
        card_sample, card_created = _ensure_card_in_library(layout, request.user)

    response_body = InvitePageLayoutSerializer(layout).data
    response_body["card_sample"] = (
        {
            "id": card_sample.id,
            "name": card_sample.name,
            "auto_saved": card_created,
        }
        if card_sample
        else None
    )
    return Response(response_body, status=200)


# ---------------------------------------------------------------------------
# POST /api/admin/page-layouts/bulk-publish
# ---------------------------------------------------------------------------

@api_view(["POST"])
@permission_classes([IsSuperUser])
def bulk_publish_page_layouts(request):
    """Publish many drafts in one call. Body: ``{ids: [int], visibility?: str}``."""
    ids = request.data.get("ids") or []
    visibility = (request.data.get("visibility") or "public").strip()
    if visibility not in {"public", "premium", "internal"}:
        return Response({"error": "visibility must be one of public/premium/internal."}, status=400)
    if not isinstance(ids, list) or not ids:
        return Response({"error": "ids must be a non-empty list of integers."}, status=400)
    try:
        ids = [int(i) for i in ids]
    except (TypeError, ValueError):
        return Response({"error": "ids must contain only integers."}, status=400)

    with transaction.atomic():
        qs = InvitePageLayout.objects.filter(id__in=ids)
        # We need the rows post-update to call _ensure_card_in_library, so .update()
        # the columns and then re-fetch. .update() is one SQL statement and skips
        # signals/`save()` overrides, which is exactly what we want for a bulk flip.
        updated = qs.update(
            status="published",
            visibility=visibility,
            updated_by=request.user,
        )
        published_layouts = list(InvitePageLayout.objects.filter(id__in=ids))
        cards_auto_saved = 0
        for layout in published_layouts:
            _, created = _ensure_card_in_library(layout, request.user)
            if created:
                cards_auto_saved += 1
    return Response(
        {"updated": updated, "ids": ids, "cards_auto_saved": cards_auto_saved},
        status=200,
    )


# ---------------------------------------------------------------------------
# GET /api/admin/llm-usage/summary
# ---------------------------------------------------------------------------

@api_view(["GET"])
@permission_classes([IsSuperUser])
def llm_usage_summary(request):
    """Cost dashboard data: today/MTD spend, caps, recent calls, kill-switch."""
    try:
        days = int(request.query_params.get("days", 30))
    except (TypeError, ValueError):
        days = 30
    summary = cost_safety.get_usage_summary(user=request.user, days=days)
    return Response(summary, status=200)


# ---------------------------------------------------------------------------
# GET /api/admin/page-layouts/recipes — diagnostic helper
# ---------------------------------------------------------------------------

@api_view(["GET"])
@permission_classes([IsSuperUser])
def list_recipes_and_presets(request):
    """Return the current recipe + style preset catalogue for staff debugging."""
    return Response(
        {
            "recipes": recipes_module.all_recipes(),
            "presets": style_presets_module.all_presets(),
        },
        status=200,
    )
