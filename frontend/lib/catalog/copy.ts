import type { CatalogPurpose } from './types'
import type { CatalogSource } from './source'

export interface CatalogCopy {
  defaultTitle: string
  defaultIntro: string
  sectionEyebrow: string
  buttonFallback: string
  emptyItems: string
  trustLine: string
  footerLine: string
}

const PURPOSE_COPY: Record<CatalogPurpose, CatalogCopy> = {
  gifts: {
    defaultTitle: 'Gifts',
    defaultIntro: 'Choose something meaningful to contribute to this celebration.',
    sectionEyebrow: 'Ways to contribute',
    buttonFallback: 'View gifts',
    emptyItems: 'Gift options will appear here soon.',
    trustLine: 'No payment on this page — the host will follow up with you directly.',
    footerLine: 'Powered by Ekfern · Your response is private and shared only with the event host',
  },
  fundraiser: {
    defaultTitle: 'Support Our Cause',
    defaultIntro: 'Every contribution helps us reach our goal. Thank you for your support.',
    sectionEyebrow: 'Ways to support',
    buttonFallback: 'Support',
    emptyItems: 'Fundraising options will appear here soon.',
    trustLine: 'No payment on this page — organizers will follow up with you directly.',
    footerLine: 'Powered by Ekfern · Your pledge is private and shared only with the organizers',
  },
  products_services: {
    defaultTitle: 'Products & Services',
    defaultIntro: 'Browse offerings and let the host know what interests you.',
    sectionEyebrow: 'Offerings',
    buttonFallback: 'Browse offerings',
    emptyItems: 'No offerings listed yet.',
    trustLine: 'No payment on this page — the host will follow up with you directly.',
    footerLine: 'Powered by Ekfern · Your response is private and shared only with the event host',
  },
  event_addons: {
    defaultTitle: 'Event Add-ons',
    defaultIntro: 'Enhance your experience — explore optional add-ons for this event.',
    sectionEyebrow: 'Add-ons',
    buttonFallback: 'View add-ons',
    emptyItems: 'Add-ons will be listed here soon.',
    trustLine: 'No payment on this page — the host will follow up with you directly.',
    footerLine: 'Powered by Ekfern · Your response is private and shared only with the event host',
  },
  sponsorships: {
    defaultTitle: 'Sponsorships',
    defaultIntro: 'Partner with us — explore sponsorship opportunities for this event.',
    sectionEyebrow: 'Sponsorship options',
    buttonFallback: 'Sponsorships',
    emptyItems: 'Sponsorship options will appear here soon.',
    trustLine: 'No payment on this page — the host will follow up with you directly.',
    footerLine: 'Powered by Ekfern · Your response is private and shared only with the event host',
  },
  general: {
    defaultTitle: 'Catalog',
    defaultIntro: 'Explore items and share your response with the host.',
    sectionEyebrow: 'Explore',
    buttonFallback: 'Catalog',
    emptyItems: 'No items available yet.',
    trustLine: 'No payment on this page — the host will follow up with you directly.',
    footerLine: 'Powered by Ekfern · Your response is private and shared only with the event host',
  },
}

export function getCatalogCopy(
  purpose: CatalogPurpose,
  catalogTitle?: string,
  introText?: string,
): {
  title: string
  intro: string
  sectionEyebrow: string
  emptyItems: string
  trustLine: string
  footerLine: string
} {
  const base = PURPOSE_COPY[purpose] ?? PURPOSE_COPY.general
  return {
    title: catalogTitle?.trim() || base.defaultTitle,
    intro: introText?.trim() || base.defaultIntro,
    sectionEyebrow: base.sectionEyebrow,
    emptyItems: base.emptyItems,
    trustLine: base.trustLine,
    footerLine: base.footerLine,
  }
}

export function getCatalogButtonFallback(purpose: CatalogPurpose): string {
  return (PURPOSE_COPY[purpose] ?? PURPOSE_COPY.general).buttonFallback
}

export function getCatalogTitlePlaceholder(purpose: CatalogPurpose): string {
  switch (purpose) {
    case 'gifts':
      return 'e.g. Our gift catalog'
    case 'fundraiser':
      return 'e.g. Support Our Cause'
    case 'products_services':
      return 'e.g. Products & Services'
    case 'event_addons':
      return 'e.g. Session Add-ons'
    case 'sponsorships':
      return 'e.g. Sponsorship Opportunities'
    default:
      return 'e.g. Event Catalog'
  }
}

/** Optional one-line context under the shelf eyebrow based on entry path */
export function getCatalogContextLine(
  source: CatalogSource,
  purpose: CatalogPurpose,
): string | null {
  if (source === 'rsvp_confirmation') {
    switch (purpose) {
      case 'gifts':
        return 'Thanks for your RSVP — choose how you’d like to contribute.'
      case 'fundraiser':
        return 'Thanks for registering — here’s how you can support.'
      case 'event_addons':
        return 'Thanks for your RSVP — explore optional add-ons below.'
      default:
        return 'Thanks for your RSVP — explore options below.'
    }
  }
  return null
}
