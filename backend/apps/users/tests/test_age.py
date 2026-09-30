"""
The minimum age at signup: enforced on the server, and nothing is stored for
someone under it.
"""
from datetime import date
from unittest import mock

from django.test import SimpleTestCase, TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.privacy.models import ConsentEvent
from apps.users.age import MINIMUM_AGE, AgeCheckError, age_on, check_date_of_birth
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
