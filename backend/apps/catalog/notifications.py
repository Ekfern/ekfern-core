import logging

from apps.common import emails
from apps.common.email_backend import send_email

logger = logging.getLogger(__name__)


def send_catalog_response_notification(response):
    """
    Send receipt to guest and alert to the host and subscribed co-hosts
    (each respects their own notification preferences).
    Mirrors the pattern from the legacy send_order_emails().
    """
    item = response.catalog_item
    event = response.event

    # Guest receipt — skip for external_click (no form submitted)
    if response.response_type != 'external_click' and response.email:
        _send_guest_receipt(response, item, event)

    # Host alerts: the owner plus co-hosts who have catalog emails on, each
    # controlled by their own gift_received preference.
    from apps.events.capabilities import NOTIFY_CATALOG_RESPONSE
    from apps.events.recipients import notification_recipients
    for recipient in notification_recipients(event, NOTIFY_CATALOG_RESPONSE):
        try:
            _send_host_alert(response, item, event, recipient)
        except Exception as e:
            logger.warning(f'Catalog alert failed for user {recipient.id}: {e}')


def _send_guest_receipt(response, item, event):
    rendered = emails.catalog_receipt(
        guest_name=response.name or '',
        item_title=item.title,
        event_title=event.title,
        amount_paise=response.amount if response.response_type == 'pledge' else None,
        guest_message=response.message or '',
        instructions=item.manual_instructions or '',
        host_name=event.host.name or '',
    )
    try:
        send_email(
            to_email=response.email, subject=rendered.subject,
            body_text=rendered.text, body_html=rendered.html,
        )
    except Exception as e:
        logger.warning(f'Failed to send catalog response receipt to {response.email}: {e}')


def _send_host_alert(response, item, event, host):
    prefs = getattr(host, 'notification_preferences', None)
    freq = prefs.gift_received if prefs else 'immediately'

    if freq == 'never':
        return

    from django.conf import settings

    rendered = emails.catalog_alert(
        event_title=event.title,
        item_title=item.title,
        response_label=dict(response.RESPONSE_TYPE_CHOICES).get(response.response_type, response.response_type),
        guest_name=response.name or '',
        guest_contact=response.phone or response.email or '',
        amount_paise=response.amount,
        guest_message=response.message or '',
        responses_url=f"{getattr(settings, 'FRONTEND_ORIGIN', 'https://ekfern.com')}/host/events/{event.id}/catalog/responses",
    )

    unsubscribe_token = prefs.unsubscribe_token if prefs else None

    if freq == 'immediately':
        try:
            send_email(
                to_email=host.email,
                subject=rendered.subject,
                body_text=rendered.text,
                body_html=rendered.html,
                unsubscribe_token=unsubscribe_token,
            )
        except Exception as e:
            logger.warning(f'Failed to send host catalog alert to {host.email}: {e}')

    elif freq == 'daily_digest':
        try:
            from apps.notifications.models import NotificationQueue
            NotificationQueue.objects.create(
                user=host,
                notification_type='gift_received',
                payload_json={
                    'event_id': event.id,
                    'event_title': event.title,
                    'item_title': item.title,
                    'response_type': response.response_type,
                    'guest_name': response.name,
                    'guest_phone': response.phone,
                    'guest_email': response.email,
                    'amount': response.amount,
                },
            )
        except Exception as e:
            logger.warning(f'Failed to queue catalog digest notification: {e}')
