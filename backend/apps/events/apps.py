from django.apps import AppConfig
import logging

logger = logging.getLogger(__name__)


class EventsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.events'
    
    def ready(self):
        """Auto-schedule analytics batch processing on app startup"""
        # Only schedule in production or when explicitly enabled
        # In development, you can manually run: python manage.py schedule_analytics_batch
        import os
        from django.conf import settings
        
        # Check if auto-scheduling is enabled (default: True in production, False in development)
        auto_schedule = os.environ.get('AUTO_SCHEDULE_ANALYTICS_BATCH', 'False') == 'True'
        
        if auto_schedule:
            try:
                from background_task.models import Task
                from apps.events.tasks import scheduled_batch_processing
                
                # Check if already scheduled
                existing = Task.objects.filter(
                    task_name__contains='scheduled_batch_processing'
                ).exists()
                
                if not existing:
                    batch_interval = getattr(settings, 'ANALYTICS_BATCH_INTERVAL_MINUTES', 30)
                    initial_delay_seconds = getattr(settings, 'ANALYTICS_BATCH_INITIAL_DELAY_SECONDS', 10)
                    
                    # Schedule first run quickly so scheduler liveness is easy to verify.
                    scheduled_batch_processing(schedule=initial_delay_seconds)
                    logger.info(
                        f"Scheduled analytics batch processing every {batch_interval} minutes "
                        f"(first run in {initial_delay_seconds}s)"
                    )
                else:
                    logger.debug("Analytics batch processing already scheduled")
                    
            except ImportError:
                logger.warning("background_task not available, skipping auto-scheduling")
            except Exception as e:
                logger.error(f"Failed to auto-schedule analytics batch processing: {str(e)}")
        else:
            logger.debug("Auto-scheduling disabled. Run 'python manage.py schedule_analytics_batch' manually.")

        # Auto-schedule the page-layout draft cleanup. Defaults to OFF so it's
        # impossible to accidentally enable in dev without setting an env var,
        # but staging/prod task definitions should set this True.
        auto_schedule_cleanup = os.environ.get(
            'AUTO_SCHEDULE_LAYOUT_CLEANUP', 'False'
        ) == 'True'
        if auto_schedule_cleanup:
            try:
                from background_task.models import Task as _CleanupTask
                from apps.events.tasks import cleanup_layout_drafts_task

                existing = _CleanupTask.objects.filter(
                    task_name__contains='cleanup_layout_drafts_task'
                ).exists()
                if not existing:
                    days = int(os.environ.get('LAYOUT_DRAFT_CLEANUP_DAYS', '30'))
                    interval_seconds = int(
                        os.environ.get('LAYOUT_DRAFT_CLEANUP_INTERVAL_SECONDS', str(24 * 3600))
                    )
                    initial_delay = int(
                        os.environ.get('LAYOUT_DRAFT_CLEANUP_INITIAL_DELAY_SECONDS', '60')
                    )
                    cleanup_layout_drafts_task(
                        days=days,
                        repeat_seconds=interval_seconds,
                        schedule=initial_delay,
                    )
                    logger.info(
                        "Scheduled cleanup_layout_drafts_task days=%s interval=%ss "
                        "(first run in %ss)",
                        days, interval_seconds, initial_delay,
                    )
                else:
                    logger.debug("cleanup_layout_drafts_task already scheduled")
            except ImportError:
                logger.warning(
                    "background_task not available; skipping layout-cleanup auto-schedule"
                )
            except Exception:
                logger.exception("Failed to auto-schedule cleanup_layout_drafts_task")

