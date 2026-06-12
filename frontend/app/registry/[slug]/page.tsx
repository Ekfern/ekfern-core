'use client'

import { useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'

/**
 * Legacy URL — redirects to Host Catalog. Preserves query params (guest token, attribution, etc.).
 */
export default function RegistryRedirect() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const slug = params.slug as string

  useEffect(() => {
    const qs = new URLSearchParams(searchParams.toString())
    const legacyGt = qs.get('gt')
    if (legacyGt && !qs.get('g')) {
      qs.set('g', legacyGt)
      qs.delete('gt')
    }
    const dest = qs.toString() ? `/catalog/${slug}?${qs}` : `/catalog/${slug}`
    router.replace(dest)
  }, [slug, router, searchParams])

  return null
}
