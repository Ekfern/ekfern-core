# Event co-hosts

Per-event collaboration. One event has one **owner** (`Event.host`, the billing
entity for that event) and any number of **co-hosts** invited by that owner.
The same person can own their own event and be a co-host on someone else's.

Branch each PR from `main`; PRs target `staging`.

## Why extend rather than replace

`Event.host` stays exactly as it is, and a new `EventCoHost` table sits beside it.
The two sets are **disjoint** — the owner never appears in the co-host table — so
no ownership fact is stored twice and there is nothing to drift.

Replacing `Event.host` with a membership table was considered and rejected:

- `Event.host` is `NOT NULL`, so "every event has exactly one owner" is guaranteed
  by the database for free. Replacing it means rebuilding that guarantee with a
  partial unique index, with a migration window where it can be violated.
- Roughly six sites use the host as a *person* rather than as a permission —
  `host_name` in serializers, the email `from_name`, the `[host_name]` message
  placeholder, the catalog notification recipient. Under "extend" they never change.
  Under "replace" every one becomes a join, and a mistake there silently breaks
  invite emails.
- It keeps the risky authorization refactor separate from a schema migration.

The cost is that the resolver special-cases the owner — a few lines, in one
function. Because every call site now goes through that function, migrating to a
full membership table later is a contained change if the need arises.

## Authorization

One resolver answers "may this user do X to this event": `apps/events/access.py`.

Two entry points, because the codebase already had two failure modes and a
permissions refactor must not change either:

| Entry point | Raises | Used by |
| --- | --- | --- |
| `require_event_access(user, event, capability=None)` | `PermissionDenied` (403) | `EventViewSet` actions |
| `get_event_or_404(user, event_id, capability=None)` | `Http404` | standalone function views |

A 404 that becomes a 403 tells an unauthorized caller that the event exists, so
the standalone views keep answering 404 for both "no such event" and "not yours".

`Event.objects.for_user(user)` is the single definition of "events I can work
on". Child querysets scope through it (`event__in=Event.objects.for_user(user)`)
rather than joining on `event__host`.

## Capabilities

Capabilities gate **writes**. Read access is implicit for anyone with access to
the event — there is deliberately no `view_*` capability, because a co-host who
cannot see the event cannot do anything useful on it.

| Capability | Covers |
| --- | --- |
| `send_messages` | `/communications` — campaigns, templates, sending |
| `manage_guests` | `/guests` — add, remove, CSV import, segments |
| `edit_invitation` | `/details`, `/design`, `/layout`, `/page-editor`, `/sub-events` |
| `edit_rsvp` | `/rsvp`, `/slot-booking` |
| `edit_catalog` | `/catalog` |

All five are granted by default. A per-co-host toggle UI comes later; because the
grant is stored on the row from day one, adding that UI is a frontend change with
no migration and no data to reinterpret.

`edit_invitation` is deliberately broad for now and includes the structural
switches on `/details` (`is_public`, `has_rsvp`, `has_registry`). A co-host with
it can make a private event public. Narrowing that is a field-level check in one
serializer whenever it is wanted.

### Never grantable

Answered from the role alone, never stored, so no capability data can grant them:
delete the event, manage co-hosts, transfer ownership, anything billing.

## Membership (planned)

```
EventCoHost
  event           FK Event, CASCADE
  user            FK User, null until acceptance
  invited_email   canonical: strip().lower(), validated
  status          pending | accepted | declined | revoked | left
  capabilities    JSON list
  accepted_at
  created_at, updated_at

  unique(event, user)          where user is not null
  unique(event, invited_email) where status in (pending, accepted)
  index(user, status), index(event, status)
```

`status` is the gate — a row with a linked `user` still grants nothing until it
is `accepted`. `revoked` (owner removed them) and `left` (they removed
themselves) are distinguished so the owner's list can tell the difference.

`user != event.host` cannot be a Django `CheckConstraint`, because constraints
cannot reference another table. It is enforced in application code and covered by
a test.

## Invite and acceptance

Invites are by **email only** — the `User` model has `USERNAME_FIELD = 'email'`
and no username field to resolve against.

1. Owner invites from the event details section. Row created `pending`, `user`
   linked immediately if an account already exists, otherwise null.
2. The email carries `TimestampSigner.sign(row.id)` — no token column, expiry for
   free, matching the existing `membership.issue_pass` pattern.
3. No account → signup with the email prefilled **and locked**, which prevents a
   mismatch at the source.
4. Acceptance is always explicit and manual, with the policy checkbox. It requires
   `request.user.email.strip().lower() == row.invited_email`, so a forwarded
   invite link is not a bearer credential.
5. The owner can revoke at any status; a co-host can leave. Both take effect on
   the next request, because the resolver checks on every call.

## Surfaces

- Dashboard splits into **Hosted** and **Shared**. `Shared` holds accepted
  co-host events only; a pending invite is a notification, never an event card.
- `my_role` is derived from `host_id` already on the row — no extra query.
- Owner-only actions are hidden for co-hosts; capability-gated ones are shown
  disabled, so the permission model is legible and there is something to ask for.

## Phases

1. **Resolver** — `access.py`, `capabilities.py`, `Event.objects.for_user`,
   rewrite every ownership check. No behaviour change, everyone resolves to owner.
2. **Membership** — `EventCoHost` model, invite/accept/revoke/leave endpoints,
   resolver learns about co-hosts.
3. **Surfaces** — Hosted/Shared dashboard, invite form, co-host list.
4. **Guards** — soft-delete or owner-gated delete, forced transfer before a host
   can delete their account (`Event.host` is `CASCADE` today), version-checked
   saves on the design config so two co-hosts cannot silently overwrite each other.

## Default ModelViewSet actions

`EventViewSet` is a `ModelViewSet`, so `retrieve`, `update`, `partial_update` and
`destroy` have no ownership check of their own — they are reached only through
`get_object()`. Capability mapping for them lives in `ACTION_CAPABILITIES`, and
`destroy` is gated on the **role**, not a capability, because deleting an event
takes the guest list, RSVPs and invite page with it (`Event` has no soft delete
and `Guest.event` cascades).

This was found by end-to-end testing, not by the unit tests: an accepted co-host
deleted a real event, because the access check passed and no capability was
required on that path. "Delete is owner-only" was true in the resolver and false
in practice. Any new action reached through `get_object()` needs an entry here.

## Known gaps

- **Quota is per user, not per event.** `HostSendQuota` is `unique(host, channel)`,
  so co-hosts would each bring their own monthly allowance to the same guest list.
  Re-keying it to the event closes that, and matches the per-event pricing model.
- **Concurrent editing.** The design page autosaves the whole config every two
  seconds, last write wins. Two co-hosts editing at once overwrite each other with
  no conflict and no warning.
- **`/analytics/enable-insights`** is a write that does not map to any of the five
  capabilities. It currently requires access but no specific capability.
