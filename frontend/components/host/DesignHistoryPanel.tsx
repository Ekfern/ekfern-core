'use client'

import { useCallback, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import {
  getDesignVersion,
  listDesignVersions,
  timeAgo,
  VERSION_LABELS,
  type DesignVersion,
  type DesignVersionDetail,
} from '@/lib/designHistory'

export interface DesignHistoryPanelProps {
  eventId: number | string
  isOpen: boolean
  onClose: () => void
}

/**
 * What this invite's design used to look like.
 *
 * Read-only on purpose — there is no restore. A host opens a version to see how
 * it looked and what it was set to, then redoes it by hand, so nothing anyone
 * else did can be swept away by one click.
 */
export default function DesignHistoryPanel({ eventId, isOpen, onClose }: DesignHistoryPanelProps) {
  const [versions, setVersions] = useState<DesignVersion[]>([])
  const [selected, setSelected] = useState<DesignVersionDetail | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setVersions(await listDesignVersions(eventId))
    setLoading(false)
  }, [eventId])

  useEffect(() => {
    if (isOpen) load()
    else setSelected(null)
  }, [isOpen, load])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  const open = async (version: DesignVersion) => {
    setSelected(await getDesignVersion(eventId, version.id))
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/20"
      role="dialog"
      aria-modal="true"
      aria-label="Design history"
      onClick={onClose}
    >
      <aside
        className="flex h-full w-full max-w-md flex-col bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Design history</h2>
            <p className="text-xs text-gray-500">
              See how this invitation looked before. Changes are not undone for you.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close design history"
            className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="p-4 text-sm text-gray-500">Loading…</p>
          ) : versions.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">
              No earlier versions yet. They appear as you and any co-hosts edit this invitation.
            </p>
          ) : selected ? (
            <VersionDetail detail={selected} onBack={() => setSelected(null)} />
          ) : (
            <ul className="divide-y divide-gray-100">
              {versions.map((v, index) => (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => open(v)}
                    className="flex w-full items-baseline justify-between gap-2 px-4 py-3 text-left hover:bg-gray-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-gray-900">
                        {v.saved_by || 'Someone'}
                        {index === 0 ? <span className="text-gray-400"> · current</span> : null}
                      </span>
                      <span className="block text-xs text-gray-500">
                        {timeAgo(v.created_at)}
                        {v.label ? ` · ${VERSION_LABELS[v.label] ?? v.label}` : ''}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-gray-400">View</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  )
}

function VersionDetail({
  detail,
  onBack,
}: {
  detail: DesignVersionDetail
  onBack: () => void
}) {
  return (
    <div className="p-4">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 text-xs text-gray-500 underline hover:text-gray-700"
      >
        ← All versions
      </button>

      <p className="text-sm text-gray-900">{detail.saved_by || 'Someone'}</p>
      <p className="mb-3 text-xs text-gray-500">{timeAgo(detail.created_at)}</p>

      {detail.changes.length > 0 ? (
        <>
          <p className="mb-2 text-xs font-medium text-gray-700">What changed</p>
          <ul className="space-y-2">
            {detail.changes.map((c, i) => (
              <li key={`${c.location}-${i}`} className="text-xs">
                <p className="text-gray-700">{c.location}</p>
                <p className="text-gray-500">
                  <span className="line-through decoration-gray-300">{c.from}</span>
                  <span className="mx-1.5 text-gray-400">→</span>
                  <span className="text-gray-900">{c.to}</span>
                </p>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-xs text-gray-500">
          {detail.is_first
            ? 'This is the earliest version kept, so there is nothing before it to compare.'
            : 'Nothing visible changed in this version.'}
        </p>
      )}
    </div>
  )
}
