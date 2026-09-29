"""
Who is emailed about something that happened on an event.

The one place that answers it, so the RSVP alert, the catalog alert and
anything added later cannot each decide differently. The owner always
receives; an accepted co-host receives what their row's ``notifications``
names. How often each person hears (immediately, daily digest, never) is still
their own NotificationPreference, applied by the caller per recipient.
"""
from .models import Event, EventCoHost


def notification_recipients(event: Event, kind: str) -> list:
    """Owner first, then subscribed accepted co-hosts. No user appears twice."""
    recipients = [event.host]
    seen = {event.host_id}
    rows = (
        EventCoHost.objects.filter(
            event=event, status=EventCoHost.STATUS_ACCEPTED, user__isnull=False
        )
        .select_related('user', 'user__notification_preferences')
        .order_by('accepted_at', 'id')
    )
    for row in rows:
        if kind in (row.notifications or []) and row.user_id not in seen:
            recipients.append(row.user)
            seen.add(row.user_id)
    return recipients
