"""
Every Ekfern email shares one layout, escapes what people typed, and keeps
its plain-text part in step with its HTML.
"""
import datetime
import inspect
import re
from pathlib import Path
from unittest import mock

from django.test import SimpleTestCase, TestCase

from apps.common import emails
from apps.common.email_layout import FONT, UNSUBSCRIBE_SLOT

SAMPLES = {
    'sign_in_code': lambda: emails.sign_in_code(first_name='Priya', otp='482913', login_url='https://ekfern.com/host/login?token=t'),
    'password_reset': lambda: emails.password_reset(first_name='', reset_url='https://ekfern.com/host/reset-password?token=t'),
    'cohost_invite': lambda: emails.cohost_invite(
        inviter='Alisha', event_title='Marathi class', event_date=datetime.date(2026, 10, 10),
        invited_email='priya@example.com', capabilities=['manage_guests'], link='https://ekfern.com/cohost-invite/x'),
    'rsvp_confirmation': lambda: emails.rsvp_confirmation(guest_name='Rahul', event_title='Marathi class', will_attend='yes'),
    'rsvp_alert': lambda: emails.rsvp_alert(event_title='Marathi class', guest_name='Rahul', will_attend='maybe',
                                            guests_count=2, rsvps_url='https://ekfern.com/host/events/1/rsvp'),
    'catalog_receipt': lambda: emails.catalog_receipt(guest_name='Rahul', item_title='Crayons', event_title='Marathi class',
                                                      amount_paise=150000),
    'catalog_alert': lambda: emails.catalog_alert(event_title='Marathi class', item_title='Crayons', response_label='Pledge',
                                                  guest_name='Rahul', guest_contact='+15125550101', amount_paise=150000,
                                                  responses_url='https://ekfern.com/host/events/1/catalog/responses'),
    'host_digest': lambda: emails.host_digest(first_name='Priya', date_label='September 30', rsvp_lines=['Rahul · Attending'],
                                              gift_lines=[], dashboard_url='https://ekfern.com/host/dashboard'),
    'staff_business_digest': lambda: emails.staff_business_digest(date_label='September 30', today_rows=[('New signups', 3)],
                                                                  all_time_rows=[('Users', 90)], admin_url='https://ekfern.com/api/admin/'),
    'staff_signup_alert': lambda: emails.staff_signup_alert(name='', email='new@example.com', joined='Sep 30, 2026 10:00 UTC',
                                                            admin_url='https://ekfern.com/api/admin/'),
    'contact_form_message': lambda: emails.contact_form_message(name='Ana', email='ana@example.com', subject='Hello', body='Hi'),
    'ops_alert': lambda: emails.ops_alert(title='Spend at 80%', subject='[Ekfern] spend', rows=[('Cap', '$10')], advice='Check it.'),
}


class SharedLayoutTests(SimpleTestCase):
    def test_every_email_in_the_catalogue_is_sampled(self):
        public = {
            name for name, fn in inspect.getmembers(emails, inspect.isfunction)
            if fn.__module__ == emails.__name__ and not name.startswith('_')
            and name not in ('format_long_date', 'rupees')
        }
        self.assertEqual(public, set(SAMPLES))

    def test_every_email_uses_the_shared_layout(self):
        for name, build in SAMPLES.items():
            with self.subTest(email=name):
                rendered = build()
                self.assertTrue(rendered.subject)
                self.assertIn(FONT, rendered.html)
                self.assertIn('class="card"', rendered.html)
                self.assertIn(UNSUBSCRIBE_SLOT, rendered.html)
                self.assertIn('prefers-color-scheme: dark', rendered.html)
                self.assertTrue(rendered.text.strip())

    def test_every_email_carries_the_brand_green(self):
        # Wordmark, top edge of the card, and the button in dark mode as well.
        from apps.common.email_layout import BRAND_GREEN, BRAND_GREEN_ON_DARK, BUTTON_GREEN_ON_DARK
        for name, build in SAMPLES.items():
            with self.subTest(email=name):
                html = build().html
                self.assertIn(f'color:{BRAND_GREEN};" class="brand">Ekfern', html)
                self.assertIn(f'border-top:4px solid {BRAND_GREEN}', html)
                self.assertIn(BRAND_GREEN_ON_DARK, html)
                self.assertIn(BUTTON_GREEN_ON_DARK, html)

    def test_one_brand_spelling(self):
        for name, build in SAMPLES.items():
            with self.subTest(email=name):
                rendered = build()
                self.assertNotIn('EkFern', rendered.subject + rendered.text + rendered.html)


class EscapingTests(SimpleTestCase):
    ATTACK = '<script>alert(1)</script><a href="https://evil.test">click</a>'

    def test_typed_values_are_escaped(self):
        rendered = emails.contact_form_message(name=self.ATTACK, email='a@b.co', subject=self.ATTACK, body=self.ATTACK)
        self.assertNotIn('<script>', rendered.html)
        self.assertNotIn('href="https://evil.test"', rendered.html)
        self.assertIn('&lt;script&gt;', rendered.html)

    def test_event_title_and_inviter_are_escaped(self):
        rendered = emails.cohost_invite(inviter=self.ATTACK, event_title=self.ATTACK, invited_email='a@b.co',
                                        capabilities=[], link='https://ekfern.com/x')
        self.assertNotIn('<script>', rendered.html)

    def test_a_message_keeps_its_line_breaks(self):
        rendered = emails.contact_form_message(name='Ana', email='a@b.co', subject='', body='Line one\nLine two')
        self.assertIn('Line one<br>Line two', rendered.html)
        self.assertIn('Line one\nLine two', rendered.text)


class ContentTests(SimpleTestCase):
    def test_sign_in_code_shows_the_code_in_both_parts(self):
        rendered = emails.sign_in_code(first_name='Priya', otp='482913', login_url='https://ekfern.com/x')
        self.assertIn('482913', rendered.html)
        self.assertIn('482913', rendered.text)

    def test_cohost_invite_lists_only_granted_abilities(self):
        rendered = emails.cohost_invite(inviter='Alisha', event_title='Class', invited_email='p@x.co',
                                        capabilities=['manage_guests'], link='https://ekfern.com/x')
        self.assertIn('Manage the guest list', rendered.text)
        self.assertNotIn('Send messages to guests', rendered.text)

    def test_empty_details_are_left_out(self):
        rendered = emails.rsvp_alert(event_title='Class', guest_name='Rahul', will_attend='yes', guests_count=1,
                                     guest_email='', rsvps_url='https://ekfern.com/x')
        self.assertNotIn('Email:', rendered.text)

    def test_rupees_reads_paise(self):
        self.assertEqual(emails.rupees(150000), '₹1,500')
        self.assertEqual(emails.rupees(None), '')


class SendEmailTests(SimpleTestCase):
    def test_unsubscribe_links_reach_the_html(self):
        from apps.common import email_backend

        rendered = emails.host_digest(first_name='', date_label='Sep 30', rsvp_lines=['x'], gift_lines=[],
                                      dashboard_url='https://ekfern.com/host/dashboard')
        with mock.patch.object(email_backend, '_send_via_ses') as ses, \
                mock.patch.object(email_backend, '_log_notification'):
            email_backend.send_email('a@b.co', rendered.subject, rendered.text, body_html=rendered.html,
                                     unsubscribe_token='tok-123')
        html = ses.call_args.args[3]
        self.assertNotIn(UNSUBSCRIBE_SLOT, html)
        self.assertIn('/unsubscribe/tok-123', html)
        self.assertIn('Notification settings', html)


class EveryEmailIsDesignedTests(SimpleTestCase):
    """The rule itself: app code never sends an email without the shared HTML."""

    def test_no_send_email_call_without_html(self):
        apps_dir = Path(__file__).resolve().parents[1]
        offenders = []
        for path in apps_dir.rglob('*.py'):
            rel = path.relative_to(apps_dir).as_posix()
            if '/migrations/' in rel or rel.startswith('common/email_backend') or '/test' in rel or path.name.startswith('test_'):
                continue
            source = path.read_text()
            for match in re.finditer(r'(?<![\w.])send_email\(', source):
                depth, i = 0, match.end() - 1
                while i < len(source):
                    depth += source[i] == '('
                    depth -= source[i] == ')'
                    if depth == 0:
                        break
                    i += 1
                if 'body_html' not in source[match.start():i]:
                    offenders.append(f'{rel}:{source[:match.start()].count(chr(10)) + 1}')
        self.assertEqual(offenders, [], 'Build these with apps.common.emails so they share the layout.')


class DigestContentTests(TestCase):
    """The digest reads the keys the alerts actually queue."""

    def test_gift_lines_show_who_what_and_how_much(self):
        from django.core.management import call_command

        from apps.notifications.models import NotificationQueue
        from apps.users.models import User

        host = User.objects.create_user(email='digest-host@test.com', name='Priya Shah')
        NotificationQueue.objects.create(user=host, notification_type='gift_received', payload_json={
            'event_id': 1, 'event_title': 'Marathi class', 'item_title': 'Crayon box',
            'response_type': 'pledge', 'guest_name': 'Rahul', 'guest_phone': '', 'guest_email': '',
            'amount': 150000,
        })
        NotificationQueue.objects.create(user=host, notification_type='rsvp_new', payload_json={
            'event_id': 1, 'event_title': 'Marathi class', 'rsvp_name': 'Meera', 'will_attend': 'yes',
        })
        with mock.patch('apps.notifications.management.commands.send_digests.send_email') as sent:
            call_command('send_digests', stdout=mock.MagicMock(), stderr=mock.MagicMock())
        text = sent.call_args.kwargs['body_text']
        self.assertIn('Rahul · Crayon box · ₹1,500 · Marathi class', text)
        self.assertIn('Meera · Attending · Marathi class', text)
        self.assertNotIn('Someone', text)
