import type { CatalogPurpose } from './types'
import { getCatalogButtonFallback } from './copy'

/** Whether the catalog CTA should appear on invite / event surfaces */
export function shouldShowCatalogOnEventPage(
  hasRegistry?: boolean,
  catalogShowOnEventPage?: boolean,
): boolean {
  return !!hasRegistry && catalogShowOnEventPage !== false
}

/** Whether the catalog CTA should appear on RSVP confirmation */
export function shouldShowCatalogOnRsvpConfirmation(
  hasRegistry?: boolean,
  catalogShowOnRsvpConfirmation?: boolean,
): boolean {
  return !!hasRegistry && catalogShowOnRsvpConfirmation === true
}

export function getCatalogButtonLabel(
  catalogTitle?: string,
  purpose: CatalogPurpose = 'general',
  fallbackLabel?: string,
): string {
  const t = catalogTitle?.trim()
  if (t) return t
  if (fallbackLabel?.trim()) return fallbackLabel.trim()
  return getCatalogButtonFallback(purpose)
}
