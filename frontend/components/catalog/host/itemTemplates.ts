import type { CatalogItem } from '@/lib/catalog/types'

export type CatalogItemFormData = Omit<
  CatalogItem,
  'id' | 'catalog_id' | 'created_at' | 'updated_at'
>

export const EMPTY_CATALOG_ITEM: CatalogItemFormData = {
  title: '',
  description: '',
  image_url: null,
  item_type: 'contribution',
  action_type: 'pledge_amount',
  amount_type: 'flexible',
  fixed_amount: null,
  suggested_amounts: null,
  external_url: null,
  manual_instructions: '',
  status: 'published',
  sort_order: 0,
}

export const CATALOG_ITEM_TEMPLATES: { label: string; data: CatalogItemFormData }[] = [
  {
    label: 'Honeymoon fund',
    data: {
      ...EMPTY_CATALOG_ITEM,
      title: 'Honeymoon Fund',
      description: 'Help us create memories on our first trip together.',
      item_type: 'contribution',
      action_type: 'pledge_amount',
      amount_type: 'suggested',
      suggested_amounts: [50000, 100000, 200000, 500000],
      sort_order: 0,
    },
  },
  {
    label: 'Fixed contribution',
    data: {
      ...EMPTY_CATALOG_ITEM,
      title: 'Contribution',
      description: 'A fixed amount contribution.',
      item_type: 'contribution',
      action_type: 'pledge_amount',
      amount_type: 'fixed',
      fixed_amount: 200000,
      sort_order: 0,
    },
  },
  {
    label: 'External link',
    data: {
      ...EMPTY_CATALOG_ITEM,
      title: 'Learn more',
      description: 'Opens an external page.',
      item_type: 'info_link',
      action_type: 'open_external_link',
      amount_type: null,
      external_url: 'https://',
      sort_order: 0,
    },
  },
]
