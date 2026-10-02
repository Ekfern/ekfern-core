"""
The minimum age at signup: enforced on the server, and nothing is stored for
someone under it.
"""
from datetime import date, datetime, timezone
from unittest import mock

from django.test import SimpleTestCase, TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.privacy.models import ConsentEvent
from apps.users.age import MINIMUM_AGE, AgeCheckError, age_on, check_date_of_birth, local_today
from apps.users.models import User

TODAY = date(2026, 9, 30)


class AgeRuleTests(SimpleTestCase):
    def test_turning_18_today_is_allowed(self):
        self.assertEqual(check_date_of_birth('2008-09-30', today=TODAY), date(2008, 9, 30))

    def test_one_day_short_of_18_is_refused(self):
        with self.assertRaises(AgeCheckError) as ctx:
            check_date_of_birth('2008-10-01', today=TODAY)
        self.assertEqual(ctx.exception.code, 'underage')
        self.assertIn(str(MINIMUM_AGE), ctx.exception.message)

    def test_leap_day_birthday_counts_from_march_first(self):
        self.assertEqual(age_on(date(2008, 2, 29), date(2026, 2, 28)), 17)
        self.assertEqual(age_on(date(2008, 2, 29), date(2026, 3, 1)), 18)

    def test_missing_unreadable_future_and_implausible_dates_are_refused(self):
        for raw, code in [
            (None, 'dob_required'),
            ('', 'dob_required'),
            ('30/09/1990', 'dob_invalid'),
            ('2027-01-01', 'dob_invalid'),
            ('1850-01-01', 'dob_invalid'),
        ]:
            with self.subTest(raw=raw), self.assertRaises(AgeCheckError) as ctx:
                check_date_of_birth(raw, today=TODAY)
            self.assertEqual(ctx.exception.code, code)


# 16:30 UTC on 30 Sep 2026: already 1 Oct in Auckland (UTC+13), still 30 Sep
# in India (22:00) and Chicago (11:30).
AUCKLAND_IS_AHEAD = datetime(2026, 9, 30, 16, 30, tzinfo=timezone.utc)
# 01:00 UTC on 1 Oct 2026: still 30 Sep in Chicago (20:00), already 1 Oct in India.
CHICAGO_IS_BEHIND = datetime(2026, 10, 1, 1, 0, tzinfo=timezone.utc)


def frozen_at(instant):
    """Patch the clock local_today reads, keeping the rest of datetime real."""
    class Frozen(datetime):
        @classmethod
        def now(cls, tz=None):
            return instant.astimezone(tz)
    return mock.patch('apps.users.age.datetime', Frozen)


class LocalTodayTests(SimpleTestCase):
    def test_uses_the_visitors_timezone(self):
        with frozen_at(AUCKLAND_IS_AHEAD):
            self.assertEqual(local_today('Pacific/Auckland'), date(2026, 10, 1))
            self.assertEqual(local_today('America/Chicago'), date(2026, 9, 30))
            self.assertEqual(local_today('Asia/Kolkata'), date(2026, 9, 30))

    def test_legacy_names_that_browsers_report_are_understood(self):
        # Chrome reports e.g. Asia/Calcutta and Asia/Saigon; these need the
        # tzdata package (requirements.txt) on the slim image.
        with frozen_at(AUCKLAND_IS_AHEAD):
            self.assertEqual(local_today('Asia/Saigon'), date(2026, 9, 30))  # 23:30
            self.assertEqual(local_today('Asia/Calcutta'), date(2026, 9, 30))
        with frozen_at(CHICAGO_IS_BEHIND):
            self.assertEqual(local_today('US/Central'), date(2026, 9, 30))
            self.assertEqual(local_today('Asia/Katmandu'), date(2026, 10, 1))

    def test_missing_or_unknown_timezones_fall_back_to_the_server_zone(self):
        with frozen_at(AUCKLAND_IS_AHEAD):
            for raw in [None, '', 'Mars/Olympus', '../../etc/passwd', '/etc/localtime', 'x' * 200, 123, ['UTC']]:
                with self.subTest(raw=raw):
                    self.assertEqual(local_today(raw), date(2026, 9, 30))  # Asia/Kolkata


@mock.patch('apps.users.views._send_otp')
class SignupAgeTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def signup(self, **data):
        return self.client.post('/api/auth/signup/', {'name': 'Priya', 'email': 'priya@example.com', **data}, format='json')

    def ok(self, send_otp):
        from rest_framework.response import Response
        send_otp.return_value = Response({'message': 'sent'})

    def test_an_adult_signs_up_and_the_check_is_recorded(self, send_otp):
        self.ok(send_otp)
        response = self.signup(date_of_birth='1990-05-17')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user = User.objects.get(email='priya@example.com')
        self.assertEqual(user.date_of_birth, date(1990, 5, 17))
        self.assertTrue(ConsentEvent.objects.filter(
            subject_type='host', subject_id=user.id, purpose=ConsentEvent.Purpose.AGE_CONFIRMATION,
        ).exists())

    def test_someone_under_18_is_refused_and_nothing_is_stored(self, send_otp):
        response = self.signup(date_of_birth=date.today().replace(year=date.today().year - 17).isoformat())
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['code'], 'underage')
        self.assertEqual(response.data['error'], 'You must be 18 or older to create an Ekfern account.')
        self.assertFalse(User.objects.filter(email='priya@example.com').exists())
        self.assertFalse(ConsentEvent.objects.exists())
        send_otp.assert_not_called()

    def test_date_of_birth_is_required(self, send_otp):
        response = self.signup()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['code'], 'dob_required')
        self.assertFalse(User.objects.exists())

    def test_resuming_an_unverified_account_records_its_age(self, send_otp):
        self.ok(send_otp)
        existing = User.objects.create_user(email='priya@example.com', name='Priya')
        response = self.signup(date_of_birth='1990-05-17')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        existing.refresh_from_db()
        self.assertEqual(existing.date_of_birth, date(1990, 5, 17))
        self.assertEqual(ConsentEvent.objects.filter(purpose=ConsentEvent.Purpose.AGE_CONFIRMATION).count(), 1)

    def test_a_verified_account_cannot_be_reached_by_an_underage_date(self, send_otp):
        # The age check runs first, so it never reveals whether the email exists.
        User.objects.create_user(email='priya@example.com', name='Priya').__class__.objects.filter(
            email='priya@example.com').update(email_verified=True)
        response = self.signup(date_of_birth='2015-01-01')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_the_birthday_counts_in_the_visitors_own_timezone(self, send_otp):
        self.ok(send_otp)
        # Turning 18 on 1 Oct: it is already that day in Auckland.
        with frozen_at(AUCKLAND_IS_AHEAD):
            response = self.signup(date_of_birth='2008-10-01', time_zone='Pacific/Auckland')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_the_eve_of_the_birthday_is_refused_where_it_is_still_the_eve(self, send_otp):
        # Already 1 Oct in India, but still 30 Sep for this visitor in Chicago.
        with frozen_at(CHICAGO_IS_BEHIND):
            response = self.signup(date_of_birth='2008-10-01', time_zone='America/Chicago')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(User.objects.exists())

    def test_without_a_timezone_the_server_zone_decides(self, send_otp):
        with frozen_at(AUCKLAND_IS_AHEAD):
            response = self.signup(date_of_birth='2008-10-01')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
