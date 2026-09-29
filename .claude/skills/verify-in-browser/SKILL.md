---
name: verify-in-browser
description: Verify a UI change in the running Ekfern app with Playwright, cheaply. Use whenever a change needs checking in a real browser — layout, responsive behaviour, a host or guest page, "does this look right", "screenshot it", or before moving on to the next PR. Covers signing in without the login form, defeating stale dev-server chunks, and keeping screenshot cost down.
---

# Verifying a change in the running app

The app runs in Docker Compose: frontend on `localhost:3000`, backend on `localhost:8000`.
Containers are usually already up — check with `docker ps` before starting anything.

## Cost comes from pixels, so answer with numbers first

Image tokens scale with the screenshot's dimensions (roughly `pixels ÷ 750`), not its file
size — so format and quality change nothing. Measured on this app:

| What | Pixels | ≈ tokens |
| --- | --- | --- |
| One element (e.g. the bottom nav) 355×70 | 25k | ~35 |
| Phone viewport 390×844 | 329k | ~440 |
| Phone full page 390×1754 | 684k | ~910 |
| Desktop viewport 1440×900 | 1.3M | ~1,590 |

**Ask the question as a measurement whenever the answer is a fact**, and screenshot only when
the question is genuinely visual ("does this look broken/ugly/clipped"). A geometry check is
about forty tokens; the screenshot proving the same thing is four hundred.

```js
// Facts: overflow, position, counts, visibility
await page.evaluate(() => ({
  overflows: document.documentElement.scrollWidth > window.innerWidth + 1,
  footerVisible: (() => { const r = el.getBoundingClientRect(); return r.bottom <= innerHeight; })(),
}))
```

Rules that follow from the table:

- **Screenshot the element, not the page.** `browser_take_screenshot` takes a `target` CSS
  selector; in a script use `page.locator(sel).screenshot({ path })`.
- **Keep `scale: "css"`** (the default). `"device"` doubles dimensions on a 2× display for no
  extra information.
- **Never `fullPage`** unless the question really is about the whole page flow — the Page
  Layout Studio list is over 18,000px tall.
- **Take many, read one.** Writing PNGs to disk is free; only reading one into context costs.
  Capture several states, open the one that answers the question.
- **Batch widths into one call.** One evaluate looping 320/375/390/768/1440 returning a small
  table beats five round trips.
- **Don't re-verify what the test suite covers.** `docker compose exec -T backend python
  manage.py test apps` is cheap. Spend browser time on what only a browser can answer.

## Signing in without the login form

Driving the login form is slow and the session expires mid-run. Mint a token instead and put
it in `localStorage` — the frontend reads `access_token` from there.

```bash
docker compose exec -T backend python manage.py shell -c "
from apps.users.models import User
from rest_framework_simplejwt.tokens import RefreshToken
u = User.objects.get(email='aakashsheth65@gmail.com')
print('TOKEN', str(RefreshToken.for_user(u).access_token))
"
```

```js
await page.goto('http://localhost:3000/host/dashboard', { waitUntil: 'domcontentloaded' })
await page.evaluate((t) => localStorage.setItem('access_token', t), TOKEN)
await page.goto(targetUrl, { waitUntil: 'networkidle' })   // reload so the app picks it up
```

There is also `POST /api/auth/password-login/` (returns `{access, refresh, user}`) if a real
credential flow is wanted. Note `/api/auth/login/` does **not** exist.

**Pick an account that actually has data.** A fresh test user owns no events and proves
nothing. To find one:

```bash
docker compose exec -T backend python manage.py shell -c "
from apps.events.models import Event
from django.db.models import Count
print(Event.objects.values('host__email','host_id').annotate(n=Count('id')).order_by('-n')[:3])
"
```

**Watch for expired events.** `is_expired` events are filed under Expired, not Active — if a
dashboard check comes up empty, check the event's date before assuming a bug.

## Stale chunks will lie to you

The frontend `.next` directory is a named Docker volume, so deleting it on the host does
nothing. Worse, the browser caches JS chunks, so **a fix can look like it failed when the
server is already serving the new code**. This has cost a full debugging cycle before.

When behaviour doesn't match the code you just wrote, check server truth first:

```bash
curl -s 'http://localhost:3000/_next/static/chunks/app/<route>/page.js' | grep -c 'yourNewSymbol'
```

If the server has it and the browser doesn't, bust the cache via CDP:

```js
const cdp = await page.context().newCDPSession(page)
await cdp.send('Network.enable')
await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
```

Do this at the **start** of any verification run that follows a code change.

## If the browser profile is locked

"Browser is already in use" means a leftover Chrome holds the Playwright profile. Do not kill
it unilaterally — it may be a window the user is working in. Identify it
(`pgrep -f mcp-chrome`), then ask.

## Two traps that produced false results

- **Measuring by text.** Icon-only buttons have empty `textContent`, so filtering elements by
  text silently reports zero. Count elements, or query by role/attribute.
- **Clipped measuring rows.** `getBoundingClientRect()` returns unclipped geometry, so an
  element inside an `overflow:hidden` box still looks like it overflows. Trust
  `documentElement.scrollWidth` for whether the page actually scrolls.

## Widths worth checking

`320` (smallest phone) · `390` (iPhone) · `768` (tablet) · `1024` (lg breakpoint, where the
host sidebar and desktop nav appear) · `1440` (laptop, and where the event tabs start
overflowing with the sidebar expanded).

The host shell changes shape at `md` (768) and `lg` (1024), so a responsive change needs at
least one width either side of both.
