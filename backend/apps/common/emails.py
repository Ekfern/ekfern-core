"""
Every email Ekfern sends, in one catalogue.

Each function takes plain values and returns a RenderedEmail (subject, text,
HTML) built from the blocks in email_layout, so all of them share one look
and one voice: a small grey eyebrow, the thing that matters as the headline,
details in a tinted panel, at most one button, and reassurance in the fine
print. None of them send anything; callers pass the result to send_email.

Campaign emails are not here: those carry the host's own message.
"""
from datetime import date

from .email_layout import (
    RenderedEmail,
    button,
    checklist,
    code,
    details,
    eyebrow,
    headline,
    message,
    note,
    paragraph,
    render_email,
    subhead,
)


def format_long_date(value) -> str:
    """"Saturday, October 10, 2026", or '' when there is no date."""
    if not isinstance(value, date):
        return ''
    return f"{value.strftime('%A, %B')} {value.day}, {value.year}"


def rupees(paise) -> str:
    """Stored amounts are paise; people read rupees."""
    if paise in (None, ''):
        return ''
    try:
        return f'₹{int(paise) / 100:,.0f}'
    except (TypeError, ValueError):
        return ''


def _hello(first_name: str) -> str:
    return f'Hi {first_name}' if first_name else 'Hi there'


# --- Account ------------------------------------------------------------------

def sign_in_code(*, first_name: str, otp: str, login_url: str, minutes: int = 15) -> RenderedEmail:
    return render_email(
        subject='Your Ekfern verification code',
        preheader=f'Your code is {otp}. It expires in {minutes} minutes.',
        blocks=[
            eyebrow(_hello(first_name)),
            headline('Your verification code'),
            paragraph('Enter this code to continue signing in to Ekfern.'),
            code(otp),
            note(f"It expires in {minutes} minutes. Don't share it with anyone."),
            button('Open verification page', login_url),
        ],
        fine_print="If you didn't try to sign in, you can ignore this email. Nobody can sign in without this code.",
        fallback_url=login_url,
    )


def password_reset(*, first_name: str, reset_url: str, minutes: int = 15) -> RenderedEmail:
    return render_email(
        subject='Reset your Ekfern password',
        preheader=f'Use this link within {minutes} minutes to choose a new password.',
        blocks=[
            eyebrow(_hello(first_name)),
            headline('Reset your password'),
            paragraph('We received a request to reset the password for your Ekfern account.'),
            button('Choose a new password', reset_url, note=f'This link expires in {minutes} minutes.'),
        ],
        fine_print="If you didn't ask to reset your password, you can ignore this email. Your password stays the same.",
        fallback_url=reset_url,
    )


# --- Co-hosts -----------------------------------------------------------------

#: What each capability lets a co-host do, in the words the invite uses.
COHOST_CAPABILITY_PHRASES = [
    ('manage_guests', 'Manage the guest list'),
    ('send_messages', 'Send messages to guests'),
    ('edit_invitation', 'Edit the invitation and event details'),
    ('edit_rsvp', 'Set up RSVPs'),
    ('edit_catalog', 'Manage the gift catalog'),
]
COHOST_INVITE_EXPIRY_DAYS = 7


def cohost_invite(
    *, inviter: str, event_title: str, event_date=None, invited_email: str, capabilities, link: str
) -> RenderedEmail:
    granted = [phrase for cap, phrase in COHOST_CAPABILITY_PHRASES if cap in (capabilities or [])]
    when = format_long_date(event_date)
    return render_email(
        subject=f'{inviter} invited you to co-host {event_title}',
        preheader=f'{inviter} would like your help running {event_title}.',
        blocks=[
            eyebrow("You're invited to co-host"),
            headline(event_title),
            *([subhead(when)] if when else []),
            paragraph('would like your help running this event on Ekfern.', lead=inviter),
            checklist('As a co-host, you can', granted),
            button(
                'Review invite',
                link,
                note=f'Accept within {COHOST_INVITE_EXPIRY_DAYS} days, signed in as {invited_email}.',
            ),
        ],
        fine_print="If you weren't expecting this, you can ignore this email. Nothing changes unless you accept.",
        fallback_url=link,
        sent_for=inviter,
    )


def cohost_accepted(
    *, cohost_name: str, cohost_email: str, event_title: str, cohosts_url: str
) -> RenderedEmail:
    """To the owner, when an invited co-host accepts."""
    who = cohost_name or cohost_email
    return render_email(
        subject=f'{who} is now a co-host – {event_title}',
        preheader=f'{who} accepted your co-host invite.',
        blocks=[
            eyebrow('Co-host accepted'),
            headline(event_title),
            paragraph('accepted your invite and can now help run this event.', lead=who),
            details([('Email', cohost_email)]),
            button('Manage co-hosts', cohosts_url),
        ],
    )


def cohost_declined(
    *, cohost_email: str, event_title: str, cohosts_url: str
) -> RenderedEmail:
    """
    To the owner, when an invited co-host declines.

    Names the email rather than a person: a declined invite never linked an
    account, so there is no name to use.
    """
    return render_email(
        subject=f'Co-host invite declined – {event_title}',
        preheader=f'{cohost_email} declined your co-host invite.',
        blocks=[
            eyebrow('Co-host declined'),
            headline(event_title),
            paragraph('declined your co-host invite.', lead=cohost_email),
            paragraph('You can invite someone else whenever you like.'),
            button('Manage co-hosts', cohosts_url),
        ],
    )


def cohost_invite_reminder(
    *, cohost_email: str, event_title: str, expires_label: str, cohosts_url: str
) -> RenderedEmail:
    """
    To the owner, when an invite is still unanswered and about to expire.

    Goes to the owner rather than the invitee: it is the owner who decides
    whether to chase them or invite someone else.
    """
    return render_email(
        subject=f'Co-host invite still unanswered – {event_title}',
        preheader=f'{cohost_email} has not responded yet.',
        blocks=[
            eyebrow('Awaiting a response'),
            headline(event_title),
            paragraph('has not responded to your co-host invite yet.', lead=cohost_email),
            details([('Invite expires', expires_label)]),
            paragraph(
                'If the link expires you can remove the pending invite and send a new one.'
            ),
            button('Manage co-hosts', cohosts_url),
        ],
    )


# --- Event lifecycle (apps/events/lifecycle.py) ---------------------------------

def event_ended_next_steps(
    *, event_title: str, gifts_until: str, link_until: str, overview_url: str
) -> RenderedEmail:
    """
    To the host, the day after the event: what guests now see, and when each
    part closes. Sent once. The dates are told now so nothing later surprises.
    """
    rows = [('RSVPs', 'Closed')]
    if gifts_until:
        rows.append(('Gifts open until', gifts_until))
    if link_until:
        rows.append(('Invite link works until', link_until))
    return render_email(
        subject=f'Your event has ended – here is what happens next ({event_title})',
        preheader='Guests can still read your invitation. Here is when each part closes.',
        blocks=[
            eyebrow('After the event'),
            headline(event_title),
            paragraph('Your invitation now tells guests the event has ended. They can still read it.'),
            details(rows),
            paragraph('You can close gifts early, or reopen them, from the event overview.'),
            button('Open event overview', overview_url),
        ],
    )


def event_gifts_closing(*, event_title: str, gifts_until: str, overview_url: str) -> RenderedEmail:
    """To the host, a week before gifts close on their own."""
    return render_email(
        subject=f'Gifts close on {gifts_until} – {event_title}',
        preheader='After that, guests can still see the list but cannot give.',
        blocks=[
            eyebrow('Gifts closing soon'),
            headline(event_title),
            details([('Gifts open until', gifts_until)]),
            paragraph('After that, guests can still see your list and what they gave, but cannot give.'),
            button('Open event overview', overview_url),
        ],
    )


def event_link_closing(*, event_title: str, link_until: str, overview_url: str) -> RenderedEmail:
    """
    To the host, before their invite link stops working. The link cannot go
    off until this has been sent and the notice period has passed.
    """
    return render_email(
        subject=f'Your invite link stops working on {link_until} – {event_title}',
        preheader='Guests opening it after that will see it is no longer available.',
        blocks=[
            eyebrow('Invite link closing'),
            headline(event_title),
            details([('Link works until', link_until)]),
            paragraph(
                'After that, anyone opening your invitation will see it is no longer available. '
                'Your guest list, RSVPs and gift record stay in your account.'
            ),
            paragraph('Need it longer? Reply to this email and we will help.'),
            button('Open event overview', overview_url),
        ],
    )


# --- RSVPs --------------------------------------------------------------------

ATTEND_FOR_GUEST = {'yes': 'attending', 'no': 'not attending', 'maybe': 'tentatively attending'}
ATTEND_FOR_HOST = {'yes': 'Attending', 'no': 'Not attending', 'maybe': 'Maybe'}


def rsvp_confirmation(
    *, guest_name: str, event_title: str, event_date=None, will_attend: str, host_name: str = ''
) -> RenderedEmail:
    """To the guest, confirming what they told the host."""
    status = ATTEND_FOR_GUEST.get(will_attend, will_attend or '')
    when = format_long_date(event_date)
    closing = 'See you there!' if will_attend in ('yes', 'maybe') else 'Thanks for letting the host know.'
    return render_email(
        subject=f'RSVP confirmed – {event_title}',
        preheader=f"You're marked as {status}.",
        blocks=[
            eyebrow('RSVP received'),
            headline(event_title),
            *([subhead(when)] if when else []),
            paragraph(f"Thanks, {guest_name or 'there'}. You're marked as {status}. {closing}"),
        ],
        sent_for=host_name,
    )


def rsvp_alert(
    *,
    event_title: str,
    guest_name: str,
    will_attend: str,
    guests_count: int,
    guest_email: str = '',
    rsvps_url: str,
) -> RenderedEmail:
    """To the host and subscribed co-hosts."""
    who = guest_name or 'Someone'
    return render_email(
        subject=f'New RSVP – {event_title}',
        preheader=f"{who} RSVP'd: {ATTEND_FOR_HOST.get(will_attend, will_attend)}.",
        blocks=[
            eyebrow('New RSVP'),
            headline(event_title),
            paragraph("has RSVP'd.", lead=who),
            details([
                ('Status', ATTEND_FOR_HOST.get(will_attend, will_attend)),
                ('Guests', guests_count or 1),
                ('Email', guest_email),
            ]),
            button('View all RSVPs', rsvps_url),
        ],
    )


# --- Catalog ------------------------------------------------------------------

def catalog_receipt(
    *,
    guest_name: str,
    item_title: str,
    event_title: str,
    amount_paise=None,
    guest_message: str = '',
    instructions: str = '',
    host_name: str = '',
) -> RenderedEmail:
    """To the guest who responded."""
    return render_email(
        subject=f'Your response was received — {event_title}',
        preheader=f'Thanks for your response to "{item_title}".',
        blocks=[
            eyebrow('Response received'),
            headline(event_title),
            paragraph(f'Thanks, {guest_name or "there"}. We passed your response to "{item_title}" on to the host.'),
            details([('Pledge', rupees(amount_paise))]),
            message(guest_message, heading='Your message'),
            message(instructions, heading='From the host'),
            paragraph('The host will be in touch soon.'),
        ],
        sent_for=host_name,
    )


def catalog_alert(
    *,
    event_title: str,
    item_title: str,
    response_label: str,
    guest_name: str,
    guest_contact: str,
    amount_paise=None,
    guest_message: str = '',
    responses_url: str,
) -> RenderedEmail:
    """To the host and subscribed co-hosts."""
    return render_email(
        subject=f'New catalog response — {event_title}',
        preheader=f'{guest_name or "A guest"} responded to "{item_title}".',
        blocks=[
            eyebrow('New catalog response'),
            headline(event_title),
            details([
                ('Item', item_title),
                ('Response', response_label),
                ('From', guest_name),
                ('Contact', guest_contact or 'No contact given'),
                ('Amount', rupees(amount_paise)),
            ]),
            message(guest_message, heading='Message'),
            button('Review responses', responses_url),
        ],
    )


# --- Digests ------------------------------------------------------------------

def host_digest(*, first_name: str, date_label: str, rsvp_lines, gift_lines, dashboard_url: str) -> RenderedEmail:
    """The daily summary for hosts who chose digest over instant emails."""
    parts = []
    if rsvp_lines:
        parts.append(f'{len(rsvp_lines)} RSVP{"s" if len(rsvp_lines) != 1 else ""}')
    if gift_lines:
        parts.append(f'{len(gift_lines)} catalog response{"s" if len(gift_lines) != 1 else ""}')
    summary = ' and '.join(parts) or 'No new activity'
    return render_email(
        subject=f'Your Ekfern daily digest – {date_label}',
        preheader=f'{summary} on your events.',
        blocks=[
            eyebrow(f'Daily digest · {date_label}'),
            headline(_hello(first_name)),
            paragraph(f"Here's what happened on your events: {summary}."),
            checklist(f'New RSVPs ({len(rsvp_lines)})', rsvp_lines, mark='dot'),
            checklist(f'Catalog responses ({len(gift_lines)})', gift_lines, mark='dot'),
            button('Open your dashboard', dashboard_url),
        ],
    )


# --- Staff and operations -------------------------------------------------------

def staff_business_digest(*, date_label: str, today_rows, all_time_rows, admin_url: str) -> RenderedEmail:
    return render_email(
        subject=f'Ekfern business digest – {date_label}',
        preheader='Signups, events, RSVPs and revenue for today.',
        blocks=[
            eyebrow('Business digest'),
            headline(date_label),
            details(today_rows, heading='Today'),
            details(all_time_rows, heading='All time'),
            button('Open admin', admin_url),
        ],
    )


def staff_signup_alert(*, name: str, email: str, joined: str, admin_url: str) -> RenderedEmail:
    return render_email(
        subject=f'New signup: {email}',
        preheader='A new user just signed up on Ekfern.',
        blocks=[
            eyebrow('New signup'),
            headline(email),
            details([('Name', name or 'Not set'), ('Email', email), ('Joined', joined)]),
            button('View in admin', admin_url),
        ],
    )


def contact_form_message(*, name: str, email: str, subject: str, body: str) -> RenderedEmail:
    """A visitor's contact-form message, forwarded to the support inbox."""
    return render_email(
        subject=f'Contact form: {subject}' if subject else 'Contact form message',
        preheader=f'{name or email} wrote in through the contact form.',
        blocks=[
            eyebrow('Contact form'),
            headline(subject or 'New message'),
            details([('From', name or 'Not given'), ('Email', email)]),
            message(body, heading='Message'),
            button(f'Reply to {name or email}', f'mailto:{email}'),
        ],
    )


def ops_alert(*, title: str, subject: str, rows, advice: str) -> RenderedEmail:
    """An operational alert: what crossed a line, and what to do about it."""
    return render_email(
        subject=subject,
        preheader=title,
        blocks=[
            eyebrow('Operations alert'),
            headline(title),
            details(rows),
            paragraph(advice),
        ],
    )
