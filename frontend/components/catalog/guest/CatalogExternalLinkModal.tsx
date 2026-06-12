'use client'

import React from 'react'
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { PublicCatalogItem } from '@/lib/catalog/types'
import type { CatalogTheme } from '../shared/catalogTheme'
import { CatalogModal } from '../shared/CatalogModal'

export function CatalogExternalLinkModal({
  item,
  theme,
  onContinue,
  onClose,
}: {
  item: PublicCatalogItem
  theme: CatalogTheme
  onContinue: () => void
  onClose: () => void
}) {
  return (
    <CatalogModal onClose={onClose}>
      <div className="text-center space-y-4">
        <p className="text-sm" style={{ color: 'var(--theme-muted)' }}>
          You&apos;re leaving this page
        </p>
        <p className="font-semibold text-lg" style={{ color: theme.primary }}>
          {item.title}
        </p>
        <div className="flex gap-3 justify-center">
          <Button
            onClick={onContinue}
            className="text-white"
            style={{ background: theme.primary }}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Continue
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </CatalogModal>
  )
}
