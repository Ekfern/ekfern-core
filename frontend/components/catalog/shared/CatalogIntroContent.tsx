'use client'

import React from 'react'

const INTRO_CONTENT_STYLES = `
  .catalog-intro-content {
    line-height: 1.75;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }
  .catalog-intro-content p {
    margin: 0;
    padding: 0;
    min-height: 1.75em;
    line-height: 1.75;
  }
  .catalog-intro-content p + p {
    margin-top: 0.75em;
  }
  .catalog-intro-content a {
    text-decoration: underline;
  }
`

export function CatalogIntroContent({
  html,
  className = '',
  invert = false,
}: {
  html: string
  className?: string
  /** White/light text on banner overlay */
  invert?: boolean
}) {
  const isHTML = /<[a-z][\s\S]*>/i.test(html)
  const proseClass = invert
    ? 'prose prose-sm prose-invert max-w-none'
    : 'prose prose-sm max-w-none'

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: INTRO_CONTENT_STYLES }} />
      {isHTML ? (
        <div
          className={`catalog-intro-content break-words ${proseClass} ${className}`}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <p className={`catalog-intro-content whitespace-pre-wrap break-words ${className}`}>
          {html}
        </p>
      )}
    </>
  )
}
