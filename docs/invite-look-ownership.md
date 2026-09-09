# Invite look ownership — page owns look, tile owns content

Status: proposal, pending sign-off. Scope: QA-V1, aggressive. No prod hosts to protect.

## The rule

A tile decides **what it is**. The page decides **what it looks like**.

| Page owns (look) | Tile owns (not look) |
|---|---|
| Font family / weight / size / tracking / transform, as role recipes | The words: "Priya & Aakash", "You're invited", RSVP label |
| Elevation (shadow / raised) | The facts: date, time, location, map pin |
| Material (solid vs glass) | The media: which photos, poster image |
| Corner radius | Structure: stacked vs grid, polaroid frame, day-prominent date |
| Gaps and outer padding between sections | Behavior: timer on/off, which carousel fields show |
| Button recipe | |
| Shared colors: ink, accent, muted, card fill | |
| Text alignment | |
| Ornament: divider rules and decorative symbols | |

Changing a page-owned value must make the whole invite feel more formal, flatter,
tighter — uniformly, with no tile opting out.

---

## 1. Elevation and material

### Schema (page level)

```ts
/** How surfaces sit on the page. */
depth?: 'flat' | 'uniform' | 'featured'      // default 'uniform'

/** Which surface is raised when depth === 'featured'.
 *  Staff/template authored only — NOT a host-facing picker. */
featuredTileId?: string

/** Surface finish. Orthogonal to depth — glass is a material, not a depth step. */
material?: 'solid' | 'glass'                 // default 'solid'
```

`alternate` is explicitly **not shipped**. Alternating by index re-shuffles emphasis
whenever a host reorders or disables a tile, so the same page changes meaning on an
edit that had nothing to do with look.

### Resolving `featured`

Semantic default, not a free pick. First match wins:

1. `featuredTileId`, if a template set one
2. the `event-details` tile
3. the `feature-buttons` tile
4. the `poster` tile
5. nothing is raised (degrade to `flat`)

Rationale: "pick the special tile" as primary host UI ends with hosts raising the
gallery and burying RSVP. Guests lose.

### Tokens

| Token | flat | uniform | featured |
|---|---|---|---|
| `--shadow-rest` | `none` | `0 1px 2px rgba(0,0,0,.08)` | `none` |
| `--shadow-lift` | `none` | `0 4px 10px -2px rgba(0,0,0,.15)` | `0 12px 24px -8px rgba(0,0,0,.22)` |

Under `featured`, only the featured surface receives `--shadow-lift`; everything else
resolves `--shadow-rest` to `none`.

Material adds, independently of depth:

```
--surface-fill      solid: var(--theme-card-fill)   glass: rgba(255,255,255,.14)
--surface-border    solid: transparent              glass: 1px solid rgba(255,255,255,.28)
--surface-blur      solid: none                     glass: blur(20px)
--surface-inset     solid: none                     glass: inset 0 1px 0 rgba(255,255,255,.25)
```

Glass must stop carrying its own private shadow. Today
`EventDetailsTile.tsx:315` and `FeatureButtonsTile.tsx:98` each hardcode a different
glass box-shadow; both are deleted and replaced by `--shadow-rest` / `--shadow-lift`
plus `--surface-inset`.

### Elevatable surface register

Only these consume elevation tokens:

- event-details card
- CTA / feature-buttons card
- carousel cards
- gallery frames, when `frame !== 'none'`
- poster card, when `frameMode === 'card'`

**Not elevatable:** the directions map. Its `drop-shadow()` at
`StaticTileMap.tsx:132` traces a ragged torn-paper alpha edge — it is edge artwork,
not page elevation, and does not read `--shadow-rest`. Documented exception.

Polaroid takes `--shadow-lift` when `depth !== 'flat'`; under `flat` it takes no
elevation shadow. (Today it force-keeps a shadow even when the gallery asks for none —
`GalleryTile.tsx:271`. That override is removed.)

---

## 2. Fonts — three roles, full recipes

### Schema (page level, replaces `customFonts`)

```ts
interface FontRole {
  family: string
  weight?: number                                  // 300–800
  size?: 'sm' | 'md' | 'lg' | 'xl'                 // step on the page type scale
  tracking?: string                                // e.g. '0.18em'
  transform?: 'none' | 'uppercase'
  italic?: boolean
}

customFonts?: {
  title: FontRole
  header: FontRole
  body: FontRole
} | null
```

No restriction on which family each role draws from — the three roles are independent.

A role is a **full recipe**, not just a family. Family-only would not fix the reported
bug: four eyebrow-class elements today render at 0.3em / 0.3em / 0.18em / 0.1em
tracking with two different weights. Unifying the family alone still yields four
different-looking labels.

### Eyebrow / kicker

Not a fourth host-facing role. A **derived recipe** that takes `title.family` and
carries its own weight, size, tracking and transform:

```
--font-eyebrow-family     = var(--font-title-family)
--font-eyebrow-weight     600
--font-eyebrow-size       0.75rem
--font-eyebrow-tracking   0.3em
--font-eyebrow-transform  uppercase
```

This makes the two eyebrows agree — today `TitleTile` inherits the title face and
`GalleryTile` inherits the body face, which is the reported inconsistency.

> **Legibility caveat, on the record.** With a script family such as Pacifico,
> `uppercase` + `0.3em` tracking is close to unreadable — it is the exact artifact in
> the reported screenshot. The recipe must be able to drop `transform` and reduce
> `tracking` for display/script faces. Recommend a `script` classification on
> `FONT_OPTIONS` that suppresses uppercase for the eyebrow recipe.

### Six recipes, three families

Three host-selectable families. Six recipes drawn from them — the page has six text
jobs, and jobs 4-6 have no role at all today, which is why captions, data and eyebrows
each drift.

| Recipe | Family | Weight | Size | Tracking | Transform |
|---|---|---|---|---|---|
| title | title | 300-400 | 2.5-4rem | 0.01em | none |
| header | header | 400-600 | 1.75-2.25rem | 0.02em | none |
| body | body | 400 | 1rem | 0 | none |
| eyebrow *(derived)* | **title** | 600 | 0.75rem | 0.3em † | uppercase † |
| caption *(derived)* | body | 400 | 0.8125rem | 0.01em | none |
| data *(derived)* | body | 500 | varies | 0.02em | none |

† Suppressed when the family is classified `script` / `display` — see the legibility
caveat above.

**No fourth selectable family.** Each additional family is another webfont payload on a
phone on patchy data, and roughly doubles the ways a non-designer can make the page
ugly. The gap is missing *recipes*, not missing families.

If a fourth is ever wanted, it should be **Accent** (the eyebrow/label face) — the one
place a different family reads as intentional rather than accidental. It would default
to `title.family`, so it changes nothing until a host opts in, and can be added later
without a migration.

### Published tokens

```
--font-title-family   --font-title-weight   --font-title-size   --font-title-tracking   --font-title-transform
--font-header-*
--font-body-*
--font-eyebrow-*      (derived: family = title family, own size/weight/tracking)
--font-caption-*      (derived from body)
--font-data-*         (derived from body)
```

Legacy `--theme-font-title` / `--theme-font-body` alias to `--font-title-family` /
`--font-body-family` for one release, then go.

### Description tile

Keeps full rich-text capability. When the host has set no inline font, the tile
renders at the **body** (normal text) role. Inline styling the host applied wins over
the page role and is never stripped on a page-font change.

### 2a. Palette contrast guarantee

`fontColor` exists on five tiles today only as a contrast escape hatch — the schema
comments say so outright ("use for contrast on dark themes"). Deleting it is only safe
if the page palette cannot produce illegible ink. Therefore:

- Ink (`fontColor`), `mutedColor` and `primaryColor` derive from `backgroundColor` /
  `backgroundGradient` while `customColors.source !== 'custom'`.
- Derivation enforces a measured contrast floor against the *effective* background —
  for a gradient, against its darkest and lightest stops, not an average.
  Target: >= 4.5:1 for body and caption, >= 3:1 for title and header (large text).
- When a host sets ink directly (`source: 'custom'`), the editor warns on a failing
  ratio but does not silently override — the palette is theirs at that point.
- Card fill (`--theme-card-fill`) and glass fill are included: text over a glass card
  is measured against the composite, not the page background.

This is a hard prerequisite for the `fontColor` deletion, not a follow-up.

---

## 2b. Ornament

Centralised. One page decision drives every rule and flourish on the invitation.

```ts
ornament?: {
  divider?: 'none' | 'hairline' | 'symbol'   // default 'hairline'
  symbol?: string                            // ❦ ✿ ✤ ✦ • — ; used when divider === 'symbol'
}
```

Replaces `footer.showDivider` and `event-details.decorativeSymbol`. Symbols render in
the page accent colour at the page border width. A host who wants a fleuron gets it
consistently above the footer and inside the details card, rather than in one place by
accident.

---

## 3. Gaps

Keep the existing rhythm tokens. Do not invent a new gap enum.

- **Between tiles:** `--space-section`, owned solely by the renderer/shell.
- **`--space-chapter`:** only at named structural beats — before the footer, or where
  a template marks a chapter. Template metadata, never a host slider.
- **Inside a tile:** `--space-cluster` only, for heading → content → controls.

Every tile loses the outer `py-*` that manufactures page whitespace:

| Tile | Remove | Real gap today |
|---|---|---|
| title | `py-10` | |
| description | `py-1` | |
| event-details | `py-12` | 28px–96px against a token that says 16px |
| feature-buttons | `py-8` | |
| timer | `py-8` | |
| footer | `py-6` | |
| directions | `py-3` | |

### Approved exceptions

1. **Stacked gallery** — the scroll-driven pile's `~429svh` section and `100svh`
   sticky stage is a *scroll budget*, not a gap. Its apparent ~200px of lead-in is
   vertical centring inside a viewport-height stage.
2. **Poster full-bleed** — `frameMode: 'full-bleed'` is layout geometry, not padding.

Timer gets **no** exception; ordinary section spacing.

---

## 4. What is deleted from tiles

~40 settings. All become page-resolved.

| Tile | Deleted |
|---|---|
| title | `font`, `color`, `eyebrowColor`, `subtitleFont`, `subtitleColor` |
| footer | `showDivider` |
| gallery | `spacing`, `cornerRadius`, `shadow` |
| timer | `circleColor`, `textColor` |
| event-details | `fontColor`, `buttonColor`, `headerFontFamily`, `contentFontFamily`, `buttonVariant`, `buttonRadius`, `borderColor`, `borderWidth`, `backgroundColor`, `borderRadius`, `decorativeSymbol` |
| directions | `fontColor` |
| description | `fontColor` |
| feature-buttons | `buttonColor`, `buttonVariant`, `buttonRadius`, `ctaCardBackgroundColor`, `ctaCardBorderColor`, `ctaCardShadow` |
| footer | `fontColor` |
| event-carousel | `cardSpacing`, `cardBackgroundColor`, `cardBorderRadius`, `cardShadow`, `cardBorderWidth`, `cardBorderColor`, `cardBorderStyle`, `cardPadding`, `subEventTitleStyling`, `subEventDetailsStyling` |

`textAlign` moves to page level on all five tiles that carry it. No per-tile override
ships; add one only if a true exception appears later.

The carousel is the largest single offender — `cardStyle: 'elegant'|'modern'|'classic'`
hardcodes `shadow-lg` / `shadow-xl border` / `shadow-md border-2` at
`EventCarouselTile.tsx:340-342`. That is a second design system inside one tile.

### Kept on tiles

- **Structure:** `arrangement`, `frame`, `frameColor`, `frameWidth`, `dateLayout`,
  `cardLayout`, `cardStyle` (reduced to a material/structure recipe consuming page
  tokens), `frameMode`, `aspectRatio`, `imageFit`, `imageHeight`, `imageAspectRatio`,
  `format`, `overlayPosition`
- **Material and ornament recipes** that consume page tokens: `borderStyle` (all 8
  values retained — `elegant`, `minimal`, `ornate`, `modern`, `classic`, `vintage`,
  `none`, `glass`), `ctaCardStyle`. `glass` additionally sets page `material`.
- **Hierarchy:** `title.size` / `subtitleSize` stay on the tile as a step on the page
  type scale — which step this headline sits on is structure; the scale itself is page.
- **Media substitute:** `poster.backgroundGradient` stays on the tile. It stands in for
  an image, so it belongs to media, not to the palette.
- **Media treatment:** `mapStyle` — a filter on media, tile-owned. Staff set it in the
  layout when a template needs consistency; not promoted to a page look family.
- **Exempt canvas:** `poster.textOverlays` — free per-overlay font, size, color and
  shadow. Artwork, not document typography. Page roles do not touch it.
- **Exempt surface:** `poster.texture` — deliberately overrides page texture for a
  full-bleed hero.
- Words, facts, media, behavior — unchanged.

---

## 5. Migration

No prod hosts, so: **eager, one-way, no dual code paths.**

1. Bump `InviteConfig` with `configVersion: 2`.
2. Backfill both `config` and `published_config` in one migration. Published invites
   are migrated too — they do not stay pixel-identical.
3. Drop the deleted keys outright rather than reading-and-ignoring them.
4. Auto-migrate staff templates. Spot-check the 4 seeded ones by eye afterward; a
   hand-tuned template usually survives auto-migration worse than a host page.
5. Invalidate Django cache + CloudFront after backfill.

### Derivation during backfill

- `customFonts.titleFont` → `customFonts.title.family`; `bodyFont` → `body.family`
  **and** `header.family` (header starts equal to body; templates differentiate later).
- `depth` absent → `'uniform'` (matches today's default).
- `borderStyle: 'glass'` or `ctaCardStyle: 'glass'` → `material: 'glass'` at page level.
- Per-tile `textAlign` → page `textAlign` by majority across tiles; ties go to `center`.

---

## 6. Invariants to enforce with tests

The root cause of the reported bug was a token layer that shipped with no consumers.
These stop it recurring:

1. **No orphan tokens.** Every token `AppearanceProvider` publishes is read by at least
   one tile. Fails the build otherwise. This alone would have caught
   `--shadow-rest` / `--shadow-lift` having zero consumers.
2. **No hardcoded look in tiles.** Lint rule: no `boxShadow`, `borderRadius`,
   `fontFamily`, or Tailwind `shadow-*` / `rounded-*` literals in
   `components/invite/tiles/**` outside the exception register.
3. **Same-role elements agree.** Snapshot asserting every eyebrow on a rendered page
   resolves to identical family, weight, tracking and transform.
4. **SSR/client parity.** `TitleTileSSR` and `EventDetailsTileSSR` resolve the same
   computed look as their client twins.
5. **No outer padding.** No `py-*` on any tile root outside the exception register.

---

## 7. Resolved

| Item | Ruling |
|---|---|
| `title.size` / `subtitleSize` | **Tile keeps it** — a step on the page type scale |
| `decorativeSymbol` / `footer.showDivider` | **Centralised to page** — one ornament setting drives dividers and symbols invite-wide |
| `poster.backgroundGradient` | **Tile keeps it** — media substitute, not palette |
| `fontColor` | **Deleted**, with the palette contrast guarantee shipping alongside (§2a) |
| `borderStyle` | **All 8 values retained** on the tile, drawing colour and width from page tokens |

### Resolved

`fontColor` is **deleted** from all five tiles, and the palette contrast guarantee
ships in the same change — see §2a.
