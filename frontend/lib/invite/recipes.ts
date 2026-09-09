import type { CSSProperties } from 'react'
import type { RecipeName } from './appearance'

export type { RecipeName }

/**
 * How a tile asks for a text role.
 *
 * The point of a recipe is that a tile names the *job* - this is a heading,
 * this is a kicker - and never answers what that job looks like. Before this,
 * four kickers on one page each spelled out their own weight, size, tracking
 * and transform, and arrived at four different answers while sharing a family.
 *
 * All five properties travel together on purpose. A tile that took the family
 * and kept its own `tracking-[0.18em]` would be back where it started.
 *
 * Returned as inline style rather than classes because the values are custom
 * properties resolved at render, which Tailwind cannot express.
 */
export function recipe(name: RecipeName, overrides?: CSSProperties): CSSProperties {
  return {
    fontFamily: `var(--font-${name}-family)`,
    fontWeight: `var(--font-${name}-weight)`,
    fontSize: `var(--font-${name}-size)`,
    letterSpacing: `var(--font-${name}-tracking)`,
    textTransform: `var(--font-${name}-transform)`,
    fontStyle: `var(--font-${name}-style)`,
    // Ink comes with the role. A tile that took the family here and its colour
    // from somewhere else would put the two rows of controls back out of step.
    color: `var(--font-${name}-color)`,
    ...overrides,
  } as CSSProperties
}

/**
 * A recipe at a size the tile chooses.
 *
 * Only for the places where size is genuinely structure rather than look - the
 * title tile's small/medium/large/xlarge, which says which step of the scale a
 * headline sits on. Everything else takes the recipe whole.
 */
export function recipeAtSize(name: RecipeName, fontSize: string, overrides?: CSSProperties): CSSProperties {
  return recipe(name, { fontSize, ...overrides })
}
