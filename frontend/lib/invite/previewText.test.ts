/**
 * Unit tests for link-preview text — what WhatsApp shows under the title.
 */

import { describe, expect, it } from 'vitest'
import { PREVIEW_DESCRIPTION_MAX, htmlToPlainText, previewDescriptionFromHtml } from './previewText'

describe('htmlToPlainText', () => {
  it('keeps paragraphs and line breaks apart instead of gluing words together', () => {
    const html =
      '<p><strong>🎥 Join the class online</strong><br><br></p>' +
      '<p><strong>मराठी अभ्यासिका</strong> · Marathi class, Standard 1<br><strong>Tuesday, Sep 29</strong></p>'
    expect(htmlToPlainText(html)).toBe(
      '🎥 Join the class online मराठी अभ्यासिका · Marathi class, Standard 1 Tuesday, Sep 29',
    )
  })

  it('does not add spaces inside a word split by inline tags', () => {
    expect(htmlToPlainText('<p>Pass<strong>code</strong></p>')).toBe('Passcode')
  })

  it('decodes entities', () => {
    expect(htmlToPlainText('<p>Tom &amp; Jerry&nbsp;&lt;3 &#39;hi&#39; &#x1F388;</p>')).toBe("Tom & Jerry <3 'hi' 🎈")
  })

  it('leaves unknown entities as written', () => {
    expect(htmlToPlainText('a &bogus; b')).toBe('a &bogus; b')
  })
})

describe('previewDescriptionFromHtml', () => {
  it('returns short text whole', () => {
    expect(previewDescriptionFromHtml('<p>Join us</p>')).toBe('Join us')
  })

  it('cuts long text at a word and marks the cut', () => {
    const long = '<p>' + 'word '.repeat(80) + '</p>'
    const out = previewDescriptionFromHtml(long)
    expect(Array.from(out).length).toBeLessThanOrEqual(PREVIEW_DESCRIPTION_MAX)
    expect(out.endsWith('word…')).toBe(true)
  })

  it('never splits an emoji', () => {
    const out = previewDescriptionFromHtml('🎈'.repeat(300), 10)
    expect(Array.from(out)).toEqual([...Array(9).fill('🎈'), '…'])
  })
})
