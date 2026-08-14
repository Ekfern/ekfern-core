"""
Django management command to seed the first batch of "universal" curated
page layouts: Grain, Glass, and Ink.

Replaces an earlier batch (Keynote, Letterpress, Editorial) that reused the
default tile look with only colors/fonts swapped — which read as flat and
generic. This batch is built around specific design references (moody
grainy poster photography, a frosted-glass floating card, a single
saturated flat color with huge whitespace) and leans on real rendering
capabilities added alongside this command: the 'grain' texture (SVG
turbulence noise, not a repeating craft pattern), the 'glass' borderStyle
(frosted blur card) and 'glass' buttonVariant, and the Title tile's
'eyebrow' kicker line. Colors are still baked in directly (customColors)
rather than left unset, because in all reference designs the background
*is* the design — an empty/theme-default background would undercut the
look before the host even reaches the Design step.

Creates Grain, Glass, and Ink if they do not already exist (keyed by
name). Deletes any leftover rows from the previous batch (Keynote,
Letterpress, Editorial) first. Idempotent: re-running does not create
duplicates.

Usage:
    python manage.py seed_modern_page_layouts

Requires at least one staff user (created_by).
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from apps.events.models import InvitePageLayout

User = get_user_model()

SEED_DATE = '2025-06-14'
OLD_BATCH_NAMES = ['Keynote', 'Letterpress', 'Editorial']


def get_grain_config():
    return {
        'customColors': {
            'backgroundGradient': 'linear-gradient(160deg, #0B1120 0%, #1B2A5C 45%, #2E1E52 100%)',
            'fontColor': '#F5F5F7',
            'primaryColor': '#FF5A3C',
            'mutedColor': '#9AA3C4',
        },
        'customFonts': {
            'titleFont': "'Montserrat', sans-serif",
            'bodyFont': 'Inter, system-ui, sans-serif',
        },
        'texture': {'type': 'grain', 'intensity': 40},
        'spacing': 'spacious',
        'tiles': [
            {
                'id': 'tile-title-0',
                'type': 'title',
                'enabled': True,
                'order': 0,
                'settings': {
                    'text': 'Event Title',
                    'size': 'xlarge',
                    'textAlign': 'left',
                    'eyebrow': 'SAVE THE DATE',
                    # eyebrowColor / font / color unset -> inherit coral primary + Montserrat
                },
            },
            {
                'id': 'tile-description-1',
                'type': 'description',
                'enabled': True,
                'order': 1,
                'settings': {
                    'content': '<p style="text-align: left">An evening, thoughtfully gathered.</p>',
                    'textAlign': 'left',
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
                    'borderStyle': 'none',
                    'backgroundColor': 'transparent',
                    'buttonVariant': 'bracket',
                    'buttonRadius': 'sharp',
                    # fontColor unset -> inherits theme
                },
            },
            {
                'id': 'tile-feature-buttons-3',
                'type': 'feature-buttons',
                'enabled': True,
                'order': 3,
                'settings': {
                    'rsvpLabel': 'RSVP',
                    'buttonVariant': 'bracket',
                    'buttonRadius': 'sharp',
                },
            },
            {
                'id': 'tile-footer-4',
                'type': 'footer',
                'enabled': True,
                'order': 4,
                'settings': {
                    'text': 'Made with care.',
                    'showDivider': False,
                },
            },
        ],
    }


def get_glass_config():
    return {
        'customColors': {
            'backgroundGradient': 'linear-gradient(135deg, #2B0B6B 0%, #5A1FB0 40%, #1447E6 100%)',
            'fontColor': '#FFFFFF',
            'primaryColor': '#FFFFFF',
            'mutedColor': '#D8D3FF',
        },
        'customFonts': {
            'titleFont': 'Inter, system-ui, sans-serif',
            'bodyFont': 'Inter, system-ui, sans-serif',
        },
        'texture': {'type': 'grain', 'intensity': 22},
        'spacing': 'spacious',
        'tiles': [
            {
                'id': 'tile-title-0',
                'type': 'title',
                'enabled': True,
                'order': 0,
                'settings': {
                    'text': 'Event Title',
                    'size': 'large',
                    'eyebrow': "YOU'RE INVITED",
                },
            },
            {
                'id': 'tile-description-1',
                'type': 'description',
                'enabled': True,
                'order': 1,
                'settings': {
                    'content': '<p style="text-align: center">Request-only access. We\'ll see you there.</p>',
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
                    'borderStyle': 'glass',
                    'buttonVariant': 'glass',
                    'buttonRadius': 'pill',
                },
            },
            {
                'id': 'tile-feature-buttons-3',
                'type': 'feature-buttons',
                'enabled': True,
                'order': 3,
                'settings': {
                    'rsvpLabel': 'RSVP',
                    'buttonVariant': 'glass',
                    'buttonRadius': 'pill',
                },
            },
            {
                'id': 'tile-footer-4',
                'type': 'footer',
                'enabled': True,
                'order': 4,
                'settings': {
                    'text': 'Made with care.',
                    'showDivider': False,
                },
            },
        ],
    }


def get_ink_config():
    return {
        'customColors': {
            'backgroundColor': '#0F2E22',
            'fontColor': '#F5F5F0',
            'primaryColor': '#EAF5EE',
            'mutedColor': '#7FA396',
        },
        'customFonts': {
            'titleFont': "'Montserrat', sans-serif",
            'bodyFont': 'Inter, system-ui, sans-serif',
        },
        'texture': {'type': 'grain', 'intensity': 12},
        'spacing': 'spacious',
        'tiles': [
            {
                'id': 'tile-title-0',
                'type': 'title',
                'enabled': True,
                'order': 0,
                'settings': {
                    'text': 'Event Title',
                    'size': 'medium',
                    'textAlign': 'left',
                    'eyebrow': 'THE DETAILS',
                },
            },
            {
                'id': 'tile-description-1',
                'type': 'description',
                'enabled': True,
                'order': 1,
                'settings': {
                    'content': '<p style="text-align: left">Quietly, joyfully, together.</p>',
                    'textAlign': 'left',
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
                    'borderStyle': 'none',
                    'backgroundColor': 'transparent',
                    'buttonVariant': 'link',
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
                },
            },
            {
                'id': 'tile-footer-4',
                'type': 'footer',
                'enabled': True,
                'order': 4,
                'settings': {
                    'text': 'Made with care.',
                    'showDivider': False,
                },
            },
        ],
    }


MODERN_PAGE_LAYOUTS = [
    {
        'name': 'Grain',
        'description': 'Moody blue-violet gradient, film grain, bold left-aligned poster type.',
        'thumbnail': '/invite-templates/minimal.svg',
        'preview_alt': 'Grain invite page layout preview with moody grainy gradient and bold poster typography',
        'config_fn': get_grain_config,
    },
    {
        'name': 'Glass',
        'description': 'Vivid violet-blue gradient with a frosted glass card floating center.',
        'thumbnail': '/invite-templates/minimal.svg',
        'preview_alt': 'Glass invite page layout preview with a frosted glass card over a vivid gradient',
        'config_fn': get_glass_config,
    },
    {
        'name': 'Ink',
        'description': 'One deep saturated forest green, zero borders, tiny precise type.',
        'thumbnail': '/invite-templates/minimal.svg',
        'preview_alt': 'Ink invite page layout preview with a deep saturated forest green and minimal typography',
        'config_fn': get_ink_config,
    },
]


class Command(BaseCommand):
    help = 'Seed the modern page layouts batch (Grain, Glass, Ink), removing the earlier Keynote/Letterpress/Editorial batch'

    def handle(self, *args, **options):
        seed_user = User.objects.filter(is_staff=True).first() or User.objects.filter(is_superuser=True).first()
        if not seed_user:
            self.stdout.write(
                self.style.ERROR('No staff or superuser found. Create a staff user first, then run this command.')
            )
            return

        removed, _ = InvitePageLayout.objects.filter(name__in=OLD_BATCH_NAMES).delete()
        if removed:
            self.stdout.write(f'Removed {removed} row(s) from the previous batch (Keynote/Letterpress/Editorial).')

        created_count = 0
        updated_count = 0
        for spec in MODERN_PAGE_LAYOUTS:
            config = spec['config_fn']()
            obj, created = InvitePageLayout.objects.update_or_create(
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
                updated_count += 1
                self.stdout.write(f'Updated page layout: {obj.name} (id={obj.id})')

        self.stdout.write(self.style.SUCCESS(f'Done. Created {created_count}, updated {updated_count} page layout(s).'))
