/**
 * Single source of truth for event types on the frontend.
 * Mirrors backend Event.EVENT_TYPE_CHOICES in backend/apps/events/models.py exactly.
 * Update both files together whenever a new type is added.
 */
export const EVENT_TYPES = [
  // Life Events — alphabetical
  { value: 'anniversary',         label: 'Anniversary',         group: 'Life Events' },
  { value: 'baby_shower',         label: 'Baby Shower',         group: 'Life Events' },
  { value: 'bachelor_party',      label: 'Bachelor Party',      group: 'Life Events' },
  { value: 'bachelorette_party',  label: 'Bachelorette Party',  group: 'Life Events' },
  { value: 'birthday',            label: 'Birthday',            group: 'Life Events' },
  { value: 'bridal_shower',       label: 'Bridal Shower',       group: 'Life Events' },
  { value: 'engagement',          label: 'Engagement',          group: 'Life Events' },
  { value: 'gender_reveal',       label: 'Gender Reveal',       group: 'Life Events' },
  { value: 'graduation',          label: 'Graduation',          group: 'Life Events' },
  { value: 'housewarming',        label: 'Housewarming',        group: 'Life Events' },
  { value: 'naming_ceremony',     label: 'Naming Ceremony',     group: 'Life Events' },
  { value: 'reception',           label: 'Reception',           group: 'Life Events' },
  { value: 'retirement',          label: 'Retirement',          group: 'Life Events' },
  { value: 'wedding',             label: 'Wedding',             group: 'Life Events' },
  // Religious & Ceremonial — alphabetical
  { value: 'bar_mitzvah',         label: 'Bar Mitzvah',         group: 'Religious & Ceremonial' },
  { value: 'bat_mitzvah',         label: 'Bat Mitzvah',         group: 'Religious & Ceremonial' },
  { value: 'church_service',      label: 'Church Service',      group: 'Religious & Ceremonial' },
  { value: 'communion',           label: 'Communion',           group: 'Religious & Ceremonial' },
  { value: 'confirmation',        label: 'Confirmation',        group: 'Religious & Ceremonial' },
  { value: 'puja',                label: 'Puja',                group: 'Religious & Ceremonial' },
  { value: 'religious_ceremony',  label: 'Religious Ceremony',  group: 'Religious & Ceremonial' },
  { value: 'satsang',             label: 'Satsang',             group: 'Religious & Ceremonial' },
  // Professional & Business — alphabetical
  { value: 'award_ceremony',      label: 'Award Ceremony',      group: 'Professional & Business' },
  { value: 'conference',          label: 'Conference',          group: 'Professional & Business' },
  { value: 'corporate_event',     label: 'Corporate Event',     group: 'Professional & Business' },
  { value: 'networking',          label: 'Networking Event',    group: 'Professional & Business' },
  { value: 'offsite',             label: 'Offsite / Retreat',   group: 'Professional & Business' },
  { value: 'product_launch',      label: 'Product Launch',      group: 'Professional & Business' },
  { value: 'seminar',             label: 'Seminar',             group: 'Professional & Business' },
  { value: 'team_building',       label: 'Team Building',       group: 'Professional & Business' },
  { value: 'town_hall',           label: 'Town Hall',           group: 'Professional & Business' },
  { value: 'trade_show',          label: 'Trade Show / Expo',   group: 'Professional & Business' },
  { value: 'training',            label: 'Training / Onboarding', group: 'Professional & Business' },
  { value: 'workshop',            label: 'Workshop',            group: 'Professional & Business' },
  // Social & Community — alphabetical
  { value: 'art_show',            label: 'Art Show',            group: 'Social & Community' },
  { value: 'charity_event',       label: 'Charity Event',       group: 'Social & Community' },
  { value: 'community_event',     label: 'Community Event',     group: 'Social & Community' },
  { value: 'cultural_event',      label: 'Cultural Event',      group: 'Social & Community' },
  { value: 'exhibition',          label: 'Exhibition',          group: 'Social & Community' },
  { value: 'festival',            label: 'Festival',            group: 'Social & Community' },
  { value: 'fundraiser',          label: 'Fundraiser',          group: 'Social & Community' },
  // Entertainment — alphabetical
  { value: 'comedy_show',         label: 'Comedy Show',         group: 'Entertainment' },
  { value: 'concert',             label: 'Concert',             group: 'Entertainment' },
  { value: 'music_event',         label: 'Music Event',         group: 'Entertainment' },
  { value: 'sports_event',        label: 'Sports Event',        group: 'Entertainment' },
  { value: 'theater',             label: 'Theater',             group: 'Entertainment' },
  // Food & Dining — alphabetical
  { value: 'brunch',              label: 'Brunch',              group: 'Food & Dining' },
  { value: 'cocktail_party',      label: 'Cocktail Party',      group: 'Food & Dining' },
  { value: 'dinner_party',        label: 'Dinner Party',        group: 'Food & Dining' },
  { value: 'potluck',             label: 'Potluck',             group: 'Food & Dining' },
  { value: 'tea_party',           label: 'Tea Party',           group: 'Food & Dining' },
  // Other
  { value: 'other',               label: 'Other',               group: 'Other' },
] as const

export type EventTypeValue = typeof EVENT_TYPES[number]['value']
export type EventTypeGroup = typeof EVENT_TYPES[number]['group']

/** All unique group names in declaration order. */
export const EVENT_TYPE_GROUPS: EventTypeGroup[] = Array.from(
  new Set(EVENT_TYPES.map((t) => t.group))
) as EventTypeGroup[]

/** Flat tuple of all values — pass directly to z.enum(). */
export const EVENT_TYPE_VALUES = EVENT_TYPES.map((t) => t.value) as unknown as [EventTypeValue, ...EventTypeValue[]]

/** Convenience: look up a label by value. */
export function getEventTypeLabel(value: string): string {
  return EVENT_TYPES.find((t) => t.value === value)?.label ?? value
}
