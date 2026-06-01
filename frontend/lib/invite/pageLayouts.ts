/**
 * Invite page layout type (layouts are stored in DB and fetched via API).
 * applyLayout() clones config and assigns unique tile IDs when applying.
 */

import type { InviteConfig } from './schema'

export interface InvitePageLayout {
  id: string
  name: string
  description?: string
  thumbnail: string
  previewAlt?: string
  config: InviteConfig
  /** Stable design code of the linked card_sample (e.g. DSGN-0042), if any. */
  cardCode?: string
  /** Creator attribution (from API layouts) */
  createdByName?: string
  /** Client-only mechanical starter (not from API) */
  isStarter?: boolean
}
