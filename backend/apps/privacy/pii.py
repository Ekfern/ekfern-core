"""
The data inventory: every model holding personal data, declared in one place.
Loaded once from ``PrivacyConfig.ready()``. To bring a new model into the
privacy machinery (export / erasure / retention), add it here — nothing else
needs to change.

The field names, ``subject_key`` and ``owner_path`` strings registered here are
validated against the real model fields by the ``privacy.E001`` system check
(see ``checks.py``), so a field rename surfaces as a ``manage.py check`` failure
instead of a runtime error at erase-time.
"""
from .registry import register, Spec, PIIField as F, Category as C, Retention as R, Scrub as S


def load_registry() -> None:
    from apps.users.models import User
    from apps.events.models import (
        Guest,
        RSVP,
        SlotBooking,
        CampaignRecipient,
        AttributionClick,
        InvitePageView,
        RSVPPageView,
    )
    from apps.catalog.models import CatalogResponse
    from apps.notifications.models import (
        NotificationLog,
        NotificationQueue,
        StaffNotificationRecipient,
    )

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

    # A guest's booking against a time slot. The contact fields are *snapshots*
    # taken at booking time (the guest FK may be nulled on guest deletion), so
    # the subject is identified by the row's own ``phone_snapshot`` column.
    # The controlling host is reached via the always-present ``event`` FK.
    register(SlotBooking, Spec(
        subject_key="phone_snapshot",
        owner_path="event__host",
        retention=R.CONTACT,
        fields=[
            F("name_snapshot", C.IDENTITY, S.TOMBSTONE),
            F("phone_snapshot", C.CONTACT, S.HASH),
            F("email_snapshot", C.CONTACT, S.HASH),
        ],
    ))

    # One delivery row per guest per messaging campaign. Contact fields are
    # snapshots stored directly on the row, so the subject is ``phone``. The
    # host is reached through the campaign: recipient -> campaign -> event -> host.
    register(CampaignRecipient, Spec(
        subject_key="phone",
        owner_path="campaign__event__host",
        retention=R.CONTACT,
        fields=[
            F("phone", C.CONTACT, S.HASH),
            F("email", C.CONTACT, S.HASH),
            F("resolved_message", C.CONTENT, S.NULL),
        ],
    ))

    # Immutable click event for an attribution link. It stores no contact
    # column of its own — the only linkage to a person is the (nullable) guest
    # FK, so the subject is reached via the spanning path ``guest__phone``.
    # The host is reached via the always-present ``event`` FK.
    register(AttributionClick, Spec(
        subject_key="guest__phone",
        owner_path="event__host",
        retention=R.BEHAVIORAL,
        fields=[
            F("ip_hash", C.BEHAVIORAL, S.NULL),
            F("user_agent", C.BEHAVIORAL, S.NULL),
            F("referer", C.BEHAVIORAL, S.NULL),
        ],
    ))

    # Page-view tracking rows. They carry no contact/free-text column of their
    # own (only channel/campaign/placement labels + a timestamp); the personal
    # data is the fact that *this guest* opened the page. Registered for
    # discoverability (export / owner-erasure sweep): subject via the spanning
    # ``guest__phone`` path, host via the ``event`` FK. No in-row fields to scrub.
    register(InvitePageView, Spec(
        subject_key="guest__phone",
        owner_path="event__host",
        retention=R.BEHAVIORAL,
        fields=[],
    ))

    register(RSVPPageView, Spec(
        subject_key="guest__phone",
        owner_path="event__host",
        retention=R.BEHAVIORAL,
        fields=[],
    ))

    # Outbound message log. ``to`` holds the recipient's raw email or phone and
    # is the subject identifier. There is no FK to a controlling host, so
    # owner_path is None — erasure/export reaches these rows by subject only.
    register(NotificationLog, Spec(
        subject_key="to",
        owner_path=None,
        retention=R.OPERATIONAL,
        fields=[
            F("to", C.CONTACT, S.HASH),
            F("payload_json", C.CONTENT, S.NULL),
        ],
    ))

    # Pending digest notifications for a host. The payload JSON is a rendered
    # message body that can embed personal data. It cannot be queried by an
    # individual subject, so subject_key is None; the host owns it via ``user``.
    register(NotificationQueue, Spec(
        subject_key=None,
        owner_path="user",
        retention=R.OPERATIONAL,
        fields=[
            F("payload_json", C.CONTENT, S.NULL),
        ],
    ))

    # Internal staff recipients of business alerts. Each row is a person's own
    # email/name; the subject is identified by ``email``. It is an admin-managed
    # internal list with no controlling host, so owner_path is None.
    register(StaffNotificationRecipient, Spec(
        subject_key="email",
        owner_path=None,
        retention=R.OPERATIONAL,
        fields=[
            F("email", C.CONTACT, S.HASH),
            F("name", C.IDENTITY, S.TOMBSTONE),
        ],
    ))
