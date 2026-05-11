"""
Schedule the recurring cleanup_layout_drafts task.

Usage:
    python manage.py schedule_layout_cleanup           # 30-day window, daily
    python manage.py schedule_layout_cleanup --clear   # cancel existing schedule first
    python manage.py schedule_layout_cleanup --days 14 --interval-hours 12

The task self-reschedules after each run, so this command only needs to be
invoked once per environment (typically on container startup via
``apps.events.apps.EventsConfig.ready``).
"""
from django.conf import settings
from django.core.management.base import BaseCommand

from apps.events.tasks import cleanup_layout_drafts_task


class Command(BaseCommand):
    help = (
        "Schedule recurring cleanup of stale auto-generated InvitePageLayout drafts "
        "using django-background-tasks."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Cancel any existing scheduled cleanup tasks first.",
        )
        parser.add_argument(
            "--days",
            type=int,
            default=30,
            help="Drafts not updated in this many days will be deleted (default: 30).",
        )
        parser.add_argument(
            "--interval-hours",
            type=int,
            default=24,
            help="Hours between runs (default: 24).",
        )
        parser.add_argument(
            "--initial-delay-seconds",
            type=int,
            default=getattr(settings, "ANALYTICS_BATCH_INITIAL_DELAY_SECONDS", 30),
            help="Seconds to wait before the first run.",
        )

    def handle(self, *args, **options):
        try:
            from background_task.models import Task
        except ImportError:
            self.stdout.write(
                self.style.ERROR(
                    "background_task is not installed or not in INSTALLED_APPS."
                )
            )
            return

        days = max(1, int(options["days"]))
        interval_hours = max(1, int(options["interval_hours"]))
        initial_delay = max(1, int(options["initial_delay_seconds"]))
        repeat_seconds = interval_hours * 3600

        if options["clear"]:
            removed, _ = Task.objects.filter(
                task_name__contains="cleanup_layout_drafts_task"
            ).delete()
            self.stdout.write(
                self.style.SUCCESS(f"Cleared {removed} existing cleanup task(s).")
            )

        existing = Task.objects.filter(
            task_name__contains="cleanup_layout_drafts_task"
        ).count()
        if existing > 0 and not options["clear"]:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Layout draft cleanup already scheduled ({existing} task(s)). "
                    "Use --clear to reset."
                )
            )
            return

        cleanup_layout_drafts_task(
            days=days,
            repeat_seconds=repeat_seconds,
            schedule=initial_delay,
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"Scheduled cleanup of drafts older than {days} days, "
                f"every {interval_hours}h (first run in {initial_delay}s). "
                "Make sure the background_task worker is running: "
                "python manage.py process_tasks"
            )
        )
