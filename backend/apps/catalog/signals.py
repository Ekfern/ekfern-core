import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.events.models import Event

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Event)
def create_host_catalog_on_event_create(sender, instance, created, **kwargs):
    if not created:
        return
    from apps.catalog.models import HostCatalog
    try:
        HostCatalog.objects.get_or_create(
            event=instance,
            defaults={'is_enabled': instance.has_registry},
        )
    except Exception as e:
        logger.warning(f'Failed to auto-create HostCatalog for event {instance.id}: {e}')
