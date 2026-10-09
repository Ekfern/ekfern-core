import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Tab switches never run a view transition; going deeper or back does.
 *
 * A transition between tabs held the old page frozen, then cross-faded it
 * under the new one - the Host Catalog drawn over the Overview. This fails if
 * a tab link starts animating again.
 */

let pathname = '/host/events/1'
vi.mock('next/navigation', () => ({ usePathname: () => pathname }))
vi.mock('next/link', () => ({
  default: ({ href, children }: any) => <a data-kind="plain" href={String(href)}>{children}</a>,
}))
vi.mock('next-view-transitions', () => ({
  Link: ({ href, children }: any) => <a data-kind="transition" href={String(href)}>{children}</a>,
}))

async function kindOf(from: string, to: string) {
  pathname = from
  const { default: HostLink } = await import('./HostLink')
  return /data-kind="(\w+)"/.exec(renderToStaticMarkup(<HostLink href={to}>go</HostLink>))?.[1]
}

describe('HostLink', () => {
  beforeEach(() => { pathname = '/host/events/1' })

  it('switches tabs without a transition', async () => {
    expect(await kindOf('/host/events/1', '/host/events/1/catalog')).toBe('plain')
    expect(await kindOf('/host/events/1/guests', '/host/events/1/rsvp')).toBe('plain')
  })

  it('animates going deeper and coming back', async () => {
    expect(await kindOf('/host/dashboard', '/host/events/1')).toBe('transition')
    expect(await kindOf('/host/events/1/details', '/host/events/1')).toBe('transition')
  })
})
