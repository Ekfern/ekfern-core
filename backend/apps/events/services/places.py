"""
Address lookup for the invite editor.

Hosts type a venue and pick from suggestions, and we keep the coordinates that
come back. Storing a point rather than a string is what lets the map frame the
venue exactly and the tap-through link open the right place - the tile prefers
coordinates over any text.

Photon is an OpenStreetMap search service built for type-ahead. It needs no key
and no billing, which suits a feature only hosts use, a handful of times each,
while composing an invitation. Its weakness is individual house numbers, which
OSM often lacks; the Directions tile takes manual latitude and longitude for
exactly that case.

Deliberately not Nominatim: its usage policy rules out autocomplete against the
public server.

Everything here fails soft. If the service is slow or down the editor falls
back to a plain text field, which is how it behaved before this existed - a
lookup being unavailable should never stop a host writing an address.
"""
import logging

import requests
from django.core.cache import cache

logger = logging.getLogger(__name__)

PHOTON_URL = 'https://photon.komoot.io/api/'

# Short enough that a host never waits on a slow third party; the UI debounces
# before it ever gets here.
REQUEST_TIMEOUT_SECONDS = 4

# Addresses do not move. Caching also keeps repeat keystroke-prefixes off a free
# community service we do not pay for.
CACHE_TTL_SECONDS = 60 * 60 * 24

MAX_RESULTS = 5

# Required when showing OpenStreetMap-derived data.
ATTRIBUTION = 'Search by OpenStreetMap'


def _label(properties):
    """Build one readable line: 'The Taj Mahal Palace, Colaba, Mumbai, India'."""
    house_and_street = ' '.join(
        str(part) for part in (properties.get('housenumber'), properties.get('street')) if part
    )
    parts = [
        properties.get('name'),
        house_and_street or None,
        properties.get('district'),
        properties.get('city'),
        properties.get('state'),
        properties.get('country'),
    ]

    seen, ordered = set(), []
    for part in parts:
        if not part:
            continue
        text = str(part).strip()
        # Photon repeats values across fields (name == city for a town, say).
        if text and text.lower() not in seen:
            seen.add(text.lower())
            ordered.append(text)
    return ', '.join(ordered)


def _normalize(payload):
    results = []
    for feature in (payload.get('features') or [])[:MAX_RESULTS]:
        geometry = feature.get('geometry') or {}
        coords = geometry.get('coordinates') or []
        if len(coords) < 2:
            continue
        label = _label(feature.get('properties') or {})
        if not label:
            continue
        # GeoJSON is [longitude, latitude] - the opposite of how people say it.
        results.append({'label': label, 'lat': coords[1], 'lng': coords[0]})
    return results


def search_places(query, limit=MAX_RESULTS):
    """
    Return [{label, lat, lng}] for a typed query, or [] when nothing is found
    or the service is unreachable. Never raises.
    """
    cleaned = (query or '').strip()
    if len(cleaned) < 3:
        # Below three characters the suggestions are noise and the request is waste.
        return []

    cache_key = f'places:photon:{cleaned.lower()}:{limit}'
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        response = requests.get(
            PHOTON_URL,
            params={'q': cleaned, 'limit': limit},
            timeout=REQUEST_TIMEOUT_SECONDS,
            headers={'User-Agent': 'Ekfern invite editor (address lookup)'},
        )
        response.raise_for_status()
        results = _normalize(response.json())
    except (requests.RequestException, ValueError) as exc:
        # Soft failure: the editor keeps working as a plain text field.
        logger.warning('Address lookup unavailable for %r: %s', cleaned, exc)
        return []

    cache.set(cache_key, results, CACHE_TTL_SECONDS)
    return results
