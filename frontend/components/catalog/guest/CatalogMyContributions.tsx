'use client'

import React from 'react'
import { Receipt } from 'lucide-react'
import { formatRupees, type MyCatalogResponse } from '@/lib/catalog/types'
import type { CatalogTheme } from '../shared/catalogTheme'

/**
 * A guest's own record of what they gave.
 *
 * This is the receipt for anyone who gave without an email address, which the
 * registry no longer insists on - phone identifies the giver, email is the
 * optional extra. They identify themselves the way they do everywhere else and
 * can come back to this whenever they like.
 */
export function CatalogMyContributions({
  responses,
  theme,
}: {
  responses: MyCatalogResponse[]
  theme: CatalogTheme
}) {
  if (responses.length === 0) return null

  return (
    <section className="mx-auto w-full max-w-3xl px-4 pb-10" aria-labelledby="my-contributions">
      <div
        className="rounded-2xl border p-5"
        style={{ borderColor: `${theme.primary}20`, background: '#fff' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Receipt className="h-4 w-4 shrink-0" style={{ color: theme.primary, opacity: 0.6 }} />
          <h2 id="my-contributions" className="font-semibold" style={{ color: theme.primary }}>
            Your contributions
          </h2>
        </div>

        <ul className="divide-y" style={{ borderColor: `${theme.primary}15` }}>
          {responses.map((r) => {
            const amount = r.amount ? formatRupees(r.amount) : null
            return (
              <li key={r.id} className="flex items-baseline justify-between gap-4 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: theme.fg }}>
                    {r.item_title}
                  </p>
                  {r.message && (
                    <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--theme-muted)' }}>
                      “{r.message}”
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {amount && (
                    <p className="text-sm font-semibold tabular-nums" style={{ color: theme.primary }}>
                      {amount}
                    </p>
                  )}
                  <p className="text-xs" style={{ color: 'var(--theme-muted)' }}>
                    {new Date(r.created_at).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
