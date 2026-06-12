'use client'

import React from 'react'
import Link from 'next/link'
import { Heart } from 'lucide-react'
import type { PublicCatalogItem } from '@/lib/catalog/types'
import type { CatalogTheme } from '../shared/catalogTheme'

export function CatalogSuccessState({
  item,
  theme,
  slug,
  guestToken,
  onChooseAnother,
  onClose,
}: {
  item: PublicCatalogItem
  theme: CatalogTheme
  slug: string
  guestToken?: string
  onChooseAnother: () => void
  onClose: () => void
}) {
  const inviteHref = guestToken ? `/invite/${slug}?g=${guestToken}` : `/invite/${slug}`

  return (
    <div className="text-center space-y-5 py-4">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
        style={{ background: `${theme.primary}15` }}
      >
        <Heart className="h-8 w-8" style={{ color: theme.primary }} />
      </div>
      <div>
        <p className="font-semibold text-lg mb-1" style={{ color: theme.primary }}>
          Thank you!
        </p>
        <p className="text-sm" style={{ color: 'var(--theme-muted)' }}>
          Your response for <strong style={{ color: theme.fg }}>{item.title}</strong> has been
          received. The host will be in touch with you shortly.
        </p>
      </div>
      {item.manual_instructions && (
        <div
          className="text-left rounded-lg px-4 py-3 text-sm"
          style={{ background: `${theme.primary}0D`, color: theme.primary }}
        >
          {item.manual_instructions}
        </div>
      )}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onChooseAnother}
          className="w-full py-3 rounded-xl text-sm font-semibold text-white"
          style={{ background: theme.primary }}
        >
          Choose another item
        </button>
        <Link
          href={inviteHref}
          className="w-full py-3 rounded-xl text-sm font-medium border block text-center transition-colors hover:opacity-80"
          style={{ borderColor: `${theme.primary}30`, color: theme.primary }}
        >
          Return to invitation
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="text-xs underline opacity-60"
          style={{ color: theme.muted }}
        >
          Close
        </button>
      </div>
    </div>
  )
}
