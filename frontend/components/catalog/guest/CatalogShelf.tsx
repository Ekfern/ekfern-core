'use client'

import React from 'react'
import type { CatalogTheme } from '../shared/catalogTheme'

export function CatalogShelf({
  eyebrow,
  contextLine,
  trustLine,
  theme,
  children,
}: {
  eyebrow: string
  contextLine?: string | null
  trustLine: string
  theme: CatalogTheme
  children: React.ReactNode
}) {
  return (
    <section className="max-w-6xl mx-auto px-4 pb-20 -mt-2">
      <div
        className="rounded-2xl shadow-sm border px-4 sm:px-8 py-8 sm:py-10"
        style={{
          background: '#fff',
          borderColor: `${theme.primary}18`,
        }}
      >
        <div className="text-center mb-8 max-w-2xl mx-auto space-y-2">
          <p
            className="text-xs font-semibold uppercase tracking-[0.2em]"
            style={{ color: theme.primary, opacity: 0.65 }}
          >
            {eyebrow}
          </p>
          {contextLine && (
            <p className="text-sm leading-relaxed" style={{ color: theme.fg, opacity: 0.75 }}>
              {contextLine}
            </p>
          )}
          <p className="text-xs leading-relaxed" style={{ color: theme.muted }}>
            {trustLine}
          </p>
        </div>
        {children}
      </div>
    </section>
  )
}
