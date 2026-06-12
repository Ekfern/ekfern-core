import type { ActionType, ItemType, PublicCatalogItem } from '@/lib/catalog/types'

export function getActionLabel(actionType: ActionType): string {
  switch (actionType) {
    case 'pledge_amount':
      return 'Contribute'
    case 'submit_interest':
      return "I'm Interested"
    case 'open_external_link':
      return 'View Details'
    case 'contact_host':
      return 'Contact Host'
    default:
      return 'Respond'
  }
}

export function getItemTypeLabel(itemType: ItemType): string {
  switch (itemType) {
    case 'contribution':
      return 'Contribution'
    case 'offer_addon':
      return 'Add-on'
    case 'info_link':
      return 'Info'
    default:
      return 'Item'
  }
}

export function getModalActionLabel(actionType: ActionType): string {
  switch (actionType) {
    case 'pledge_amount':
      return 'Contribute'
    case 'submit_interest':
      return 'Show interest'
    case 'contact_host':
      return 'Contact host'
    default:
      return 'Respond'
  }
}

export function getSubmitLabel(item: PublicCatalogItem, submitting: boolean): string {
  if (submitting) return 'Submitting…'
  switch (item.action_type) {
    case 'pledge_amount':
      return 'Send my pledge'
    case 'submit_interest':
      return 'Show interest'
    case 'contact_host':
      return 'Send message'
    default:
      return 'Submit'
  }
}
