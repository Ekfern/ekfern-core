export type CatalogPurpose =
  | 'gifts'
  | 'fundraiser'
  | 'products_services'
  | 'event_addons'
  | 'sponsorships'
  | 'general'

export type CatalogAccessMode = 'same_as_event' | 'after_rsvp' | 'confirmed_only'

export type ItemType = 'contribution' | 'offer_addon' | 'info_link'

export type ActionType =
  | 'pledge_amount'
  | 'submit_interest'
  | 'open_external_link'
  | 'contact_host'

export type AmountType = 'none' | 'fixed' | 'suggested' | 'flexible'

export type ResponseType = 'pledge' | 'interest' | 'external_click' | 'host_message'

export type ResponseStatus = 'new' | 'contacted' | 'confirmed' | 'completed' | 'cancelled'

export interface HostCatalog {
  id: number
  event_id: number
  is_enabled: boolean
  purpose: CatalogPurpose
  catalog_title: string
  intro_text: string
  catalog_access_mode: CatalogAccessMode
  show_on_event_page: boolean
  show_on_rsvp_confirmation: boolean
  created_at: string
  updated_at: string
}

export interface CatalogItem {
  id: number
  catalog_id: number
  title: string
  description: string
  image_url: string | null
  item_type: ItemType
  action_type: ActionType
  amount_type: AmountType | null
  fixed_amount: number | null  // paise
  suggested_amounts: number[] | null  // paise
  external_url: string | null
  manual_instructions: string
  status: 'published' | 'hidden'
  sort_order: number
  created_at: string
  updated_at: string
}

export interface CatalogResponse {
  id: number
  catalog_item_id: number
  item_title: string
  event_id: number
  guest_id: number | null
  name: string
  email: string
  phone: string
  response_type: ResponseType
  amount: number | null  // paise
  message: string
  status: ResponseStatus
  source: 'event_page' | 'rsvp_confirmation' | 'invite' | 'direct' | 'qr'
  created_at: string
  updated_at: string
}

export interface PublicCatalog {
  catalog: HostCatalog
  items: PublicCatalogItem[]
  event: {
    id: number
    title: string
    slug: string
    is_public: boolean
  }
}

export interface PublicCatalogItem {
  id: number
  title: string
  description: string
  image_url: string | null
  item_type: ItemType
  action_type: ActionType
  amount_type: AmountType | null
  fixed_amount: number | null  // paise
  suggested_amounts: number[] | null  // paise
  external_url: string | null
  manual_instructions: string
  sort_order: number
}

/** Convert paise to rupees string, e.g. 200000 → "₹2,000" */
export function formatRupees(paise: number): string {
  const rupees = paise / 100
  return `₹${rupees.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}
