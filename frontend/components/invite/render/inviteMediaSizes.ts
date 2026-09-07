/**
 * The lengths an invitation's media is measured in.
 *
 * Plain module, deliberately: `useInviteViewport` is `'use client'`, and Next
 * turns every export of a client module into a client reference, so a server
 * component importing one of these strings would receive a reference object
 * rather than a CSS length. `PosterTileSSR` needs the same numbers as its
 * client twin, so they live where both can read them.
 */

export const INVITE_VIEWPORT_H = 'var(--invite-viewport, 100svh)'
export const INVITE_VIEWPORT_W = 'var(--invite-viewport-w, 100vw)'

/**
 * The widest any piece of media sits on an invitation.
 *
 * One rule, shared: photographs and the map are the same kind of thing to a
 * reader, and a map running edge to edge beside a photo that stops well short
 * of it reads as two designs rather than one.
 */
export const INVITE_MEDIA_MAX_WIDTH = `min(480px, calc(${INVITE_VIEWPORT_W} * 0.82))`

/**
 * The poster is allowed to be the largest thing on the page - it is the hero -
 * but larger within the same family, not in a different unit.
 *
 * It used to cap at `max-w-4xl` (896px) against the 420px every other piece of
 * media obeyed: more than twice the width, which is why the poster read as
 * belonging to a different design rather than as the loudest member of this
 * one. Paired with a fixed portrait aspect it was also 1120px tall on a 900px
 * screen, so the hero of the invitation was the one thing a guest could never
 * see whole.
 *
 * The height cap is what makes it fit a device rather than a width. A print
 * has to fit the screen it is shown on, in both directions.
 */
export const INVITE_HERO_MAX_WIDTH = `min(100%, 1200px, calc(${INVITE_VIEWPORT_W} * 0.92))`

/**
 * The height budget is what actually sizes the poster; the width cap only stops
 * it running away on a very wide window.
 *
 * Capping the width first was the earlier mistake. A width cap sizes a portrait
 * print generously and a landscape one meanly - the same 640px gave a 4:5 card
 * 800px of height and a 3:2 photograph only 416px, so a landscape poster came
 * out looking like a thumbnail on a page it was supposed to open. Presence is
 * vertical: how much of the first screen the print occupies. Budget that, and
 * a tall picture and a wide one carry the same weight.
 */
/**
 * The band the scroll cue sits in: `ScrollIndicator` is `fixed bottom-8` (32px)
 * with an `h-6` (24px) chevron, so it paints over the last 56px of the screen.
 * Subtracting it is what keeps the cue off the picture.
 */
const INVITE_SCROLL_CUE_BAND = '56px'

/**
 * How tall the print may be: whatever is left of the screen once the page's own
 * spacing, its frame and its scroll cue have taken their share.
 *
 * Every term here is measured or published rather than chosen, because the one
 * fraction that would have to be chosen - "the hero takes N% of the fold" - can
 * only be argued from what follows the poster, and that is the host's tile
 * order, not ours. What is true whatever the order is that a print has to fit
 * the screen it is shown on with the page's own breathing room around it.
 *
 * It falls out that a spacious page gives its hero less room and a tight page
 * more. That is those settings meaning what they say, not a number to tune.
 *
 * Two gaps are subtracted though a poster in first position only has one below
 * it: position is not reliably knowable here, so this takes the pessimistic
 * case and is at most one gap conservative.
 *
 * The 900px ceiling is the one deliberate constant - a print stops reading as a
 * document past it, however large the screen gets.
 */
export const INVITE_HERO_MAX_HEIGHT =
  `min(900px, calc(${INVITE_VIEWPORT_H} - 2 * var(--space-section, 2rem) - var(--page-mat, 0px) - ${INVITE_SCROLL_CUE_BAND}))`
