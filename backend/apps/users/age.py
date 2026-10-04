"""
The minimum age for an Ekfern account, checked on the server at signup.

18 because India's DPDP Act treats anyone under 18 as a child whose data needs
verifiable parental consent, and hosts can take money through the catalog;
it also covers COPPA (13) and the EU's 16. Under the limit, signup is refused
before an account exists, so no child's data is ever stored.
"""
from datetime import date, datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.conf import settings

# The signup form refuses with the same rule before sending anything, so an
# underage visitor's email never reaches us; keep frontend/lib/auth/age.ts in step.
MINIMUM_AGE = 18
OLDEST_PLAUSIBLE_AGE = 120

UNDERAGE_MESSAGE = f'You must be {MINIMUM_AGE} or older to create an Ekfern account.'


class AgeCheckError(ValueError):
    """Why a date of birth was refused. ``code`` is stable for the frontend."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def age_on(born: date, today: date) -> int:
    """Whole years completed by ``today``. A 29 February birthday counts from 1 March."""
    had_birthday = (today.month, today.day) >= (born.month, born.day)
    return today.year - born.year - (0 if had_birthday else 1)


def parse_date_of_birth(raw) -> date:
    """An ISO date (YYYY-MM-DD), as the date input sends it."""
    if isinstance(raw, date):
        return raw
    try:
        return date.fromisoformat(str(raw or '').strip())
    except ValueError:
        raise AgeCheckError('dob_invalid', 'Enter your date of birth.')


def local_today(time_zone) -> date:
    """
    Today in the visitor's own timezone (an IANA name such as
    "Pacific/Auckland", sent by the signup form), so a birthday falls on the
    same day here as it does for the visitor and in the form. A real timezone
    can only move today by about a day, so it needs no further checking.
    Missing or unknown values fall back to the server's own zone.
    """
    if isinstance(time_zone, str) and 0 < len(time_zone) <= 64:
        try:
            return datetime.now(ZoneInfo(time_zone)).date()
        except (ZoneInfoNotFoundError, ValueError):
            pass
    return datetime.now(ZoneInfo(settings.TIME_ZONE)).date()


def check_date_of_birth(raw, *, today: date | None = None) -> date:
    """Return the date of birth if the person may hold an account; raise otherwise."""
    if raw in (None, ''):
        raise AgeCheckError('dob_required', 'Enter your date of birth.')
    born = parse_date_of_birth(raw)
    today = today or date.today()
    if born > today:
        raise AgeCheckError('dob_invalid', 'Your date of birth cannot be in the future.')
    age = age_on(born, today)
    if age > OLDEST_PLAUSIBLE_AGE:
        raise AgeCheckError('dob_invalid', 'Check your date of birth.')
    if age < MINIMUM_AGE:
        raise AgeCheckError('underage', UNDERAGE_MESSAGE)
    return born
