'use client'

import React from 'react'
import { Heart } from 'lucide-react'
import type { PublicCatalogItem } from '@/lib/catalog/types'
import { formatRupees } from '@/lib/catalog/types'
import { getActionLabel, getItemTypeLabel } from './itemLabels'

function placeholderGradient(itemId: number, primary: string): string {
  const hue = (itemId * 47) % 360
  return `linear-gradient(135deg, hsl(${hue} 35% 88%) 0%, ${primary}12 100%)`
}

function SuggestedPill({
  paise,
  primary,
  onClick,
}: {
  paise: number
  primary: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1 rounded-full text-xs font-medium border transition-colors hover:text-white"
      style={{ borderColor: primary, color: primary }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = primary
        e.currentTarget.style.color = '#fff'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = primary
      }}
    >
      {formatRupees(paise)}
    </button>
  )
}

function ItemBadges({ item, primary }: { item: PublicCatalogItem; primary: string }) {
  return (
    <div className="flex flex-wrap gap-1.5 mb-2">
      <span
        className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full font-semibold"
        style={{ background: `${primary}14`, color: primary }}
      >
        {getItemTypeLabel(item.item_type)}
      </span>
    </div>
  )
}

export function CatalogItemCard({
  item,
  primary,
  hero = false,
  onAction,
}: {
  item: PublicCatalogItem
  primary: string
  hero?: boolean
  onAction: (preselectedAmount?: string) => void
}) {
  const actionLabel = getActionLabel(item.action_type)
  const hasSuggested = item.amount_type === 'suggested' && !!item.suggested_amounts?.length

  if (hero) {
    return (
      <div
        className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-200 flex flex-col sm:flex-row w-full"
        style={{ maxWidth: '42rem' }}
      >
        {item.image_url ? (
          <div className="relative sm:w-56 flex-shrink-0 overflow-hidden" style={{ minHeight: '200px' }}>
            <img
              src={item.image_url}
              alt={item.title}
              className="absolute inset-0 w-full h-full object-cover object-top"
            />
          </div>
        ) : (
          <div
            className="sm:w-56 flex-shrink-0 flex items-center justify-center"
            style={{
              minHeight: '200px',
              background: placeholderGradient(item.id, primary),
            }}
          >
            <Heart className="h-12 w-12 opacity-15" style={{ color: primary }} />
          </div>
        )}
        <div className="p-6 flex flex-col flex-1 items-center text-center">
          <ItemBadges item={item} primary={primary} />
          <h3 className="font-semibold text-xl leading-snug mb-2" style={{ color: primary }}>
            {item.title}
          </h3>
          {item.description && (
            <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--theme-muted)' }}>
              {item.description}
            </p>
          )}
          {item.amount_type === 'fixed' && item.fixed_amount && (
            <p className="text-2xl font-bold mb-4" style={{ color: primary }}>
              {formatRupees(item.fixed_amount)}
            </p>
          )}
          {item.amount_type === 'flexible' && (
            <p className="text-sm mb-4" style={{ color: 'var(--theme-muted)' }}>
              Any amount you&apos;d like
            </p>
          )}
          {hasSuggested && (
            <div className="flex flex-wrap justify-center gap-2 mb-4">
              {item.suggested_amounts!.map((p) => (
                <SuggestedPill
                  key={p}
                  paise={p}
                  primary={primary}
                  onClick={() => onAction(String(p / 100))}
                />
              ))}
            </div>
          )}
          <div className="mt-auto w-full">
            <button
              type="button"
              onClick={() => onAction()}
              className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: primary }}
            >
              {actionLabel}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-200 flex flex-col w-full"
      style={{ maxWidth: '320px' }}
    >
      {item.image_url ? (
        <div className="relative w-full overflow-hidden" style={{ paddingTop: '56.25%' }}>
          <img
            src={item.image_url}
            alt={item.title}
            className="absolute inset-0 w-full h-full object-cover object-top"
          />
        </div>
      ) : (
        <div
          className="w-full relative"
          style={{
            paddingTop: '56.25%',
            background: placeholderGradient(item.id, primary),
          }}
        />
      )}
      <div className="p-4 flex flex-col flex-1">
        <ItemBadges item={item} primary={primary} />
        <h3 className="font-semibold text-base leading-snug mb-1" style={{ color: primary }}>
          {item.title}
        </h3>
        {item.description && (
          <p
            className="text-xs leading-relaxed mb-2 line-clamp-2"
            style={{ color: 'var(--theme-muted)' }}
          >
            {item.description}
          </p>
        )}
        {item.amount_type === 'fixed' && item.fixed_amount && (
          <p className="text-xl font-bold mb-3" style={{ color: primary }}>
            {formatRupees(item.fixed_amount)}
          </p>
        )}
        {item.amount_type === 'flexible' && (
          <p className="text-xs mb-3" style={{ color: 'var(--theme-muted)' }}>
            Any amount
          </p>
        )}
        {hasSuggested && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {item.suggested_amounts!.map((p) => (
              <SuggestedPill
                key={p}
                paise={p}
                primary={primary}
                onClick={() => onAction(String(p / 100))}
              />
            ))}
          </div>
        )}
        <div className="mt-auto">
          <button
            type="button"
            onClick={() => onAction()}
            className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: primary }}
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
