import logging

from apps.common.email_backend import send_email

logger = logging.getLogger(__name__)


def send_catalog_response_notification(response):
    """
    Send receipt to guest and alert to host (respects host notification preferences).
    Mirrors the pattern from the legacy send_order_emails().
    """
    item = response.catalog_item
    event = response.event
    host = event.host

    # Guest receipt — skip for external_click (no form submitted)
    if response.response_type != 'external_click' and response.email:
        _send_guest_receipt(response, item, event)

    # Host alert — controlled by gift_received preference
    _send_host_alert(response, item, event, host)


def _send_guest_receipt(response, item, event):
    subject = f'Your response was received — {event.title}'
    body = (
        f'Hi {response.name},\n\n'
        f'Thanks for your response to "{item.title}" on {event.title}.\n\n'
    )
    if response.response_type == 'pledge' and response.amount:
        rupees = response.amount / 100
        body += f'Pledge amount: ₹{rupees:,.0f}\n\n'
    if response.message:
        body += f'Your message: {response.message}\n\n'
    if item.manual_instructions:
        body += f'{item.manual_instructions}\n\n'
    body += 'The host will be in touch soon.\n\nThank you!'
    try:
        send_email(to_email=response.email, subject=subject, body_text=body)
    except Exception as e:
        logger.warning(f'Failed to send catalog response receipt to {response.email}: {e}')


def _send_host_alert(response, item, event, host):
    prefs = getattr(host, 'notification_preferences', None)
    freq = prefs.gift_received if prefs else 'immediately'

    if freq == 'never':
        return

    response_label = dict(response.RESPONSE_TYPE_CHOICES).get(response.response_type, response.response_type)
    subject = f'New catalog response — {event.title}'
    body = (
        f'Hi {host.name or "there"},\n\n'
        f'You have a new catalog response on {event.title}.\n\n'
        f'Item: {item.title}\n'
        f'Response: {response_label}\n'
        f'From: {response.name} ({response.email})\n'
    )
    if response.amount:
        rupees = response.amount / 100
        body += f'Amount: ₹{rupees:,.0f}\n'
    if response.message:
        body += f'Message: {response.message}\n'
    body += '\nLog in to your dashboard to review and follow up.'

    unsubscribe_token = prefs.unsubscribe_token if prefs else None

    if freq == 'immediately':
        try:
            send_email(
                to_email=host.email,
                subject=subject,
                body_text=body,
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
                    'guest_email': response.email,
                    'amount': response.amount,
                },
            )
        except Exception as e:
            logger.warning(f'Failed to queue catalog digest notification: {e}')
