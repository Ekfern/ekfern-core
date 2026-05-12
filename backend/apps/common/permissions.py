"""
Custom DRF permission classes for the project.

`IsSuperUser` is intentionally stricter than DRF's built-in `IsAdminUser`
(which only checks `is_staff`). Other admin tooling that performs
irreversible operations on shared resources may use ``IsSuperUser``.

LLM paid endpoints use ``HasLLMModuleAccess`` (superusers or users with
``User.llm_module_access``) alongside ``enforce_safety_stack`` in views.
"""
from rest_framework.permissions import BasePermission


def user_has_llm_module_access(user) -> bool:
    """True when the account may call LLM-backed generator APIs."""
    if not user or not getattr(user, 'is_authenticated', False):
        return False
    return bool(
        getattr(user, 'is_superuser', False)
        or getattr(user, 'llm_module_access', False)
    )


class HasLLMModuleAccess(BasePermission):
    """
    Allows users with explicit ``llm_module_access`` or Django superusers.
    Pair with ``cost_safety.enforce_safety_stack`` on mutating LLM routes.
    """

    message = 'LLM module access is not enabled for this account.'

    def has_permission(self, request, view):
        return user_has_llm_module_access(getattr(request, 'user', None))

    def has_object_permission(self, request, view, obj):
        return self.has_permission(request, view)


class IsSuperUser(BasePermission):
    """
    Allows access only to authenticated users with `is_superuser=True`.

    Use this for endpoints that must not be exposed to staff or LLM-flagged
    users — e.g. irreversible administrative actions on shared resources.

    Staff users (`is_staff=True` but not `is_superuser=True`) are denied.
    """

    message = "Superuser access required."

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        return bool(user and user.is_authenticated and user.is_superuser)

    def has_object_permission(self, request, view, obj):
        return self.has_permission(request, view)
