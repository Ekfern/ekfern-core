"""
Django management command to seed the first batch of "universal" curated
page layouts: Keynote, Letterpress, and Editorial.

Unlike the original 4 defaults (seed_page_layouts.py), these deliberately
leave tile-level color fields (buttonColor, fontColor, borderColor, etc.)
unset wherever the tile should inherit the live theme / Design-step-derived
palette, instead of baking literal hex values into every field. Only
structural/typographic choices (themeId, texture, borderStyle, textAlign,
font family where it differs from the theme default) are set explicitly.

Creates Keynote, Letterpress, and Editorial if they do not already exist
(keyed by name). Idempotent: re-running does not create duplicates.

Usage:
    python manage.py seed_modern_page_layouts

Requires at least one staff user (created_by).
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from apps.events.models import InvitePageLayout

User = get_user_model()

SEED_DATE = '2025-06-14'


def get_keynote_config():
    return {
        'themeId': 'carbon',
        'customColors': {},
        'texture': {'type': 'none', 'intensity': 0},
        'tiles': [
            {
                'id': 'tile-title-0',
                'type': 'title',
                'enabled': True,
                'order': 0,
                'settings': {
                    'text': 'Event Title',
                    'size': 'large',
                    # font + color unset -> inherit carbon theme (Inter, off-white)
                },
            },
            {
                'id': 'tile-description-1',
                'type': 'description',
                'enabled': True,
                'order': 1,
                'settings': {
                    'content': '<p style="text-align: center">Join us for an evening to remember.</p>',
                },
            },
            {
                'id': 'tile-event-details-2',
                'type': 'event-details',
                'enabled': True,
                'order': 2,
                'settings': {
                    'location': '',
                    'date': SEED_DATE,
                    'borderStyle': 'minimal',
                    'backgroundColor': 'transparent',
                    # fontColor / borderColor unset -> inherit theme
                },
            },
            {
                'id': 'tile-feature-buttons-3',
                'type': 'feature-buttons',
                'enabled': True,
                'order': 3,
                'settings': {
                    'rsvpLabel': 'RSVP',
                    'buttonVariant': 'classic',
                    'buttonRadius': 'pill',
                    # buttonColor unset -> inherits carbon's Apple-blue primary
                },
            },
            {
                'id': 'tile-footer-4',
                'type': 'footer',
                'enabled': True,
                'order': 4,
                'settings': {
                    'text': 'Made with care.',
                },
            },
        ],
    }


def get_letterpress_config():
    return {
        'themeId': 'warm-parchment',
        'customColors': {},
        'texture': {'type': 'paper-grain', 'intensity': 20},
        'tiles': [
            {
                'id': 'tile-title-0',
                'type': 'title',
                'enabled': True,
                'order': 0,
                'settings': {
                    'text': 'Event Title',
                    'size': 'large',
                    'subtitle': 'Join us to celebrate',
                    # font unset -> inherits warm-parchment's Cormorant Garamond
                },
            },
            {
                'id': 'tile-description-1',
                'type': 'description',
                'enabled': True,
                'order': 1,
                'settings': {
                    'content': '<p style="text-align: center">A celebration to remember, surrounded by those we love.</p>',
                },
            },
            {
                'id': 'tile-event-details-2',
                'type': 'event-details',
                'enabled': True,
                'order': 2,
                'settings': {
                    'location': '',
                    'date': SEED_DATE,
                    'borderStyle': 'elegant',
                    'decorativeSymbol': '❦',
                    # fontColor / borderColor unset -> inherit theme
                },
            },
            {
                'id': 'tile-feature-buttons-3',
                'type': 'feature-buttons',
                'enabled': True,
                'order': 3,
                'settings': {
                    'rsvpLabel': 'RSVP',
                    'buttonVariant': 'ornate',
                    'buttonRadius': 'subtle',
                },
            },
            {
                'id': 'tile-footer-4',
                'type': 'footer',
                'enabled': True,
                'order': 4,
                'settings': {
                    'text': "We can't wait to celebrate with you.",
                },
            },
        ],
    }


def get_editorial_config():
    return {
        'themeId': 'minimal-ivory',
        'customColors': {},
        'texture': {'type': 'none', 'intensity': 0},
        'tiles': [
            {
                'id': 'tile-title-0',
                'type': 'title',
                'enabled': True,
                'order': 0,
                'settings': {
                    'text': 'Event Title',
                    'size': 'large',
                    'textAlign': 'left',
                    # font unset -> inherits minimal-ivory's Playfair Display
                },
            },
            {
                'id': 'tile-description-1',
                'type': 'description',
                'enabled': True,
                'order': 1,
                'settings': {
                    'content': '<p style="text-align: left">An evening of celebration, thoughtfully gathered.</p>',
                },
            },
            {
                'id': 'tile-event-details-2',
                'type': 'event-details',
                'enabled': True,
                'order': 2,
                'settings': {
                    'location': '',
                    'date': SEED_DATE,
                    'textAlign': 'left',
                    'borderStyle': 'minimal',
                },
            },
            {
                'id': 'tile-feature-buttons-3',
                'type': 'feature-buttons',
                'enabled': True,
                'order': 3,
                'settings': {
                    'rsvpLabel': 'RSVP',
                    'buttonVariant': 'link',
                    'buttonRadius': 'sharp',
                },
            },
            {
                'id': 'tile-footer-4',
                'type': 'footer',
                'enabled': True,
                'order': 4,
                'settings': {
                    'text': 'With love, always.',
                },
            },
        ],
    }


MODERN_PAGE_LAYOUTS = [
    {
        'name': 'Keynote',
        'description': 'Near-black, confident type, one accent color. No ornamentation.',
        'thumbnail': '/invite-templates/minimal.svg',
        'preview_alt': 'Keynote invite page layout preview with dark tech-premium styling',
        'config_fn': get_keynote_config,
    },
    {
        'name': 'Letterpress',
        'description': 'Parchment, serif type, ornamental dividers, paper texture.',
        'thumbnail': '/invite-templates/minimal.svg',
        'preview_alt': 'Letterpress invite page layout preview with warm parchment styling',
        'config_fn': get_letterpress_config,
    },
    {
        'name': 'Editorial',
        'description': 'Left-aligned masthead title, generous whitespace, magazine feel.',
        'thumbnail': '/invite-templates/minimal.svg',
        'preview_alt': 'Editorial invite page layout preview with left-aligned minimalist styling',
        'config_fn': get_editorial_config,
    },
]


class Command(BaseCommand):
    help = 'Seed the first batch of modern page layouts (Keynote, Letterpress, Editorial)'

    def handle(self, *args, **options):
        seed_user = User.objects.filter(is_staff=True).first() or User.objects.filter(is_superuser=True).first()
        if not seed_user:
            self.stdout.write(
                self.style.ERROR('No staff or superuser found. Create a staff user first, then run this command.')
            )
            return

        created_count = 0
        for spec in MODERN_PAGE_LAYOUTS:
            config = spec['config_fn']()
            obj, created = InvitePageLayout.objects.get_or_create(
                name=spec['name'],
                defaults={
                    'description': spec['description'],
                    'thumbnail': spec['thumbnail'],
                    'preview_alt': spec['preview_alt'],
                    'config': config,
                    'visibility': 'public',
                    'status': 'published',
                    'created_by': seed_user,
                },
            )
            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f'Created page layout: {obj.name} (id={obj.id})'))
            else:
                self.stdout.write(f'Page layout already exists: {obj.name}')

        self.stdout.write(self.style.SUCCESS(f'Done. Created {created_count} new page layout(s).'))
