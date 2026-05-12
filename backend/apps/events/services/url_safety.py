"""
URL safety helpers for the Page Layout Auto-Generator.

Anywhere we fetch a host-supplied URL server-side (vision base64 fallback,
greeting card image upload, etc.) we MUST validate the target before opening
a socket. Without this, a malicious or misconfigured ``card_url`` can point
at an internal address and trick the backend into proxying requests to:

  - AWS instance metadata (``169.254.169.254``)
  - Internal services on ``127.0.0.1`` / ``localhost``
  - RFC1918 LAN addresses (``10.0.0.0/8``, ``172.16.0.0/12``, ``192.168.0.0/16``)
  - Other reserved ranges (link-local v6, multicast, unspecified)

The validator combines two checks:

  1. Host allowlist — match the URL host against ``LLM_IMAGE_FETCH_ALLOWED_HOSTS``
     using exact-or-suffix matching. ``*.amazonaws.com`` matches every S3
     bucket; ``localhost`` is opt-in for dev only.
  2. Address-family check — resolve every A/AAAA record for the host and
     reject if ANY resolves to a private/loopback/link-local/multicast/
     reserved/unspecified address. Belt-and-braces against an allowlisted
     hostname that DNS-resolves into a private range.

Both layers must pass. Order matters: allowlist first (cheap), DNS second.
"""
from __future__ import annotations

import ipaddress
import logging
import socket
from typing import Iterable
from urllib.parse import urlparse

logger = logging.getLogger(__name__)


class UnsafeUrlError(ValueError):
    """Raised when a URL fails any safety check. Maps to HTTP 400 upstream."""


def _split_hosts(raw: str) -> list[str]:
    if not raw:
        return []
    return [h.strip().lower() for h in raw.split(",") if h.strip()]


def _allowed_hosts() -> list[str]:
    """Configured allowlist; defaults are safe for prod (S3 + CloudFront only).

    Set via admin (LLM Platform Settings), ``LLM_IMAGE_FETCH_ALLOWED_HOSTS`` env,
    or comma-separated list. A leading ``*.`` means "any subdomain of".
    """
    from apps.events.models import LLMPlatformSettings

    hosts = LLMPlatformSettings.get_config()['image_fetch_allowed_hosts']
    return hosts or [
        "*.amazonaws.com",
        "*.cloudfront.net",
    ]


def _host_matches(host: str, pattern: str) -> bool:
    """Match a host against a single allowlist pattern (exact or ``*.suffix``)."""
    host = (host or "").lower()
    pattern = (pattern or "").lower()
    if not host or not pattern:
        return False
    if pattern.startswith("*."):
        suffix = pattern[1:]  # ".amazonaws.com"
        return host.endswith(suffix) or host == suffix.lstrip(".")
    return host == pattern


def _host_in_allowlist(host: str, patterns: Iterable[str]) -> bool:
    return any(_host_matches(host, p) for p in patterns)


def _address_is_routable(addr: str) -> bool:
    """True iff the address is safe to fetch from (public + non-reserved)."""
    try:
        ip = ipaddress.ip_address(addr)
    except ValueError:
        return False
    return not (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    )


def _resolve_all(host: str) -> list[str]:
    """Return every distinct numeric address for ``host`` (v4 + v6)."""
    try:
        results = socket.getaddrinfo(host, None)
    except socket.gaierror as exc:
        raise UnsafeUrlError(f"DNS lookup failed for {host!r}: {exc}") from exc

    seen: set[str] = set()
    ordered: list[str] = []
    for family, _socktype, _proto, _canon, sockaddr in results:
        if family == socket.AF_INET:
            ip = sockaddr[0]
        elif family == socket.AF_INET6:
            ip = sockaddr[0]
        else:
            continue
        if ip and ip not in seen:
            seen.add(ip)
            ordered.append(ip)
    if not ordered:
        raise UnsafeUrlError(f"DNS returned no addresses for {host!r}.")
    return ordered


def validate_image_url(url: str, *, context: str = "image") -> None:
    """Validate that ``url`` is safe for the backend to fetch.

    Raises ``UnsafeUrlError`` on any failure — bad scheme, missing host,
    non-allowlisted host, DNS lookup failure, or DNS pointing to a
    private/loopback/link-local/multicast/reserved/unspecified IP.

    ``context`` is folded into the error message so callers can distinguish
    "card_url failed" from "vision base64 fetch failed" in logs.
    """
    from apps.events.models import LLMPlatformSettings

    if not url or not isinstance(url, str):
        raise UnsafeUrlError(f"{context}: url is required.")

    parsed = urlparse(url.strip())
    if parsed.scheme not in ("http", "https"):
        raise UnsafeUrlError(
            f"{context}: scheme {parsed.scheme!r} not allowed (must be http or https)."
        )
    host = (parsed.hostname or "").lower()
    if not host:
        raise UnsafeUrlError(f"{context}: url has no host component.")

    patterns = _allowed_hosts()
    if not _host_in_allowlist(host, patterns):
        raise UnsafeUrlError(
            f"{context}: host {host!r} is not in the image-fetch allowlist."
        )

    # DNS belt-and-braces — even an allowlisted host can resolve to a private
    # IP via a CNAME, AAAA-only response, or hosts-file override.
    if LLMPlatformSettings.get_config()["image_fetch_allow_private"]:
        # Local dev opt-in: still resolve so DNS failures surface, but skip
        # the routability gate so http://localhost/media works.
        try:
            _resolve_all(host)
        except UnsafeUrlError:
            raise
        return

    addrs = _resolve_all(host)
    bad = [a for a in addrs if not _address_is_routable(a)]
    if bad:
        raise UnsafeUrlError(
            f"{context}: host {host!r} resolves to non-routable address(es) "
            f"{bad}; refusing to fetch."
        )
