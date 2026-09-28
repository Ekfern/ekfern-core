"""
One place that answers "may this user do X to this event".

Before this module the question was asked two different ways: an explicit
``_verify_event_ownership`` check inside ``EventViewSet`` (403 on failure), and
``host=request.user`` fused into the queryset of standalone views (404 on
failure). Both fail closed, but neither has anywhere to express a collaborator.

Both status codes are preserved deliberately — see ``require_event_access``
(403) and ``get_event_or_404`` (404). Changing them here would turn a
permissions refactor into a visible API change, and a 404 that becomes a 403
tells an unauthorized caller that the event exists.

Co-host resolution slots into ``resolve_event_access`` alone. Every call site in
the codebase goes through this module, so that is the only function that needs
to learn about collaborators.
"""
from typing import NamedTuple, Optional

from django.http import Http404
from rest_framework.exceptions import PermissionDenied

from .capabilities import ALL_CAPABILITIES, OWNER_ONLY, normalize_capabilities

ROLE_OWNER = 'owner'
ROLE_COHOST = 'cohost'

#: The owner can do everything, including the actions no co-host may ever hold.
OWNER_CAPABILITIES = ALL_CAPABILITIES | OWNER_ONLY


class EventAccess(NamedTuple):
    """What a given user may do on a given event."""
    role: Optional[str]
    capabilities: frozenset

    @property
    def has_access(self) -> bool:
        return self.role is not None

    @property
    def is_owner(self) -> bool:
        return self.role == ROLE_OWNER

    def can(self, capability: str) -> bool:
        return capability in self.capabilities


NO_ACCESS = EventAccess(role=None, capabilities=frozenset())


def resolve_event_access(user, event) -> EventAccess:
    """
    Resolve a user's access to one event. Never raises; returns ``NO_ACCESS``.

    The owner is ``Event.host``. Co-hosts will be resolved here from the
    membership table; the two sets are disjoint, so the owner branch always
    wins and no row can shadow it.
    """
    if event is None or user is None or not getattr(user, 'is_authenticated', False):
        return NO_ACCESS

    if event.host_id == user.id:
        return EventAccess(role=ROLE_OWNER, capabilities=OWNER_CAPABILITIES)

    from .models import EventCoHost

    row = EventCoHost.objects.filter(
        event=event, user=user, status=EventCoHost.STATUS_ACCEPTED
    ).first()
    if row is None:
        return NO_ACCESS

    # Only names the code still recognises are honoured, so a capability that is
    # renamed or retired cannot keep granting access from old rows.
    return EventAccess(
        role=ROLE_COHOST,
        capabilities=frozenset(normalize_capabilities(row.capabilities)),
    )


def require_event_access(user, event, capability: Optional[str] = None) -> EventAccess:
    """
    Access check for callers that answer with 403 (``EventViewSet`` actions).

    ``capability=None`` means "any access to this event is enough", which is the
    read case. Pass a capability for anything that writes.
    """
    if user is None or not getattr(user, 'is_authenticated', False):
        raise PermissionDenied("Authentication required.")

    access = resolve_event_access(user, event)
    if not access.has_access:
        raise PermissionDenied("You can only access your own events.")
    if capability is not None and not access.can(capability):
        raise PermissionDenied("You do not have permission to do that on this event.")
    return access


def get_event_or_404(user, event_id, capability: Optional[str] = None):
    """
    Access check for callers that answer with 404 (standalone function views).

    Replaces ``get_object_or_404(Event, id=event_id, host=request.user)``: a
    missing event and an event you may not touch are still indistinguishable
    from the outside, exactly as before.
    """
    from .models import Event

    event = Event.objects.filter(id=event_id).first()
    if event is None:
        raise Http404("Event not found.")

    access = resolve_event_access(user, event)
    if not access.has_access:
        raise Http404("Event not found.")
    if capability is not None and not access.can(capability):
        raise Http404("Event not found.")
    return event
