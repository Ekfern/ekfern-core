'use client'

import React from 'react'
import { Copy } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { catalogAbsoluteUrl } from '@/lib/catalog/source'

export function CatalogSharingCard({
  eventSlug,
  isPublic,
  onCopied,
}: {
  eventSlug: string
  isPublic: boolean
  onCopied: (label: string) => void
}) {
  const origin =
    typeof window !== 'undefined' ? window.location.origin : ''

  function copyLink(label: string, source: 'direct' | 'rsvp_confirmation' | 'qr') {
    if (!origin) return
    const url = catalogAbsoluteUrl(origin, eventSlug, { source })
    navigator.clipboard.writeText(url).then(
      () => onCopied(`${label} copied`),
      () => onCopied(`Could not copy ${label}`),
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-gray-500 uppercase tracking-wide">
          Share catalog
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-gray-500">
          Each link is tagged so you can see how guests found your catalog in Responses.
        </p>
        <div className="flex flex-col sm:flex-row flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => copyLink('Direct link', 'direct')}
          >
            <Copy className="h-4 w-4 mr-1" />
            Direct link
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => copyLink('After RSVP link', 'rsvp_confirmation')}
          >
            <Copy className="h-4 w-4 mr-1" />
            After RSVP
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => copyLink('QR / print link', 'qr')}
          >
            <Copy className="h-4 w-4 mr-1" />
            QR / print
          </Button>
        </div>
        <p className="text-xs text-gray-500">
          The <strong>After RSVP</strong> link is shown automatically on the RSVP confirmation page when
          that option is enabled in Settings. Use these copies for email, signage, or testing.
        </p>
        {!isPublic && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Private event: append each guest&apos;s <code className="text-[11px]">?g=token</code> from
            their invite for access.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
