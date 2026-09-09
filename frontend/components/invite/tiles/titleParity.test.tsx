import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import TitleTile from './TitleTile'
import TitleTileSSR from './TitleTileSSR'
import type { TitleTileSettings } from '@/lib/invite/schema'

/**
 * One tile, two files, and nothing that made them agree.
 *
 * They had drifted in four ways at once: `py-8` against `py-10`, `font-bold`
 * against `font-light`, a size scale a step smaller at every stop, and an
 * eyebrow that inherited a different face. A guest saw the server's answer and
 * then watched it change on hydration.
 *
 * Comparing rendered markup rather than reading both files is the point - it
 * fails on any divergence, including one nobody thought to look for.
 */
const settings: TitleTileSettings = {
  text: 'Priya & Aakash',
  eyebrow: "YOU'RE INVITED",
  subtitle: 'Join us for an evening to remember',
  size: 'xlarge',
  subtitleSize: 'medium',
  textAlign: 'center',
}

describe('TitleTile and TitleTileSSR', () => {
  it('render the same markup', () => {
    expect(renderToStaticMarkup(<TitleTile settings={settings} preview />)).toBe(
      renderToStaticMarkup(<TitleTileSSR settings={settings} />),
    )
  })

  it.each([['small'], ['medium'], ['large'], ['xlarge']] as const)(
    'agree at size %s',
    (size) => {
      const at = { ...settings, size }
      expect(renderToStaticMarkup(<TitleTile settings={at} preview />)).toBe(
        renderToStaticMarkup(<TitleTileSSR settings={at} />),
      )
    },
  )

  it.each([['left'], ['center'], ['right']] as const)('agree when aligned %s', (textAlign) => {
    const at = { ...settings, textAlign }
    expect(renderToStaticMarkup(<TitleTile settings={at} preview />)).toBe(
      renderToStaticMarkup(<TitleTileSSR settings={at} />),
    )
  })

  it('names the eyebrow as a role rather than styling it', () => {
    const markup = renderToStaticMarkup(<TitleTile settings={settings} preview />)
    // The kicker takes every one of its properties from the recipe. A tile that
    // kept even its own tracking would be back to four labels, four answers.
    expect(markup).toContain('var(--font-eyebrow-family)')
    expect(markup).toContain('var(--font-eyebrow-tracking)')
    expect(markup).toContain('var(--font-eyebrow-transform)')
    expect(markup).not.toMatch(/letter-spacing:\s*0\.\d+em/)
  })
})
