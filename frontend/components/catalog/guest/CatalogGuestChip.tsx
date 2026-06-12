'use client'

import React from 'react'
import { User } from 'lucide-react'
import type { CatalogTheme } from '../shared/catalogTheme'

export function CatalogGuestChip({
  guestName,
  theme,
}: {
  guestName?: string
  theme: CatalogTheme
}) {
  if (!guestName?.trim()) return null
  return (
    <div
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mx-auto"
      style={{ background: `${theme.primary}12`, color: theme.primary }}
    >
      <User className="h-3.5 w-3.5" />
      Responding as {guestName}
    </div>
  )
}
