'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { getErrorMessage, logError, logDebug } from '@/lib/error-handler'
import WizardProgress from '@/components/host/WizardProgress'
import EventDetailsForm, { type EventDetailsFormData } from '@/components/host/EventDetailsForm'

export default function NewEventPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)

  const onSubmit = async (data: EventDetailsFormData) => {
    setLoading(true)
    try {
      const response = await api.post('/api/events/', data)
      const eventId = response.data.id
      if (!eventId) {
        logError('Event ID not found in response:', response.data)
        showToast('Event created but ID not found. Please refresh the dashboard.', 'error')
        router.push('/host/dashboard')
        return
      }
      logDebug('Event created successfully, navigating to layout step:', eventId)
      showToast('Event created! Now let\'s pick a page layout.', 'success')
      setTimeout(() => {
        router.push(`/host/events/${eventId}/layout`)
      }, 100)
    } catch (error: unknown) {
      logError('Event creation error:', error)
      showToast(getErrorMessage(error), 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-eco-beige">
      <WizardProgress currentStep={1} />
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-4xl font-bold mb-2 text-eco-green">Create Your Event</h1>
        <p className="text-lg text-gray-700 mb-8">Start with your basic details — you can add RSVP or a host catalog anytime.</p>
        <Card className="bg-white border-2 border-eco-green-light">
          <CardHeader>
            <CardTitle className="text-eco-green">Event Details</CardTitle>
          </CardHeader>
          <CardContent>
            <EventDetailsForm
              onSubmit={onSubmit}
              submitLabel="Next: Choose Layout"
              loading={loading}
              onCancel={() => router.back()}
            />
            <p className="text-sm text-center text-gray-600 mt-4">
              You can enable RSVP or Registry later from your Dashboard.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
