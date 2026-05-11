"""
Custom DRF permission classes for the project.

`IsSuperUser` is intentionally stricter than DRF's built-in `IsAdminUser`
(which only checks `is_staff`). LLM-spending endpoints, cost-dashboard
endpoints, and any admin tool that can incur direct external cost MUST use
`IsSuperUser` so that staff users (e.g. content editors) cannot trigger
spend even if their account is compromised.
"""
from rest_framework.permissions import BasePermission


class IsSuperUser(BasePermission):
    """
    Allows access only to authenticated users with `is_superuser=True`.

    Use this for any endpoint that:
      - Triggers an external paid API call (e.g. LLM generation).
      - Mutates or reads global cost / billing dashboards.
      - Performs irreversible administrative actions on shared resources.

    Staff users (`is_staff=True` but not `is_superuser=True`) are denied.
    """

    message = "Superuser access required."

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        return bool(user and user.is_authenticated and user.is_superuser)

    def has_object_permission(self, request, view, obj):
        return self.has_permission(request, view)
