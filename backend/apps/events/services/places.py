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

The create-event form uses the same service in a city-only mode, and works out
each city's time zone from its coordinates with tzfpy - offline zone
boundaries, so a time zone never depends on a second third party.

Everything here fails soft. If the service is slow or down the editor falls
back to a plain text field, which is how it behaved before this existed - a
lookup being unavailable should never stop a host writing an address.
"""
import logging

import requests
from django.core.cache import cache
from tzfpy import get_tz

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


def _timezone_at(lat, lng):
    """
    IANA time zone for a point, or None.

    Worked out locally from zone boundaries - no second service to call or to
    go down. The `Etc/GMT±N` zones only cover open sea; a town never lands in
    one, so one coming back means the point is wrong and the host should pick.
    """
    try:
        zone = get_tz(lng, lat)
    except Exception as exc:  # A bad point must not take the suggestion list down.
        logger.warning('Time zone lookup failed for (%s, %s): %s', lat, lng, exc)
        return None
    if not zone or zone.startswith('Etc/'):
        return None
    return zone


def _normalize_cities(payload, limit):
    """
    One result per town: 'Udaipur' plus 'Rajasthan, India', and its time zone.

    The country code and time zone are what the event actually stores; the
    words are only for the host to recognise the right Udaipur.
    """
    results, seen = [], set()
    for feature in payload.get('features') or []:
        properties = feature.get('properties') or {}
        coords = (feature.get('geometry') or {}).get('coordinates') or []
        name = str(properties.get('name') or '').strip()
        if len(coords) < 2 or not name:
            continue

        region_parts = []
        for part in (properties.get('state'), properties.get('country')):
            text = str(part or '').strip()
            if text and text.lower() != name.lower() and text not in region_parts:
                region_parts.append(text)
        region = ', '.join(region_parts)
        label = ', '.join([name] + region_parts)
        # OSM often holds the same village twice (a node and a boundary).
        if label.lower() in seen:
            continue
        seen.add(label.lower())

        lat, lng = coords[1], coords[0]
        results.append({
            'label': label,
            'name': name,
            'region': region,
            'country_code': str(properties.get('countrycode') or '').upper(),
            'lat': lat,
            'lng': lng,
            'timezone': _timezone_at(lat, lng),
        })
        if len(results) >= limit:
            break
    return results


def _lookup(cleaned, params, cache_key, normalize, purpose):
    """Ask Photon once per distinct query, caching answers. Returns (results, available)."""
    cached = cache.get(cache_key)
    if cached is not None:
        return cached, True

    try:
        response = requests.get(
            PHOTON_URL,
            params=params,
            timeout=REQUEST_TIMEOUT_SECONDS,
            headers={'User-Agent': f'Ekfern invite editor ({purpose})'},
        )
        response.raise_for_status()
        results = normalize(response.json())
    except (requests.RequestException, ValueError) as exc:
        # Soft failure: the form keeps working as a plain text field.
        logger.warning('%s unavailable for %r: %s', purpose.capitalize(), cleaned, exc)
        return [], False

    cache.set(cache_key, results, CACHE_TTL_SECONDS)
    return results, True


def search_places(query, limit=MAX_RESULTS):
    """
    Return (results, available) for a typed query. Never raises.

    `available` separates the two reasons a list comes back empty: the address
    genuinely has no match, or the lookup service could not be reached. The
    editor offers manual coordinates for both, but says something different.
    """
    cleaned = (query or '').strip()
    if len(cleaned) < 3:
        # Below three characters the suggestions are noise and the request is waste.
        return [], True

    return _lookup(
        cleaned,
        params={'q': cleaned, 'limit': limit},
        cache_key=f'places:photon:{cleaned.lower()}:{limit}',
        normalize=_normalize,
        purpose='address lookup',
    )


def search_cities(query, limit=MAX_RESULTS):
    """
    Towns and cities only, each with its country and time zone. Never raises.

    For the create-event form, where the event needs a city, a country and a
    time zone rather than a street address. Photon's `city` layer covers towns
    and villages too (Nathdwara, Kasauli), and `lang=en` keeps a Ukrainian
    village from showing up in Cyrillic.

    Same (results, available) contract as search_places: when the service is
    down the form falls back to typing the city and choosing the country.
    """
    cleaned = (query or '').strip()
    if len(cleaned) < 3:
        return [], True

    return _lookup(
        cleaned,
        # Ask for extra: duplicates are dropped before the list is cut to `limit`.
        params={'q': cleaned, 'limit': limit * 2, 'layer': 'city', 'lang': 'en'},
        cache_key=f'places:photon:city:{cleaned.lower()}:{limit}',
        normalize=lambda payload: _normalize_cities(payload, limit),
        purpose='city lookup',
    )
