import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import PageSkeleton from './PageSkeleton'

/**
 * Host pages wait behind a skeleton of their own layout, never a blank screen
 * with "Loading..." in the middle - that swap is what read as a flicker.
 */
describe('PageSkeleton', () => {
  for (const shape of ['overview', 'list', 'form', 'grid', 'editor'] as const) {
    it(`draws the ${shape} page's frame and says "Loading" only to screen readers`, () => {
      const html = renderToStaticMarkup(<PageSkeleton shape={shape} />)
      expect(html).toContain('role="status"')
      expect(html).toContain('aria-busy="true"')
      expect(html).toContain('<span class="sr-only">Loading…</span>')
      // Placeholder blocks, and they hold still for anyone who asked for less motion.
      expect(html.match(/motion-safe:animate-pulse/g)?.length ?? 0).toBeGreaterThan(3)
      expect(html.replace('<span class="sr-only">Loading…</span>', '')).not.toMatch(/Loading/)
    })
  }
})
