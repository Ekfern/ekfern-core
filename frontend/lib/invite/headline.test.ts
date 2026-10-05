import { describe, expect, it } from 'vitest'
import { headlineText, headlineTile } from './headline'
import type { Tile } from './schema'

const title = (id: string, order: number, text: string, enabled = true): Tile =>
  ({ id, type: 'title', order, enabled, settings: { text } }) as Tile

describe('headline', () => {
  it('is the first Title tile by order, shown or hidden', () => {
    const tiles = [title('b', 3, 'Welcome'), title('a', 1, 'Riya weds Kabir', false)]
    expect(headlineTile(tiles)?.id).toBe('a')
    expect(headlineText(tiles)).toBe('Riya weds Kabir')
  })

  it('is absent without a Title tile, and blank text reads as empty', () => {
    expect(headlineTile([])).toBeUndefined()
    expect(headlineText([title('a', 0, '   ')])).toBe('')
  })
})
