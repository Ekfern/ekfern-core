# Generated manually for llm_module_access user flag.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0005_add_password_reset_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='llm_module_access',
            field=models.BooleanField(
                'LLM module access',
                default=False,
                help_text='Allow Page Layout Auto-Generator and related LLM APIs (in addition to superusers).',
            ),
        ),
    ]
