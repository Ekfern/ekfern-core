"""
Tests for invite page view de-duplication.

The public invite payload is a data fetch, not a page view. It is requested by
the server render, again when the client mounts, again every 15 seconds while
the tab is visible, and again by the catalog page - each of which used to write
its own ``InvitePageView`` row. A guest who left a tab open for an hour
registered roughly 240 "views".

The fix is a dedupe window enforced by the database rather than by the caller,
so the count does not depend on how many times any client happens to fetch.
These tests pin that guarantee, including under concurrency, which is where a
check-then-insert implementation would quietly fail.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone as dt_timezone

from django.db import IntegrityError, connection, transaction
from django.test import TestCase, TransactionTestCase
from django.utils import timezone

from apps.events.models import (
    Event,
    Guest,
    InvitePageView,
    INVITE_VIEW_DEDUPE_MINUTES,
    invite_view_bucket,
)
from apps.users.models import User


def _fixture(slug: str):
    user = User.objects.create(email=f"host-{slug}@example.com", name="Host")
    event = Event.objects.create(host=user, slug=slug, title="Meera & Arjun")
    guest = Guest.objects.create(
        event=event, name="Asha", phone=f"+9199{abs(hash(slug)) % 10**8:08d}",
        guest_token=f"tok-{slug}",
    )
    return event, guest


def _record(event, guest, when):
    """The write the view performs, in the shape the view performs it."""
    with transaction.atomic():
        return InvitePageView.objects.create(
            guest=guest,
            event=event,
            viewed_at=when,
            view_bucket=invite_view_bucket(when),
        )


class InviteViewBucketTests(TestCase):
    def test_floors_to_the_window_start(self):
        at = lambda m, s=0: datetime(2026, 9, 18, 14, m, s, 123456, tzinfo=dt_timezone.utc)
        self.assertEqual(invite_view_bucket(at(0)).minute, 0)
        self.assertEqual(invite_view_bucket(at(29, 59)).minute, 0)
        self.assertEqual(invite_view_bucket(at(30)).minute, 30)
        self.assertEqual(invite_view_bucket(at(59, 59)).minute, 30)

    def test_strips_seconds_and_microseconds(self):
        bucket = invite_view_bucket(
            datetime(2026, 9, 18, 14, 47, 33, 987654, tzinfo=dt_timezone.utc)
        )
        self.assertEqual((bucket.second, bucket.microsecond), (0, 0))

    def test_window_is_stable_across_an_hour_boundary(self):
        before = invite_view_bucket(datetime(2026, 9, 18, 13, 59, tzinfo=dt_timezone.utc))
        after = invite_view_bucket(datetime(2026, 9, 18, 14, 1, tzinfo=dt_timezone.utc))
        self.assertNotEqual(before, after)
        self.assertEqual(after - before, timedelta(minutes=INVITE_VIEW_DEDUPE_MINUTES))

    def test_handles_a_window_that_does_not_divide_into_an_hour(self):
        # Computed on the epoch, so boundaries stay consistent rather than
        # resetting every hour.
        a = invite_view_bucket(datetime(2026, 9, 18, 14, 10, tzinfo=dt_timezone.utc), minutes=7)
        b = invite_view_bucket(datetime(2026, 9, 18, 14, 13, tzinfo=dt_timezone.utc), minutes=7)
        self.assertEqual(a, b)


class InviteViewDedupeTests(TestCase):
    def setUp(self):
        self.event, self.guest = _fixture("dedupe")

    def test_one_row_per_guest_per_window(self):
        start = timezone.now().replace(minute=0, second=0, microsecond=0)
        # The shape of a real visit: server render, client mount, then polling
        # every 15 seconds for ten minutes.
        _record(self.event, self.guest, start)
        _record_attempts = 0
        for seconds in range(0, 600, 15):
            try:
                _record(self.event, self.guest, start + timedelta(seconds=seconds))
            except IntegrityError:
                pass
            _record_attempts += 1

        self.assertEqual(InvitePageView.objects.filter(event=self.event).count(), 1)
        self.assertGreater(_record_attempts, 30)  # 40 fetches, one view

    def test_a_later_window_records_a_new_view(self):
        start = timezone.now().replace(minute=0, second=0, microsecond=0)
        _record(self.event, self.guest, start)
        _record(self.event, self.guest, start + timedelta(minutes=INVITE_VIEW_DEDUPE_MINUTES))
        self.assertEqual(InvitePageView.objects.filter(event=self.event).count(), 2)

    def test_two_guests_are_counted_separately(self):
        other = Guest.objects.create(
            event=self.event, name="Ravi", phone="+919800000002", guest_token="tok-2",
        )
        now = timezone.now()
        _record(self.event, self.guest, now)
        _record(self.event, other, now)
        self.assertEqual(InvitePageView.objects.filter(event=self.event).count(), 2)

    def test_the_first_request_of_a_window_keeps_its_attribution(self):
        # Polls carry no `source`, so the arrival that does must be the one
        # that survives.
        now = timezone.now()
        InvitePageView.objects.create(
            guest=self.guest, event=self.event, viewed_at=now,
            view_bucket=invite_view_bucket(now), source_channel='qr',
        )
        with self.assertRaises(IntegrityError), transaction.atomic():
            InvitePageView.objects.create(
                guest=self.guest, event=self.event, viewed_at=now + timedelta(seconds=15),
                view_bucket=invite_view_bucket(now), source_channel='link',
            )
        self.assertEqual(InvitePageView.objects.get(event=self.event).source_channel, 'qr')

    def test_viewed_at_keeps_full_precision(self):
        # The bucket carries the constraint so the timestamp does not have to
        # be rounded - "when did they look" stays answerable.
        now = timezone.now().replace(microsecond=123456)
        row = _record(self.event, self.guest, now)
        row.refresh_from_db()
        self.assertEqual(row.viewed_at, now)
        self.assertNotEqual(row.viewed_at, row.view_bucket)

    def test_legacy_rows_without_a_bucket_do_not_collide(self):
        # Nulls are distinct under a unique constraint, so rows recorded before
        # this existed are left alone rather than blocking new writes.
        now = timezone.now()
        for _ in range(3):
            InvitePageView.objects.create(
                guest=self.guest, event=self.event, viewed_at=now, view_bucket=None,
            )
        _record(self.event, self.guest, now)
        self.assertEqual(InvitePageView.objects.filter(event=self.event).count(), 4)


class InviteViewConcurrencyTests(TransactionTestCase):
    """
    The reason this is insert-and-catch rather than check-then-insert.

    Two polls landing at the same moment both pass an `exists()` check and both
    insert. Only the database can settle it, so the constraint is the guarantee
    and this test is what proves it is actually doing the work.
    """

    def test_concurrent_writes_yield_exactly_one_row(self):
        import threading

        event, guest = _fixture("concurrent")
        now = timezone.now()
        bucket = invite_view_bucket(now)
        barrier = threading.Barrier(8)
        created, conflicts = [], []

        def attempt():
            barrier.wait()
            try:
                with transaction.atomic():
                    InvitePageView.objects.create(
                        guest=guest, event=event, viewed_at=timezone.now(),
                        view_bucket=bucket,
                    )
                created.append(1)
            except IntegrityError:
                conflicts.append(1)
            finally:
                connection.close()

        threads = [threading.Thread(target=attempt) for _ in range(8)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        self.assertEqual(InvitePageView.objects.filter(event=event).count(), 1)
        self.assertEqual(len(created), 1)
        self.assertEqual(len(conflicts), 7)
