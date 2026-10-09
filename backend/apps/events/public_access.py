"""
The one gate every guest-facing endpoint passes through.

A guest endpoint is any view anyone can call without signing in that reads or
writes one event's data. Each one says what it needs:

    READ     the link must still be active (not archived)
    RSVP     ... and RSVP must be open (not ended, not cancelled)
    CATALOG  ... and gifts must be open (not closed, not cancelled)

and calls require_public_access(event, NEED) as soon as it has the event. The
view itself is marked with @guest_endpoint(NEED), or @not_guest_endpoint(why)
for the rare public view that has no event to guard (a webhook, a sign-in
step). test_public_access walks every URL and fails on an AllowAny view that
carries neither mark, so a new endpoint cannot quietly skip the lifecycle.
"""
from rest_framework import status
from rest_framework.exceptions import APIException

from . import lifecycle

READ = 'read'
RSVP = 'rsvp'
CATALOG = 'catalog'

MARK = 'guest_endpoint_need'
EXEMPT_MARK = 'not_guest_endpoint_reason'


class LifecycleClosed(APIException):
    """What a guest sees when the event no longer allows what they tried."""
    status_code = status.HTTP_409_CONFLICT

    def __init__(self, code, message, event, http_status=None):
        if http_status:
            self.status_code = http_status
        super().__init__({
            'code': code,
            'error': message,
            'lifecycle': lifecycle.lifecycle_payload(event),
        })


def require_public_access(event, need=READ, now=None):
    if not lifecycle.link_active(event, now):
        raise LifecycleClosed('EVENT_ARCHIVED', 'This invitation is no longer available.', event,
                              http_status=status.HTTP_410_GONE)
    if need == READ:
        return
    if lifecycle.is_cancelled(event):
        raise LifecycleClosed('EVENT_CANCELLED', 'This event has been cancelled.', event)
    if need == RSVP and not lifecycle.rsvp_open(event, now):
        raise LifecycleClosed('RSVP_CLOSED', 'RSVPs are closed for this event.', event)
    if need == CATALOG and not lifecycle.catalog_open(event, now):
        raise LifecycleClosed('CATALOG_CLOSED', 'Gifting has closed for this event.', event)


def exception_handler(exc, context):
    """DRF's handler, plus no-store on lifecycle refusals so no cache keeps a stale "closed"."""
    from rest_framework.views import exception_handler as drf_exception_handler

    response = drf_exception_handler(exc, context)
    if response is not None and isinstance(exc, LifecycleClosed):
        response['Cache-Control'] = 'no-store, no-cache, must-revalidate, private'
    return response


def _mark(view, attribute, value):
    # A function view from @api_view, or an APIView / ViewSet class.
    setattr(view, attribute, value)
    cls = getattr(view, 'cls', None) or getattr(view, 'view_class', None)
    if cls is not None:
        setattr(cls, attribute, value)
    return view


def guest_endpoint(need):
    """Mark a public view as guarded. Put it above @api_view."""
    return lambda view: _mark(view, MARK, need)


def not_guest_endpoint(reason):
    """Mark a public view that serves no one event's guests, and say why."""
    return lambda view: _mark(view, EXEMPT_MARK, reason)
