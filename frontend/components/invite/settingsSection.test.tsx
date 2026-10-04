import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import SettingsSection from './SettingsSection'

/**
 * Every settings section shares one header. These cases pin the shape that
 * drifted when each section drew its own: the title is a real heading with the
 * toggle inside it, the chevron is one size, and nothing shifts the button off
 * the panel's edge.
 */

function html(props: Partial<React.ComponentProps<typeof SettingsSection>> = {}) {
  return renderToStaticMarkup(
    <SettingsSection title="Page Background" open={false} onToggle={() => {}} {...props}>
      <p id="body">controls</p>
    </SettingsSection>,
  )
}

describe('SettingsSection', () => {
  it('puts the toggle inside a heading and reports its state', () => {
    expect(html()).toMatch(/<h3[^>]*><button[^>]*aria-expanded="false"/)
    expect(html({ open: true })).toContain('aria-expanded="true"')
  })

  it('draws the same chevron and never offsets the button', () => {
    const out = html()
    expect(out).toContain('w-4 h-4')
    expect(out).not.toMatch(/-m-\d|w-5 h-5/)
  })

  it('unmounts a closed body unless asked to keep it', () => {
    expect(html()).not.toContain('id="body"')
    expect(html({ keepMounted: true })).toMatch(/class="mt-4 hidden"><p id="body">/)
    expect(html({ open: true })).toMatch(/class="mt-4 "><p id="body">/)
  })

  it('shows the badge and description under the same title style', () => {
    const out = html({ badge: <span id="badge">Using default</span>, description: 'How it looks when shared' })
    expect(out).toContain('<span class="text-sm font-semibold text-eco-green">Page Background</span><span id="badge">')
    expect(out).toContain('How it looks when shared')
  })
})
