'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { CatalogTheme } from '../shared/catalogTheme'

export function CatalogEmptyState({
  message,
  slug,
  guestToken,
  theme,
}: {
  message: string
  slug: string
  guestToken?: string
  theme: CatalogTheme
}) {
  const inviteHref = guestToken ? `/invite/${slug}?g=${guestToken}` : `/invite/${slug}`

  return (
    <div className="text-center py-16 px-6 space-y-4">
      <div
        className="w-16 h-16 mx-auto rounded-full flex items-center justify-center"
        style={{ background: `${theme.primary}12` }}
      >
        <span className="text-2xl opacity-40" style={{ color: theme.primary }}>
          ···
        </span>
      </div>
      <p className="text-sm max-w-xs mx-auto" style={{ color: theme.muted }}>
        {message}
      </p>
      <Link
        href={inviteHref}
        className="inline-flex items-center gap-1.5 text-sm font-medium"
        style={{ color: theme.primary }}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to invitation
      </Link>
    </div>
  )
}
