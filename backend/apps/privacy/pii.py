"""
The data inventory: every model holding personal data, declared in one place.
Loaded once from ``PrivacyConfig.ready()``. To bring a new model into the
privacy machinery (export / erasure / retention), add it here — nothing else
needs to change.
"""
from .registry import register, Spec, PIIField as F, Category as C, Retention as R, Scrub as S


def load_registry() -> None:
    from apps.users.models import User
    from apps.events.models import Guest, RSVP
    from apps.catalog.models import CatalogResponse

    # Host account. The host is both a subject (of their own account) and the
    # controller of their guests' data (see owner_path on the models below).
    register(User, Spec(
        subject_key="email",
        owner_path=None,
        retention=R.OPERATIONAL,
        fields=[
            F("email", C.CONTACT, S.HASH),
            F("name", C.IDENTITY, S.TOMBSTONE),
        ],
    ))

    register(Guest, Spec(
        subject_key="phone",
        owner_path="event__host",
        retention=R.CONTACT,
        fields=[
            F("name", C.IDENTITY, S.TOMBSTONE),
            F("phone", C.CONTACT, S.HASH),
            F("email", C.CONTACT, S.NULL),
            F("relationship", C.CONTENT, S.NULL),
            F("notes", C.CONTENT, S.NULL),
            F("custom_fields", C.CONTENT, S.NULL),
        ],
    ))

    register(RSVP, Spec(
        subject_key="phone",
        owner_path="event__host",
        retention=R.CONTACT,
        fields=[
            F("name", C.IDENTITY, S.TOMBSTONE),
            F("phone", C.CONTACT, S.HASH),
            F("email", C.CONTACT, S.NULL),
            F("notes", C.CONTENT, S.NULL),
            F("custom_fields", C.BEHAVIORAL, S.NULL),
        ],
    ))

    # A pledge/response carries an ``amount`` — financial data. Erasure keeps the
    # row (retention: FINANCIAL) and pseudonymizes the identity, rather than
    # hard-deleting, so tax/accounting records survive a "delete me" request.
    register(CatalogResponse, Spec(
        subject_key="email",
        owner_path="event__host",
        retention=R.FINANCIAL,
        fields=[
            F("name", C.IDENTITY, S.TOMBSTONE),
            F("email", C.CONTACT, S.HASH),
            F("phone", C.CONTACT, S.HASH),
        ],
    ))
