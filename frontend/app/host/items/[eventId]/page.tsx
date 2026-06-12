'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function RegistryRedirect() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.eventId as string

  useEffect(() => {
    router.replace(`/host/events/${eventId}/catalog`)
  }, [eventId, router])

  return null
}
