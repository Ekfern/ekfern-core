"""
Management command to send daily digest emails to hosts who have chosen
'daily_digest' frequency for RSVP or gift notifications.

Usage:
    python manage.py send_digests
    python manage.py send_digests --dry-run   # preview without sending

Schedule via cron (runs daily at 8 AM server time):
    0 8 * * * /path/to/venv/bin/python manage.py send_digests

Or via ECS scheduled task / Fargate cron with the same command.
"""
import logging
from collections import defaultdict

from django.core.management.base import BaseCommand
from django.utils import timezone
from django.conf import settings
from django.db import transaction
from django.db.models import Sum

from apps.notifications.models import NotificationQueue, StaffNotificationRecipient
from apps.common.email_backend import send_email
from apps.common import emails

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Send daily digest emails for batched RSVP and gift notifications'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview digest emails without actually sending or marking as sent',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        logger.info(f'Starting send_digests (dry_run={dry_run})')

        pending = (
            NotificationQueue.objects
            .filter(sent_at__isnull=True)
            .select_related('user', 'user__notification_preferences')
        )
        total = pending.count()

        if not total:
            self.stdout.write('No pending digest notifications.')
            logger.info('send_digests: nothing to send')
            return

        logger.info(f'send_digests: found {total} pending items across all users')

        # Group by user
        by_user = defaultdict(list)
        for item in pending:
            by_user[item.user].append(item)

        sent_count = 0
        failed_count = 0

        for user, items in by_user.items():
            prefs = getattr(user, 'notification_preferences', None)
            unsubscribe_token = prefs.unsubscribe_token if prefs else None

            rsvps = [i for i in items if i.notification_type == 'rsvp_new']
            gifts = [i for i in items if i.notification_type == 'gift_received']

            # Keys match what the RSVP and catalog alerts queue (apps.events.views,
            # apps.catalog.notifications). The gift lines used to read keys nothing
            # wrote - amount_rupees, buyer_name, item_name - so every one came out
            # as "₹? from Someone for a gift".
            rsvp_lines = [
                ' · '.join(filter(None, [
                    r.payload_json.get('rsvp_name') or 'A guest',
                    emails.ATTEND_FOR_HOST.get(r.payload_json.get('will_attend'), r.payload_json.get('will_attend')),
                    r.payload_json.get('event_title'),
                ]))
                for r in rsvps
            ]
            gift_lines = [
                ' · '.join(filter(None, [
                    g.payload_json.get('guest_name') or 'A guest',
                    g.payload_json.get('item_title'),
                    emails.rupees(g.payload_json.get('amount')),
                    g.payload_json.get('event_title'),
                ]))
                for g in gifts
            ]
            if not rsvp_lines and not gift_lines:
                continue

            first_name = (user.name or '').split()[0] if (user.name or '').strip() else ''
            rendered = emails.host_digest(
                first_name=first_name,
                date_label=timezone.localdate().strftime('%B %d').replace(' 0', ' '),
                rsvp_lines=rsvp_lines,
                gift_lines=gift_lines,
                dashboard_url=f"{settings.FRONTEND_ORIGIN}/host/dashboard",
            )
            subject = rendered.subject

            if dry_run:
                self.stdout.write(f'  [DRY RUN] Would send digest to {user.email} '
                                  f'({len(rsvps)} RSVPs, {len(gifts)} gifts)')
                self.stdout.write(f'  Subject: {subject}')
                sent_count += 1
                continue

            now = timezone.now()
            try:
                send_email(
                    to_email=user.email,
                    subject=rendered.subject,
                    body_text=rendered.text,
                    body_html=rendered.html,
                    unsubscribe_token=unsubscribe_token,
                )
                with transaction.atomic():
                    NotificationQueue.objects.filter(
                        id__in=[i.id for i in items]
                    ).update(sent_at=now)
                sent_count += 1
                logger.info(f'Digest sent to {user.email} ({len(rsvps)} RSVPs, {len(gifts)} gifts)')
                self.stdout.write(f'  Sent digest to {user.email} ({len(rsvps)} RSVPs, {len(gifts)} gifts)')
            except Exception as e:
                failed_count += 1
                logger.error(f'Failed to send digest to {user.email}: {e}', exc_info=True)
                self.stderr.write(f'  Failed to send digest to {user.email}: {e}')

        summary = f'Done. Users processed: {sent_count}, Failed: {failed_count}'
        self.stdout.write(self.style.SUCCESS(summary))
        logger.info(f'send_digests complete: {summary}')

        self._send_business_digest(dry_run)

    def _send_business_digest(self, dry_run):
        """Send daily business metrics summary to all active staff recipients."""
        recipients = StaffNotificationRecipient.objects.filter(receive_daily_digest=True, is_active=True)
        if not recipients.exists():
            logger.info('send_digests: no staff recipients configured for business digest')
            return

        # Late imports to avoid circular dependencies
        from django.contrib.auth import get_user_model
        from apps.events.models import Event, RSVP
        from apps.catalog.models import CatalogResponse

        User = get_user_model()
        today = timezone.localdate()

        # Today's metrics
        new_signups = User.objects.filter(date_joined__date=today).count()
        new_events = Event.objects.filter(created_at__date=today).count()
        new_rsvps = RSVP.objects.filter(created_at__date=today, is_removed=False).count()
        pledges_today_qs = CatalogResponse.objects.filter(
            created_at__date=today, response_type='pledge', amount__isnull=False
        )
        gifts_today_count = pledges_today_qs.count()
        gifts_today_inr = (pledges_today_qs.aggregate(total=Sum('amount'))['total'] or 0) / 100

        # All-time metrics
        total_users = User.objects.count()
        total_events = Event.objects.count()
        total_revenue_inr = (
            CatalogResponse.objects.filter(response_type='pledge', amount__isnull=False)
            .aggregate(total=Sum('amount'))['total'] or 0
        ) / 100

        date_str = today.strftime('%B %d').replace(' 0', ' ')
        frontend = getattr(settings, 'FRONTEND_ORIGIN', 'https://ekfern.com')

        gifts_line = (
            f"\u20b9{gifts_today_inr:,.0f} across {gifts_today_count} order{'s' if gifts_today_count != 1 else ''}"
            if gifts_today_count else "None"
        )
        rendered = emails.staff_business_digest(
            date_label=date_str,
            today_rows=[
                ('New signups', new_signups),
                ('New events', new_events),
                ('New RSVPs', new_rsvps),
                ('Gifts', gifts_line),
            ],
            all_time_rows=[
                ('Users', total_users),
                ('Events', total_events),
                ('Revenue', f"\u20b9{total_revenue_inr:,.0f}"),
            ],
            admin_url=f"{frontend}/api/admin/",
        )
        subject = rendered.subject

        if dry_run:
            self.stdout.write(
                f'  [DRY RUN] Would send business digest to {recipients.count()} staff recipient(s)'
            )
            self.stdout.write(f'  Subject: {subject}')
            self.stdout.write(
                f'  Today: {new_signups} signups, {new_events} events, {new_rsvps} RSVPs, {gifts_line}'
            )
            return

        sent = 0
        for recipient in recipients:
            try:
                send_email(
                    to_email=recipient.email, subject=rendered.subject,
                    body_text=rendered.text, body_html=rendered.html,
                )
                sent += 1
                logger.info(f'Business digest sent to {recipient.email}')
            except Exception as e:
                logger.error(f'Failed to send business digest to {recipient.email}: {e}', exc_info=True)
                self.stderr.write(f'  Failed to send business digest to {recipient.email}: {e}')

        self.stdout.write(f'  Business digest sent to {sent}/{recipients.count()} staff recipient(s)')
