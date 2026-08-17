"""
Django management command to seed a second, parallel batch of "universal"
curated page layouts: Cover, Editorial Type, and Poster Card.

This batch embodies a different design philosophy than the earlier Grain/
Glass/Ink batch (seed_modern_page_layouts.py), which is left untouched and
still offered to hosts side by side with these. Where Grain/Glass/Ink spread
color/texture across the whole page, this batch (informed by a UX/UI review
plus a Luma.com event-page reference) concentrates all visual risk into ONE
zone — a full-bleed hero panel — and keeps the rest of the page plain,
high-contrast, and legible by construction:

  - Cover: photo/gradient hero, then a plain white body with a boxed
    "RSVP"-style CTA card (Luma's own composition, one column).
  - Editorial Type: no hero at all — big asymmetric left-aligned serif
    type and an oversized day-number are the whole identity. Built to look
    intentional with zero host-uploaded photo, not like a fallback.
  - Poster Card: full-bleed moody gradient + grain hero (confined to the
    hero panel only, not the whole page), transitioning to a calm flat-dark
    body with one frosted-glass card holding date/location and RSVP.

New capability used (added alongside this command, not invented for it):
DesignTileSettings.frameMode='full-bleed' (was hard-capped to a small 9:16
inset card), DesignTileSettings.texture (hero-scoped grain instead of
page-wide), DesignTileSettings.isLayoutHero (preserves a layout's own baked
gradient through the Layout gallery's skeletonize step, which normally hides
staff-authored photos pre-Design-step), and FeatureButtonsTileSettings'
ctaCardStyle/ctaCard* fields (boxed or glass CTA card, previously only
Event Details could look like a card).

Creates Cover, Editorial Type, and Poster Card if they do not already exist
(keyed by name). Idempotent via update_or_create: re-running syncs config.

Usage:
    python manage.py seed_hero_page_layouts

Requires at least one staff user (created_by).
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from apps.events.models import InvitePageLayout

User = get_user_model()

SEED_DATE = '2025-06-14'


def get_cover_config():
    return {
        'customColors': {
            'backgroundColor': '#FFFFFF',
            'fontColor': '#111111',
            'primaryColor': '#D9654F',
            'mutedColor': '#6B7280',
        },
        'customFonts': {
            'titleFont': 'Inter, system-ui, sans-serif',
            'bodyFont': 'Inter, system-ui, sans-serif',
        },
        'texture': {'type': 'none'},
        'spacing': 'normal',
        'tiles': [
            {
                'id': 'tile-design-0',
                'type': 'poster',
                'enabled': True,
                'order': 0,
                'settings': {
                    'frameMode': 'full-bleed',
                    'aspectRatio': '4 / 5',
                    'isLayoutHero': True,
                    'backgroundGradient': 'linear-gradient(160deg, #FDF2F0 0%, #F4A896 55%, #D9654F 100%)',
                },
            },
            {
                'id': 'tile-title-1',
                'type': 'title',
                'enabled': True,
                'order': 1,
                'settings': {
                    'text': 'Event Title',
                    'size': 'xlarge',
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
                    'dateLayout': 'day-prominent',
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
                    'buttonVariant': 'classic',
                    'buttonRadius': 'pill',
                    'ctaCardStyle': 'bordered',
                    'ctaCardBackgroundColor': '#FFFFFF',
                    'ctaCardBorderColor': 'rgba(0,0,0,0.08)',
                    'ctaCardShadow': True,
                    'ctaCardLabel': 'RSVP',
                },
            },
            {
                'id': 'tile-description-4',
                'type': 'description',
                'enabled': True,
                'order': 4,
                'settings': {
                    'content': '<p style="text-align: left">Join us to celebrate — details below.</p>',
                    'textAlign': 'left',
                },
            },
            {
                'id': 'tile-footer-5',
                'type': 'footer',
                'enabled': True,
                'order': 5,
                'settings': {
                    'text': 'Made with care.',
                    'showDivider': False,
                },
            },
        ],
    }


def get_editorial_type_config():
    return {
        'customColors': {
            'backgroundColor': '#FAFAF8',
            'fontColor': '#1A1A1A',
            'primaryColor': '#8C2F39',
            'mutedColor': '#8A8A85',
        },
        'customFonts': {
            'titleFont': "'Playfair Display', serif",
            'bodyFont': 'Inter, system-ui, sans-serif',
        },
        'texture': {'type': 'none'},
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
                },
            },
            {
                'id': 'tile-event-details-1',
                'type': 'event-details',
                'enabled': True,
                'order': 1,
                'settings': {
                    'location': '',
                    'date': SEED_DATE,
                    'textAlign': 'left',
                    'dateLayout': 'day-prominent',
                    'borderStyle': 'none',
                    'backgroundColor': 'transparent',
                    'buttonVariant': 'link',
                },
            },
            {
                'id': 'tile-description-2',
                'type': 'description',
                'enabled': True,
                'order': 2,
                'settings': {
                    'content': '<p style="text-align: left">Join us for an evening to remember.</p>',
                    'textAlign': 'left',
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
                    'ctaCardStyle': 'none',
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


def get_poster_card_config():
    return {
        'customColors': {
            'backgroundColor': '#15131C',
            'fontColor': '#F2F0F5',
            'primaryColor': '#C9A7F2',
            'mutedColor': '#8B86A3',
        },
        'customFonts': {
            'titleFont': "'Cormorant Garamond', serif",
            'bodyFont': 'Inter, system-ui, sans-serif',
        },
        'texture': {'type': 'none'},
        'spacing': 'spacious',
        'tiles': [
            {
                'id': 'tile-design-0',
                'type': 'poster',
                'enabled': True,
                'order': 0,
                'settings': {
                    'frameMode': 'full-bleed',
                    'aspectRatio': '4 / 5',
                    'isLayoutHero': True,
                    'backgroundGradient': 'linear-gradient(160deg, #1B1626 0%, #2E1F4D 50%, #120F1A 100%)',
                    'texture': {'type': 'grain', 'intensity': 45},
                },
            },
            {
                'id': 'tile-title-1',
                'type': 'title',
                'enabled': True,
                'order': 1,
                'settings': {
                    'text': 'Event Title',
                    'size': 'xlarge',
                    'eyebrow': "YOU'RE INVITED",
                },
            },
            {
                'id': 'tile-description-2',
                'type': 'description',
                'enabled': True,
                'order': 2,
                'settings': {
                    'content': '<p style="text-align: center">An evening to remember.</p>',
                },
            },
            {
                'id': 'tile-event-details-3',
                'type': 'event-details',
                'enabled': True,
                'order': 3,
                'settings': {
                    'location': '',
                    'date': SEED_DATE,
                    'borderStyle': 'glass',
                    'buttonVariant': 'glass',
                    'buttonRadius': 'pill',
                },
            },
            {
                'id': 'tile-feature-buttons-4',
                'type': 'feature-buttons',
                'enabled': True,
                'order': 4,
                'settings': {
                    'rsvpLabel': 'RSVP',
                    'buttonVariant': 'glass',
                    'buttonRadius': 'pill',
                    'ctaCardStyle': 'glass',
                    'ctaCardShadow': True,
                },
            },
            {
                'id': 'tile-footer-5',
                'type': 'footer',
                'enabled': True,
                'order': 5,
                'settings': {
                    'text': 'Made with care.',
                    'showDivider': False,
                },
            },
        ],
    }


HERO_PAGE_LAYOUTS = [
    {
        'name': 'Cover',
        'description': 'Full-bleed photo hero, plain white body, boxed RSVP card.',
        'thumbnail': '/invite-templates/minimal.svg',
        'preview_alt': 'Cover invite page layout preview with a full-bleed hero photo and a boxed RSVP card',
        'config_fn': get_cover_config,
    },
    {
        'name': 'Editorial Type',
        'description': 'No photo needed — big asymmetric serif type and an oversized date are the identity.',
        'thumbnail': '/invite-templates/minimal.svg',
        'preview_alt': 'Editorial Type invite page layout preview with large asymmetric typography and no hero image',
        'config_fn': get_editorial_type_config,
    },
    {
        'name': 'Poster Card',
        'description': 'Moody grain hero up top, calm dark body, one frosted glass card for RSVP.',
        'thumbnail': '/invite-templates/minimal.svg',
        'preview_alt': 'Poster Card invite page layout preview with a grainy gradient hero and a frosted glass RSVP card',
        'config_fn': get_poster_card_config,
    },
]


class Command(BaseCommand):
    help = 'Seed the hero-led page layouts batch (Cover, Editorial Type, Poster Card), additive alongside Grain/Glass/Ink'

    def handle(self, *args, **options):
        seed_user = User.objects.filter(is_staff=True).first() or User.objects.filter(is_superuser=True).first()
        if not seed_user:
            self.stdout.write(
                self.style.ERROR('No staff or superuser found. Create a staff user first, then run this command.')
            )
            return

        created_count = 0
        updated_count = 0
        for spec in HERO_PAGE_LAYOUTS:
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
