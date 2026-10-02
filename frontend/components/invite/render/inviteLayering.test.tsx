import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import InviteRenderer from './InviteRenderer'
import TextureOverlay from './TextureOverlay'
import type { InviteConfig, TextureType } from '@/lib/invite/schema'

/**
 * Texture is the paper; the tiles are printed on it.
 *
 * It used to sit at `zIndex: 1` beside an unpositioned tile column, which CSS
 * paints over every tile - linen lines ran through the title and the photos
 * while the comment above it said "behind all content". These cases pin the
 * mechanism that keeps it underneath (see lib/invite/layers): the element that
 * paints the paper is an isolated stacking root, and only the paper's own
 * layers - texture and corner decorations - go negative inside it.
 */

const NAVY = '#14213D'
const IVORY = '#F7F1E3'

function config(texture: TextureType = 'linen'): InviteConfig {
  return {
    customColors: { backgroundColor: NAVY },
    texture: { type: texture, intensity: 30 },
    cornerDecorations: { topLeft: '/corner.png' },
    tiles: [
      { id: 't1', type: 'title', order: 0, enabled: true, settings: { text: 'Priya & Aakash' } },
    ],
  } as unknown as InviteConfig
}

/** The renderer's own root tag - inside AppearanceProvider's wrapper. */
function rootTag(html: string): string {
  const tag = html.match(/<div class="w-full relative"[^>]*>/)
  expect(tag).not.toBeNull()
  return tag![0]
}

function render(skipTextureOverlay: boolean) {
  return renderToStaticMarkup(
    <InviteRenderer config={config()} eventSlug="layering" skipTextureOverlay={skipTextureOverlay} />,
  )
}

describe('InviteRenderer paper layers', () => {
  it('is the paper root when it paints its own texture', () => {
    const html = render(false)
    expect(rootTag(html)).toContain('isolation:isolate')
    expect(html).toMatch(/data-texture-type="linen"[^>]*z-index:-2|z-index:-2[^>]*data-texture-type="linen"/)
  })

  it('puts only the texture and the corner decorations under the tiles', () => {
    const html = render(false)
    expect(html.match(/z-index:-\d/g)).toEqual(['z-index:-2', 'z-index:-1'])
    // The ornament layer is the one holding the corner image.
    expect(html).toMatch(/z-index:-1[^>]*>\s*<img src="\/corner.png"/)
  })

  it('leaves the root to its caller when the caller paints the paper', () => {
    const html = render(true)
    expect(rootTag(html)).not.toContain('isolation')
    expect(html).not.toContain('data-texture-type')
    // Corner decorations still sink - into the caller's paper root.
    expect(html.match(/z-index:-\d/g)).toEqual(['z-index:-1'])
  })
})

describe('TextureOverlay placement', () => {
  it('paints paper under content and a surface over its own image', () => {
    const paper = renderToStaticMarkup(<TextureOverlay layer="paper" type="linen" />)
    const surface = renderToStaticMarkup(<TextureOverlay layer="surface" type="linen" />)
    expect(paper).toContain('z-index:-2')
    expect(surface).toContain('z-index:1')
  })
})

describe('TextureOverlay follows the paper colour', () => {
  const html = (type: TextureType, paperColor?: string) =>
    renderToStaticMarkup(<TextureOverlay layer="paper" type={type} paperColor={paperColor} />)

  it('weaves in shadow on light stock and in highlight on dark', () => {
    expect(html('linen', IVORY)).toContain('rgba(0, 0, 0,')
    expect(html('linen', IVORY)).not.toContain('rgba(255, 255, 255,')
    expect(html('linen', NAVY)).toContain('rgba(255, 255, 255,')
    expect(html('linen', NAVY)).not.toContain('rgba(0, 0, 0,')
  })

  it('draws for light paper when it is not told the colour', () => {
    expect(html('linen')).toContain('rgba(0, 0, 0,')
  })

  it.each(['parchment', 'vintage-paper'] as const)('%s is a finish, not a brown tint', (type) => {
    for (const paper of [IVORY, NAVY]) {
      const out = html(type, paper)
      expect(out).not.toMatch(/rgba\(139, 90, 43|rgba\(101, 67, 33/)
    }
  })

  it('flecks stars dark on light stock and cream on dark', () => {
    expect(html('stars', IVORY)).toContain('--star-fleck:#8A6A2F')
    expect(html('stars', NAVY)).toContain('--star-fleck:#FFF8EC')
  })
})
