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
  // PR 4 - typography adoption
  '--font-title-family', '--font-title-weight', '--font-title-size',
  '--font-title-tracking', '--font-title-transform', '--font-title-style',
  '--font-header-family', '--font-header-weight', '--font-header-size',
  '--font-header-tracking', '--font-header-transform', '--font-header-style',
  '--font-body-family', '--font-body-weight', '--font-body-size',
  '--font-body-tracking', '--font-body-transform', '--font-body-style',
  '--font-eyebrow-family', '--font-eyebrow-weight', '--font-eyebrow-size',
  '--font-eyebrow-tracking', '--font-eyebrow-transform', '--font-eyebrow-style',
  '--font-caption-family', '--font-caption-weight', '--font-caption-size',
  '--font-caption-tracking', '--font-caption-transform', '--font-caption-style',
  '--font-data-family', '--font-data-weight', '--font-data-size',
  '--font-data-tracking', '--font-data-transform', '--font-data-style',
  // PR 5 - material adoption
  '--surface-fill', '--surface-border', '--surface-blur', '--surface-inset',
  // PR 6 - alignment
  '--invite-align',

  // Already orphaned before this work started - published by the earlier token
  // pass and read by nothing. Listed here so the check can run green, not
  // because they are fine.
  '--measure-text',      // PR 4  - running text gets a measure
  '--inset-page',        // PR 6  - replaces each tile's own px-4
  '--space-chapter',     // PR 6  - the breath before the footer
  '--theme-bg',          // PR 5  - under review; a tile may never need it
  '--theme-overlay-opacity', // PR 6 - under review; TextureOverlay takes a prop
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
 * `var(--x)` and `var(--x, fallback)` are both reads. Matching only the first
 * spelling reported half the adopted tokens as orphans.
 */
function isConsumed(token) {
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

console.log(
  `invite tokens: ${published.size} published, ` +
  `${published.size - PENDING_ADOPTION.size} consumed, ` +
  `${PENDING_ADOPTION.size} pending adoption`,
)
