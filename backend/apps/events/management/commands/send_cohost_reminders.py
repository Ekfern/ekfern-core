"""
Tell owners about co-host invites that are still unanswered.

An invite link is a signed token valid for ``INVITE_MAX_AGE_SECONDS`` (7 days).
Nothing in the database changes when it lapses - the row stays ``pending`` and
the link simply stops resolving - so without this the owner never learns that
an invite went nowhere.

Runs once a day and mails the owner on day 6, leaving a day to act. The send is
stamped on the row, so re-running the command cannot mail the same owner twice.

Usage:
    python manage.py send_cohost_reminders
    python manage.py send_cohost_reminders --dry-run   # preview without sending

Schedule via cron (daily, alongside send_digests):
    0 9 * * * /path/to/venv/bin/python manage.py send_cohost_reminders

Or via ECS scheduled task / Fargate cron with the same command.
"""
import logging
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.common.email_backend import send_email
from apps.common.emails import cohost_invite_reminder, format_long_date
from apps.events.cohost_views import INVITE_MAX_AGE_SECONDS, cohosts_url
from apps.events.models import EventCoHost

logger = logging.getLogger(__name__)

#: How long before expiry the owner is told. One day's notice.
REMIND_AFTER = timedelta(seconds=INVITE_MAX_AGE_SECONDS) - timedelta(days=1)


class Command(BaseCommand):
    help = 'Email owners about co-host invites still awaiting a response'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview reminders without sending or stamping them',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        now = timezone.now()

        # Old enough to be worth chasing, not so old the link has already died:
        # a reminder about an expired invite would only tell the owner to act on
        # something that can no longer be accepted.
        oldest = now - timedelta(seconds=INVITE_MAX_AGE_SECONDS)
        due = (
            EventCoHost.objects.filter(
                status=EventCoHost.STATUS_PENDING,
                reminder_sent_at__isnull=True,
                created_at__lte=now - REMIND_AFTER,
                created_at__gt=oldest,
            )
            .select_related('event', 'event__host')
            .order_by('created_at')
        )

        sent = skipped = failed = 0
        for cohost in due:
            event = cohost.event
            to = (event.host.email or '').strip()
            if not to:
                skipped += 1
                continue

            expires_at = cohost.created_at + timedelta(seconds=INVITE_MAX_AGE_SECONDS)
            email = cohost_invite_reminder(
                cohost_email=cohost.invited_email,
                event_title=event.title,
                expires_label=format_long_date(expires_at) or expires_at.strftime('%d %b %Y'),
                cohosts_url=cohosts_url(event),
            )

            if dry_run:
                self.stdout.write(f'  would remind {to} about {cohost.invited_email} ({event.title})')
                sent += 1
                continue

            try:
                send_email(to, email.subject, email.text, body_html=email.html)
            except Exception as exc:
                failed += 1
                logger.error(
                    '[CoHost] reminder failed for cohost=%s event=%s: %s',
                    cohost.id, event.id, exc, exc_info=True,
                )
                continue

            # Only stamped on a successful send, so a transient mail outage
            # leaves the invite eligible for tomorrow's run.
            cohost.reminder_sent_at = timezone.now()
            cohost.save(update_fields=['reminder_sent_at', 'updated_at'])
            sent += 1

        prefix = '[dry run] ' if dry_run else ''
        self.stdout.write(
            self.style.SUCCESS(
                f'{prefix}co-host reminders: {sent} sent, {skipped} skipped, {failed} failed'
            )
        )
