'use client'

import React, { useState } from 'react'

const VISIBLE_TAGS = 4

export interface StudioLayoutTagsCellProps {
  /** The layout's own tags. */
  tags?: string[] | null
  /** Tags inherited from the linked design (shown in a lighter style). */
  designTags?: string[] | null
}

/**
 * Tags column for the Page Layout Studio list.
 *
 * Layout tags and design tags are separate stores: the layout owns `tags`, the
 * linked GreetingCardSample owns its own. Both are shown here, visually
 * distinct, so staff can tell which ones they can edit on the layout.
 */
export default function StudioLayoutTagsCell({
  tags,
  designTags,
}: StudioLayoutTagsCellProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false)
  const own = (tags ?? []).filter(Boolean)
  // A design tag that the layout already carries would just be a duplicate chip.
  const inherited = (designTags ?? []).filter((t) => t && !own.includes(t))

  if (own.length === 0 && inherited.length === 0) {
    return <span className="text-gray-400">—</span>
  }

  const all = [
    ...own.map((t) => ({ tag: t, inherited: false })),
    ...inherited.map((t) => ({ tag: t, inherited: true })),
  ]
  const shown = expanded ? all : all.slice(0, VISIBLE_TAGS)
  const hidden = all.length - shown.length

  return (
    <div className="flex flex-wrap gap-1 max-w-[220px]">
      {shown.map(({ tag, inherited: isInherited }) => (
        <span
          key={`${isInherited ? 'design' : 'own'}-${tag}`}
          title={isInherited ? `From the linked design: ${tag}` : tag}
          className={
            isInherited
              ? 'inline-flex items-center rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-[11px] text-gray-500'
              : 'inline-flex items-center rounded-full bg-eco-green-light px-2 py-0.5 text-[11px] text-eco-green'
          }
        >
          {tag}
        </span>
      ))}
      {hidden > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-[11px] text-gray-500 underline hover:text-gray-700"
        >
          +{hidden} more
        </button>
      ) : null}
    </div>
  )
}
