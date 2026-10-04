/**
 * Pure logic for the Letter Balloons experience: balloon layout and the tap
 * rules. Kept out of the module so it can be unit-tested without a DOM.
 *
 * The tap boundary: the overlay never takes pointer events, so the invite
 * underneath always receives the tap first. A balloon is let go only when the
 * tap landed on open space — never when it hit a link, button or form field.
 */

export const BALLOON_LETTERS = ['अ', 'आ', 'इ', 'ई', 'उ', 'क', 'ख', 'ग', 'म'] as const

export type BalloonPalette = {
  body: string
  shade: string
  ink: string
}

export const BALLOON_PALETTES: readonly BalloonPalette[] = [
  { body: '#FFD447', shade: '#E9B415', ink: '#6E4300' },
  { body: '#6EC6FF', shade: '#3FA4E6', ink: '#0C3A66' },
  { body: '#7EDDB9', shade: '#4DBF96', ink: '#0E5540' },
  { body: '#FF9A82', shade: '#EE7659', ink: '#6A1C0E' },
  { body: '#BBA6FF', shade: '#977DF2', ink: '#2D1A78' },
] as const

/** Balloon SVG is 60×104; the body is the top 68 units, centred at y=36. */
export const BALLOON_ASPECT = 104 / 60
export const BALLOON_BODY_CENTER_Y = 36 / 104
export const BALLOON_KNOT_Y = 70 / 104
export const BALLOON_LETTER_BASELINE_Y = 44 / 104
export const BALLOON_LETTER_SIZE = 25 / 60

export type BalloonConfig = {
  id: number
  /** Horizontal position as % of the overlay width. */
  left: number
  /** Balloon width in px. */
  size: number
  duration: number
  delay: number
  sway: number
  drift: number
  tiltStart: number
  tiltEnd: number
  bobDuration: number
  opacity: number
  /** 0–1 fraction of the overlay height where the balloon rests when motion is reduced. */
  rest: number
  palette: BalloonPalette
  letter: string
  /** True for the few small balloons allowed to cross the reading column. */
  center: boolean
}

/** Tiny deterministic PRNG so hydration stays stable while paths feel irregular. */
export function mulberry32(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

export function buildBalloons(count: number, seed = 0x6d61726b): BalloonConfig[] {
  const rand = mulberry32(seed)

  return Array.from({ length: count }, (_, i) => {
    const r = () => rand()
    const depth = r()
    const lane = r()
    // Most balloons ride the edges; only lanes 0.4–0.6 cross the middle, and smaller.
    const center = lane >= 0.4 && lane < 0.6
    const left = center ? 34 + r() * 26 : lane < 0.4 ? r() * 20 - 5 : 80 + r() * 18
    const size = center ? 30 + depth * 12 : 38 + depth * 26
    const duration = 16 + (1 - depth) * 9 + r() * 4
    const delay = -(((i + r() * 0.5) / count) * duration)
    const sway = (14 + r() * 30) * (r() < 0.5 ? -1 : 1)
    const drift = (10 + r() * 36) * (r() < 0.5 ? -1 : 1)
    const tiltStart = r() * 10 - 5
    const tiltEnd = tiltStart + (r() * 12 - 6)

    return {
      id: i,
      left,
      size,
      duration,
      delay,
      sway,
      drift,
      tiltStart,
      tiltEnd,
      bobDuration: 2.6 + r() * 2,
      opacity: center ? 0.78 : 0.85 + depth * 0.15,
      rest: r() * 0.85,
      palette: BALLOON_PALETTES[i % BALLOON_PALETTES.length],
      letter: BALLOON_LETTERS[i % BALLOON_LETTERS.length],
      center,
    }
  })
}

/** Anything a guest taps on purpose. A tap here must never be taken by a balloon. */
export const INTERACTIVE_SELECTOR =
  'a, button, input, textarea, select, label, summary, [role="button"], [role="link"], [contenteditable="true"]'

type ClosestCapable = { closest: (selector: string) => unknown }

export function isInteractiveTarget(target: unknown): boolean {
  if (!target || typeof (target as ClosestCapable).closest !== 'function') return false
  return (target as ClosestCapable).closest(INTERACTIVE_SELECTOR) != null
}

type Rect = { left: number; top: number; width: number; height: number }

/**
 * Whether a tap at (x, y) hits the balloon drawn in `rect` (its full box,
 * string included). The hit area is the body ellipse, slightly enlarged so a
 * child's finger does not have to be precise; the string does not count.
 */
export function isPointInBalloon(x: number, y: number, rect: Rect): boolean {
  if (rect.width <= 0 || rect.height <= 0) return false
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height * BALLOON_BODY_CENTER_Y
  const rx = rect.width * 0.55
  const ry = rect.height * 0.36
  const nx = (x - cx) / rx
  const ny = (y - cy) / ry
  return nx * nx + ny * ny <= 1
}
