from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0084_event_rsvp_require_sub_event_selection'),
    ]

    operations = [
        migrations.AddField(
            model_name='invitepage',
            name='published_config',
            field=models.JSONField(
                blank=True,
                default=None,
                null=True,
                help_text='Live snapshot served to guests. Copied from config on publish; null until first publish.',
            ),
        ),
        migrations.AddField(
            model_name='invitepage',
            name='published_at',
            field=models.DateTimeField(
                blank=True,
                null=True,
                help_text='Timestamp of the last publish. Retained when pulled back so guests see a Coming Soon page.',
            ),
        ),
        migrations.AlterField(
            model_name='invitepage',
            name='config',
            field=models.JSONField(
                default=dict,
                help_text='Draft invite configuration (edited in the page editor, auto-saved)',
            ),
        ),
    ]
