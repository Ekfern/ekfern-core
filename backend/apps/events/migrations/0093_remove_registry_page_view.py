from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0092_deprecate_has_registry'),
    ]

    operations = [
        migrations.DeleteModel(
            name='RegistryPageView',
        ),
    ]
