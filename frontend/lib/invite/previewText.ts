/**
 * Link-preview text from a Description tile's HTML.
 *
 * The live page's metadata and the editor's link-preview mock-up both call
 * this, so the text a host sees in the editor is the text WhatsApp receives.
 * They used to strip tags separately - and cut at different lengths - with a
 * bare tag regex that glued paragraphs together ("Join the class onlineमराठी")
 * and left entities like &amp; in place.
 */

export const PREVIEW_DESCRIPTION_MAX = 200

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : match
    }
    return ENTITIES[code.toLowerCase()] ?? match
  })
}

/** Plain text of rich-text HTML: every line and block break becomes a space. */
export function htmlToPlainText(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/(p|div|li|h[1-6]|blockquote|tr)>/gi, ' ')
      .replace(/<[^>]*>/g, ''),
  )
    .replace(/\s+/g, ' ')
    .trim()
}

/** Plain text trimmed to `max` characters, cut at a word with an ellipsis. */
export function previewDescriptionFromHtml(html: string, max = PREVIEW_DESCRIPTION_MAX): string {
  const text = htmlToPlainText(html)
  // Count characters, not UTF-16 units, so an emoji is never cut in half.
  const chars = Array.from(text)
  if (chars.length <= max) return text
  const cut = chars.slice(0, max - 1).join('')
  const lastSpace = cut.lastIndexOf(' ')
  const atWord = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut
  return `${atWord.trimEnd()}…`
}
