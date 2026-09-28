"""
Guards for what may be stored inside an event's page_config.

The config is meant to hold *references* to images — an S3 or CloudFront URL —
never the image itself. The Page Editor already works that way: it reads a file
as a data URL only to compress it in the browser, then uploads the result and
stores the returned URL.

Nothing enforced that, though, and one event from before the upload path existed
carries 3MB of base64 in its config: ~2,400x the 1.5KB median. That single row is
fetched on every invite page load, cached in Django, and pushed through
CloudFront, and it is why the event list endpoint had to be trimmed.

Small inline SVGs (textures, map styles) are legitimate and stay allowed, so the
rule is a size limit rather than a ban.
"""
import re

#: Longest data: URI allowed inside a stored config. Comfortably fits a decorative
#: inline SVG; nowhere near a photograph, which starts in the hundreds of KB.
MAX_DATA_URI_CHARS = 8 * 1024

_DATA_URI = re.compile(r'^data:', re.IGNORECASE)

MESSAGE = (
    'Images must be uploaded rather than embedded in the page configuration. '
    'Upload the image first and store the URL it returns.'
)


def _walk(value, path, on_oversized):
    if isinstance(value, str):
        if _DATA_URI.match(value) and len(value) > MAX_DATA_URI_CHARS:
            on_oversized(path, value)
    elif isinstance(value, dict):
        for key, item in value.items():
            _walk(item, f'{path}.{key}', on_oversized)
    elif isinstance(value, (list, tuple)):
        for index, item in enumerate(value):
            _walk(item, f'{path}[{index}]', on_oversized)


def collect_oversized_data_uris(config):
    """Every oversized data: URI already present in a stored config."""
    seen = set()
    _walk(config or {}, 'page_config', lambda _path, value: seen.add(value))
    return seen


def find_oversized_data_uris(value, existing=None, path='page_config'):
    """
    Paths of any data: URI over the size limit that is *not already stored*.

    Only newly embedded images are rejected. One legacy event still carries 3MB
    of base64, and its editor sends the whole config back on every save - so
    refusing anything merely present would lock that host out of their own event
    rather than stopping the practice.

    Returns "where (how big)" strings, so the caller can name the offending part
    of the config instead of refusing the whole save without explanation.
    """
    allowed = existing if existing is not None else set()
    found = []
    _walk(
        value,
        path,
        lambda p, v: None if v in allowed else found.append(f'{p} ({len(v) // 1024}KB)'),
    )
    return found
