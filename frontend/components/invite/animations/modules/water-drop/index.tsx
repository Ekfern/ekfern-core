'use client'

/**
 * Opening module: Water Drop — fogged winter glass.
 *
 * The invite sits behind a cold, condensation-covered pane on a rainy night.
 * Dragging a finger (or cursor) across it wipes the fog the way real glass
 * wipes: the film is erased with irregular brush stamps, the frosted blur
 * behind it is lifted through an SVG mask, and moisture beads up along the
 * edge of the stroke. Once enough glass is clear the rest evaporates.
 *
 * Everything heavy lives on one canvas plus one backdrop-filter element, so
 * there is no per-droplet DOM and nothing is rebuilt inside the frame loop.
 * The mask that lifts the blur is ten pooled <path> nodes (one per stroke
 * width bucket) whose `d` we append to — no node churn, ever.
 */

import React, { useEffect, useId, useRef, useState } from 'react'
import type { OpeningModuleProps } from '@/lib/invite/animations/types'

const STORAGE_KEY_BASE = 'invite_opening:water_drop'

/** Cleared fraction that kicks off the evaporation transition. */
const REVEAL_AT = 0.58
const EVAPORATE_MS = 2000
/** Hard release so a guest who never touches the glass is not trapped. */
const MAX_WAIT_MS = 20000
/** The fog starts thinning on its own well before that, as a hint. */
const SELF_THIN_AT_MS = 11000
/** Coarse occupancy grid used to estimate how much glass is clean. */
const GRID = 36
/** Keeps the backing store sane on large desktop displays. */
const MAX_CANVAS_PX = 4_200_000

const STROKE_BUCKETS = [16, 22, 28, 35, 43, 53, 65, 79, 95, 114]

function storageKey(slug?: string): string {
  return slug ? `${STORAGE_KEY_BASE}:${slug}` : STORAGE_KEY_BASE
}

function hasSeen(slug?: string): boolean {
  try {
    return localStorage.getItem(storageKey(slug)) === 'true'
  } catch {
    return false
  }
}

function markSeen(slug?: string): void {
  try {
    localStorage.setItem(storageKey(slug), 'true')
  } catch {
    // private mode / quota — non-fatal
  }
}

function clearSeen(slug?: string): void {
  try {
    localStorage.removeItem(storageKey(slug))
  } catch {
    // ignore
  }
}

function shouldForceReplay(): boolean {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  return params.get('showAnimation') === 'true' || params.get('replayOpening') === 'true'
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function cssId(raw: string): string {
  return `fgw-${raw.replace(/[^a-zA-Z0-9_-]/g, '')}`
}

type Rand = () => number

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w))
  c.height = Math.max(1, Math.round(h))
  return c
}

/**
 * Smooth multi-octave value noise, rendered small and scaled up later.
 * This is what gives the fog its uneven density instead of a flat wash.
 */
function noiseTexture(w: number, h: number, rand: Rand): HTMLCanvasElement {
  const c = makeCanvas(w, h)
  const g = c.getContext('2d')!
  const img = g.createImageData(c.width, c.height)
  const d = img.data
  const octaves = [5, 11, 23].map((n) => {
    const a = new Float32Array(n * n)
    for (let i = 0; i < a.length; i++) a[i] = rand()
    return { n, a }
  })
  const sample = (o: { n: number; a: Float32Array }, u: number, v: number) => {
    const fx = u * o.n
    const fy = v * o.n
    const x0 = Math.floor(fx) % o.n
    const y0 = Math.floor(fy) % o.n
    const x1 = (x0 + 1) % o.n
    const y1 = (y0 + 1) % o.n
    const tx = fx - Math.floor(fx)
    const ty = fy - Math.floor(fy)
    const sx = tx * tx * (3 - 2 * tx)
    const sy = ty * ty * (3 - 2 * ty)
    const top = o.a[y0 * o.n + x0] + (o.a[y0 * o.n + x1] - o.a[y0 * o.n + x0]) * sx
    const bot = o.a[y1 * o.n + x0] + (o.a[y1 * o.n + x1] - o.a[y1 * o.n + x0]) * sx
    return top + (bot - top) * sy
  }
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const u = x / c.width
      const v = y / c.height
      const n =
        sample(octaves[0], u, v) * 0.58 +
        sample(octaves[1], u, v) * 0.29 +
        sample(octaves[2], u, v) * 0.13
      const i = (y * c.width + x) * 4
      d[i] = 255
      d[i + 1] = 255
      d[i + 2] = 255
      d[i + 3] = Math.max(0, Math.min(255, Math.round(n * 255)))
    }
  }
  g.putImageData(img, 0, 0)
  return c
}

/** A single condensation bead: dark rim, bright specular, light caustic base. */
function beadSprite(px: number, rand: Rand): HTMLCanvasElement {
  const c = makeCanvas(px, px)
  const g = c.getContext('2d')!
  const r = px / 2
  const lobes = 3 + Math.floor(rand() * 3)
  const jit = 0.1 + rand() * 0.22
  const seed = rand() * 10

  g.beginPath()
  const N = 22
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2
    const w =
      r *
      0.92 *
      (1 + jit * (Math.sin(a * lobes + seed) * 0.5 + Math.sin(a * (lobes + 2) + seed * 1.6) * 0.3))
    const x = r + Math.cos(a) * w
    const y = r + Math.sin(a) * w
    if (i) g.lineTo(x, y)
    else g.moveTo(x, y)
  }
  g.closePath()

  const grad = g.createRadialGradient(r * 0.66, r * 0.62, r * 0.05, r, r, r)
  grad.addColorStop(0, 'rgba(255,255,255,0.95)')
  grad.addColorStop(0.2, 'rgba(255,255,255,0.20)')
  grad.addColorStop(0.58, 'rgba(158,186,198,0.10)')
  grad.addColorStop(0.86, 'rgba(22,46,58,0.44)')
  grad.addColorStop(1, 'rgba(240,248,251,0.66)')
  g.fillStyle = grad
  g.fill()

  g.fillStyle = 'rgba(255,255,255,0.95)'
  g.beginPath()
  g.ellipse(r * 0.66, r * 0.6, r * 0.17, r * 0.11, -0.5, 0, Math.PI * 2)
  g.fill()
  return c
}

/** A running droplet: necked at the top, heavy at the base. */
function dropletSprite(px: number, rand: Rand): HTMLCanvasElement {
  const c = makeCanvas(px, px * 1.55)
  const g = c.getContext('2d')!
  const w = px
  const h = px * 1.55
  const seed = rand() * 10
  const jit = 0.08 + rand() * 0.14

  g.beginPath()
  const N = 26
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2
    const taper = 1 - 0.3 * Math.max(0, -Math.sin(a))
    const n = Math.sin(a * 3 + seed) * 0.5 + Math.sin(a * 5 + seed * 1.4) * 0.28
    const rr = (w / 2) * 0.94 * (1 + jit * n) * taper
    const x = w / 2 + Math.cos(a) * rr
    const y = h * 0.62 + Math.sin(a) * rr * 1.5
    if (i) g.lineTo(x, y)
    else g.moveTo(x, y)
  }
  g.closePath()

  const grad = g.createRadialGradient(w * 0.36, h * 0.44, w * 0.04, w * 0.5, h * 0.62, w * 0.78)
  grad.addColorStop(0, 'rgba(255,255,255,0.92)')
  grad.addColorStop(0.22, 'rgba(255,255,255,0.16)')
  grad.addColorStop(0.62, 'rgba(168,196,206,0.08)')
  grad.addColorStop(0.88, 'rgba(18,44,56,0.40)')
  grad.addColorStop(1, 'rgba(244,250,252,0.70)')
  g.fillStyle = grad
  g.fill()

  g.fillStyle = 'rgba(255,255,255,0.97)'
  g.beginPath()
  g.ellipse(w * 0.36, h * 0.4, w * 0.15, w * 0.09, -0.4, 0, Math.PI * 2)
  g.fill()
  return c
}

/**
 * Eraser stamp. A main soft core ringed by offset satellite blobs, so the
 * edge of a wipe is ragged and feathered rather than a clean circle.
 */
function brushSprite(px: number, rand: Rand): HTMLCanvasElement {
  const c = makeCanvas(px, px)
  const g = c.getContext('2d')!
  const r = px / 2

  const core = g.createRadialGradient(r, r, r * 0.12, r, r, r * 0.82)
  core.addColorStop(0, 'rgba(0,0,0,1)')
  core.addColorStop(0.55, 'rgba(0,0,0,0.92)')
  core.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = core
  g.beginPath()
  g.arc(r, r, r * 0.82, 0, Math.PI * 2)
  g.fill()

  const lobes = 7 + Math.floor(rand() * 5)
  for (let i = 0; i < lobes; i++) {
    const a = (i / lobes) * Math.PI * 2 + rand() * 0.6
    const dist = r * (0.42 + rand() * 0.34)
    const rr = r * (0.2 + rand() * 0.26)
    const x = r + Math.cos(a) * dist
    const y = r + Math.sin(a) * dist
    const lg = g.createRadialGradient(x, y, 0, x, y, rr)
    lg.addColorStop(0, `rgba(0,0,0,${(0.5 + rand() * 0.4).toFixed(2)})`)
    lg.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = lg
    g.beginPath()
    g.arc(x, y, rr, 0, Math.PI * 2)
    g.fill()
  }
  return c
}

/** Short, slightly brown noise — white noise alone reads as hiss, not glass. */
function noiseBuffer(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const n = Math.max(1, Math.floor(ctx.sampleRate * seconds))
  const buf = ctx.createBuffer(1, n, ctx.sampleRate)
  const d = buf.getChannelData(0)
  let v = 0
  for (let i = 0; i < n; i++) {
    v = v * 0.7 + (Math.random() * 2 - 1) * 0.3
    const env = decay > 0 ? Math.pow(1 - i / n, decay) : 1
    d[i] = v * env
  }
  return buf
}

/**
 * Scrub audio: a continuous filtered-noise bed whose gain and brightness
 * track cursor speed, plus short randomised grains so repeated strokes never
 * sound identical. Nothing is constructed until the guest actually interacts.
 */
function createScrub() {
  let ctx: AudioContext | null = null
  let bedGain: GainNode | null = null
  let band: BiquadFilterNode | null = null
  let master: GainNode | null = null
  let grains: AudioBuffer[] = []
  let lastGrain = 0
  let dead = false

  const ensure = (): AudioContext | null => {
    if (dead) return null
    if (ctx) return ctx
    const AC: typeof AudioContext | undefined =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    try {
      ctx = new AC()
    } catch {
      dead = true
      return null
    }
    master = ctx.createGain()
    master.gain.value = 1
    master.connect(ctx.destination)

    const bed = ctx.createBufferSource()
    bed.buffer = noiseBuffer(ctx, 2.7, 0)
    bed.loop = true
    band = ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = 1100
    band.Q.value = 0.85
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 5200
    bedGain = ctx.createGain()
    bedGain.gain.value = 0
    bed.connect(band)
    band.connect(lp)
    lp.connect(bedGain)
    bedGain.connect(master)
    bed.start()

    grains = []
    for (let i = 0; i < 5; i++) grains.push(noiseBuffer(ctx, 0.06 + i * 0.022, 2.2 + i * 0.5))
    return ctx
  }

  let woken = false

  return {
    /**
     * Only ever called from a gesture (pointerdown / click / key). A plain
     * pointermove does not count as user activation, so trying there just
     * logs an autoplay warning on every single move.
     */
    wake() {
      if (woken || dead) return
      woken = true
      const c = ensure()
      if (c && c.state === 'suspended') void c.resume()
    },
    speed(px: number, now: number) {
      if (!ctx || ctx.state !== 'running' || !bedGain || !band) return
      const t = ctx.currentTime
      bedGain.gain.setTargetAtTime(Math.min(0.05, px / 2800), t, 0.07)
      band.frequency.setTargetAtTime(900 + Math.min(px, 1900) * 1.15, t, 0.09)
      if (px > 130 && now - lastGrain > 95 + Math.random() * 150 && grains.length) {
        lastGrain = now
        const src = ctx.createBufferSource()
        src.buffer = grains[(Math.random() * grains.length) | 0]
        src.playbackRate.value = 0.8 + Math.random() * 0.7
        const bp = ctx.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.value = 1600 + Math.random() * 2600
        bp.Q.value = 1.4 + Math.random()
        const gg = ctx.createGain()
        gg.gain.value = Math.min(0.03, px / 9000)
        src.connect(bp)
        bp.connect(gg)
        gg.connect(master!)
        src.start()
        src.stop(ctx.currentTime + 0.4)
      }
    },
    hush() {
      if (!ctx || !bedGain) return
      bedGain.gain.setTargetAtTime(0, ctx.currentTime, 0.12)
    },
    dispose() {
      dead = true
      if (ctx) {
        try {
          void ctx.close()
        } catch {
          // already closed
        }
      }
      ctx = null
      bedGain = null
      band = null
      master = null
      grains = []
    },
  }
}

type Droplet = { x: number; y: number; s: number; vy: number; sprite: number; wob: number; life: number }

export default function WaterDropModule({ children, slug, onComplete }: OpeningModuleProps) {
  const [showOverlay, setShowOverlay] = useState(true)
  const completedRef = useRef(false)
  const onCompleteRef = useRef(onComplete)
  const stageRef = useRef<HTMLDivElement>(null)
  const glassRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<HTMLCanvasElement>(null)
  const holesRef = useRef<SVGGElement>(null)

  const rawId = useId()
  const maskId = cssId(rawId)
  const frostId = `${maskId}-frost`
  const roughId = `${maskId}-rough`

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  const finish = (opts?: { persist?: boolean }) => {
    if (completedRef.current) return
    completedRef.current = true
    setShowOverlay(false)
    if (opts?.persist !== false) markSeen(slug)
    onCompleteRef.current()
  }

  useEffect(() => {
    let cancelled = false
    let raf = 0

    const safeFinish = (opts?: { persist?: boolean }) => {
      if (cancelled) return
      finish(opts)
    }

    if (typeof window === 'undefined') {
      safeFinish({ persist: false })
      return
    }

    const previewSlug = typeof slug === 'string' && slug.includes('preview')
    const force = shouldForceReplay() || previewSlug
    if (force) clearSeen(slug)

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      safeFinish()
      return
    }
    if (!force && hasSeen(slug)) {
      safeFinish()
      return
    }

    completedRef.current = false
    setShowOverlay(true)

    const stage = stageRef.current
    const view = viewRef.current
    const holes = holesRef.current
    const glass = glassRef.current
    if (!stage || !view || !holes || !glass) return

    const vctx = view.getContext('2d', { alpha: true })
    if (!vctx) {
      safeFinish()
      return
    }

    const rand = mulberry32(0x6c0d9a)
    const scrub = createScrub()

    // ---- sprites (built once) ----
    const beads = [10, 14, 18, 24, 30].map((p) => beadSprite(p, rand))
    const drips = [22, 28, 36].map((p) => dropletSprite(p, rand))
    const brushes = [0, 1, 2, 3, 4].map(() => brushSprite(128, rand))

    // ---- mask paths: one per stroke-width bucket, appended to forever ----
    // Cleared first: StrictMode and HMR can re-run this effect, and a stale set
    // of paths would keep old wipes cut into the glass.
    while (holes.firstChild) holes.removeChild(holes.firstChild)
    const bucketPaths: SVGPathElement[] = STROKE_BUCKETS.map((w) => {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      p.setAttribute('fill', 'none')
      p.setAttribute('stroke', 'black')
      p.setAttribute('stroke-width', String(w))
      p.setAttribute('stroke-linecap', 'round')
      p.setAttribute('stroke-linejoin', 'round')
      p.setAttribute('d', '')
      holes.appendChild(p)
      return p
    })
    const bucketData: string[] = STROKE_BUCKETS.map(() => '')
    const bucketDirty: boolean[] = STROKE_BUCKETS.map(() => false)
    let lastBucket = -1

    // ---- geometry / fog surface ----
    let W = 0
    let H = 0
    let dpr = 1
    let fog = makeCanvas(1, 1)
    let fctx = fog.getContext('2d')!
    const cells = new Uint8Array(GRID * GRID)
    let cleared = 0
    const droplets: Droplet[] = []

    const buildFog = () => {
      fog = makeCanvas(W * dpr, H * dpr)
      fctx = fog.getContext('2d')!
      fctx.scale(dpr, dpr)

      // Cool winter film, then carve uneven density out of it with noise.
      fctx.fillStyle = 'rgba(223,235,241,0.80)'
      fctx.fillRect(0, 0, W, H)
      const n = noiseTexture(Math.max(24, Math.round(W / 7)), Math.max(24, Math.round(H / 7)), rand)
      fctx.save()
      fctx.globalCompositeOperation = 'destination-out'
      fctx.globalAlpha = 0.34
      fctx.drawImage(n, 0, 0, W, H)
      fctx.restore()
      fctx.save()
      fctx.globalAlpha = 0.16
      fctx.drawImage(n, -W * 0.2, -H * 0.15, W * 1.4, H * 1.3)
      fctx.restore()

      // Dried streaks left from earlier runs down the pane.
      const streaks = 12 + Math.floor(rand() * 8)
      for (let i = 0; i < streaks; i++) {
        const x = rand() * W
        const y0 = rand() * H * 0.5
        const len = H * (0.18 + rand() * 0.5)
        const w = 5 + rand() * 16
        const g = fctx.createLinearGradient(x, y0, x, y0 + len)
        g.addColorStop(0, 'rgba(0,0,0,0)')
        g.addColorStop(0.35, `rgba(0,0,0,${(0.18 + rand() * 0.2).toFixed(2)})`)
        g.addColorStop(1, 'rgba(0,0,0,0)')
        fctx.save()
        fctx.globalCompositeOperation = 'destination-out'
        fctx.fillStyle = g
        fctx.fillRect(x - w / 2, y0, w, len)
        fctx.restore()
      }

      // Fine condensation beads across the whole pane.
      const count = Math.round((W * H) / 900)
      for (let i = 0; i < count; i++) {
        const sp = beads[(rand() * beads.length) | 0]
        const s = 1.6 + rand() * rand() * 9
        fctx.save()
        fctx.translate(rand() * W, rand() * H)
        fctx.rotate(rand() * Math.PI * 2)
        fctx.globalAlpha = 0.5 + rand() * 0.5
        fctx.drawImage(sp, -s / 2, -s / 2, s, s)
        fctx.restore()
      }
    }

    const seedDroplets = () => {
      droplets.length = 0
      const n = Math.round(Math.min(34, (W * H) / 14000))
      for (let i = 0; i < n; i++) {
        droplets.push({
          x: rand() * W,
          y: rand() * H,
          s: 7 + rand() * rand() * 22,
          vy: 3 + rand() * 9,
          sprite: (rand() * drips.length) | 0,
          wob: rand() * Math.PI * 2,
          life: 0,
        })
      }
    }

    const fit = () => {
      W = stage.clientWidth || window.innerWidth
      H = stage.clientHeight || window.innerHeight
      dpr = Math.max(1, Math.min(2, Math.sqrt(MAX_CANVAS_PX / Math.max(W * H, 1))))
      view.width = Math.round(W * dpr)
      view.height = Math.round(H * dpr)
      view.style.width = `${W}px`
      view.style.height = `${H}px`
      vctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      buildFog()
      seedDroplets()
    }

    fit()

    // ---- wiping ----
    const markCells = (x: number, y: number, r: number) => {
      const c0 = Math.max(0, Math.floor(((x - r) / W) * GRID))
      const c1 = Math.min(GRID - 1, Math.floor(((x + r) / W) * GRID))
      const r0 = Math.max(0, Math.floor(((y - r) / H) * GRID))
      const r1 = Math.min(GRID - 1, Math.floor(((y + r) / H) * GRID))
      for (let b = r0; b <= r1; b++) {
        for (let a = c0; a <= c1; a++) {
          const i = b * GRID + a
          if (!cells[i]) {
            cells[i] = 1
            cleared++
          }
        }
      }
    }

    const pushStroke = (x: number, y: number, r: number, jump: boolean) => {
      const want = r * 1.9
      let bi = 0
      for (let i = 0; i < STROKE_BUCKETS.length; i++) {
        if (Math.abs(STROKE_BUCKETS[i] - want) < Math.abs(STROKE_BUCKETS[bi] - want)) bi = i
      }
      const pt = `${x.toFixed(1)} ${y.toFixed(1)}`
      // A bucket change or a lifted finger has to start a fresh sub-path.
      if (bi !== lastBucket || jump || !bucketData[bi]) bucketData[bi] += `M${pt}`
      else bucketData[bi] += `L${pt}`
      bucketDirty[bi] = true
      lastBucket = bi
    }

    const flushStrokes = () => {
      for (let i = 0; i < bucketPaths.length; i++) {
        if (!bucketDirty[i]) continue
        bucketDirty[i] = false
        bucketPaths[i].setAttribute('d', bucketData[i])
      }
    }

    const stamp = (x: number, y: number, r: number) => {
      const sp = brushes[(Math.random() * brushes.length) | 0]
      const s = r * 2 * (0.86 + Math.random() * 0.3)
      fctx.save()
      fctx.globalCompositeOperation = 'destination-out'
      fctx.translate(x, y)
      fctx.rotate(Math.random() * Math.PI * 2)
      fctx.globalAlpha = 0.72 + Math.random() * 0.28
      fctx.drawImage(sp, -s / 2, -s / 2, s, s)
      fctx.restore()
      markCells(x, y, r)

      // Moisture pushed to the rim of the stroke, the way a finger leaves it.
      if (Math.random() < 0.3) {
        const a = Math.random() * Math.PI * 2
        const d = r * (0.85 + Math.random() * 0.3)
        const bs = 1.6 + Math.random() * 5
        fctx.save()
        fctx.translate(x + Math.cos(a) * d, y + Math.sin(a) * d)
        fctx.rotate(Math.random() * Math.PI * 2)
        fctx.globalAlpha = 0.55 + Math.random() * 0.4
        fctx.drawImage(beads[(Math.random() * beads.length) | 0], -bs / 2, -bs / 2, bs, bs)
        fctx.restore()
      }
    }

    /** Smear a little condensation back along the trailing edge of the wipe. */
    const smear = (x: number, y: number, dx: number, dy: number, r: number) => {
      const len = Math.hypot(dx, dy) || 1
      fctx.save()
      fctx.globalAlpha = 0.1
      fctx.translate(x - (dx / len) * r * 0.7, y - (dy / len) * r * 0.7)
      fctx.rotate(Math.atan2(dy, dx))
      fctx.fillStyle = 'rgba(223,235,241,0.9)'
      fctx.beginPath()
      fctx.ellipse(0, 0, r * 0.75, r * 0.3, 0, 0, Math.PI * 2)
      fctx.fill()
      fctx.restore()
    }

    let px = 0
    let py = 0
    let pt = 0
    let drawing = false
    let lastBuzz = 0
    let idleTimer = 0

    const wipeTo = (x: number, y: number, now: number, touch: boolean) => {
      const dt = Math.max(now - pt, 1)
      const dx = x - px
      const dy = y - py
      const dist = Math.hypot(dx, dy)
      const speed = (dist / dt) * 1000

      // Slow, deliberate contact clears wider — a fast swipe only grazes.
      const base = touch ? 30 : 24
      const r = Math.max(14, Math.min(touch ? 46 : 38, base + 16 - speed * 0.011))

      if (!drawing || dist > 260) {
        drawing = true
        stamp(x, y, r)
        pushStroke(x, y, r, true)
      } else {
        // Interpolate so a fast drag leaves a continuous path, never a dotted one.
        const step = Math.max(2.5, r * 0.3)
        const n = Math.max(1, Math.ceil(dist / step))
        for (let i = 1; i <= n; i++) {
          const t = i / n
          stamp(px + dx * t, py + dy * t, r)
        }
        smear(x, y, dx, dy, r)
        pushStroke(x, y, r, false)
      }
      flushStrokes()

      scrub.speed(speed, now)
      if (touch && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        if (now - lastBuzz > 140) {
          lastBuzz = now
          try {
            navigator.vibrate(5)
          } catch {
            // unsupported / blocked — cosmetic only
          }
        }
      }

      px = x
      py = y
      pt = now
      window.clearTimeout(idleTimer)
      idleTimer = window.setTimeout(() => scrub.hush(), 110)
    }

    const onPointer = (event: PointerEvent) => {
      if (cancelled || completedRef.current || evaporating) return
      const target = event.target
      if (target instanceof Element && target.closest('.fgw-skip')) return
      const box = stage.getBoundingClientRect()
      const x = event.clientX - box.left
      const y = event.clientY - box.top
      if (x < 0 || y < 0 || x > box.width || y > box.height) {
        drawing = false
        scrub.hush()
        return
      }
      if (event.type === 'pointerdown') {
        scrub.wake()
        drawing = false
        px = x
        py = y
        pt = performance.now()
      }
      wipeTo(x, y, performance.now(), event.pointerType === 'touch')
    }

    const endStroke = () => {
      drawing = false
      scrub.hush()
    }

    // ---- frame loop ----
    const started = performance.now()
    let last = started
    let evaporating = false
    let evapFrom = 0
    let fade = 1

    const frame = (now: number) => {
      if (cancelled) return
      const dt = Math.min(0.034, (now - last) / 1000)
      last = now

      for (const d of droplets) {
        d.life += dt
        d.wob += dt * 1.6
        d.y += d.vy * dt * (1 + d.s * 0.02)
        d.x += Math.sin(d.wob) * 5 * dt
        if (d.y - d.s > H) {
          d.y = -d.s * 2
          d.x = Math.random() * W
          d.s = 7 + Math.random() * Math.random() * 22
          d.vy = 3 + Math.random() * 9
        }
      }

      vctx.clearRect(0, 0, W, H)
      vctx.save()
      vctx.globalAlpha = fade
      vctx.drawImage(fog, 0, 0, W, H)
      for (const d of droplets) {
        const sp = drips[d.sprite]
        const h = d.s * 1.55
        vctx.save()
        vctx.globalAlpha = fade * 0.92
        vctx.translate(d.x, d.y)
        vctx.drawImage(sp, -d.s / 2, -h / 2, d.s, h)
        vctx.restore()
      }
      vctx.restore()

      const frac = cleared / (GRID * GRID)
      const elapsed = now - started

      // A guest who never touches the glass still gets in: the film thins on
      // its own, then releases outright.
      if (!evaporating && elapsed > SELF_THIN_AT_MS) {
        fade = Math.max(0.35, 1 - (elapsed - SELF_THIN_AT_MS) / (MAX_WAIT_MS - SELF_THIN_AT_MS))
        glass.style.opacity = String(fade)
      }

      if (!evaporating && (frac >= REVEAL_AT || elapsed >= MAX_WAIT_MS)) {
        evaporating = true
        evapFrom = now
        scrub.hush()
        stage.dataset.done = 'true'
      }

      if (evaporating) {
        const k = Math.min(1, (now - evapFrom) / EVAPORATE_MS)
        // ease-out so the last of the condensation lingers, then goes
        fade = (1 - k) * (1 - k)
        glass.style.opacity = String(fade)
        if (k >= 1) {
          safeFinish()
          return
        }
      }

      raf = window.requestAnimationFrame(frame)
    }

    const onResize = () => {
      if (cancelled || evaporating) return
      fit()
    }

    const onGesture = () => scrub.wake()
    window.addEventListener('click', onGesture, { passive: true })
    window.addEventListener('keydown', onGesture, { passive: true })
    window.addEventListener('touchstart', onGesture, { passive: true })
    window.addEventListener('pointermove', onPointer, { passive: true })
    window.addEventListener('pointerdown', onPointer, { passive: true })
    window.addEventListener('pointerup', endStroke)
    window.addEventListener('pointercancel', endStroke)
    window.addEventListener('resize', onResize)
    raf = window.requestAnimationFrame(frame)

    return () => {
      cancelled = true
      window.cancelAnimationFrame(raf)
      window.clearTimeout(idleTimer)
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('pointerup', endStroke)
      window.removeEventListener('pointercancel', endStroke)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('click', onGesture)
      window.removeEventListener('keydown', onGesture)
      window.removeEventListener('touchstart', onGesture)
      // The mask paths were appended imperatively; a re-run would double them.
      for (const p of bucketPaths) p.remove()
      scrub.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, maskId, frostId, roughId])

  const contentInteractive = !showOverlay

  return (
    <>
      <style>{`
        .fgw-root {
          position: relative;
          border-radius: inherit;
          min-height: 100%;
          display: flex;
          flex-direction: column;
          flex: 1 1 0%;
        }
        .fgw-content {
          display: flex;
          flex-direction: column;
          flex: 1 1 0%;
          min-height: 0;
        }
        .fgw-content[data-locked="true"] { pointer-events: none; }
        .fgw-stage {
          position: fixed;
          inset: 0;
          z-index: 9999;
          /* Rounded so the fog never paints over the preview's bezel corners. */
          border-radius: inherit;
          overflow: hidden;
          cursor: crosshair;
          touch-action: none;
        }
        .fgw-stage[data-done="true"] { cursor: default; }
        .fgw-glass {
          position: absolute;
          inset: 0;
          backdrop-filter: blur(14px) saturate(0.74) brightness(1.05) url(#${frostId});
          -webkit-backdrop-filter: blur(14px) saturate(0.74) brightness(1.05) url(#${frostId});
          background:
            radial-gradient(130% 100% at 50% 0%, rgba(255,255,255,0.20), rgba(188,206,218,0.10) 60%, rgba(150,172,188,0.16)),
            linear-gradient(200deg, rgba(214,230,240,0.20), rgba(196,214,226,0.08));
          -webkit-mask-image: url(#${maskId});
          mask-image: url(#${maskId});
          -webkit-mask-repeat: no-repeat;
          mask-repeat: no-repeat;
        }
        .fgw-canvas {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }
        .fgw-skip {
          position: absolute;
          top: max(1rem, env(safe-area-inset-top));
          right: max(1rem, env(safe-area-inset-right));
          z-index: 3;
          background: rgba(255, 255, 255, 0.92);
          padding: 0.5rem 1rem;
          border-radius: 9999px;
          font-size: 0.875rem;
          color: #374151;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
          border: 1px solid #e5e7eb;
          cursor: pointer;
        }
      `}</style>

      <div className="fgw-root" data-opening="water_drop">
        <div className="fgw-content" data-locked={contentInteractive ? 'false' : 'true'}>
          {children}
        </div>

        {showOverlay && (
          <div ref={stageRef} className="fgw-stage">
            <svg aria-hidden style={{ position: 'absolute', width: 0, height: 0 }}>
              <defs>
                {/* Refractive graininess so the pane reads as frosted glass, not a blur. */}
                <filter id={frostId} x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
                  <feTurbulence type="fractalNoise" baseFrequency="0.014 0.023" numOctaves="3" seed="11" result="n" />
                  <feDisplacementMap in="SourceGraphic" in2="n" scale="16" xChannelSelector="R" yChannelSelector="G" />
                </filter>
                {/* Roughens the wipe path so its edge is organic, not a clean sweep. */}
                <filter id={roughId} x="-25%" y="-25%" width="150%" height="150%" colorInterpolationFilters="sRGB">
                  <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="5" result="r" />
                  <feDisplacementMap in="SourceGraphic" in2="r" scale="11" xChannelSelector="R" yChannelSelector="G" result="d" />
                  <feGaussianBlur in="d" stdDeviation="2.4" />
                </filter>
                {/* Pixel user space. White keeps the glass up; the wipe paths cut through it. */}
                <mask
                  id={maskId}
                  maskUnits="userSpaceOnUse"
                  maskContentUnits="userSpaceOnUse"
                  x="0"
                  y="0"
                  width="9000"
                  height="9000"
                >
                  <rect x="0" y="0" width="9000" height="9000" fill="white" />
                  <g ref={holesRef} filter={`url(#${roughId})`} />
                </mask>
              </defs>
            </svg>

            <div ref={glassRef} className="fgw-glass" aria-hidden />
            <canvas ref={viewRef} className="fgw-canvas" aria-hidden />

            <button
              type="button"
              className="fgw-skip"
              onClick={(event) => {
                event.stopPropagation()
                finish()
              }}
            >
              Skip
            </button>
          </div>
        )}
      </div>
    </>
  )
}
