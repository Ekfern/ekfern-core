'use client'

import { useEffect, useId, useState } from 'react'
import { Repeat } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  WEEKDAY_NAMES,
  WEEKDAY_SHORT,
  nthOfMonth,
  specSummary,
  weekdayOf,
  type RecurrenceSpec,
  type RepeatFreq,
} from '@/lib/invite/recurrence'

interface Props {
  /** First date (ISO), which anchors the rhythm. */
  firstDate?: string
  value: RecurrenceSpec | null
  onChange: (value: RecurrenceSpec | null) => void
}

const CHOICES: Array<{ value: RepeatFreq | 'none'; label: string }> = [
  { value: 'none', label: 'Doesn’t repeat' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
]

/**
 * How a single event repeats: a weekly satsang, a fortnightly class, a monthly
 * meetup. The same invitation serves every date; guests RSVP to the series.
 */
export default function RepeatField({ firstDate, value, onChange }: Props) {
  const uid = useId()
  const [skipDraft, setSkipDraft] = useState('')
  // One line until the host asks to change it, like "Times in … · Change".
  const [open, setOpen] = useState(false)
  const anchor = firstDate ? weekdayOf(firstDate) : null
  const freq = value?.freq ?? 'none'

  const choose = (next: RepeatFreq | 'none') => {
    if (next === 'none') return onChange(null)
    onChange({
      freq: next,
      weekdays: next === 'monthly' ? [] : value?.weekdays?.length ? value.weekdays : anchor !== null ? [anchor] : [],
      until: value?.until ?? null,
      skipped: value?.skipped ?? [],
    })
  }

  // Moving the first date to another weekday brings that day along: the
  // series must include its own first date.
  useEffect(() => {
    if (value && value.freq !== 'monthly' && anchor !== null && !value.weekdays.includes(anchor)) {
      onChange({ ...value, weekdays: [anchor] })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor])

  const toggleDay = (day: number) => {
    if (!value || day === anchor) return // the first date's own day always stays
    const has = value.weekdays.includes(day)
    onChange({ ...value, weekdays: has ? value.weekdays.filter((d) => d !== day) : [...value.weekdays, day] })
  }

  return (
    <fieldset className="space-y-3">
      <legend className="sr-only">Repeats</legend>
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-gray-700">
        <Repeat className="h-4 w-4 text-gray-500" aria-hidden="true" />
        <span>
          <strong className="text-eco-green">{specSummary(value, firstDate)}</strong> ·
        </span>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="font-medium text-eco-teal underline underline-offset-2"
        >
          {open ? 'Done' : 'Change'}
        </button>
      </div>

      {open && (<>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Repeats">
        {CHOICES.map((choice) => (
          <button
            key={choice.value}
            type="button"
            role="radio"
            aria-checked={freq === choice.value}
            disabled={choice.value !== 'none' && !firstDate}
            onClick={() => choose(choice.value)}
            className={`min-h-[44px] rounded-full border px-4 text-sm transition-colors disabled:opacity-40 ${
              freq === choice.value ? 'border-eco-green bg-eco-green text-white' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {choice.label}
          </button>
        ))}
      </div>
      {!firstDate && <p className="text-xs text-gray-500">Pick the first date to set a repeat.</p>}

      {value && firstDate && (value.freq === 'weekly' || value.freq === 'fortnightly') && (
        <div>
          <p className="text-xs text-gray-600 mb-2">On</p>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAY_SHORT.map((label, day) => {
              const on = value.weekdays.includes(day)
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={on}
                  aria-label={WEEKDAY_NAMES[day]}
                  onClick={() => toggleDay(day)}
                  className={`h-11 w-11 rounded-full border text-xs font-medium ${
                    on ? 'border-eco-green bg-eco-green-light text-eco-green' : 'border-gray-300 text-gray-600'
                  } ${day === anchor ? 'cursor-default' : ''}`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {value && firstDate && value.freq === 'monthly' && (
        <p className="text-sm text-gray-700">
          On the {nthOfMonth(firstDate).toLowerCase()} {WEEKDAY_NAMES[weekdayOf(firstDate)]} of each month
        </p>
      )}

      {value && firstDate && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`until-${uid}`} className="block text-xs text-gray-600 mb-1">
              Last date <span className="text-gray-400">(optional)</span>
            </label>
            <Input
              id={`until-${uid}`}
              type="date"
              min={firstDate}
              value={value.until ?? ''}
              onChange={(e) => onChange({ ...value, until: e.target.value || null })}
            />
          </div>
          <div>
            <label htmlFor={`skip-${uid}`} className="block text-xs text-gray-600 mb-1">
              Skip a date <span className="text-gray-400">(a festival, a holiday)</span>
            </label>
            <div className="flex gap-2">
              <Input id={`skip-${uid}`} type="date" min={firstDate} value={skipDraft} onChange={(e) => setSkipDraft(e.target.value)} />
              <button
                type="button"
                disabled={!skipDraft}
                onClick={() => {
                  if (skipDraft && !value.skipped.includes(skipDraft)) {
                    onChange({ ...value, skipped: [...value.skipped, skipDraft].sort() })
                  }
                  setSkipDraft('')
                }}
                className="min-h-[40px] rounded-md border border-gray-300 px-3 text-sm disabled:opacity-40"
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}

      {value && value.skipped.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Skipped dates">
          {value.skipped.map((day) => (
            <li key={day} className="flex items-center gap-1 rounded-full bg-gray-100 pl-3 pr-1 text-xs text-gray-700">
              No session on {day}
              <button
                type="button"
                aria-label={`Keep ${day}`}
                onClick={() => onChange({ ...value, skipped: value.skipped.filter((d) => d !== day) })}
                className="h-8 w-8 rounded-full hover:bg-gray-200"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      </>)}
    </fieldset>
  )
}
