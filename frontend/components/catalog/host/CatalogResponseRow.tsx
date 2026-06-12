'use client'

import React, { useState } from 'react'
import { ChevronDown, ChevronUp, Copy, Mail } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { CatalogResponse, ResponseStatus } from '@/lib/catalog/types'
import { formatRupees } from '@/lib/catalog/types'
import { sourceLabel } from '@/lib/catalog/source'

const RESPONSE_TYPE_LABELS: Record<string, string> = {
  pledge: 'Pledge',
  interest: 'Interest',
  external_click: 'External click',
  host_message: 'Message',
}

const STATUS_COLORS: Record<ResponseStatus, string> = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-500',
}

const STATUS_CHOICES: ResponseStatus[] = [
  'new',
  'contacted',
  'confirmed',
  'completed',
  'cancelled',
]

export function CatalogResponseRow({
  response,
  onStatusChange,
  onCopied,
}: {
  response: CatalogResponse
  onStatusChange: (status: ResponseStatus) => void
  onCopied: (label: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  function copyText(text: string, label: string) {
    navigator.clipboard.writeText(text).then(
      () => onCopied(`${label} copied`),
      () => onCopied(`Could not copy ${label}`),
    )
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[response.status]}`}
              >
                {response.status.charAt(0).toUpperCase() + response.status.slice(1)}
              </span>
              <span className="text-xs text-gray-500">
                {RESPONSE_TYPE_LABELS[response.response_type]}
              </span>
            </div>
            <p className="font-medium text-gray-900">{response.name}</p>
            <p className="text-sm text-gray-500">
              {response.email}
              {response.phone ? ` · ${response.phone}` : ''}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              Item: <span className="font-medium">{response.item_title}</span>
              {response.amount && (
                <span className="ml-2 text-eco-green font-medium">
                  {formatRupees(response.amount)}
                </span>
              )}
            </p>
            {response.message && !expanded && (
              <p className="text-sm text-gray-500 mt-1 italic line-clamp-1">
                &ldquo;{response.message}&rdquo;
              </p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              {new Date(response.created_at).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
              {' · '}
              {sourceLabel(response.source)}
            </p>
          </div>
          <div className="flex flex-col gap-2 flex-shrink-0 items-end">
            <select
              value={response.status}
              onChange={(e) => onStatusChange(e.target.value as ResponseStatus)}
              className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-eco-green"
            >
              {STATUS_CHOICES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-gray-500 flex items-center gap-0.5 hover:text-eco-green"
            >
              {expanded ? (
                <>
                  Less <ChevronUp className="h-3 w-3" />
                </>
              ) : (
                <>
                  More <ChevronDown className="h-3 w-3" />
                </>
              )}
            </button>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
            {response.message && (
              <p className="text-sm text-gray-600 italic">&ldquo;{response.message}&rdquo;</p>
            )}
            <div className="flex flex-wrap gap-2">
              <a
                href={`mailto:${response.email}`}
                className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border border-gray-200 hover:border-eco-green hover:text-eco-green"
              >
                <Mail className="h-3 w-3" />
                Email
              </a>
              <button
                type="button"
                onClick={() => copyText(response.email, 'Email')}
                className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border border-gray-200 hover:border-eco-green hover:text-eco-green"
              >
                <Copy className="h-3 w-3" />
                Copy email
              </button>
              {response.phone && (
                <button
                  type="button"
                  onClick={() => copyText(response.phone, 'Phone')}
                  className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border border-gray-200 hover:border-eco-green hover:text-eco-green"
                >
                  <Copy className="h-3 w-3" />
                  Copy phone
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1">
              {STATUS_CHOICES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onStatusChange(s)}
                  className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                    response.status === s
                      ? 'bg-eco-green text-white border-eco-green'
                      : 'border-gray-200 text-gray-600 hover:border-eco-green'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
