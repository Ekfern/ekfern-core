'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

/**
 * Publish the size of the surface a tile is actually being shown on.
 *
 * `svh` and `vw` always mean the browser window, which is wrong inside the
 * editor's phone mockup: a tile sized that way comes out proportioned for the
 * window inside a much smaller frame, so the preview promises something the
 * invitation does not deliver. The nearest scrollport is the honest measure -
 * the window on a real invitation, the mockup in a preview.
 *
 * Published as custom properties so tiles can stay in CSS, with `100svh` and
 * `100vw` as the fallback for server-rendered markup and the first paint. The
 * measurement is also returned, for the few things that need a real number
 * rather than a CSS length - the map has to size its tile grid in pixels.
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
export const INVITE_MEDIA_MAX_WIDTH = `min(420px, calc(${INVITE_VIEWPORT_W} * 0.82))`

export interface InviteViewportSize {
  height: number
  width: number
}

export function useInviteViewport(ref: RefObject<HTMLElement>) {
  const [size, setSize] = useState<InviteViewportSize | null>(null)
  // `measure` is called from the gallery's scroll driver, once per animation
  // frame. Committing state on every one of those would re-render the tile
  // sixty times a second, so the value is only published when it changes.
  const lastRef = useRef<InviteViewportSize | null>(null)

  const measure = useCallback(() => {
    const element = ref.current
    if (!element) return
    let node = element.parentElement
    let height = 0
    let width = 0
    while (node) {
      const style = getComputedStyle(node)
      if (['auto', 'scroll'].includes(style.overflowY) && node.clientHeight > 0) {
        height = node.clientHeight
        width = node.clientWidth
        break
      }
      node = node.parentElement
    }
    if (!height) {
      height = window.innerHeight
      width = window.innerWidth
    }
    element.style.setProperty('--invite-viewport', `${height}px`)
    element.style.setProperty('--invite-viewport-w', `${width}px`)

    const last = lastRef.current
    if (!last || last.height !== height || last.width !== width) {
      lastRef.current = { height, width }
      setSize({ height, width })
    }
  }, [ref])

  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  })

  return { size, measure }
}
