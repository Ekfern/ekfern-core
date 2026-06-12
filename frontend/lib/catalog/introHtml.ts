/** True when TipTap/HTML content has no visible text */
export function isEmptyIntroHtml(html: string | null | undefined): boolean {
  if (!html?.trim()) return true
  const text = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
  return text.length === 0
}
