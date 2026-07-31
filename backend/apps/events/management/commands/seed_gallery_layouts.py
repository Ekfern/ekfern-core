"""
Django management command to populate the Page Layout gallery with every
(structural recipe × style preset) combination from the gallery generator.

This is additive and independent of the two earlier hand-authored batches
(seed_modern_page_layouts.py: Grain/Glass/Ink, seed_hero_page_layouts.py:
Cover/Editorial Type/Poster Card) — those stay exactly as they are. This
command instead uses `gallery_recipes.py` (structure) x
`gallery_style_presets.py` (color/font/texture/button) x
`gallery_layout_generator.py` (composer) to generate many layouts at once
without hand-writing each config.

Idempotent via update_or_create, keyed by name ("{Preset Name} {Recipe
Name}", e.g. "Blush Grain Cover"). Re-running syncs config if a recipe or
preset definition changes.

Usage:
    python manage.py seed_gallery_layouts
    python manage.py seed_gallery_layouts --dry-run   # print names, no DB writes

Requires at least one staff user (created_by).
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

from apps.events.models import InvitePageLayout
from apps.events.services import gallery_recipes, gallery_style_presets, gallery_layout_generator

User = get_user_model()


class Command(BaseCommand):
    help = 'Seed the Page Layout gallery with every recipe x preset combination from the gallery generator'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Print the layout names that would be created/updated without writing to the database.',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']

        seed_user = None
        if not dry_run:
            seed_user = User.objects.filter(is_staff=True).first() or User.objects.filter(is_superuser=True).first()
            if not seed_user:
                self.stdout.write(
                    self.style.ERROR('No staff or superuser found. Create a staff user first, then run this command.')
                )
                return

        recipes = gallery_recipes.all_recipes()
        presets = gallery_style_presets.all_presets()

        created_count = 0
        updated_count = 0
        for recipe in recipes:
            for preset in presets:
                name = gallery_layout_generator.compose_name(recipe, preset)
                if dry_run:
                    self.stdout.write(name)
                    continue

                config = gallery_layout_generator.compose_gallery_config(recipe, preset)
                description = gallery_layout_generator.compose_description(recipe, preset)
                obj, created = InvitePageLayout.objects.update_or_create(
                    name=name,
                    defaults={
                        'description': description,
                        'thumbnail': '/invite-templates/minimal.svg',
                        'preview_alt': f'{name} invite page layout preview',
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

        if dry_run:
            self.stdout.write(self.style.SUCCESS(
                f'Dry run: {len(recipes) * len(presets)} layout(s) would be created/updated.'
            ))
        else:
            self.stdout.write(self.style.SUCCESS(
                f'Done. Created {created_count}, updated {updated_count} page layout(s).'
            ))
