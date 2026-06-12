'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { formatPhoneWithCountryCode } from '@/lib/countryCodesFull'
import CountryCodeSelector from '@/components/CountryCodeSelector'
import { getErrorMessage, logError } from '@/lib/error-handler'
import type { RsvpCustomFieldConfig, RsvpFormConfig } from '@/lib/invite/schema'
import {
  getCatalogButtonLabel,
  shouldShowCatalogOnRsvpConfirmation,
} from '@/lib/catalog/placement'
import { catalogUrl } from '@/lib/catalog/source'
import type { CatalogPurpose } from '@/lib/catalog/types'

const rsvpSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(10, 'Valid phone number is required'),
  country_code: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  will_attend: z.enum(['yes', 'no', 'maybe']),
  guests_count: z.number().min(1).default(1),
  notes: z.string().optional(),
})

type RSVPForm = z.infer<typeof rsvpSchema>
type Step = 'verify' | 'details' | 'decision' | 'sessions' | 'slot' | 'optional' | 'review' | 'success'

const CAPACITY_FULL_MESSAGE = 'No seats available. Please reach out to the host.'

interface Event {
  id: number
  title: string
  country_code: string
  has_rsvp?: boolean
  has_registry?: boolean
  catalog_show_on_rsvp_confirmation?: boolean
  catalog_title?: string
  catalog_purpose?: CatalogPurpose
  is_public?: boolean
  slug?: string
  host_name?: string | null
  rsvp_experience_mode?: 'standard' | 'sub_event' | 'slot_based' | 'auto_confirm'
  rsvp_mode?: 'PER_SUBEVENT' | 'ONE_TAP_ALL'
  rsvp_total_capacity?: number | null
  rsvp_block_on_full_capacity?: boolean
  rsvp_registration_full?: boolean
  rsvp_require_sub_event_selection?: boolean
  page_config?: { rsvpForm?: RsvpFormConfig }
}
interface CalendarDayAvailability { date: string; status: 'available' | 'sold_out'; availabilityLabel: string }
interface SlotAvailability {
  slotId: number
  date: string
  startAt: string
  endAt: string
  label: string
  remainingSeats: number | null
  status: 'available' | 'unavailable' | 'sold_out' | 'hidden'
}
interface RsvpSubEvent {
  id: number
  title: string
  start_at?: string | null
  location?: string | null
}

const formatMonthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

const STEP_TITLES: Record<Exclude<Step, 'success'>, string> = {
  verify: 'Verify phone',
  details: 'Your details',
  decision: 'Will you be joining us?',
  sessions: 'Choose sessions',
  slot: 'Pick a slot',
  optional: 'Additional details',
  review: 'Review and confirm',
}

export default function RSVPPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const slug = params.slug as string
  const { showToast } = useToast()

  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [calendarAvailability, setCalendarAvailability] = useState<CalendarDayAvailability[]>([])
  const [selectedSlotDate, setSelectedSlotDate] = useState('')
  const [slotOptions, setSlotOptions] = useState<SlotAvailability[]>([])
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null)
  const [calendarMonthDate, setCalendarMonthDate] = useState<Date>(new Date())
  const [slotResponseChoice, setSlotResponseChoice] = useState<'book' | 'decline'>('book')
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({})
  const [customFieldErrors, setCustomFieldErrors] = useState<Record<string, string>>({})
  const [summary, setSummary] = useState<any>(null)
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [verifyingPhone, setVerifyingPhone] = useState(false)
  const [checkingRegistration, setCheckingRegistration] = useState(false)
  const [registrationBlocked, setRegistrationBlocked] = useState(false)
  const [availableSubEvents, setAvailableSubEvents] = useState<RsvpSubEvent[]>([])
  const [selectedSubEventIds, setSelectedSubEventIds] = useState<number[]>([])
  const [currentStep, setCurrentStep] = useState<Step>('details')

  const guestToken = searchParams.get('g') || searchParams.get('token')
  const sourceChannel = searchParams.get('source') === 'qr' ? 'qr' : 'link'
  const needsVerification = !!event && !event.is_public && !guestToken
  const isSlotMode = event?.rsvp_experience_mode === 'slot_based'
  const isSubEventMode = event?.rsvp_experience_mode === 'sub_event'
  const isPerSubeventRsvp = isSubEventMode && event?.rsvp_mode === 'PER_SUBEVENT'
  const showSessionPicker = isPerSubeventRsvp && availableSubEvents.length > 0
  const requireSessionSelection = !!event?.rsvp_require_sub_event_selection && showSessionPicker
  const isAutoConfirm = event?.rsvp_experience_mode === 'auto_confirm'
  const capacityApplies =
    !!event &&
    !isSlotMode &&
    (event.rsvp_experience_mode === 'standard' || event.rsvp_experience_mode === 'auto_confirm') &&
    !!event.rsvp_block_on_full_capacity &&
    !!event.rsvp_total_capacity
  const isIntentFirstFlow = !!event?.is_public && isSlotMode

  const { register, watch, setValue, getValues, formState: { errors } } = useForm<RSVPForm>({
    resolver: zodResolver(rsvpSchema),
    defaultValues: { will_attend: 'yes', guests_count: 1, country_code: '+91', notes: '', email: '' },
  })

  const willAttend = watch('will_attend')
  const rsvpFormConfig = (event?.page_config as any)?.rsvpForm as RsvpFormConfig | undefined
  const isEmailEnabled = rsvpFormConfig?.systemFields?.email?.enabled ?? true
  const isNotesEnabled = rsvpFormConfig?.systemFields?.notes?.enabled ?? true
  const notesLabel = rsvpFormConfig?.systemFields?.notes?.label || 'Notes (optional)'
  const activeCustomFields = (rsvpFormConfig?.customFields || []).filter((f: any) => f?.enabled) as RsvpCustomFieldConfig[]
  const calendarMonthKey = formatMonthKey(calendarMonthDate)
  const calendarMonthLabel = calendarMonthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  useEffect(() => { fetchEvent() }, [slug])
  useEffect(() => {
    if (!event || registrationBlocked) return
    if (needsVerification && !phoneVerified) {
      setCurrentStep('verify')
      return
    }
    setCurrentStep(isIntentFirstFlow ? 'decision' : 'details')
  }, [event, needsVerification, isIntentFirstFlow, registrationBlocked, phoneVerified])
  useEffect(() => {
    if (!event?.slug || !isPerSubeventRsvp) return
    fetchSubEvents()
  }, [event?.slug, event?.rsvp_mode, isPerSubeventRsvp, guestToken])
  useEffect(() => {
    if (!event?.id || !guestToken) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await api.get(`/api/events/${event.id}/rsvp/guest-by-token/`, {
          params: { g: guestToken },
        })
        if (cancelled) return
        applyLookupData(res.data)
        if (Array.isArray(res.data?.sub_event_invites) && res.data.sub_event_invites.length > 0) {
          setSelectedSubEventIds(res.data.sub_event_invites.map((id: number) => Number(id)))
        }
        setPhoneVerified(true)
      } catch (error: any) {
        logError('Failed to load guest token', error)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [event?.id, guestToken])
  useEffect(() => {
    if (!isSlotMode) return
    setValue('will_attend', slotResponseChoice === 'book' ? 'yes' : 'no', { shouldValidate: false })
  }, [slotResponseChoice, isSlotMode, setValue])

  const visibleSteps = useMemo(() => {
    const list: Step[] = []
    if (needsVerification && !phoneVerified) list.push('verify')
    if (isIntentFirstFlow) {
      list.push('decision')
      if (slotResponseChoice === 'book') list.push('slot')
      list.push('details')
    } else {
      list.push('details')
      if (showSessionPicker) list.push('sessions')
      if (!isAutoConfirm) list.push('decision')
      if (isSlotMode && slotResponseChoice === 'book') list.push('slot')
    }
    list.push('optional', 'review')
    return list
  }, [needsVerification, phoneVerified, isSlotMode, isAutoConfirm, slotResponseChoice, isIntentFirstFlow, showSessionPicker])
  const stepIndex = currentStep === 'success' ? visibleSteps.length : Math.max(0, visibleSteps.indexOf(currentStep)) + 1

  const applyLookupData = (data: any) => {
    if (data.name) setValue('name', data.name, { shouldValidate: false })
    if (data.email) setValue('email', data.email, { shouldValidate: false })
    if (data.guests_count) setValue('guests_count', Math.max(1, data.guests_count), { shouldValidate: false })
    if (data.notes) setValue('notes', data.notes, { shouldValidate: false })
    if (data.will_attend) setValue('will_attend', data.will_attend, { shouldValidate: false })
  }

  const beginRsvpFlow = () => {
    setRegistrationBlocked(false)
    setPhoneVerified(true)
    if (needsVerification) setCurrentStep('details')
    else setCurrentStep(isIntentFirstFlow ? 'decision' : 'details')
  }

  const fetchSubEvents = async () => {
    if (!slug || !isPerSubeventRsvp) return
    try {
      const params: Record<string, string> = {}
      if (guestToken) params.g = guestToken
      const res = await api.get(`/api/events/public/${slug}/rsvp-sub-events/`, { params })
      setAvailableSubEvents(res.data?.results || [])
    } catch {
      setAvailableSubEvents([])
    }
  }

  const fetchEvent = async () => {
    try {
      const response = await api.get(`/api/events/invite/${slug}/`)
      const eventData = response.data
      if (!eventData.has_rsvp) {
        showToast('RSVP is not available for this event', 'info')
        router.push(`/invite/${slug}`)
        return
      }
      setEvent({ ...eventData, slug })
      setValue('country_code', eventData.country_code || '+91', { shouldValidate: false })
      const full =
        !!eventData.rsvp_registration_full &&
        !!eventData.rsvp_block_on_full_capacity &&
        !!eventData.rsvp_total_capacity &&
        (eventData.rsvp_experience_mode === 'standard' || eventData.rsvp_experience_mode === 'auto_confirm')
      setRegistrationBlocked(full && !!eventData.is_public)
      if (eventData.rsvp_experience_mode === 'slot_based') await fetchCalendarByMonth(formatMonthKey(new Date()))
    } catch (error: any) {
      logError('Failed to fetch event', error)
      showToast(getErrorMessage(error, 'Unable to load event'), 'error')
    } finally {
      setLoading(false)
    }
  }

  const fetchSlotsByDate = async (date: string) => {
    try {
      const res = await api.get(`/api/events/public/${slug}/booking-slots/`, { params: { date } })
      setSlotOptions(res.data?.results || [])
    } catch {
      setSlotOptions([])
      showToast('Unable to load slots for selected date', 'error')
    }
  }

  const fetchCalendarByMonth = async (month: string) => {
    try {
      const cal = await api.get(`/api/events/public/${slug}/booking-calendar/`, { params: { month } })
      setCalendarAvailability(cal.data?.results || [])
    } catch {
      setCalendarAvailability([])
      showToast('Unable to load calendar for this month', 'error')
    }
  }

  const moveCalendarMonth = (delta: number) => {
    const next = new Date(calendarMonthDate.getFullYear(), calendarMonthDate.getMonth() + delta, 1)
    setCalendarMonthDate(next)
    setSelectedSlotDate('')
    setSelectedSlotId(null)
    setSlotOptions([])
    fetchCalendarByMonth(formatMonthKey(next))
  }

  const verifyPhone = async () => {
    if (!event) return
    const phone = getValues('phone')
    const countryCode = getValues('country_code') || event.country_code || '+91'
    if (!phone || phone.length < 10) return showToast('Please enter a valid phone number', 'error')
    setVerifyingPhone(true)
    try {
      const response = await api.post(`/api/events/${event.id}/rsvp/check/phone/`, { phone, country_code: countryCode })
      applyLookupData(response.data)
      beginRsvpFlow()
      showToast('Phone verified', 'success')
    } catch (error: any) {
      if (error.response?.data?.errorCode === 'CAPACITY_FULL') {
        setRegistrationBlocked(true)
        return
      }
      showToast(getErrorMessage(error, 'Could not verify phone number'), 'error')
    } finally {
      setVerifyingPhone(false)
    }
  }

  const checkExistingRegistration = async () => {
    if (!event) return
    const phone = getValues('phone')
    const countryCode = getValues('country_code') || event.country_code || '+91'
    if (!phone || phone.length < 10) return showToast('Please enter a valid phone number', 'error')
    setCheckingRegistration(true)
    try {
      const response = await api.post(`/api/events/${event.id}/rsvp/registration-status/`, {
        phone,
        country_code: countryCode,
      })
      applyLookupData(response.data)
      beginRsvpFlow()
      showToast('Welcome back — you can update your RSVP below.', 'success')
    } catch (error: any) {
      if (error.response?.data?.errorCode === 'CAPACITY_FULL') {
        setRegistrationBlocked(true)
        showToast(CAPACITY_FULL_MESSAGE, 'info')
        return
      }
      showToast(getErrorMessage(error, 'Could not find an existing RSVP for this number'), 'error')
    } finally {
      setCheckingRegistration(false)
    }
  }

  const validateCustomFields = () => {
    const nextErrors: Record<string, string> = {}
    if (willAttend === 'yes') {
      for (const field of activeCustomFields) {
        if (!field.required) continue
        const val = customFieldValues[field.key]
        if (!val || String(val).trim() === '') nextErrors[field.key] = 'This field is required'
      }
    }
    setCustomFieldErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const goNext = () => {
    if (currentStep === 'details') {
      const values = getValues()
      if (!values.name?.trim()) return showToast('Name is required', 'error')
      if (!values.phone?.trim() || values.phone.length < 10) return showToast('Valid phone number is required', 'error')
      if ((values.guests_count || 1) < 1) return showToast('Guest count must be at least 1', 'error')
      if (isIntentFirstFlow) return setCurrentStep('decision')
      if (showSessionPicker) return setCurrentStep('sessions')
      if (!isAutoConfirm) return setCurrentStep('decision')
      return setCurrentStep('optional')
    }
    if (currentStep === 'sessions') {
      return setCurrentStep(!isAutoConfirm ? 'decision' : 'optional')
    }
    if (currentStep === 'decision') {
      if (isIntentFirstFlow) return setCurrentStep(isSlotMode && slotResponseChoice === 'book' ? 'slot' : 'details')
      return setCurrentStep(isSlotMode && slotResponseChoice === 'book' ? 'slot' : 'optional')
    }
    if (currentStep === 'slot') {
      if (!selectedSlotId) return showToast('Please select a slot', 'error')
      return setCurrentStep(isIntentFirstFlow ? 'details' : 'optional')
    }
    if (currentStep === 'optional') {
      if (!validateCustomFields()) return
      return setCurrentStep('review')
    }
  }

  const goBack = () => {
    if (currentStep === 'decision') {
      if (showSessionPicker) setCurrentStep('sessions')
      else setCurrentStep(isIntentFirstFlow ? 'decision' : 'details')
    } else if (currentStep === 'sessions') setCurrentStep('details')
    else if (currentStep === 'slot') setCurrentStep('decision')
    else if (currentStep === 'details') setCurrentStep(isIntentFirstFlow ? (slotResponseChoice === 'book' ? 'slot' : 'decision') : 'details')
    else if (currentStep === 'optional') {
      if (isIntentFirstFlow) setCurrentStep('details')
      else if (!isAutoConfirm) setCurrentStep('decision')
      else if (showSessionPicker) setCurrentStep('sessions')
      else setCurrentStep(isSlotMode && slotResponseChoice === 'book' ? 'slot' : 'details')
    }
    else if (currentStep === 'review') setCurrentStep('optional')
  }

  const submit = async () => {
    if (!event) return
    const data = getValues()
    setSubmitting(true)
    try {
      const formattedPhone = formatPhoneWithCountryCode(data.phone, data.country_code || event.country_code || '+91')
      const effectiveAttend = isSlotMode
        ? (slotResponseChoice === 'book' ? 'yes' : 'no')
        : isAutoConfirm
        ? 'yes'
        : data.will_attend
      const payload: any = {
        name: data.name,
        phone: formattedPhone,
        country_code: data.country_code,
        will_attend: effectiveAttend,
        guests_count: data.guests_count || 1,
        notes: isNotesEnabled ? (data.notes || '') : '',
        source_channel: sourceChannel,
      }
      if (isEmailEnabled) payload.email = data.email || ''
      if (effectiveAttend === 'yes' && activeCustomFields.length > 0) payload.custom_fields = customFieldValues
      if (isPerSubeventRsvp && effectiveAttend === 'yes') {
        if (requireSessionSelection && selectedSubEventIds.length === 0) {
          showToast('Please select at least one session', 'error')
          setSubmitting(false)
          return
        }
        payload.selectedSubEventIds = selectedSubEventIds
      }

      if (isSlotMode && slotResponseChoice === 'book') {
        await api.post(`/api/events/${event.id}/slot-bookings/`, {
          slotId: selectedSlotId,
          seatsBooked: data.guests_count || 1,
          name: data.name,
          phone: formattedPhone,
          email: data.email || '',
          notes: payload.notes,
          custom_fields: payload.custom_fields || {},
          sourceContext: sourceChannel,
          idempotencyKey: `${formattedPhone}:${selectedSlotId}:${Date.now()}`,
        })
      } else {
        await api.post(`/api/events/${event.id}/rsvp/`, payload)
      }

      setSummary({
        decision: isSlotMode
          ? (slotResponseChoice === 'book' ? 'Book a slot' : "Can't make it")
          : isAutoConfirm
          ? 'Attending'
          : data.will_attend === 'yes'
          ? 'Yes'
          : data.will_attend === 'maybe'
          ? 'Maybe'
          : 'No',
        sessions: availableSubEvents.filter((s) => selectedSubEventIds.includes(s.id)),
        slot: slotOptions.find((s) => s.slotId === selectedSlotId) || null,
        guests_count: data.guests_count || 1,
        notes: payload.notes,
      })
      setCurrentStep('success')
      showToast('Thank you for your response', 'success')
    } catch (error: any) {
      logError('RSVP submit failed', error)
      if (error.response?.data?.errorCode === 'CAPACITY_FULL') {
        setRegistrationBlocked(true)
        showToast(CAPACITY_FULL_MESSAGE, 'error')
      } else {
        showToast(getErrorMessage(error, 'Failed to submit RSVP'), 'error')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-eco-beige">Loading...</div>
  if (!event) return <div className="min-h-screen flex items-center justify-center bg-eco-beige">Event not found</div>

  if (registrationBlocked && capacityApplies) {
    return (
      <div className="min-h-screen bg-eco-beige py-8 px-4">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 text-center">
            <h1 className="text-3xl font-semibold text-gray-900">{event.title}</h1>
          </div>
          <Card className="shadow-sm rounded-2xl border-gray-200">
            <CardHeader>
              <CardTitle className="text-2xl text-gray-900">RSVP closed</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {event.host_name ? (
                <p className="text-sm text-gray-600">
                  Host: <span className="font-medium text-gray-800">{event.host_name}</span>
                </p>
              ) : null}
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                {CAPACITY_FULL_MESSAGE}
              </div>
              <div className="border-t border-gray-100 pt-4 space-y-3">
                <p className="text-sm text-gray-600">
                  Already registered? Enter the phone number you used before to update your response.
                </p>
                <div className="flex gap-2">
                  <CountryCodeSelector
                    name="country_code"
                    value={watch('country_code') ?? event.country_code ?? '+91'}
                    defaultValue={event.country_code || '+91'}
                    onChange={(v) => setValue('country_code', v, { shouldValidate: true })}
                    className="w-44"
                  />
                  <Input type="tel" {...register('phone')} placeholder="10-digit phone number" />
                </div>
                <Button onClick={checkExistingRegistration} disabled={checkingRegistration} className="w-full">
                  {checkingRegistration ? 'Checking...' : 'Look up my RSVP'}
                </Button>
              </div>
              <Link href={`/invite/${slug}`} className="inline-block text-sm text-eco-green hover:underline">
                Back to invite
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const stepCard = (title: string, description: string | undefined, body: ReactNode) => (
    <Card className="shadow-sm rounded-2xl border-gray-200">
      <CardHeader>
        <CardTitle className="text-2xl text-gray-900">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  )

  return (
    <div className="min-h-screen bg-eco-beige py-8 px-4">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 text-center">
          <h1 className="text-3xl font-semibold text-gray-900">{event.title}</h1>
          <p className="text-sm text-gray-500 mt-2">
            {currentStep !== 'success' ? `${stepIndex} of ${visibleSteps.length}: ${STEP_TITLES[currentStep as Exclude<Step, 'success'>] || ''}` : 'Confirmation'}
          </p>
        </div>

        {currentStep === 'verify' && stepCard('Verify your phone', 'For private events, phone verification is required before RSVP.', (
          <div className="space-y-4">
            <div className="flex gap-2">
              <CountryCodeSelector name="country_code" value={watch('country_code') ?? event.country_code ?? '+91'} defaultValue={event.country_code || '+91'} onChange={(v) => setValue('country_code', v, { shouldValidate: true })} className="w-44" />
              <Input type="tel" {...register('phone')} placeholder="10-digit phone number" />
            </div>
            <Button onClick={verifyPhone} disabled={verifyingPhone} className="w-full">{verifyingPhone ? 'Verifying...' : 'Verify phone'}</Button>
          </div>
        ))}

        {currentStep === 'details' && stepCard('Your details', 'Share details so we can keep your RSVP accurate.', (
          <div className="space-y-4">
            <div><label className="text-sm font-medium">Full name</label><Input {...register('name')} className="mt-1" />{errors.name && <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>}</div>
            <div>
              <label className="text-sm font-medium">Phone number</label>
              <div className="flex gap-2 mt-1">
                <CountryCodeSelector name="country_code" value={watch('country_code') ?? event.country_code ?? '+91'} defaultValue={event.country_code || '+91'} onChange={(v) => setValue('country_code', v, { shouldValidate: true })} className="w-44" />
                <Input type="tel" {...register('phone')} />
              </div>
              {errors.phone && <p className="text-sm text-red-600 mt-1">{errors.phone.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium">How many total guests are coming?</label>
              <p className="text-xs text-gray-500 mb-2">Including you</p>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => setValue('guests_count', Math.max(1, (watch('guests_count') || 1) - 1))}>-</Button>
                <Input type="number" min="1" {...register('guests_count', { valueAsNumber: true })} className="text-center" />
                <Button type="button" variant="outline" onClick={() => setValue('guests_count', (watch('guests_count') || 1) + 1)}>+</Button>
              </div>
            </div>
            {isEmailEnabled && <div><label className="text-sm font-medium">Email (optional)</label><Input type="email" {...register('email')} className="mt-1" /></div>}
          </div>
        ))}

        {currentStep === 'decision' && stepCard('Will you be joining us?', undefined, (
          isSlotMode ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button type="button" className={`rounded-xl p-4 border text-left ${slotResponseChoice === 'book' ? 'border-eco-green bg-eco-green-light/40' : 'border-gray-300 bg-white'}`} onClick={() => { setSlotResponseChoice('book'); setValue('will_attend', 'yes', { shouldValidate: false }) }}><p className="font-medium">Book a slot</p><p className="text-sm text-gray-500 mt-1">Pick a date and time.</p></button>
              <button type="button" className={`rounded-xl p-4 border text-left ${slotResponseChoice === 'decline' ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'}`} onClick={() => { setSlotResponseChoice('decline'); setValue('will_attend', 'no', { shouldValidate: false }) }}><p className="font-medium">Can&apos;t make it</p><p className="text-sm text-gray-500 mt-1">We&apos;ll update the host accordingly.</p></button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(['yes', 'maybe', 'no'] as const).map((choice) => (
                <button
                  key={choice}
                  type="button"
                  className={`rounded-xl p-4 border text-left ${willAttend === choice ? (choice === 'no' ? 'border-red-300 bg-red-50' : choice === 'maybe' ? 'border-amber-300 bg-amber-50' : 'border-eco-green bg-eco-green-light/40') : 'border-gray-300 bg-white'}`}
                  onClick={() => setValue('will_attend', choice, { shouldValidate: false })}
                >
                  <p className="font-medium">{choice === 'yes' ? 'Yes' : choice === 'maybe' ? 'Maybe' : 'No'}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {choice === 'yes' ? 'Count me in.' : choice === 'maybe' ? 'Still deciding.' : 'Unable to attend.'}
                  </p>
                </button>
              ))}
            </div>
          )
        ))}

        {currentStep === 'sessions' && stepCard(
          'Choose sessions',
          requireSessionSelection
            ? 'Select at least one session you plan to attend.'
            : 'Select the sessions you plan to attend (optional).',
          (
          <div className="space-y-3">
            {availableSubEvents.map((session) => {
              const checked = selectedSubEventIds.includes(session.id)
              return (
                <label
                  key={session.id}
                  className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer ${checked ? 'border-eco-green bg-eco-green-light/30' : 'border-gray-200 bg-white'}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      setSelectedSubEventIds((prev) =>
                        checked ? prev.filter((id) => id !== session.id) : [...prev, session.id],
                      )
                    }}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-medium text-gray-900">{session.title}</p>
                    {session.start_at ? (
                      <p className="text-sm text-gray-600 mt-1">
                        {new Date(session.start_at).toLocaleString([], {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </p>
                    ) : null}
                    {session.location ? (
                      <p className="text-sm text-gray-500 mt-1">{session.location}</p>
                    ) : null}
                  </div>
                </label>
              )
            })}
            {!requireSessionSelection && (
              <p className="text-xs text-gray-500">You can continue without selecting any sessions.</p>
            )}
          </div>
        ))}

        {currentStep === 'slot' && stepCard('Choose your date and time', 'Select a date first, then pick an available slot.', (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <Button type="button" variant="outline" onClick={() => moveCalendarMonth(-1)}>
                Previous
              </Button>
              <p className="text-sm font-medium text-gray-700">{calendarMonthLabel}</p>
              <Button type="button" variant="outline" onClick={() => moveCalendarMonth(1)}>
                Next
              </Button>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {calendarAvailability.map((day) => {
                const isSelected = selectedSlotDate === day.date
                const soldOut = day.status === 'sold_out'
                const few = day.availabilityLabel.toLowerCase().includes('few')
                return (
                  <button key={day.date} type="button" disabled={soldOut} onClick={() => { setSelectedSlotDate(day.date); setSelectedSlotId(null); fetchSlotsByDate(day.date) }} className={`rounded-lg border p-2 text-xs flex flex-col items-center justify-center text-center ${isSelected ? 'border-eco-green bg-eco-green-light/30' : 'border-gray-200 bg-white'} ${soldOut ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <div className="font-medium text-center">{new Date(day.date).getDate()}</div>
                    <div className={`text-center ${few ? 'text-amber-600' : soldOut ? 'text-red-600' : 'text-eco-green'}`}>{day.availabilityLabel}</div>
                  </button>
                )
              })}
            </div>
            {calendarAvailability.length === 0 && (
              <p className="text-sm text-gray-500">No slots available for {calendarMonthKey}. Try another month.</p>
            )}
            {selectedSlotDate && <div className="space-y-3">{slotOptions.map((slot) => {
              const disabled = slot.status !== 'available'
              const selected = selectedSlotId === slot.slotId
              return (
                <button key={slot.slotId} type="button" disabled={disabled} onClick={() => setSelectedSlotId(slot.slotId)} className={`w-full text-left rounded-xl border p-4 ${selected ? 'border-eco-green bg-eco-green-light/30' : 'border-gray-200 bg-white'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <p className="font-medium text-gray-900">{slot.label || 'Slot'}</p>
                  <p className="text-sm text-gray-600">{new Date(slot.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(slot.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  <p className="text-xs mt-1 text-gray-500">{slot.remainingSeats === null ? (slot.status === 'sold_out' ? 'Sold out' : 'Available') : `${slot.remainingSeats} spots left`}</p>
                </button>
              )
            })}</div>}
          </div>
        ))}

        {currentStep === 'optional' && stepCard('Additional details', 'Optional fields to help the host plan better.', (
          <div className="space-y-4">
            {isNotesEnabled && <div><label className="text-sm font-medium">{notesLabel}</label><textarea {...register('notes')} className="mt-1 min-h-[90px] w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Any note you'd like to share" /></div>}
            {activeCustomFields.map((field) => <div key={field.key}><label className="text-sm font-medium">{field.label || field.key}{field.required ? ' *' : ''}</label><Input value={customFieldValues[field.key] ?? ''} onChange={(e) => setCustomFieldValues((prev) => ({ ...prev, [field.key]: e.target.value }))} className="mt-1" />{customFieldErrors[field.key] ? <p className="text-sm text-red-600 mt-1">{customFieldErrors[field.key]}</p> : null}</div>)}
          </div>
        ))}

        {currentStep === 'review' && stepCard('Review your response', 'Please confirm before submitting.', (
          <div className="space-y-4 text-sm">
            {showSessionPicker && (
              <div className="rounded-xl border p-3 bg-gray-50">
                <p className="font-medium">Sessions</p>
                <p>
                  {selectedSubEventIds.length > 0
                    ? availableSubEvents
                        .filter((s) => selectedSubEventIds.includes(s.id))
                        .map((s) => s.title)
                        .join(', ')
                    : 'None selected'}
                </p>
                <button type="button" onClick={() => setCurrentStep('sessions')} className="text-xs text-eco-green mt-1">Edit</button>
              </div>
            )}
            {!isAutoConfirm && (
              <div className="rounded-xl border p-3 bg-gray-50">
                <p className="font-medium">Decision</p>
                <p>
                  {isSlotMode
                    ? (slotResponseChoice === 'book' ? 'Book a slot' : "Can't make it")
                    : willAttend === 'yes'
                    ? 'Yes'
                    : willAttend === 'maybe'
                    ? 'Maybe'
                    : 'No'}
                </p>
                <button type="button" onClick={() => setCurrentStep('decision')} className="text-xs text-eco-green mt-1">Edit</button>
              </div>
            )}
            {isSlotMode && slotResponseChoice === 'book' && (
              <div className="rounded-xl border p-3 bg-gray-50">
                <p className="font-medium">Selected slot</p>
                <p>{slotOptions.find((s) => s.slotId === selectedSlotId)?.label || 'Not selected'}</p>
                <button type="button" onClick={() => setCurrentStep('slot')} className="text-xs text-eco-green mt-1">Edit</button>
              </div>
            )}
            <div className="rounded-xl border p-3 bg-gray-50"><p className="font-medium">Guests</p><p>{watch('guests_count') || 1}</p><button type="button" onClick={() => setCurrentStep('details')} className="text-xs text-eco-green mt-1">Edit</button></div>
            {watch('notes') && <div className="rounded-xl border p-3 bg-gray-50"><p className="font-medium">Notes</p><p>{watch('notes')}</p></div>}
          </div>
        ))}

        {currentStep === 'success' && stepCard(isSlotMode ? 'Thank you for booking' : 'Thank you for your response', isSlotMode ? 'Your booking has been recorded.' : 'Your RSVP has been recorded.', (
          <div className="space-y-3 text-sm">
            <p className="text-gray-700">Decision: {summary?.decision}</p>
            {summary?.sessions?.length > 0 && (
              <p className="text-gray-700">
                Sessions: {summary.sessions.map((s: RsvpSubEvent) => s.title).join(', ')}
              </p>
            )}
            {summary?.slot && <p className="text-gray-700">Slot: {summary.slot.label || `${summary.slot.date}`}</p>}
            <p className="text-gray-700">Guests: {summary?.guests_count}</p>
            {summary?.notes && <p className="text-gray-700">Notes: {summary.notes}</p>}
            <p className="text-gray-700">🌿 Thanks for helping us plan responsibly.</p>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setCurrentStep('review')}>Edit response</Button>
              {shouldShowCatalogOnRsvpConfirmation(
                event.has_registry,
                event.catalog_show_on_rsvp_confirmation,
              ) ? (
                <Link
                  href={catalogUrl(slug, {
                    guestToken: searchParams.get('g') || undefined,
                    source: 'rsvp_confirmation',
                  })}
                >
                  <Button>
                    {getCatalogButtonLabel(
                      event.catalog_title,
                      event.catalog_purpose || 'general',
                    )}
                  </Button>
                </Link>
              ) : null}
            </div>
          </div>
        ))}

        {currentStep !== 'success' && currentStep !== 'verify' && <div className="sticky bottom-0 mt-6 bg-eco-beige/95 backdrop-blur border-t border-gray-200 py-3"><div className="mx-auto max-w-3xl flex gap-3">{stepIndex > 1 ? <Button type="button" variant="outline" onClick={goBack} className="flex-1">Back</Button> : null}{currentStep === 'review' ? <Button type="button" className="flex-1" onClick={submit} disabled={submitting}>{submitting ? 'Submitting...' : 'Confirm RSVP'}</Button> : <Button type="button" className="flex-1" onClick={goNext}>Continue</Button>}</div></div>}
      </div>
    </div>
  )
}
