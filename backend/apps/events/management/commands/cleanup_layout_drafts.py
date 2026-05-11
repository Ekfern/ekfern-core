"""
Purge stale Page Layout Auto-Generator drafts.

Drafts produced by the auto-generator are persisted with
``status='draft', visibility='internal'``. Reviewers publish or reject most
within minutes, but accumulated drafts from abandoned sessions can pile up
over time and clutter the staff "review" view.

This command deletes drafts that:
  * have ``status='draft'``,
  * have ``visibility='internal'``,
  * were not updated in the last N days (default 30),
  * have not been published (no historical published version exists for the
    same row — guaranteed by the schema since publish flips status in place).

Usage:
    python manage.py cleanup_layout_drafts             # 30-day default
    python manage.py cleanup_layout_drafts --days 14   # narrower window
    python manage.py cleanup_layout_drafts --dry-run   # show what would be deleted

Designed to be safe to run repeatedly (idempotent) and from a daily cron.
"""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.events.models import InvitePageLayout


class Command(BaseCommand):
    help = "Delete auto-generated InvitePageLayout drafts older than N days."

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            default=30,
            help="Drafts not updated in this many days will be deleted (default: 30).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print counts without deleting anything.",
        )

    def handle(self, *args, **options):
        days = max(1, int(options["days"]))
        dry_run = bool(options["dry_run"])

        cutoff = timezone.now() - timedelta(days=days)
        qs = InvitePageLayout.objects.filter(
            status="draft",
            visibility="internal",
            updated_at__lt=cutoff,
        )
        count = qs.count()

        if count == 0:
            self.stdout.write(
                self.style.SUCCESS(
                    f"No internal drafts older than {days} days found. Nothing to do."
                )
            )
            return

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f"[DRY RUN] Would delete {count} internal drafts updated before {cutoff:%Y-%m-%d %H:%M}."
                )
            )
            for layout in qs.values_list("id", "name", "updated_at")[:50]:
                self.stdout.write(f"  - id={layout[0]} updated_at={layout[2]:%Y-%m-%d} name={layout[1]!r}")
            if count > 50:
                self.stdout.write(f"  \u2026 and {count - 50} more.")
            return

        deleted, _by_model = qs.delete()
        self.stdout.write(
            self.style.SUCCESS(
                f"Deleted {deleted} internal draft(s) updated before {cutoff:%Y-%m-%d %H:%M}."
            )
        )
