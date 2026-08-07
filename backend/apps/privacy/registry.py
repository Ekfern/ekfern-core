"""
The PII registry — the single, declarative inventory of where personal data
lives, how to find it for a person or a host, how long to keep it, and how to
scrub it. Everything else in this app (export, erasure, retention) reads from
this. Models are registered centrally in ``pii.py`` so the model files stay
untouched and the whole inventory is readable in one place.
"""
from dataclasses import dataclass, field
from enum import Enum


class Category(str, Enum):
    IDENTITY = "identity"        # name
    CONTACT = "contact"          # phone, email
    BEHAVIORAL = "behavioral"    # RSVP answers, opens
    FINANCIAL = "financial"      # pledge / payment amounts
    CONTENT = "content"          # free text a person wrote


class Retention(str, Enum):
    CONTACT = "contact"          # purge soon after the event's useful life
    CONTENT = "content"
    FINANCIAL = "financial"      # keep for tax/accounting — pseudonymize, never hard-delete
    OPERATIONAL = "operational"  # account-level, tied to the account's life


class Scrub(str, Enum):
    NULL = "null"                # blank it
    TOMBSTONE = "tombstone"      # replace with a neutral placeholder
    HASH = "hash"               # replace with a peppered, non-reversible pseudonym
    KEEP = "keep"                # leave as-is (non-identifying)


@dataclass(frozen=True)
class PIIField:
    name: str
    category: Category
    scrub: Scrub = Scrub.NULL


@dataclass
class Spec:
    # ``subject_key`` identifies the person a row is about (e.g. "phone").
    # ``owner_path`` is the ORM path to the host who controls the data
    # (e.g. "event__host"), enabling "delete/export everything for host X".
    subject_key: str | None = None
    owner_path: str | None = None
    retention: Retention = Retention.OPERATIONAL
    fields: list[PIIField] = field(default_factory=list)


# model class -> Spec
REGISTRY: dict[type, Spec] = {}


def register(model: type, spec: Spec) -> None:
    REGISTRY[model] = spec
