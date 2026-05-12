# Generated manually for LLMPlatformSettings singleton

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('events', '0077_llmusageledger'),
    ]

    operations = [
        migrations.CreateModel(
            name='LLMPlatformSettings',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                (
                    'generation_enabled',
                    models.BooleanField(
                        default=False,
                        help_text='Master switch for LLM generation (Page Layout Auto-Generator, etc.).',
                    ),
                ),
                (
                    'cost_alert_email',
                    models.EmailField(
                        blank=True,
                        help_text='Recipient for cost threshold and kill-switch alert emails.',
                        max_length=254,
                    ),
                ),
                (
                    'daily_cost_cap_usd',
                    models.DecimalField(
                        decimal_places=2,
                        default='5.00',
                        help_text='Global daily spend cap in USD (ledger-based, all users).',
                        max_digits=12,
                    ),
                ),
                (
                    'monthly_cost_cap_usd',
                    models.DecimalField(
                        decimal_places=2,
                        default='50.00',
                        help_text='Global monthly spend cap in USD (ledger-based, all users).',
                        max_digits=12,
                    ),
                ),
                (
                    'image_fetch_allowed_hosts',
                    models.TextField(
                        blank=True,
                        help_text='Comma-separated host allowlist for server-side image fetches '
                        '(*.suffix patterns allowed). Leave blank to use '
                        'LLM_IMAGE_FETCH_ALLOWED_HOSTS from the environment.',
                    ),
                ),
                (
                    'image_fetch_allow_private',
                    models.BooleanField(
                        default=False,
                        help_text='Allow private/loopback DNS targets for image fetches. '
                        'Local development only — keep False in staging and production.',
                    ),
                ),
                ('updated_at', models.DateTimeField(auto_now=True)),
                (
                    'updated_by',
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name='+',
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                'verbose_name': 'LLM Platform Settings',
                'verbose_name_plural': 'LLM Platform Settings',
                'db_table': 'llm_platform_settings',
            },
        ),
    ]
