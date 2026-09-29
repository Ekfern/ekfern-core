"""
Capability names for event access.

Capabilities gate *writes* on an event. Read access is implicit for anyone who
has access to the event at all, so there is deliberately no ``view_*`` capability:
a collaborator who cannot see the event cannot do anything useful on it.

``OWNER_ONLY`` actions are never capabilities. They are not grantable, not
stored, and not configurable — the resolver answers them from the role alone, so
no amount of bad capability data can hand them to a co-host.
"""

# --- Grantable capabilities -------------------------------------------------

SEND_MESSAGES = 'send_messages'      # campaigns, templates, sending
MANAGE_GUESTS = 'manage_guests'      # add, remove, CSV import, segments
EDIT_INVITATION = 'edit_invitation'  # details, design, layout, page editor, sub-events
EDIT_RSVP = 'edit_rsvp'              # RSVP configuration and slot booking
EDIT_CATALOG = 'edit_catalog'        # host catalog and responses

ALL_CAPABILITIES = frozenset({
    SEND_MESSAGES,
    MANAGE_GUESTS,
    EDIT_INVITATION,
    EDIT_RSVP,
    EDIT_CATALOG,
})

#: Granted to a new co-host when nobody has configured anything. Stored per row
#: rather than assumed at read time, so adding a toggle UI later changes only
#: what is written here — never how it is enforced.
DEFAULT_COHOST_CAPABILITIES = sorted(ALL_CAPABILITIES)


#: How many people may hold access to one event at a time. Counted over active
#: invites (pending + accepted), so a declined or cancelled invite frees a slot -
#: the limit is on how many can hold access, not how many times you may ask.
MAX_COHOSTS_PER_EVENT = 5


# --- Owner-only actions (never grantable) -----------------------------------

DELETE_EVENT = 'delete_event'
MANAGE_COHOSTS = 'manage_cohosts'
TRANSFER_OWNERSHIP = 'transfer_ownership'
MANAGE_BILLING = 'manage_billing'

OWNER_ONLY = frozenset({
    DELETE_EVENT,
    MANAGE_COHOSTS,
    TRANSFER_OWNERSHIP,
    MANAGE_BILLING,
})


def normalize_capabilities(values):
    """Keep only known capability names, de-duplicated and ordered."""
    if not isinstance(values, (list, tuple, set, frozenset)):
        return []
    return sorted({v for v in values if v in ALL_CAPABILITIES})


# --- Notifications (who is emailed, not what they may do) --------------------
#
# Kept apart from capabilities on purpose: a capability is enforced on every
# write by the access resolver, a notification only adds someone to a mailing.
# The owner is always a recipient; these name what an accepted co-host is sent.
# How often (immediately / daily digest / never) stays each person's own
# NotificationPreference, so a co-host can still turn email off.

NOTIFY_RSVP_NEW = 'rsvp_new'                    # a guest submits or updates an RSVP
NOTIFY_CATALOG_RESPONSE = 'catalog_response'    # a pledge, gift or interest on the catalog

ALL_NOTIFICATIONS = frozenset({
    NOTIFY_RSVP_NEW,
    NOTIFY_CATALOG_RESPONSE,
})

#: On by default for now: a co-host is there to help run the event.
DEFAULT_COHOST_NOTIFICATIONS = sorted(ALL_NOTIFICATIONS)


def normalize_notifications(values):
    """Keep only known notification names, de-duplicated and ordered."""
    if not isinstance(values, (list, tuple, set, frozenset)):
        return []
    return sorted({v for v in values if v in ALL_NOTIFICATIONS})
