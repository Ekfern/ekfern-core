import type { HostCatalog } from './types'

export type CatalogPresetId = 'open' | 'after_rsvp' | 'attendees_only'

export interface CatalogPreset {
  id: CatalogPresetId
  label: string
  description: string
  patch: Pick<
    HostCatalog,
    'catalog_access_mode' | 'show_on_event_page' | 'show_on_rsvp_confirmation'
  >
}

export const CATALOG_PRESETS: CatalogPreset[] = [
  {
    id: 'open',
    label: 'Open catalog',
    description: 'Anyone with the link can browse. Show a button on the invitation.',
    patch: {
      catalog_access_mode: 'same_as_event',
      show_on_event_page: true,
      show_on_rsvp_confirmation: false,
    },
  },
  {
    id: 'after_rsvp',
    label: 'After RSVP',
    description: 'Guests RSVP first, then see the catalog. Link on the confirmation page.',
    patch: {
      catalog_access_mode: 'after_rsvp',
      show_on_event_page: false,
      show_on_rsvp_confirmation: true,
    },
  },
  {
    id: 'attendees_only',
    label: 'Attendees only',
    description: 'Only confirmed guests. Link after RSVP when they mark attending.',
    patch: {
      catalog_access_mode: 'confirmed_only',
      show_on_event_page: false,
      show_on_rsvp_confirmation: true,
    },
  },
]

export function detectActivePreset(catalog: HostCatalog): CatalogPresetId | null {
  for (const preset of CATALOG_PRESETS) {
    const { patch } = preset
    if (
      catalog.catalog_access_mode === patch.catalog_access_mode &&
      catalog.show_on_event_page === patch.show_on_event_page &&
      catalog.show_on_rsvp_confirmation === patch.show_on_rsvp_confirmation
    ) {
      return preset.id
    }
  }
  return null
}
