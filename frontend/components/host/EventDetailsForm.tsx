'use client'

import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { COUNTRY_CODES } from '@/lib/countryCodesFull'
import { EVENT_TYPE_VALUES } from '@/lib/eventTypes'
import EventTypeSelect from '@/components/ui/EventTypeSelect'

export const eventDetailsSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  event_type: z.enum(EVENT_TYPE_VALUES, { errorMap: () => ({ message: 'Please select an event type' }) }),
  date: z.string().optional(),
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
})

export type EventDetailsFormData = z.infer<typeof eventDetailsSchema>

const BASE_DEFAULTS: EventDetailsFormData = {
  title: '',
  event_type: '' as EventDetailsFormData['event_type'],
  date: '',
  city: '',
  country: 'IN',
  timezone: 'Asia/Kolkata',
  is_public: true,
  has_rsvp: true,
  has_registry: true,
  is_multi_sub_event: false,
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
}

export default function EventDetailsForm({
  defaultValues,
  onSubmit,
  submitLabel,
  loading = false,
  onCancel,
  cancelLabel = 'Cancel',
  showStructureChoice = false,
}: EventDetailsFormProps) {
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<EventDetailsFormData>({
    resolver: zodResolver(eventDetailsSchema),
    defaultValues: { ...BASE_DEFAULTS, ...defaultValues },
  })

  const isMultiSubEvent = watch('is_multi_sub_event')
  // When the host picks multiple sub-events, the next step is Sub-events, not Layout.
  const effectiveSubmitLabel =
    showStructureChoice && isMultiSubEvent ? 'Next: Add Sub-events' : submitLabel

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Event Title</label>
        <Input {...register('title')} placeholder="Your event name" />
        {errors.title && (
          <p className="text-red-500 text-sm mt-1">
            {errors.title.message}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          What type of event are you hosting?
        </label>
        <Controller
          name="event_type"
          control={control}
          render={({ field }) => (
            <EventTypeSelect
              value={field.value}
              onChange={field.onChange}
              hasError={!!errors.event_type}
            />
          )}
        />
        {errors.event_type && (
          <p className="text-red-500 text-sm mt-1">{errors.event_type.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Date</label>
        <Input type="date" {...register('date')} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">City (leave blank for virtual)</label>
          <Input {...register('city')} placeholder="e.g. New York, London, Mumbai" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Country</label>
          <select
            {...register('country')}
            className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            {Object.entries(COUNTRY_CODES)
              .sort(([, a], [, b]) => a.name.localeCompare(b.name))
              .map(([iso, info]) => (
                <option key={iso} value={iso}>
                  {info.flag} {info.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Timezone</label>
        <select
          {...register('timezone')}
          className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
        >
          <option value="Asia/Kolkata">India (IST) — Asia/Kolkata</option>
          <option value="America/New_York">US East — America/New_York</option>
          <option value="America/Chicago">US Central — America/Chicago</option>
          <option value="America/Denver">US Mountain — America/Denver</option>
          <option value="America/Los_Angeles">US Pacific — America/Los_Angeles</option>
          <option value="Europe/London">UK — Europe/London</option>
          <option value="Asia/Dubai">UAE — Asia/Dubai</option>
          <option value="Asia/Singapore">Singapore — Asia/Singapore</option>
          <option value="Australia/Sydney">Australia — Australia/Sydney</option>
          <option value="Pacific/Auckland">New Zealand — Pacific/Auckland</option>
          <option value="UTC">UTC</option>
        </select>
        <p className="text-xs text-gray-500 mt-1">
          Times will be shown exactly as you enter them, using this timezone.
        </p>
      </div>

      {showStructureChoice && (
        <Controller
          name="is_multi_sub_event"
          control={control}
          render={({ field }) => (
            <div>
              <label className="block text-sm font-medium mb-1">
                Is this one event, or a few events together?
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label
                  className={`rounded-md border p-3 cursor-pointer ${
                    !field.value ? 'border-eco-green bg-eco-green-light/40' : 'border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="event_structure_choice"
                      checked={!field.value}
                      onChange={() => field.onChange(false)}
                      className="text-eco-green"
                    />
                    <span className="font-medium text-sm">Just one event</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-600">
                    A single gathering at one time and place.
                  </p>
                </label>
                <label
                  className={`rounded-md border p-3 cursor-pointer ${
                    field.value ? 'border-eco-green bg-eco-green-light/40' : 'border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="event_structure_choice"
                      checked={!!field.value}
                      onChange={() => field.onChange(true)}
                      className="text-eco-green"
                    />
                    <span className="font-medium text-sm">Several events together</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-600">
                    A few separate gatherings under one invitation, across one or more days.
                  </p>
                </label>
              </div>
            </div>
          )}
        />
      )}

      <div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            {...register('is_public')}
            className="form-checkbox text-eco-green"
          />
          <span>Make this event public</span>
          <span className="relative group cursor-default">
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-xs font-bold leading-none">?</span>
            <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-6 w-64 rounded-md bg-gray-800 text-white text-xs px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-lg">
              When public, anyone with the link can view your invite, RSVP, and use the host catalog — even if they&apos;re not on your guest list. When private, only people you&apos;ve invited can participate.
            </span>
          </span>
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Features</p>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            {...register('has_rsvp')}
            className="form-checkbox text-eco-green"
          />
          <span className="text-sm">Enable RSVP</span>
          <span className="relative group cursor-default">
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-xs font-bold leading-none">?</span>
            <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-6 w-64 rounded-md bg-gray-800 text-white text-xs px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-lg">
              RSVP lets guests confirm whether they&apos;ll attend. You&apos;ll see a live headcount as responses come in. You can enable or disable this later.
            </span>
          </span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            {...register('has_registry')}
            className="form-checkbox text-eco-green"
          />
          <span className="text-sm">Enable Host Catalog</span>
          <span className="relative group cursor-default">
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-xs font-bold leading-none">?</span>
            <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-6 w-64 rounded-md bg-gray-800 text-white text-xs px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-lg">
              A host catalog lets guests browse your items and send pledges, interest, or messages. You add catalog items and review responses in your dashboard. You can enable or disable this later.
            </span>
          </span>
        </label>
      </div>

      <div className="flex gap-2 pt-4">
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
        <Button
          type="submit"
          disabled={loading}
          className="flex-1 bg-eco-green hover:bg-eco-green-dark text-white"
        >
          {loading ? 'Saving...' : effectiveSubmitLabel}
        </Button>
      </div>
    </form>
  )
}
