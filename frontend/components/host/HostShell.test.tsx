// @vitest-environment jsdom
import React, { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Clicking between host pages builds each page once.
 *
 * The shell used to wrap every page in a fade keyed on the path
 * (AnimatePresence mode="wait"). The incoming page then rendered inside the
 * outgoing wrapper and again when the fade finished, so each click showed the
 * page, a blank "Loading...", and the page again, and fetched its data twice.
 * It was blamed on other causes twice before anyone found it. This fails if a
 * page transition that rebuilds the page ever comes back.
 */

let pathname = '/host/events/1'

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, prefetch: _prefetch, ...rest }: any) => <a href={String(href)} {...rest}>{children}</a>,
}))
vi.mock('@/lib/api', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: { id: 1, title: 'Event', has_rsvp: true, has_registry: true } })) },
}))

// jsdom has no matchMedia; the shell reads breakpoints from it.
beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: true, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  })) as any
  ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
})

const mounts: Record<string, number> = {}

/**
 * Stands in for the slot Next.js passes as `children`: an element that reads
 * the current route and renders that page, as Next's layout router does. That
 * is what made the fade rebuild pages - a wrapper still fading out held this
 * slot, so it showed the *new* page too.
 */
const RouteContext = React.createContext('')
function RouteSlot() {
  const route = React.useContext(RouteContext)
  const name = route.split('/').pop() || 'overview'
  return <Page key={name} name={name === '1' ? 'overview' : name} />
}

/** A page that counts how many times it is built - the thing a fetch-on-mount page pays for. */
function Page({ name }: { name: string }) {
  useEffect(() => {
    mounts[name] = (mounts[name] ?? 0) + 1
  }, [name])
  return <p data-page={name}>{name}</p>
}

let root: Root
let container: HTMLDivElement

afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
  for (const key of Object.keys(mounts)) delete mounts[key]
})

async function render(ui: React.ReactElement) {
  await act(async () => {
    root.render(ui)
  })
  // Long enough for any exit/enter transition to finish.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 400))
  })
}

describe('HostShell navigation', () => {
  it('builds each page once when moving between pages', async () => {
    const { default: HostShell } = await import('./HostShell')
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    const at = async (path: string) => {
      pathname = path
      await render(
        <RouteContext.Provider value={path}>
          <HostShell><RouteSlot /></HostShell>
        </RouteContext.Provider>,
      )
    }
    await at('/host/events/1')
    await at('/host/events/1/guests')
    await at('/host/events/1/rsvp')

    expect(mounts).toEqual({ overview: 1, guests: 1, rsvp: 1 })
    // Exactly one page on screen - never the outgoing and incoming together.
    expect(container.querySelectorAll('[data-page]')).toHaveLength(1)
    expect(container.querySelector('[data-page]')?.textContent).toBe('rsvp')
  })
})
