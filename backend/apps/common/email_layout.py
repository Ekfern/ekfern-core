"""
The one look every Ekfern email shares.

An email is a list of blocks - headline, paragraph, checklist, details, code,
button - rendered into a single layout: a soft grey page, a white rounded card,
the system font (San Francisco on Apple devices), one pill button in the brand
green, and a quiet footer. Each block renders itself twice, as HTML and as
plain text, so the two parts of a message always say the same thing.

Rules the blocks enforce so no email has to remember them:
- Every string is HTML-escaped here. Callers pass plain text, never markup.
- Table layout and inline styles, because that is what email clients render.
- Apple Mail and iOS Mail get a dark version via prefers-color-scheme;
  clients that strip <style> keep the inline light design.
"""
from dataclasses import dataclass
from html import escape

BRAND_GREEN = '#0B3D2E'
#: The brand green for dark backgrounds: the wordmark, ticks and top edge.
BRAND_GREEN_ON_DARK = '#63D3A5'
#: A button green that still reads on a near-black card, with white text at
#: over 4.5:1 contrast. #0B3D2E itself nearly disappears on #1C1C1E.
BUTTON_GREEN_ON_DARK = '#1F7A5A'
INK = '#1D1D1F'
MUTED = '#6E6E73'
PAGE = '#F5F5F7'
HAIRLINE = '#E5E5EA'

#: Where send_email puts notification-settings and unsubscribe links when the
#: message carries an unsubscribe token, so no HTML email can ship without them.
UNSUBSCRIBE_SLOT = '<!--ekfern:unsubscribe-->'

FONT = (
    "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, "
    "'Helvetica Neue', Arial, sans-serif"
)
MONO = "'SF Mono', ui-monospace, Menlo, Consolas, monospace"


@dataclass(frozen=True)
class Block:
    html: str
    text: str


@dataclass(frozen=True)
class RenderedEmail:
    subject: str
    text: str
    html: str


def _row(inner: str, *, top: int, align: str = 'center') -> str:
    return (
        f'<tr><td align="{align}" style="padding:{top}px 40px 0 40px;" class="pad">'
        f'{inner}</td></tr>'
    )


# --- Blocks -------------------------------------------------------------------

def eyebrow(text: str) -> Block:
    """The small grey line above a headline: "You're invited to co-host"."""
    return Block(
        html=_row(
            f'<p style="margin:0;font-family:{FONT};font-size:15px;line-height:20px;'
            f'color:{MUTED};" class="muted">{escape(text)}</p>',
            top=48,
        ),
        text=text,
    )


def headline(text: str, *, first: bool = False) -> Block:
    return Block(
        html=_row(
            f'<h1 style="margin:0;font-family:{FONT};font-size:32px;line-height:38px;'
            f'font-weight:700;letter-spacing:-0.02em;color:{INK};" class="ink hero">'
            f'{escape(text)}</h1>',
            top=48 if first else 12,
        ),
        text=text,
    )


def subhead(text: str) -> Block:
    """A grey line under the headline, such as the event date."""
    return Block(
        html=_row(
            f'<p style="margin:0;font-family:{FONT};font-size:17px;line-height:24px;'
            f'color:{MUTED};" class="muted">{escape(text)}</p>',
            top=10,
        ),
        text=text,
    )


def paragraph(text: str, *, lead: str = '') -> Block:
    """Body copy. ``lead`` is set in bold before the text: "Priya would like…"."""
    bold = f'<strong>{escape(lead)}</strong> ' if lead else ''
    return Block(
        html=_row(
            f'<p style="margin:0;font-family:{FONT};font-size:17px;line-height:26px;'
            f'color:{INK};" class="ink">{bold}{escape(text)}</p>',
            top=20,
        ),
        text=f'{lead} {text}' if lead else text,
    )


def _well(inner: str) -> str:
    return _row(
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" '
        f'style="background:{PAGE};border-radius:14px;" class="well"><tr>'
        f'<td align="left" style="padding:20px 24px;">{inner}</td></tr></table>',
        top=28,
    )


def _well_heading(text: str) -> str:
    return (
        f'<p style="margin:0 0 8px 0;font-family:{FONT};font-size:12px;line-height:16px;'
        f'font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:{MUTED};" '
        f'class="muted">{escape(text)}</p>'
    )


def checklist(heading: str, items, *, mark: str = 'check') -> Block:
    """
    A tinted panel of lines. ``mark='check'`` ticks each one (what a co-host
    can do); ``mark='dot'`` is a plain list (a digest's RSVPs).
    """
    items = [i for i in items if i]
    if not items:
        return Block(html='', text='')
    glyph = '&#10003;' if mark == 'check' else '&#8226;'
    rows = ''.join(
        f'<tr><td valign="top" width="26" style="padding:6px 0;font-family:{FONT};'
        f'font-size:15px;line-height:22px;color:{BRAND_GREEN};" class="accent">{glyph}</td>'
        f'<td style="padding:6px 0;font-family:{FONT};font-size:15px;line-height:22px;'
        f'color:{INK};" class="ink">{escape(i)}</td></tr>'
        for i in items
    )
    return Block(
        html=_well(
            _well_heading(heading)
            + f'<table role="presentation" cellpadding="0" cellspacing="0" border="0">{rows}</table>'
        ),
        text='\n'.join([f'{heading}:', *[f'  - {i}' for i in items]]),
    )


def details(rows, heading: str = '') -> Block:
    """Label / value pairs in a tinted panel: an RSVP's status, guests, email."""
    rows = [(label, value) for label, value in rows if value not in (None, '')]
    if not rows:
        return Block(html='', text='')
    body = ''.join(
        f'<tr><td valign="top" style="padding:6px 16px 6px 0;font-family:{FONT};font-size:15px;'
        f'line-height:22px;color:{MUTED};white-space:nowrap;" class="muted">{escape(str(label))}</td>'
        f'<td style="padding:6px 0;font-family:{FONT};font-size:15px;line-height:22px;'
        f'color:{INK};word-break:break-word;" class="ink">{escape(str(value))}</td></tr>'
        for label, value in rows
    )
    return Block(
        html=_well(
            (_well_heading(heading) if heading else '')
            + f'<table role="presentation" cellpadding="0" cellspacing="0" border="0">{body}</table>'
        ),
        text='\n'.join(
            ([f'{heading}:'] if heading else []) + [f'{label}: {value}' for label, value in rows]
        ),
    )


def message(text: str, *, heading: str = '') -> Block:
    """
    Someone's own words - a guest's note, a contact-form message - in a tinted
    panel, keeping their line breaks.
    """
    text = (text or '').strip()
    if not text:
        return Block(html='', text='')
    body = escape(text).replace('\r\n', '\n').replace('\n', '<br>')
    return Block(
        html=_well(
            (_well_heading(heading) if heading else '')
            + f'<p style="margin:0;font-family:{FONT};font-size:15px;line-height:22px;'
            f'color:{INK};" class="ink">{body}</p>'
        ),
        text=f'{heading}:\n{text}' if heading else text,
    )


def code(value: str) -> Block:
    """A one-time code, large and spaced so it is easy to read and copy."""
    return Block(
        html=_row(
            f'<table role="presentation" cellpadding="0" cellspacing="0" border="0" '
            f'style="background:{PAGE};border-radius:14px;" class="well"><tr>'
            f'<td align="center" style="padding:18px 32px;font-family:{MONO};font-size:34px;'
            f'line-height:40px;font-weight:600;letter-spacing:0.3em;color:{INK};" class="ink">'
            f'{escape(value)}</td></tr></table>',
            top=28,
        ),
        text=value,
    )


def button(label: str, url: str, *, note: str = '') -> Block:
    """The single call to action: a pill in the brand green."""
    href = escape(url, quote=True)
    note_html = (
        f'<p style="margin:16px 0 0 0;font-family:{FONT};font-size:13px;line-height:18px;'
        f'color:{MUTED};" class="muted">{escape(note)}</p>'
        if note
        else ''
    )
    return Block(
        html=_row(
            f'<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>'
            f'<td align="center" style="background:{BRAND_GREEN};border-radius:980px;" class="btn">'
            f'<a href="{href}" target="_blank" style="display:inline-block;padding:14px 32px;'
            f'font-family:{FONT};font-size:17px;line-height:22px;font-weight:600;color:#FFFFFF;'
            f'text-decoration:none;border-radius:980px;">{escape(label)}</a></td></tr></table>'
            f'{note_html}',
            top=36,
        ),
        text='\n'.join([f'{label}: {url}', *([note] if note else [])]),
    )


def note(text: str) -> Block:
    """Small grey copy inside the card, such as an expiry or a reassurance."""
    return Block(
        html=_row(
            f'<p style="margin:0;font-family:{FONT};font-size:13px;line-height:19px;'
            f'color:{MUTED};" class="muted">{escape(text)}</p>',
            top=16,
        ),
        text=text,
    )


# --- Layout -------------------------------------------------------------------

def unsubscribe_html(settings_url: str, unsubscribe_url: str) -> str:
    """The links send_email drops into UNSUBSCRIBE_SLOT."""
    link = f'color:#86868B;text-decoration:underline;'
    return (
        f'<tr><td align="center" style="padding:8px 24px 0 24px;font-family:{FONT};font-size:12px;'
        f'line-height:16px;color:#86868B;" class="muted">'
        f'<a href="{escape(settings_url, quote=True)}" style="{link}" class="muted">Notification settings</a>'
        f' &nbsp;·&nbsp; '
        f'<a href="{escape(unsubscribe_url, quote=True)}" style="{link}" class="muted">Unsubscribe from marketing emails</a>'
        f'</td></tr>'
    )


def render_email(
    *,
    subject: str,
    preheader: str,
    blocks,
    fine_print: str = '',
    fallback_url: str = '',
    sent_for: str = '',
) -> RenderedEmail:
    """
    Wrap blocks in the shared layout.

    ``fine_print`` sits under a hairline at the foot of the card;
    ``fallback_url`` adds "Button not working?" with the raw link;
    ``sent_for`` names who the message is sent on behalf of, under the card.
    """
    blocks = [b for b in blocks if b.html or b.text]

    foot_parts = []
    if fine_print:
        foot_parts.append(escape(fine_print))
    if fallback_url:
        href = escape(fallback_url, quote=True)
        foot_parts.append(
            'Button not working? Paste this link into your browser:<br>'
            f'<a href="{href}" style="color:{MUTED};word-break:break-all;" class="muted">{href}</a>'
        )
    foot = (
        f'<tr><td style="padding:40px 40px 0 40px;" class="pad">'
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>'
        f'<td style="border-top:1px solid {HAIRLINE};padding-top:24px;font-family:{FONT};'
        f'font-size:13px;line-height:19px;color:{MUTED};" class="muted rule">'
        f'{"<br><br>".join(foot_parts)}</td></tr></table></td></tr>'
        if foot_parts
        else ''
    )
    below = (
        f'<tr><td align="center" style="padding:24px 24px 0 24px;font-family:{FONT};font-size:12px;'
        f'line-height:16px;color:#86868B;" class="muted">Sent by Ekfern on behalf of {escape(sent_for)}.</td></tr>'
        if sent_for
        else f'<tr><td align="center" style="padding:24px 24px 0 24px;font-family:{FONT};font-size:12px;'
        f'line-height:16px;color:#86868B;" class="muted">Ekfern</td></tr>'
    )

    html = f"""<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>{escape(subject)}</title>
<style>
  @media (max-width: 600px) {{
    .card {{ border-radius: 0 !important; }}
    .pad {{ padding-left: 24px !important; padding-right: 24px !important; }}
    .hero {{ font-size: 28px !important; line-height: 34px !important; }}
  }}
  @media (prefers-color-scheme: dark) {{
    .page {{ background: #000000 !important; }}
    .card {{ background: #1C1C1E !important; border-top-color: {BRAND_GREEN_ON_DARK} !important; }}
    .brand {{ color: {BRAND_GREEN_ON_DARK} !important; }}
    .well {{ background: #2C2C2E !important; }}
    .ink {{ color: #F5F5F7 !important; }}
    .muted {{ color: #98989D !important; }}
    .accent {{ color: {BRAND_GREEN_ON_DARK} !important; }}
    .btn {{ background: {BUTTON_GREEN_ON_DARK} !important; }}
    .btn a {{ color: #FFFFFF !important; }}
    .rule {{ border-top-color: #38383A !important; }}
  }}
</style>
</head>
<body style="margin:0;padding:0;background:{PAGE};" class="page">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">{escape(preheader)}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:{PAGE};" class="page">
<tr><td align="center" style="padding:40px 0;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">
<tr><td align="center" style="padding:0 0 24px 0;font-family:{FONT};font-size:17px;line-height:22px;font-weight:700;letter-spacing:-0.01em;color:{BRAND_GREEN};" class="brand">Ekfern</td></tr>
<tr><td style="background:#FFFFFF;border-radius:20px;border-top:4px solid {BRAND_GREEN};" class="card">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
{''.join(b.html for b in blocks)}
{foot}
<tr><td style="padding:0 0 40px 0;line-height:0;font-size:0;">&nbsp;</td></tr>
</table>
</td></tr>
{below}
{UNSUBSCRIBE_SLOT}
</table>
</td></tr>
</table>
</body>
</html>"""

    text_parts = [b.text for b in blocks if b.text]
    if fine_print:
        text_parts.append(fine_print)
    text = '\n\n'.join(text_parts) + '\n\n— Ekfern'
    return RenderedEmail(subject=subject, text=text, html=html)
