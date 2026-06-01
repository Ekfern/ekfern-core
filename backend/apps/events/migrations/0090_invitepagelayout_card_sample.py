import django.db.models.deletion
from django.db import migrations, models


def _url_variants(raw):
    """Equivalent string forms for matching a stored layout thumbnail to a card url."""
    u = (raw or '').strip()
    if not u:
        return []
    if len(u) > 2000:
        u = u[:2000]
    variants = {u, u.rstrip('/')}
    if not u.endswith('/'):
        variants.add(u + '/')
    try:
        from urllib.parse import urlparse, urlunparse

        p = urlparse(u)
        if p.scheme == 'https':
            variants.add(urlunparse(('http', p.netloc, p.path, p.params, p.query, p.fragment)))
        elif p.scheme == 'http':
            variants.add(urlunparse(('https', p.netloc, p.path, p.params, p.query, p.fragment)))
    except Exception:
        pass
    return [v for v in variants if v]


def backfill_card_sample(apps, schema_editor):
    InvitePageLayout = apps.get_model('events', 'InvitePageLayout')
    GreetingCardSample = apps.get_model('events', 'GreetingCardSample')

    # Map every known sample background url variant -> sample id for O(1) lookup.
    url_to_sample = {}
    for sample in GreetingCardSample.objects.all().only('id', 'background_image_url'):
        for variant in _url_variants(sample.background_image_url):
            url_to_sample.setdefault(variant, sample.id)

    for layout in InvitePageLayout.objects.filter(card_sample__isnull=True).only('id', 'thumbnail'):
        thumb = (layout.thumbnail or '').strip()
        if not thumb:
            continue
        sample_id = None
        for variant in _url_variants(thumb):
            sample_id = url_to_sample.get(variant)
            if sample_id:
                break
        if sample_id:
            layout.card_sample_id = sample_id
            layout.save(update_fields=['card_sample'])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0089_greetingcardsample_code'),
    ]

    operations = [
        migrations.AddField(
            model_name='invitepagelayout',
            name='card_sample',
            field=models.ForeignKey(
                blank=True,
                help_text='Design this layout was created for. Drives design-based layout filtering.',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='layouts',
                to='events.greetingcardsample',
            ),
        ),
        migrations.RunPython(backfill_card_sample, noop_reverse),
    ]
