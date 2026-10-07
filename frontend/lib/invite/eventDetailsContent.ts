/**
 * The part of the invitation the event forms edit directly: the Event Details
 * tile's time, location line and Good to know.
 *
 * None of it is an Event field - it lives only in the invitation - so the
 * create form writes it as a starter invitation and the edit form reads it
 * back and patches it, touching nothing else in the tile. The Page Editor
 * edits the same values; both ways end in the same place.
 */

import type { EventDetailsTileSettings, GoodToKnowItem, InviteConfig, Tile } from './schema'
import { visibleItems } from './goodToKnow'

export interface EventDetailsContent {
  time?: string
  /** The line the invitation shows under "Location" ("The Lakeside Lawns, Udaipur"). */
  location?: string
  goodToKnow?: GoodToKnowItem[]
}

function detailsTile(config: InviteConfig | null | undefined): Tile | undefined {
  return config?.tiles?.find((tile) => tile.type === 'event-details')
}

/** What the invitation currently says, for the edit form to start from. */
export function readEventDetailsContent(config: InviteConfig | null | undefined): EventDetailsContent {
  const settings = detailsTile(config)?.settings as EventDetailsTileSettings | undefined
  return {
    time: settings?.time ?? '',
    location: settings?.location ?? '',
    goodToKnow: settings?.goodToKnow ?? [],
  }
}

/** Only what changed, so a save never rewrites values the host left alone. */
export function changedContent(before: EventDetailsContent, after: EventDetailsContent): EventDetailsContent {
  const patch: EventDetailsContent = {}
  if ((after.time ?? '') !== (before.time ?? '')) patch.time = after.time ?? ''
  if ((after.location ?? '').trim() !== (before.location ?? '').trim()) patch.location = (after.location ?? '').trim()
  const beforeItems = JSON.stringify(visibleItems(before.goodToKnow))
  const afterItems = visibleItems(after.goodToKnow)
  if (JSON.stringify(afterItems) !== beforeItems) patch.goodToKnow = afterItems
  return patch
}

/** Apply a patch to the Event Details tile; an empty value removes the key. */
function patchSettings(settings: EventDetailsTileSettings, patch: EventDetailsContent & { date?: string }): EventDetailsTileSettings {
  const next: EventDetailsTileSettings = { ...settings }
  if (patch.date !== undefined) next.date = patch.date
  if (patch.time !== undefined) {
    if (patch.time) next.time = patch.time
    else delete next.time
  }
  if (patch.location !== undefined) next.location = patch.location
  if (patch.goodToKnow !== undefined) {
    if (patch.goodToKnow.length) next.goodToKnow = patch.goodToKnow
    else delete next.goodToKnow
  }
  return next
}

/**
 * The invitation with the patch applied, or null when there is nothing to write.
 *
 * With an Event Details tile, only that tile changes. Without one - an event
 * that has not been through the Layout step - a starter invitation holds the
 * content until a layout is applied and carries it in (tileContent.ts).
 */
export function withEventDetailsContent(
  config: InviteConfig | null | undefined,
  patch: EventDetailsContent & { date?: string },
  title: string,
): InviteConfig | null {
  if (Object.keys(patch).length === 0) return null
  const tile = detailsTile(config)
  if (tile && config?.tiles) {
    return {
      ...config,
      tiles: config.tiles.map((t) =>
        t.id === tile.id ? { ...t, settings: patchSettings(t.settings as EventDetailsTileSettings, patch) } : t,
      ),
    }
  }
  const settings = patchSettings({ date: patch.date ?? '', location: '' }, patch)
  const hasContent = !!settings.time || !!settings.location || !!settings.goodToKnow?.length
  if (!hasContent) return null
  return {
    ...(config ?? {}),
    tiles: [
      { id: 'tile-title-start', type: 'title', enabled: true, order: 0, settings: { text: title } },
      { id: 'tile-event-details-start', type: 'event-details', enabled: true, order: 1, settings },
    ],
  } as InviteConfig
}

/**
 * Whether the invitation has been laid out - a layout applied, or the editor
 * saved a page of its own - as opposed to empty or only the starter the create
 * form writes (ids ending "-start"). From then on the invitation is where its
 * time, location line and Good to know are edited; Edit Event Details shows
 * them greyed out.
 */
export function invitationIsLaidOut(config: InviteConfig | null | undefined): boolean {
  const tiles = config?.tiles ?? []
  return tiles.length > 0 && !tiles.every((tile) => tile.id.endsWith('-start'))
}
