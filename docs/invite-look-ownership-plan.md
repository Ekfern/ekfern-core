# Implementation plan — page owns look, tile owns content

Companion to `invite-look-ownership.md`. Scope: QA-V1, aggressive, one-way.
Branch each PR from `main`; PRs target `staging`.

## Sequencing principle

Tokens and the drift check land **before** the surface area grows. Every PR that
deletes a tile setting also deletes its editor control in the same PR — otherwise the
editor writes fields the schema no longer has.

The contrast guarantee is a hard gate on the `fontColor` deletion, so it lands early.

---

## PR 1 — Foundation: schema, tokens, drift harness

No visible change. Nothing consumes the new tokens yet.

- Extend `InviteConfig`: `depth`, `featuredTileId`, `material`, `textAlign`,
  `customFonts: { title, header, body }` as `FontRole`, `configVersion`.
- Extend `resolveAppearance()` + `AppearanceProvider` to publish all six font recipes
  and the surface tokens (`--surface-fill`, `--surface-border`, `--surface-blur`,
  `--surface-inset`).
- Keep `--theme-font-title` / `--theme-font-body` as aliases so nothing breaks.
- **Token-adoption harness**: a declared registry of published tokens. Each must be
  consumed by >= 1 tile, or listed in a `PENDING_ADOPTION` allowlist. Later PRs shrink
  the list; PR 9 asserts it is empty.

> This harness is the thing that would have caught the original bug: `--shadow-rest`
> and `--shadow-lift` shipped with zero consumers and nobody noticed.

**Verify:** existing invites render byte-identical. Allowlist is fully populated.

---

## PR 2 — Page settings UI

Somewhere to actually set the new values before tiles obey them.

- Page-level controls: 3 font pickers (Title / Header / Normal text), depth
  (Flat / Uniform / Featured), material (Solid / Glass), alignment, spacing, button recipe.
- Plain-language labels, not CSS terms. "Raised cards", not "box-shadow".
- `featuredTileId` is **not** exposed — staff/template only.

**Verify:** values persist; tiles still ignore them; no rendering change.

---

## PR 3 — Palette contrast guarantee

Hard prerequisite for PR 4's `fontColor` deletion.

- Derive ink / muted / primary from background while `customColors.source !== 'custom'`.
- Measure against the **effective** background: for a gradient, both extreme stops;
  for text on a card, the composite of card fill over page.
- Floors: >= 4.5:1 body & caption, >= 3:1 title & header.
- Host sets ink directly -> editor warns on a failing ratio, does not override.

**Verify:** unit tests over the existing seeded palettes + the gradient on
`no-theme-id` (`#E8D8C3 -> #C4A882`). Every combination clears its floor.

---

## PR 4 — Typography adoption + deletion

- All tiles consume `--font-{title,header,body,eyebrow,caption,data}-*`.
- Script/display faces suppress `uppercase` + wide tracking on the eyebrow recipe
  (classification added to `FONT_OPTIONS`).
- **Delete:** `title.font`, `title.color`, `eyebrowColor`, `subtitleFont`,
  `subtitleColor`, `headerFontFamily`, `contentFontFamily`, and `fontColor` on all
  five tiles — plus every corresponding editor control.
- Description tile: renders at body recipe when no inline font; inline styling wins
  and is never stripped.
- SSR twins (`TitleTileSSR`, `EventDetailsTileSSR`) move in lockstep.

**Verify:** all four eyebrow-class elements resolve to identical family, weight,
tracking, transform. Snapshot asserts it.

---

## PR 5 — Elevation and material adoption + deletion

- Resolve `depth` and `material`; apply only to the elevatable surface register
  (event-details card, CTA card, carousel cards, framed gallery prints, poster card).
- `featured` resolves semantically: `featuredTileId` -> event-details ->
  feature-buttons -> poster -> nothing.
- Untangle glass: it sets fill/border/blur/inset, never its own shadow.
- **Delete:** the two hardcoded glass shadows (`EventDetailsTile.tsx:315`,
  `FeatureButtonsTile.tsx:98`), `GalleryTile`'s private `SHADOW` scale, `gallery.shadow`,
  `gallery.cornerRadius`, `borderColor`, `borderWidth`, `backgroundColor`,
  `borderRadius`, `buttonColor`, `buttonVariant`, `buttonRadius`,
  `ctaCardBackgroundColor`, `ctaCardBorderColor`, `ctaCardShadow`, `timer.circleColor`,
  `timer.textColor` — plus editor controls.
- **Keep:** all 8 `borderStyle` values and `ctaCardStyle`, now drawing colour and width
  from page tokens. The map's torn-edge `drop-shadow()` stays as edge artwork.
- Polaroid takes `--shadow-lift` when depth != flat; no shadow under flat.

**Verify:** under `flat`, nothing on the page casts a shadow except the map's edge
artwork. Under `featured`, exactly one surface is raised.

---

## PR 6 — Rhythm and alignment

- Remove outer `py-*` from title, description, event-details, feature-buttons, timer,
  footer, directions. Between-tile gap lives only on the renderer.
- Internal spacing uses `--space-cluster`.
- `--space-chapter` before the footer, via template metadata.
- `textAlign` -> page; delete all five tile pickers.
- Exceptions register: stacked gallery (scroll budget), poster full-bleed (geometry).

**Verify:** no `py-*` on any tile root outside the register. Measured gap between every
adjacent pair equals `--space-section`.

---

## PR 7 — Event carousel

Its own PR — 10 settings, the largest single offender, and `cardStyle`'s
`elegant|modern|classic` hardcodes `shadow-lg` / `shadow-xl border` / `shadow-md border-2`
at `EventCarouselTile.tsx:340-342`: a second design system inside one tile.

- Reduce `cardStyle` to a structure/material recipe consuming page tokens.
- **Delete:** `cardSpacing`, `cardBackgroundColor`, `cardBorderRadius`, `cardShadow`,
  `cardBorderWidth`, `cardBorderColor`, `cardBorderStyle`, `cardPadding`,
  `subEventTitleStyling`, `subEventDetailsStyling`.
- **Keep:** `showFields`, `autoPlay`, `autoPlayInterval`, `showArrows`, `showDots`,
  `cardLayout`, `imageHeight`, `imageAspectRatio`.

---

## PR 8 — Migration

- `configVersion: 2`. Eager, one-way backfill of **both** `config` and
  `published_config`. Published invites are migrated; they do not stay pixel-identical.
- Derivations: `titleFont` -> `title.family`; `bodyFont` -> `body.family` **and**
  `header.family`; absent `depth` -> `uniform`; `borderStyle:'glass'` or
  `ctaCardStyle:'glass'` -> page `material:'glass'`; per-tile `textAlign` -> page by
  majority, ties to `center`.
- Drop deleted keys outright — no read-and-ignore.
- Auto-migrate the staff templates, then **spot-check the 4 seeded ones by eye**. A
  hand-tuned template survives auto-migration worse than a host page does.
- Invalidate Django cache + CloudFront after backfill.

**Verify:** re-render every existing invite pre/post migration and diff. Differences
must be explainable by the new rules, not by dropped content.

---

## PR 9 — Close out

- Remove the legacy `--theme-font-*` aliases.
- Assert `PENDING_ADOPTION` is empty.
- Land the remaining invariants:
  1. No orphan tokens (from PR 1).
  2. No hardcoded look in `components/invite/tiles/**` — no `boxShadow`,
     `borderRadius`, `fontFamily`, or Tailwind `shadow-*` / `rounded-*` literals
     outside the exception register.
  3. Same-role elements agree.
  4. SSR/client parity.
  5. No outer padding.

---

## Risks

| Risk | Where | Mitigation |
|---|---|---|
| Contrast derivation makes an existing palette illegible or ugly | PR 3 | Test against all seeded palettes + the live gradient before PR 4 deletes the escape hatch |
| SSR and client tiles drift while being edited separately | PR 4, 5 | Parity test lands with PR 4, not PR 9 |
| Auto-migrated templates look worse than hand-authored | PR 8 | Manual spot-check of the 4 seeded templates is a gate, not a follow-up |
| Removing controls reads as "the product got worse" | PR 2, 4-7 | Page controls ship (PR 2) *before* tile controls are removed (PR 4+) |
| Stacked gallery's scroll budget mistaken for a gap regression | PR 6 | Documented in the exception register with the measurement |

## Open items (defaults apply unless overridden)

- `title.size` / `subtitleSize` — tile keeps it, as a step on the page scale.
- `decorativeSymbol` / `footer.showDivider` — tile keeps it, consuming page accent.
- `poster.backgroundGradient` — tile keeps it; media substitute, not palette.
