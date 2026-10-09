"""
Move events along their lifecycle and tell hosts before anything closes.

The lifecycle itself is computed (apps/events/lifecycle.py); nothing here
decides what is open. This job records what happened and when, so support can
answer "why did my link stop working, and were we told?", and sends the
host the notices the rule depends on:

    ended           "Your event has ended - here is what happens next" (once)
    warned_catalog  "Gifts close on <date>", warn_days before (unless closed early)
    warned_link     "Your link stops working on <date>", warn_days before.
                    Stamps Event.host_warned_link_off_at, which the link needs
                    before it can go off at all. Only sent while enforcement is on.
    catalog_closed  recorded when gifts close
    archived        recorded when the link goes off; purges CloudFront

Each entry is unique per (event, kind, moment), so re-running sends nothing
twice, and a moved date earns a fresh notice. A warning is recorded only after
its email is sent, so a mail outage leaves it due for the next run.

Usage:
    python manage.py run_lifecycle_transitions
    python manage.py run_lifecycle_transitions --dry-run

Schedule every 15 minutes (infrastructure/setup-lifecycle-scheduler.sh).
"""
import logging
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.common.email_backend import send_email
from apps.common.emails import event_ended_next_steps, event_gifts_closing, event_link_closing, format_long_date
from apps.events import lifecycle
from apps.events.models import Event, EventLifecycleTransition, InvitePage

logger = logging.getLogger(__name__)

#: How long after an event ends its "what happens next" note is still worth sending.
ENDED_NOTE_WINDOW = timedelta(days=2)


def overview_url(event) -> str:
    return f"{settings.FRONTEND_ORIGIN.rstrip('/')}/host/events/{event.id}"


def last_open_day(event, moment) -> str:
    """'Saturday, December 7, 2026' for a close at the start of 8 December, in the event's zone."""
    if not moment:
        return ''
    local = timezone.localtime(moment - timedelta(seconds=1), lifecycle.event_tz(event))
    return format_long_date(local.date())


class Command(BaseCommand):
    help = 'Record lifecycle transitions and send hosts their notices'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Show what would happen; send and record nothing')

    def handle(self, *args, **options):
        self.dry_run = options['dry_run']
        self.counts = {'recorded': 0, 'sent': 0, 'failed': 0}
        now = timezone.now()
        config = lifecycle._config()
        warn = timedelta(days=int(config['warn_days_before']))

        # Every event that has ended (or ends within the notice period, for
        # warnings), and has not gone dark yet.
        candidates = (
            Event.objects.filter(ends_at__isnull=False, ends_at__lte=now + warn)
            .exclude(lifecycle_transitions__kind='archived')
            .select_related('host')
            .order_by('ends_at')
        )
        for event in candidates.iterator():
            try:
                self.process(event, now, config, warn)
            except Exception:
                self.counts['failed'] += 1
                logger.exception('[Lifecycle] failed for event=%s', event.id)

        prefix = '[dry run] ' if self.dry_run else ''
        self.stdout.write(self.style.SUCCESS(
            f"{prefix}lifecycle: {self.counts['recorded']} recorded, "
            f"{self.counts['sent']} emails sent, {self.counts['failed']} failed"
        ))

    # --- one event -------------------------------------------------------

    def process(self, event, now, config, warn):
        ends = lifecycle.compute_ends_at(event)
        closes = lifecycle.catalog_closes_at(event)
        scheduled_off = lifecycle.scheduled_link_off_at(event)
        cancelled = lifecycle.is_cancelled(event)
        has_catalog = bool(getattr(event, 'has_registry', False))

        if ends and now >= ends:
            # Only fresh endings get the note: the job's first run must not mail
            # every host whose event ended months ago.
            if self.record(event, 'ended', ends) and not cancelled and now - ends < ENDED_NOTE_WINDOW:
                self.notify(event, 'ended_summary', ends, event_ended_next_steps(
                    event_title=event.invitation_title,
                    gifts_until=last_open_day(event, closes) if has_catalog and not event.catalog_closed_at else '',
                    link_until=last_open_day(event, scheduled_off) if config['enforce_link_off'] else '',
                    overview_url=overview_url(event),
                ))

        if closes:
            if now >= closes:
                self.record(event, 'catalog_closed', closes)
            elif (has_catalog and not cancelled and not event.catalog_closed_at
                    and now >= closes - warn and ends and now >= ends):
                self.notify(event, 'warned_catalog', closes, event_gifts_closing(
                    event_title=event.invitation_title,
                    gifts_until=last_open_day(event, closes),
                    overview_url=overview_url(event),
                ))

        if config['enforce_link_off'] and scheduled_off:
            if now >= scheduled_off - warn:
                warned = self.notify(event, 'warned_link', scheduled_off, event_link_closing(
                    event_title=event.invitation_title,
                    # A late warning still buys the full notice: say the real date.
                    link_until=last_open_day(event, max(scheduled_off, now + warn)),
                    overview_url=overview_url(event),
                ))
                if warned and not self.dry_run and not event.host_warned_link_off_at:
                    event.host_warned_link_off_at = now
                    Event.objects.filter(pk=event.pk).update(host_warned_link_off_at=now)
            if not lifecycle.link_active(event, now):
                if self.record(event, 'archived', lifecycle.link_off_at(event)) and not self.dry_run:
                    self.purge_cdn(event)

    # --- helpers -----------------------------------------------------------

    def _exists(self, event, kind, moment):
        return EventLifecycleTransition.objects.filter(event=event, kind=kind, for_moment=moment).exists()

    def record(self, event, kind, moment) -> bool:
        """Record a transition once. True only the first time."""
        if self._exists(event, kind, moment):
            return False
        if self.dry_run:
            self.stdout.write(f'  would record {kind} for event {event.id} ({moment:%Y-%m-%d %H:%M})')
            return True
        try:
            with transaction.atomic():
                EventLifecycleTransition.objects.create(event=event, kind=kind, for_moment=moment)
        except IntegrityError:
            return False  # another run got there first
        self.counts['recorded'] += 1
        logger.info('[Lifecycle] event=%s %s at %s', event.id, kind, moment)
        return True

    def notify(self, event, kind, moment, email) -> bool:
        """Email the host once per (kind, moment); recorded only after a successful send."""
        if self._exists(event, kind, moment):
            return True
        to = (getattr(event.host, 'email', '') or '').strip()
        if not to:
            return False
        if self.dry_run:
            self.stdout.write(f'  would email {to}: {email.subject}')
            return True
        try:
            send_email(to, email.subject, email.text, body_html=email.html)
        except Exception as exc:
            self.counts['failed'] += 1
            logger.error('[Lifecycle] %s email failed for event=%s: %s', kind, event.id, exc, exc_info=True)
            return False
        self.counts['sent'] += 1
        self.record(event, kind, moment)
        return True

    def purge_cdn(self, event):
        from apps.events.views import invalidate_cloudfront_cache_immediate, invalidate_invite_page_cache

        slug = InvitePage.objects.filter(event=event).values_list('slug', flat=True).first()
        if not slug:
            return
        try:
            invalidate_invite_page_cache(slug)
            invalidate_cloudfront_cache_immediate(slug)
        except Exception:
            logger.exception('[Lifecycle] CDN purge failed for event=%s', event.id)
