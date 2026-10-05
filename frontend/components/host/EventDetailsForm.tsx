'use client'

import { useId, type ReactNode } from 'react'
import Link from 'next/link'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EVENT_TYPE_VALUES } from '@/lib/eventTypes'
import type { GoodToKnowItem } from '@/lib/invite/schema'
import EventTypePicker from '@/components/host/EventTypePicker'
import WhereField, { type WhereMode } from '@/components/host/WhereField'
import BackstageChips from '@/components/host/BackstageChips'
import GoodToKnowEditor from '@/components/invite/GoodToKnowEditor'

export const eventDetailsSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  event_type: z.enum(EVENT_TYPE_VALUES, { errorMap: () => ({ message: 'Please select an event type' }) }),
  date: z.string().optional(),
  // Several events only: the last day, so the event expires after it, not after day one.
  event_end_date: z.string().nullable().optional(),
  city: z.string().optional(),
  country: z.string().default('IN'),
  timezone: z.string().default('Asia/Kolkata'),
  is_public: z.boolean().default(true),
  has_rsvp: z.boolean().default(true),
  has_registry: z.boolean().default(true),
  // UI-only wizard routing flag — decides whether creation continues into the
  // Sub-events step. Not sent to the backend; ENVELOPE structure is derived
  // there once sub-events are actually created.
  is_multi_sub_event: z.boolean().default(false),
  // UI-only. In person or online decides what Where asks for; the event itself
  // only stores the city (blank for online), as it always has.
  where_mode: z.enum(['in-person', 'online']).default('in-person'),
  // Invitation content, asked for at creation only. None of it is an Event
  // field: it is written into the invitation's Event Details tile.
  time: z.string().optional(),
  venue: z.string().optional(),
  good_to_know: z.array(z.custom<GoodToKnowItem>()).default([]),
})

export type EventDetailsFormData = z.infer<typeof eventDetailsSchema>

/** The fields the Event API takes. Everything else is UI state or invitation content. */
export type EventPayload = Pick<
  EventDetailsFormData,
  'title' | 'event_type' | 'date' | 'event_end_date' | 'city' | 'country' | 'timezone' | 'is_public' | 'has_rsvp' | 'has_registry'
>

export function eventPayloadOf(data: EventDetailsFormData): EventPayload {
  const { title, event_type, date, city, country, timezone, is_public, has_rsvp, has_registry } = data
  return {
    title,
    event_type,
    // The API wants null, not "", for an unset date.
    date: date || undefined,
    // A single event is one day; only several events keep a last day.
    event_end_date: data.is_multi_sub_event ? data.event_end_date || null : null,
    city: data.where_mode === 'online' ? '' : (city ?? '').trim(),
    country,
    timezone,
    is_public,
    has_rsvp,
    has_registry,
  }
}

const BASE_DEFAULTS: EventDetailsFormData = {
  title: '',
  event_type: '' as EventDetailsFormData['event_type'],
  date: '',
  event_end_date: '',
  city: '',
  country: 'IN',
  timezone: 'Asia/Kolkata',
  is_public: true,
  has_rsvp: true,
  has_registry: true,
  is_multi_sub_event: false,
  where_mode: 'in-person',
  time: '',
  venue: '',
  good_to_know: [],
}

interface EventDetailsFormProps {
  defaultValues?: Partial<EventDetailsFormData>
  onSubmit: (data: EventDetailsFormData) => void | Promise<void>
  submitLabel: string
  loading?: boolean
  onCancel?: () => void
  cancelLabel?: string
  /** Show the single-event vs multiple-sub-events fork (creation flow only). */
  showStructureChoice?: boolean
  /**
   * Also ask for the invitation's own content - time, venue, Good to know -
   * which lives in its Event Details tile, not on the event.
   * 'create': a venue to combine with the city, written as a starter invitation.
   * 'edit': the location line exactly as the invitation shows it, read back and
   * patched; the Page Editor edits the same values.
   */
  inviteContent?: 'create' | 'edit'
  /**
   * Edit only, once the invitation is laid out: its time, venue line and Good
   * to know are edited there, so they show here greyed out with a link to it.
   */
  inviteContentLockedHref?: string
  /** Backstage's Co-hosts chip: an invite panel while creating, a link to Overview after. */
  coHosts?: { count: number; panel?: ReactNode; href?: string }
}

const sectionHeading = 'text-lg font-bold text-eco-green'

export default function EventDetailsForm({
  defaultValues,
  onSubmit,
  submitLabel,
  loading = false,
  onCancel,
  cancelLabel = 'Cancel',
  showStructureChoice = false,
  inviteContent,
  inviteContentLockedHref,
  coHosts,
}: EventDetailsFormProps) {
  const uid = useId()
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<EventDetailsFormData>({
    resolver: zodResolver(eventDetailsSchema),
    defaultValues: { ...BASE_DEFAULTS, ...defaultValues },
  })

  const isMultiSubEvent = watch('is_multi_sub_event')
  const whereMode = watch('where_mode') as WhereMode
  const eventType = watch('event_type')
  const city = watch('city') ?? ''
  const country = watch('country')
  const timezone = watch('timezone')
  const effectiveSubmitLabel =
    showStructureChoice && isMultiSubEvent ? 'Next: Add Sub-events' : submitLabel

  const submit = handleSubmit(async (data) => {
    // A single event needs its date at creation: the invitation, its countdown
    // and reminders all hang off it. Several events take theirs per sub-event.
    // The invitation, its countdown, reminders and expiry all hang off the date.
    if (inviteContent === 'create' && !data.date) {
      setError('date', { message: data.is_multi_sub_event ? 'Pick the first day' : 'Pick the date of your event' })
      return
    }
    if (data.is_multi_sub_event && data.event_end_date && data.date && data.event_end_date < data.date) {
      setError('event_end_date', { message: 'The last day can’t be before the first' })
      return
    }
    await onSubmit(data)
  })

  const locked = !!inviteContentLockedHref
  const lockedInput = locked ? 'cursor-not-allowed bg-gray-100 text-gray-500' : ''
  // Under each greyed field: where it is edited now.
  const editOnInvitationShort = locked ? (
    <Link href={inviteContentLockedHref!} className="mt-1 inline-block text-xs font-medium text-eco-teal underline underline-offset-2">
      Edit on your invitation →
    </Link>
  ) : null
  const editOnInvitation = locked ? (
    <Link href={inviteContentLockedHref!} className="font-medium text-eco-teal underline underline-offset-2">
      Edit in the Page Editor →
    </Link>
  ) : null

  const set = (key: 'where_mode' | 'city' | 'country' | 'timezone' | 'is_public' | 'has_rsvp' | 'has_registry', value: string | boolean) =>
    setValue(key, value as never, { shouldDirty: true })

  return (
    <form onSubmit={submit} className="space-y-8">
      {/* ── The basics ─────────────────────────────────────────────────── */}
      <section className="space-y-5">
        <div>
          <h2 className={sectionHeading}>The basics</h2>
          {inviteContent && !locked && (
            <p className="text-sm text-gray-600">
              {inviteContent === 'create'
                ? 'This shows on your invitation. You’ll choose how it looks next.'
                : 'This shows on your invitation. Changes here update it too.'}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={`title-${uid}`} className="block text-sm font-medium mb-1">
            Event title
          </label>
          <Input id={`title-${uid}`} {...register('title')} placeholder="What are you celebrating?" />
          {errors.title && <p className="text-red-600 text-sm mt-1">{errors.title.message}</p>}
        </div>

        <div>
          <p id={`type-${uid}`} className="block text-sm font-medium mb-2">
            What kind of event?
          </p>
          <Controller
            name="event_type"
            control={control}
            render={({ field }) => (
              <EventTypePicker
                value={field.value}
                onChange={field.onChange}
                hasError={!!errors.event_type}
                labelledBy={`type-${uid}`}
              />
            )}
          />
          {errors.event_type && <p className="text-red-600 text-sm mt-1">{errors.event_type.message}</p>}
        </div>

        {showStructureChoice && (
          <Controller
            name="is_multi_sub_event"
            control={control}
            render={({ field }) => (
              <div>
                <p className="block text-sm font-medium mb-2">One event, or a few together?</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[
                    { multi: false, title: 'Just one event', hint: 'A single gathering at one time and place.' },
                    {
                      multi: true,
                      title: 'Several events together',
                      hint: 'A few separate gatherings under one invitation, across one or more days.',
                    },
                  ].map((choice) => (
                    <label
                      key={String(choice.multi)}
                      className={`rounded-md border p-3 cursor-pointer ${
                        field.value === choice.multi ? 'border-eco-green bg-eco-green-light/40' : 'border-gray-300'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="event_structure_choice"
                          checked={field.value === choice.multi}
                          onChange={() => field.onChange(choice.multi)}
                          className="text-eco-green"
                        />
                        <span className="font-medium text-sm">{choice.title}</span>
                      </span>
                      <span className="mt-1 block text-xs text-gray-600">{choice.hint}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          />
        )}

        {!isMultiSubEvent ? (
          <div className={`grid gap-4 ${inviteContent ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
            <div>
              <label htmlFor={`date-${uid}`} className="block text-sm font-medium mb-1">
                Date
              </label>
              <Input id={`date-${uid}`} type="date" {...register('date')} aria-invalid={!!errors.date} />
              {errors.date && <p className="text-red-600 text-sm mt-1">{errors.date.message}</p>}
            </div>
            {inviteContent && (
              <div>
                <label htmlFor={`time-${uid}`} className="block text-sm font-medium mb-1">
                  Time <span className="font-normal text-gray-500">(optional)</span>
                </label>
                <Input
                  id={`time-${uid}`}
                  type="time"
                  {...register('time')}
                  readOnly={locked}
                  aria-readonly={locked}
                  className={lockedInput}
                />
                {editOnInvitationShort}
              </div>
            )}
          </div>
        ) : (
          // Several events: the span of days. The event expires after its last
          // day; each event's own time is set on it in the next step.
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`date-${uid}`} className="block text-sm font-medium mb-1">
                First day
              </label>
              <Input id={`date-${uid}`} type="date" {...register('date')} aria-invalid={!!errors.date} />
              {errors.date && <p className="text-red-600 text-sm mt-1">{errors.date.message}</p>}
            </div>
            <div>
              <label htmlFor={`end-date-${uid}`} className="block text-sm font-medium mb-1">
                Last day <span className="font-normal text-gray-500">(optional)</span>
              </label>
              <Input
                id={`end-date-${uid}`}
                type="date"
                min={watch('date') || undefined}
                {...register('event_end_date')}
                aria-invalid={!!errors.event_end_date}
              />
              {errors.event_end_date && <p className="text-red-600 text-sm mt-1">{errors.event_end_date.message}</p>}
            </div>
          </div>
        )}

        <WhereField
          mode={whereMode}
          onModeChange={(mode) => set('where_mode', mode)}
          value={{ city, country, timezone }}
          onChange={(patch) => {
            if (patch.city !== undefined) set('city', patch.city)
            if (patch.country !== undefined) set('country', patch.country)
            if (patch.timezone !== undefined) set('timezone', patch.timezone)
          }}
        />

        {inviteContent === 'create' && !isMultiSubEvent && (
          <div>
            <label htmlFor={`venue-${uid}`} className="block text-sm font-medium mb-1">
              {whereMode === 'online' ? 'How guests join' : 'Venue'}{' '}
              <span className="font-normal text-gray-500">(optional)</span>
            </label>
            <Input
              id={`venue-${uid}`}
              {...register('venue')}
              placeholder={whereMode === 'online' ? 'Online · link shared after you RSVP' : 'Hall, home, farmhouse…'}
            />
          </div>
        )}
        {inviteContent === 'edit' && !isMultiSubEvent && (
          <div>
            <label htmlFor={`venue-${uid}`} className="block text-sm font-medium mb-1">
              {whereMode === 'online' ? 'How guests join, shown on your invitation' : 'Venue line on your invitation'}
            </label>
            <Input
              id={`venue-${uid}`}
              {...register('venue')}
              placeholder={whereMode === 'online' ? 'Online · link shared after you RSVP' : 'The Lakeside Lawns, Udaipur'}
              readOnly={locked}
              aria-readonly={locked}
              className={lockedInput}
            />
            {editOnInvitationShort}
            {!locked && (
              <p className="mt-1 text-xs text-gray-500">
                {whereMode === 'online'
                  ? 'Exactly what guests read under Location.'
                  : 'Exactly what guests read under Location. Changing the city above doesn’t change it.'}
              </p>
            )}
          </div>
        )}
      </section>

      {/* ── Good to know ───────────────────────────────────────────────── */}
      {inviteContent && (
        <section className="space-y-3">
          <div>
            <h2 className={sectionHeading}>Good to know</h2>
            <p className="text-sm text-gray-600">
              {locked
                ? <>On your invitation. {editOnInvitation}</>
                : !isMultiSubEvent
                ? 'Answers to what guests usually ask. Add only what you need.'
                : inviteContent === 'create'
                  ? 'For the whole celebration - where to stay, who to call. Each event can add its own, like its dress code, in the next step.'
                  : 'For the whole celebration - where to stay, who to call. Each event’s own, like its dress code, is on the Sub-events page.'}
            </p>
          </div>
          <Controller
            name="good_to_know"
            control={control}
            render={({ field }) => (
              <GoodToKnowEditor
                items={field.value ?? []}
                onChange={field.onChange}
                eventType={eventType}
                variant="form"
                readOnly={locked}
              />
            )}
          />
        </section>
      )}

      {/* ── Backstage ──────────────────────────────────────────────────── */}
      <BackstageChips
        value={{ is_public: watch('is_public'), has_rsvp: watch('has_rsvp'), has_registry: watch('has_registry') }}
        onChange={(patch) => {
          for (const [key, value] of Object.entries(patch)) {
            set(key as 'is_public' | 'has_rsvp' | 'has_registry', value as boolean)
          }
        }}
        coHosts={coHosts}
      />

      <div className="flex gap-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1 border-eco-green text-eco-green hover:bg-eco-green-light"
          >
            {cancelLabel}
          </Button>
        )}
        <Button type="submit" disabled={loading} className="flex-1 bg-eco-green hover:bg-eco-green-dark text-white">
          {loading ? 'Saving...' : effectiveSubmitLabel}
        </Button>
      </div>
    </form>
  )
}
