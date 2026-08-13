"""
Make every stored invite config describe its own appearance.

Until now a config could say only `themeId: 'warm-parchment'` and let the
frontend's ThemeProvider supply the palette and fonts at render time. That
default provider is being removed, so anything relying on it would fall back to
component defaults and quietly restyle invites that are already published -
9 of 17 pages at the time of writing.

This copies the values ThemeProvider would have resolved into the config's own
customColors/customFonts, and only where the config has not already said
something. Every page keeps exactly the look it has now, and stops depending on
a concept the host never sees.

Existing customColors/customFonts always win: they were set deliberately.
"""
from django.db import migrations

# Mirrors frontend/lib/invite/themes.ts at the time of this migration. Copied
# rather than imported because the frontend file is about to be deleted, and a
# migration must keep working from whatever the tree looks like later.
THEMES = {
    'minimal-ivory': {
        'bg': '#F8F7F4', 'fg': '#121212', 'primary': '#0D6EFD', 'muted': '#6B7280',
        'title': "'Playfair Display', serif", 'body': 'Inter, system-ui',
    },
    'classic-noir': {
        'bg': '#0E0F14', 'fg': '#FFFFFF', 'primary': '#E55A9E', 'muted': '#A7A8AD',
        'title': "'Great Vibes', cursive", 'body': 'Inter, system-ui',
    },
    'emerald-mist': {
        'bg': '#0d1f1a', 'fg': '#FFFFFF', 'primary': '#34d399', 'muted': '#a7f3d0',
        'title': "'Cormorant Garamond', serif", 'body': 'Inter, system-ui',
    },
    'warm-parchment': {
        'bg': '#E8D8C3', 'fg': '#0B3D2E', 'primary': '#D4A017', 'muted': '#8B5E3C',
        'title': "'Cormorant Garamond', serif", 'body': "Georgia, 'Times New Roman', serif",
    },
    'carbon': {
        'bg': '#0A0A0B', 'fg': '#F5F5F7', 'primary': '#0A84FF', 'muted': '#8E8E93',
        'title': "'Inter', system-ui, sans-serif", 'body': "'Inter', system-ui, sans-serif",
    },
}

# ThemeProvider's fallback when a config carries no themeId at all.
DEFAULT_THEME = 'warm-parchment'


def _bake(config):
    """Return (config, changed) with the resolved palette and fonts written in."""
    if not isinstance(config, dict):
        return config, False

    theme = THEMES.get(config.get('themeId') or DEFAULT_THEME, THEMES[DEFAULT_THEME])
    changed = False

    colors = dict(config.get('customColors') or {})
    # A gradient already covers the background, so leave it alone.
    if not colors.get('backgroundColor') and not colors.get('backgroundGradient'):
        colors['backgroundColor'] = theme['bg']
        changed = True
    for key, value in (
        ('fontColor', theme['fg']),
        ('primaryColor', theme['primary']),
        ('mutedColor', theme['muted']),
    ):
        if not colors.get(key):
            colors[key] = value
            changed = True

    fonts = dict(config.get('customFonts') or {})
    for key, value in (('titleFont', theme['title']), ('bodyFont', theme['body'])):
        if not fonts.get(key):
            fonts[key] = value
            changed = True

    if changed:
        config['customColors'] = colors
        config['customFonts'] = fonts

    # Drop the key itself. Nothing reads it any more, and leaving it in stored
    # JSON invites the next person to wonder what it controls.
    if 'themeId' in config:
        config.pop('themeId')
        changed = True

    return config, changed


def bake_theme_values(apps, schema_editor):
    InvitePage = apps.get_model('events', 'InvitePage')

    for page in InvitePage.objects.all().iterator():
        touched = []
        for field in ('config', 'published_config'):
            value = getattr(page, field)
            baked, changed = _bake(value)
            if changed:
                setattr(page, field, baked)
                touched.append(field)
        if touched:
            page.save(update_fields=touched)

    # Layouts and templates seed new invites, so they need the same treatment or
    # every page created from them arrives unstyled.
    for model_name, field in (
        ('InvitePageLayout', 'config'),
        ('InviteDesignTemplate', 'config'),
    ):
        try:
            model = apps.get_model('events', model_name)
        except LookupError:
            continue
        for row in model.objects.all().iterator():
            baked, changed = _bake(getattr(row, field))
            if changed:
                setattr(row, field, baked)
                row.save(update_fields=[field])


def noop_reverse(apps, schema_editor):
    """
    Not reversible in a meaningful sense.

    The baked values are indistinguishable from ones a host chose, so stripping
    them again would throw away real choices along with the defaults.
    """


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0097_customfield'),
    ]

    operations = [
        migrations.RunPython(bake_theme_values, noop_reverse),
    ]
