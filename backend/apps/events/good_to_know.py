"""
Good to know: the answers to what guests ask the host the week before.

The invitation's Event Details tile carries them for the whole event (in
page_config, shaped by the frontend's lib/invite/goodToKnow.ts). A sub-event
carries its own in SubEvent.good_to_know - the mehendi's dress code is not the
reception's. Same shape in both places: a short list of
{id, kind, text, url?}, at most one answer per kind.

Checked here because a sub-event's list is a model field the API writes
directly. Links are only length-checked: what may become a clickable link is
decided where it is rendered (frontend lib/safeUrl.ts), the one place that
cannot be bypassed.
"""
from rest_framework import serializers

KINDS = ('dress', 'stay', 'parking', 'food', 'contact')
MAX_TEXT = 300
MAX_URL = 500
MAX_ID = 64


def validate_good_to_know(value):
    """Return a clean list of answers, or raise ValidationError."""
    if value in (None, ''):
        return []
    if not isinstance(value, list):
        raise serializers.ValidationError('Expected a list of answers.')
    if len(value) > len(KINDS):
        raise serializers.ValidationError(f'At most {len(KINDS)} answers.')

    cleaned, kinds = [], set()
    for item in value:
        if not isinstance(item, dict):
            raise serializers.ValidationError('Each answer must be an object.')
        kind = item.get('kind')
        if kind not in KINDS:
            raise serializers.ValidationError(f'Unknown kind {kind!r}; expected one of {", ".join(KINDS)}.')
        if kind in kinds:
            raise serializers.ValidationError(f'Only one {kind} answer.')
        kinds.add(kind)

        item_id = item.get('id')
        text = item.get('text', '')
        url = item.get('url')
        if not isinstance(item_id, str) or not item_id or len(item_id) > MAX_ID:
            raise serializers.ValidationError('Each answer needs a short id.')
        if not isinstance(text, str) or len(text) > MAX_TEXT:
            raise serializers.ValidationError(f'Answers are text of at most {MAX_TEXT} characters.')
        if url is not None and (not isinstance(url, str) or len(url) > MAX_URL):
            raise serializers.ValidationError(f'Links are at most {MAX_URL} characters.')

        answer = {'id': item_id, 'kind': kind, 'text': text}
        if url and url.strip():
            answer['url'] = url.strip()
        cleaned.append(answer)
    return cleaned
