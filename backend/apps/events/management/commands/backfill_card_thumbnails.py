"""Generate thumbnail derivatives for existing GreetingCardSample rows.

Catalog grids render `thumbnail_url` (a small Pillow derivative) for speed. New
uploads create it automatically; this command backfills rows created before the
thumbnail pipeline existed.

Usage:
    python manage.py backfill_card_thumbnails            # only rows missing a thumb
    python manage.py backfill_card_thumbnails --force     # regenerate every row
    python manage.py backfill_card_thumbnails --dry-run   # report, change nothing
"""
import hashlib

from django.conf import settings
from django.core.management.base import BaseCommand

from apps.events.models import GreetingCardSample
from apps.events.views import (
    _generate_card_thumbnail_bytes,
    _store_greeting_card_bytes,
)


class Command(BaseCommand):
    help = 'Generate thumbnail_url derivatives for greeting card samples that lack them.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Regenerate thumbnails even for rows that already have one.',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Report what would change without writing anything.',
        )

    def _fetch_image_bytes(self, url: str) -> bytes:
        """Read the source image bytes from an absolute URL or a local /media path."""
        if url.startswith(('http://', 'https://')):
            import requests
            resp = requests.get(url, timeout=30)
            resp.raise_for_status()
            return resp.content

        # Dev: relative /media/... path → read from MEDIA_ROOT.
        import os
        media_url = getattr(settings, 'MEDIA_URL', '/media/')
        media_root = getattr(settings, 'MEDIA_ROOT', '/tmp/media')
        relative = url[len(media_url):] if url.startswith(media_url) else url.lstrip('/')
        path = os.path.join(media_root, relative)
        with open(path, 'rb') as f:
            return f.read()

    def handle(self, *args, **options):
        force = options['force']
        dry_run = options['dry_run']

        qs = GreetingCardSample.objects.all().order_by('pk')
        if not force:
            qs = qs.filter(thumbnail_url='')

        total = qs.count()
        if total == 0:
            self.stdout.write(self.style.SUCCESS('Nothing to backfill — all samples have thumbnails.'))
            return

        self.stdout.write(f'Processing {total} sample(s){" (dry run)" if dry_run else ""}…')

        succeeded = 0
        skipped = 0
        failed = 0

        for sample in qs.iterator():
            if not sample.background_image_url:
                self.stdout.write(self.style.WARNING(f'  [{sample.pk}] {sample.name}: no background URL, skipping.'))
                skipped += 1
                continue
            try:
                content = self._fetch_image_bytes(sample.background_image_url)
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'  [{sample.pk}] {sample.name}: fetch failed ({e}).'))
                failed += 1
                continue

            thumb = _generate_card_thumbnail_bytes(content)
            if thumb is None:
                self.stdout.write(self.style.WARNING(
                    f'  [{sample.pk}] {sample.name}: could not generate thumbnail (animated/unsupported), skipping.'
                ))
                skipped += 1
                continue

            thumb_bytes, thumb_ext, thumb_content_type = thumb
            content_hash = hashlib.sha256(content).hexdigest()[:20]
            thumb_key = f"greeting-cards/thumbs/{content_hash}{thumb_ext}"

            if dry_run:
                self.stdout.write(f'  [{sample.pk}] {sample.name}: would store {thumb_key}.')
                succeeded += 1
                continue

            try:
                thumbnail_url = _store_greeting_card_bytes(thumb_bytes, thumb_key, thumb_content_type)
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'  [{sample.pk}] {sample.name}: upload failed ({e}).'))
                failed += 1
                continue

            sample.thumbnail_url = thumbnail_url
            sample.save(update_fields=['thumbnail_url', 'updated_at'])
            self.stdout.write(self.style.SUCCESS(f'  [{sample.pk}] {sample.name}: thumbnail saved.'))
            succeeded += 1

        summary = f'Done. {succeeded} processed, {skipped} skipped, {failed} failed.'
        style = self.style.SUCCESS if failed == 0 else self.style.WARNING
        self.stdout.write(style(summary))
