'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getCatalogResponses, updateResponseStatus } from '@/lib/catalog/api'
import type { CatalogResponse, ResponseStatus, ResponseType } from '@/lib/catalog/types'
import type { CatalogSource } from '@/lib/catalog/source'
import { sourceLabel } from '@/lib/catalog/source'
import { useToast } from '@/components/ui/toast'
import { CatalogResponsesSummary, filterResponses, groupByItem } from '@/components/catalog/host/CatalogResponsesSummary'
import { CatalogResponseRow } from '@/components/catalog/host/CatalogResponseRow'

const STATUS_CHOICES: ResponseStatus[] = [
  'new',
  'contacted',
  'confirmed',
  'completed',
  'cancelled',
]

const TYPE_CHOICES: { value: ResponseType | 'all'; label: string }[] = [
  { value: 'all', label: 'All types' },
  { value: 'pledge', label: 'Pledge' },
  { value: 'interest', label: 'Interest' },
  { value: 'external_click', label: 'External click' },
  { value: 'host_message', label: 'Message' },
]

export default function CatalogResponsesPage() {
  const params = useParams()
  const { showToast } = useToast()
  const eventId = parseInt(params.eventId as string)

  const [responses, setResponses] = useState<CatalogResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<ResponseStatus | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<ResponseType | 'all'>('all')
  const [sourceFilter, setSourceFilter] = useState<CatalogSource | 'all'>('all')
  const [search, setSearch] = useState('')
  const [groupByItemMode, setGroupByItemMode] = useState(false)

  useEffect(() => {
    getCatalogResponses(eventId)
      .then(setResponses)
      .catch(() => showToast('Failed to load responses.', 'error'))
      .finally(() => setLoading(false))
  }, [eventId])

  async function handleStatusChange(response: CatalogResponse, status: ResponseStatus) {
    try {
      const updated = await updateResponseStatus(eventId, response.id, status)
      setResponses((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
    } catch {
      showToast('Failed to update status.', 'error')
    }
  }

  const filtered = useMemo(
    () =>
      filterResponses(responses, {
        status: statusFilter,
        responseType: typeFilter,
        source: sourceFilter,
        search,
      }),
    [responses, statusFilter, typeFilter, sourceFilter, search],
  )

  const grouped = useMemo(() => groupByItem(filtered), [filtered])

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/host/events/${eventId}/catalog`}
          className="text-gray-400 hover:text-gray-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-eco-green">Catalog Responses</h1>
      </div>

      {!loading && responses.length > 0 && <CatalogResponsesSummary responses={responses} />}

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="search"
          placeholder="Search name, email, item…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-eco-green"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as ResponseType | 'all')}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          {TYPE_CHOICES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value as CatalogSource | 'all')}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="all">All sources</option>
          {(
            ['rsvp_confirmation', 'invite', 'direct', 'qr', 'event_page'] as CatalogSource[]
          ).map((s) => (
            <option key={s} value={s}>
              {sourceLabel(s)}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap">
          <input
            type="checkbox"
            checked={groupByItemMode}
            onChange={(e) => setGroupByItemMode(e.target.checked)}
            className="accent-eco-green"
          />
          Group by item
        </label>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(['all', ...STATUS_CHOICES] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              statusFilter === s
                ? 'bg-eco-green text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            {s !== 'all' && (
              <span className="ml-1 text-xs opacity-70">
                ({responses.filter((r) => r.status === s).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-12">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-gray-400 py-12">No responses match your filters.</div>
      ) : groupByItemMode ? (
        <div className="space-y-8">
          {grouped.map(({ itemTitle, responses: groupResponses }) => (
            <div key={itemTitle}>
              <h2 className="text-sm font-semibold text-eco-green mb-3">
                {itemTitle}
                <span className="ml-2 text-gray-400 font-normal">({groupResponses.length})</span>
              </h2>
              <div className="space-y-3">
                {groupResponses.map((r) => (
                  <CatalogResponseRow
                    key={r.id}
                    response={r}
                    onStatusChange={(status) => handleStatusChange(r, status)}
                    onCopied={(msg) => showToast(msg, 'success')}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <CatalogResponseRow
              key={r.id}
              response={r}
              onStatusChange={(status) => handleStatusChange(r, status)}
              onCopied={(msg) => showToast(msg, 'success')}
            />
          ))}
        </div>
      )}
    </div>
  )
}
