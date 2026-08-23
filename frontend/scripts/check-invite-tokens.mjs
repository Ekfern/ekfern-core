#!/usr/bin/env node
/**
 * Every token the page publishes must be read by something.
 *
 * The invitation shipped `--shadow-rest` and `--shadow-lift` and then set every
 * tile's shadow by hand, so the page could say "flat" and stay raised. Nothing
 * failed, because a token with no reader is silent. This makes it loud.
 *
 * Tokens not adopted yet live in PENDING_ADOPTION. The list only shrinks; when
 * it is empty this check is the whole invariant. See
 * docs/invite-look-ownership-plan.md.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const PROVIDER = 'components/invite/render/AppearanceProvider.tsx'
const CONSUMER_DIRS = ['components/invite', 'app/invite', 'lib/invite']

/**
 * Published, but nothing reads it yet. Each PR in the plan removes entries.
 * Adding one is a deliberate act and should be argued for in review.
 */
const PENDING_ADOPTION = new Set([
  // PR 5 - material adoption
  '--surface-fill', '--surface-border', '--surface-blur', '--surface-inset',
  // PR 6 - alignment
  '--invite-align',

  // Already orphaned before this work started - published by the earlier token
  // pass and read by nothing. Listed here so the check can run green, not
  // because they are fine. (`--theme-bg` and `--theme-overlay-opacity` were on
  // this list too; nothing needed them, so they were deleted instead.)
  '--measure-text',      // PR 6  - running text gets a measure
  '--inset-page',        // PR 6  - replaces each tile's own px-4
  '--space-chapter',     // PR 6  - the breath before the footer
])

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else if (/\.(tsx?|css)$/.test(entry.name)) out.push(full)
  }
  return out
}

const provider = readFileSync(PROVIDER, 'utf8')
const published = new Set(
  [...provider.matchAll(/'(--[a-z0-9-]+)':/g)].map((m) => m[1]),
)
// The recipe loop builds its names, so read them from the template instead.
for (const [, name] of provider.matchAll(/`--font-\$\{name\}-([a-z]+)`/g)) {
  for (const recipe of ['title', 'header', 'body', 'eyebrow', 'caption', 'data']) {
    published.add(`--font-${recipe}-${name}`)
  }
}

const consumers = CONSUMER_DIRS.flatMap(walk)
  .filter((f) => !f.endsWith(PROVIDER))
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n')

/**
 * Which text roles some tile actually asks for.
 *
 * Tiles do not spell out `var(--font-eyebrow-family)`; they call
 * `recipe('eyebrow')` and the helper spends all six properties at once. That
 * indirection is the point - a tile naming the job rather than the look - so
 * the check has to follow it rather than report the whole set as unread.
 */
const requestedRecipes = new Set(
  [...consumers.matchAll(/\brecipe(?:AtSize)?\(\s*'([a-z]+)'/g)].map((m) => m[1]),
)

/**
 * `var(--x)` and `var(--x, fallback)` are both reads. Matching only the first
 * spelling reported half the adopted tokens as orphans.
 */
function isConsumed(token) {
  const viaRecipe = /^--font-([a-z]+)-[a-z]+$/.exec(token)
  if (viaRecipe && requestedRecipes.has(viaRecipe[1])) return true
  return new RegExp(`var\\(\\s*${token}\\s*[,)]`).test(consumers)
}

const orphans = [...published]
  .filter((token) => !isConsumed(token))
  .filter((token) => !PENDING_ADOPTION.has(token))
  .sort()

const adopted = [...PENDING_ADOPTION].filter(isConsumed).sort()

if (orphans.length) {
  console.error('Tokens published by the page that no tile reads:\n')
  for (const token of orphans) console.error(`  ${token}`)
  console.error('\nEither a tile should consume it, or it should not be published.')
  console.error('If adoption is genuinely pending, add it to PENDING_ADOPTION and say why.')
  process.exit(1)
}

if (adopted.length) {
  console.error('These are adopted now - remove them from PENDING_ADOPTION:\n')
  for (const token of adopted) console.error(`  ${token}`)
  process.exit(1)
}

/**
 * No tile may state a typeface, a tracking or a weight in its own words.
 *
 * The tokens check catches a page talking to nobody. This catches the other
 * direction: a tile answering a question it was never supposed to ask. Both
 * failures produced the same page - four labels doing one job, four different
 * answers - and only one of them was visible from the provider.
 */
const TYPOGRAPHY_LITERALS = [
  [/fontFamily:\s*['"`](?!var\()/, 'a literal fontFamily'],
  [/tracking-\[/, 'a hand-set letter-spacing'],
  [/letterSpacing:\s*['"`](?!var\()/, 'a literal letterSpacing'],
]

const tileFiles = walk('components/invite/tiles').filter(
  (f) => f.endsWith('.tsx') && !f.includes('Settings'),
)
const offences = []
for (const file of tileFiles) {
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, index) => {
    for (const [pattern, what] of TYPOGRAPHY_LITERALS) {
      if (pattern.test(line)) offences.push(`  ${file}:${index + 1} - ${what}`)
    }
  })
}

if (offences.length) {
  console.error('Tiles deciding what text looks like:\n')
  for (const offence of offences) console.error(offence)
  console.error('\nAsk for a role with recipe(...) instead.')
  process.exit(1)
}

console.log(
  `invite tokens: ${published.size} published, ` +
  `${published.size - PENDING_ADOPTION.size} consumed, ` +
  `${PENDING_ADOPTION.size} pending adoption; ` +
  `${tileFiles.length} tiles stating no typography of their own`,
)
