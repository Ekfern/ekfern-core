/**
 * The invitation's headline: its first Title tile, shown or hidden.
 *
 * It is the event's name as guests know it - WhatsApp messages, emails and the
 * link preview use it (backend Event.invitation_title) - so it can be hidden on
 * the page, for a poster that carries the names in its artwork, but never
 * deleted or left blank. Any further Title tiles are decoration.
 */

import type { Tile } from './schema'

export function headlineTile(tiles: readonly Tile[] | undefined): Tile | undefined {
  return [...(tiles ?? [])].filter((t) => t.type === 'title').sort((a, b) => a.order - b.order)[0]
}

export function headlineText(tiles: readonly Tile[] | undefined): string {
  const text = (headlineTile(tiles)?.settings as { text?: string } | undefined)?.text
  return (text ?? '').trim()
}
