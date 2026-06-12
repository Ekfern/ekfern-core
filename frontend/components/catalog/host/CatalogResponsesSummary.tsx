'use client'

import React from 'react'
import type { CatalogResponse, ResponseStatus, ResponseType } from '@/lib/catalog/types'
import type { CatalogSource } from '@/lib/catalog/source'
import { formatRupees } from '@/lib/catalog/types'

export function CatalogResponsesSummary({ responses }: { responses: CatalogResponse[] }) {
  const pledgeTotal = responses
    .filter((r) => r.response_type === 'pledge' && r.amount)
    .reduce((sum, r) => sum + (r.amount || 0), 0)

  const byStatus = (['new', 'contacted', 'confirmed', 'completed', 'cancelled'] as ResponseStatus[]).map(
    (s) => ({
      status: s,
      count: responses.filter((r) => r.status === s).length,
    }),
  )

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="rounded-lg border border-eco-green-light bg-white p-4">
        <p className="text-2xl font-bold text-eco-green">{responses.length}</p>
        <p className="text-xs text-gray-500 mt-0.5">Total responses</p>
      </div>
      <div className="rounded-lg border border-eco-green-light bg-white p-4">
        <p className="text-2xl font-bold text-eco-green">
          {pledgeTotal > 0 ? formatRupees(pledgeTotal) : '—'}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">Pledged (intent)</p>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-4 col-span-2 sm:col-span-2">
        <p className="text-xs text-gray-500 mb-2">By status</p>
        <div className="flex flex-wrap gap-2">
          {byStatus.map(({ status, count }) =>
            count > 0 ? (
              <span
                key={status}
                className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 capitalize"
              >
                {status}: {count}
              </span>
            ) : null,
          )}
        </div>
      </div>
    </div>
  )
}

export function filterResponses(
  responses: CatalogResponse[],
  opts: {
    status: ResponseStatus | 'all'
    responseType: ResponseType | 'all'
    source?: CatalogSource | 'all'
    search: string
  },
): CatalogResponse[] {
  let list = responses
  if (opts.status !== 'all') {
    list = list.filter((r) => r.status === opts.status)
  }
  if (opts.responseType !== 'all') {
    list = list.filter((r) => r.response_type === opts.responseType)
  }
  if (opts.source && opts.source !== 'all') {
    list = list.filter((r) => r.source === opts.source)
  }
  if (opts.search.trim()) {
    const q = opts.search.toLowerCase()
    list = list.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.item_title.toLowerCase().includes(q) ||
        (r.phone && r.phone.includes(q)),
    )
  }
  return list
}

export function groupByItem(
  responses: CatalogResponse[],
): { itemTitle: string; responses: CatalogResponse[] }[] {
  const map = new Map<string, CatalogResponse[]>()
  for (const r of responses) {
    const key = r.item_title || 'Unknown item'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(r)
  }
  return Array.from(map.entries()).map(([itemTitle, rs]) => ({
    itemTitle,
    responses: rs,
  }))
}
