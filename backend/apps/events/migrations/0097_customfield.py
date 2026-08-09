"""
Promote custom fields from a JSON blob on Event to their own table.

Event.custom_fields_metadata stays, but becomes a read cache rebuilt from these
rows. Existing keys are carried over verbatim -- they are referenced by RSVP
form config, invite/WhatsApp template variables, saved guest-list filters, and
every guest's answers, none of which this migration touches.
"""
from django.db import migrations, models
import django.db.models.deletion


def forwards(apps, schema_editor):
    """Copy each event's custom_fields_metadata into CustomField rows."""
    Event = apps.get_model('events', 'Event')
    CustomField = apps.get_model('events', 'CustomField')

    rows = []
    for event in Event.objects.exclude(custom_fields_metadata={}).exclude(
        custom_fields_metadata__isnull=True
    ).iterator():
        meta = event.custom_fields_metadata
        if not isinstance(meta, dict):
            continue
        for key, value in meta.items():
            if not key:
                continue
            # Tolerate the legacy shape where the value was just a label string.
            if isinstance(value, dict):
                label = str(value.get('display_label') or key)[:80]
                example = str(value.get('example') or '')[:120]
                active = bool(value.get('active', True))
            else:
                label = (str(value) if value else str(key))[:80]
                example = ''
                active = True
            rows.append(CustomField(
                event_id=event.id,
                key=str(key)[:50],
                label=label,
                example=example,
                active=active,
            ))

    CustomField.objects.bulk_create(rows, batch_size=500, ignore_conflicts=True)


def backwards(apps, schema_editor):
    """
    Rebuild the blob from rows so a rollback keeps the read cache correct.
    Dropping the table is handled by the schema operation.
    """
    Event = apps.get_model('events', 'Event')
    CustomField = apps.get_model('events', 'CustomField')

    by_event = {}
    for f in CustomField.objects.all().iterator():
        by_event.setdefault(f.event_id, {})[f.key] = {
            'display_label': f.label,
            'example': f.example or '',
            'active': f.active,
        }
    for event_id, meta in by_event.items():
        Event.objects.filter(id=event_id).update(custom_fields_metadata=meta)


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0096_alter_event_data_region'),
    ]

    operations = [
        migrations.CreateModel(
            name='CustomField',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('key', models.CharField(help_text='Immutable system-generated slug. Referenced by RSVP form config, template variables, and guest answers.', max_length=50)),
                ('label', models.CharField(help_text='Host-facing name. Freely editable.', max_length=80)),
                ('example', models.CharField(blank=True, default='', max_length=120)),
                ('active', models.BooleanField(default=True, help_text='Inactive fields stay in the data but are hidden from pickers.')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('event', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='custom_fields', to='events.event')),
            ],
            options={
                'db_table': 'event_custom_fields',
                'ordering': ['label'],
            },
        ),
        migrations.AddConstraint(
            model_name='customfield',
            constraint=models.UniqueConstraint(fields=('event', 'key'), name='uniq_custom_field_per_event'),
        ),
        migrations.AlterField(
            model_name='event',
            name='custom_fields_metadata',
            field=models.JSONField(blank=True, default=dict, help_text='Read cache of CustomField rows: key -> {display_label, example, active}. Source of truth is the CustomField table.'),
        ),
        migrations.RunPython(forwards, backwards),
    ]
