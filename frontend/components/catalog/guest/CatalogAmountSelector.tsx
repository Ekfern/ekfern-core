'use client'

import React from 'react'
import { Input } from '@/components/ui/input'
import type { PublicCatalogItem } from '@/lib/catalog/types'
import { formatRupees } from '@/lib/catalog/types'

export function CatalogAmountSelector({
  item,
  value,
  primary,
  onChange,
}: {
  item: PublicCatalogItem
  value: string
  primary: string
  onChange: (v: string) => void
}) {
  if (item.amount_type === 'fixed' && item.fixed_amount) {
    return (
      <div className="rounded-lg px-3 py-2.5" style={{ background: `${primary}0D` }}>
        <span className="text-sm" style={{ color: primary }}>
          Amount: <strong>{formatRupees(item.fixed_amount)}</strong>
        </span>
      </div>
    )
  }

  if (item.amount_type === 'flexible') {
    return (
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--theme-muted)' }}>
          Amount (₹)
        </label>
        <Input
          type="number"
          placeholder="Enter amount"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    )
  }

  if (item.amount_type === 'suggested' && item.suggested_amounts) {
    return (
      <div>
        <label className="block text-xs font-medium mb-2" style={{ color: 'var(--theme-muted)' }}>
          Choose an amount
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          {item.suggested_amounts.map((p) => {
            const str = String(p / 100)
            const selected = value === str
            return (
              <button
                key={p}
                type="button"
                onClick={() => onChange(selected ? '' : str)}
                className="px-4 py-2 rounded-full text-sm font-medium border transition-all"
                style={
                  selected
                    ? { background: primary, color: '#fff', borderColor: primary }
                    : { borderColor: `${primary}40`, color: primary, background: 'white' }
                }
              >
                {formatRupees(p)}
              </button>
            )
          })}
        </div>
        <Input
          type="number"
          placeholder="Or enter a different amount"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    )
  }

  return null
}
