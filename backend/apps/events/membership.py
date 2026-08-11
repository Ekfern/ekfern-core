"""
Guest membership for the guest-facing surfaces (RSVP and catalog).

The product claim for a private event is access control, not authentication:
only a phone number that is on the guest list gets in. We do not assert that
the visitor owns that number. Keeping that distinction explicit matters,
because nothing behind these gates should assume more assurance than this
module provides.

Two credentials establish membership:

* the guest's invite token (``?g=``), permanent and forwardable - the host
  hands it out deliberately;
* an access pass (``?p=``), minted here after a phone match, valid for 15
  minutes of inactivity and scoped to one guest on one event.

Both are transferable, which is inherent to link-based access. The pass is the
narrower of the two, which is why it - not the invite token - is what the
phone-verification flow hands back.

If an OTP step is ever added, it belongs in ``prove_by_phone`` and no caller
needs to change.
"""
import re

from django.core import signing

from .models import Guest

# Salt keeps these signatures from being interchangeable with any other signed
# value in the project.
PASS_SALT = 'events.membership.access_pass'

# Sliding, not absolute: every response that accepts a pass mints a fresh one,
# so an active guest is never interrupted mid-flow while an abandoned session
# stops working quickly. Never surfaced in UI copy.
PASS_MAX_AGE_SECONDS = 15 * 60

GUEST_NOT_FOUND_MESSAGE = (
    "Hmm, we couldn’t find your number on the guest list. Double-check that "
    "you’re using the number shared with the host, or contact them for help."
)


def normalize_phone(event, phone, country_code=''):
    """
    Return (e164, digits_only, effective_country_code) for a submitted number.

    Falls back to the event's own country when the guest did not pick one.
    """
    from .utils import format_phone_with_country_code, get_country_code

    phone = (phone or '').strip()
    event_country_code = get_country_code(event.country)
    effective_country_code = country_code or event_country_code

    if phone and not phone.startswith('+'):
        phone = format_phone_with_country_code(phone, effective_country_code)

    return phone, re.sub(r'\D', '', phone), effective_country_code


def prove_by_phone(event, phone, country_code=''):
    """
    Return the Guest on this event whose listed number matches, or None.

    This is the single place membership is established from a phone number, so
    that RSVP and catalog answer the same question the same way. It is a
    lookup, not a proof of ownership - see the module docstring.
    """
    from .utils import parse_phone_number

    e164, digits_only, effective_country_code = normalize_phone(event, phone, country_code)
    if not digits_only:
        return None

    guest = Guest.objects.filter(event=event, phone=e164, is_removed=False).first()
    if guest:
        return guest

    for candidate in Guest.objects.filter(event=event, is_removed=False):
        candidate_digits = re.sub(r'\D', '', candidate.phone or '')
        if candidate_digits and candidate_digits == digits_only:
            return candidate

        # Same local number stored with a different prefix: only a match when
        # the country codes agree, so +91xxxxxxxxxx never matches +1xxxxxxxxxx.
        if len(digits_only) >= 10 and len(candidate_digits) >= 10:
            if candidate_digits.endswith(digits_only[-10:]):
                stored_country_code, _ = parse_phone_number(candidate.phone)
                if stored_country_code == effective_country_code:
                    return candidate

    return None


def issue_pass(event, guest):
    """Mint a short-lived pass for this guest on this event."""
    if guest is None:
        return None
    signer = signing.TimestampSigner(salt=PASS_SALT)
    return signer.sign(f'{event.id}:{guest.id}')


def verify_pass(event, access_pass):
    """Return the Guest a valid, unexpired, same-event pass refers to, else None."""
    if not access_pass:
        return None

    signer = signing.TimestampSigner(salt=PASS_SALT)
    try:
        # SignatureExpired subclasses BadSignature, so this covers both.
        value = signer.unsign(access_pass, max_age=PASS_MAX_AGE_SECONDS)
    except signing.BadSignature:
        return None

    try:
        event_id, guest_id = (int(part) for part in value.split(':'))
    except (ValueError, TypeError):
        return None

    # A pass minted for another event must never open this one.
    if event_id != event.id:
        return None

    return Guest.objects.filter(id=guest_id, event=event, is_removed=False).first()


def resolve_guest(event, guest_token=None, access_pass=None):
    """Resolve a guest from either credential. Invite token wins when both are present."""
    if guest_token:
        guest = Guest.objects.filter(
            guest_token=guest_token, event=event, is_removed=False
        ).first()
        if guest:
            return guest

    return verify_pass(event, access_pass)
