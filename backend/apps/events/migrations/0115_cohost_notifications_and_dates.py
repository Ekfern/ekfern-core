from django.db import migrations, models
from django.db.models import F


# Literal copies, not imports: a migration must keep meaning what it meant
# when it was written, whatever capabilities.py says later.
NOTIFICATIONS_AT_THIS_MIGRATION = ['catalog_response', 'rsvp_new']


def backfill(apps, schema_editor):
    EventCoHost = apps.get_model('events', 'EventCoHost')
    # Notifications are on by default for co-hosts, including the ones who
    # joined before the setting existed.
    EventCoHost.objects.update(notifications=NOTIFICATIONS_AT_THIS_MIGRATION)
    # Nothing recorded when these happened; the last update is the best
    # available answer, since nothing else changes a finished invite.
    EventCoHost.objects.filter(status='left', left_at__isnull=True).update(left_at=F('updated_at'))
    EventCoHost.objects.filter(status='declined', declined_at__isnull=True).update(declined_at=F('updated_at'))


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0114_letter_balloons_animation'),
    ]

    operations = [
        migrations.AddField(
            model_name='eventcohost',
            name='declined_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='eventcohost',
            name='left_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='eventcohost',
            name='notifications',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
