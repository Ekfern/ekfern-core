/**
 * WizardProgress — horizontal step indicator for the invitation creation wizard.
 *
 * Steps:
 *   Event Details  (/host/events/new to create; /host/events/[eventId]/details to edit)
 *   Sub-events     (/host/events/[eventId]/sub-events-setup) — only for multi-sub-event (ENVELOPE) events
 *   Layout         (/host/events/[eventId]/layout)
 *   Page Editor    (/host/events/[eventId]/page-editor)
 *
 * The Sub-events step is inserted only when `includeSubEvents` is set (i.e. the
 * host chose "multiple sub-events" and the event is/became ENVELOPE). Step
 * numbers are derived from position so the same component renders both the
 * 3-step and 4-step journeys. The card is no longer a step of its own: it is
 * edited from the poster tile inside the Page Editor. Completed steps are clickable when eventId is set.
 */

import React, { useEffect, useState } from 'react'
import { Link } from 'next-view-transitions'
import { motion, AnimatePresence } from 'framer-motion'
import api from '@/lib/api'
import { completedSteps, type WizardEvent } from '@/lib/host/wizardSteps'

export type { WizardStepKey } from '@/lib/host/wizardSteps'
import type { WizardStepKey } from '@/lib/host/wizardSteps'

export interface WizardProgressProps {
  currentStep: WizardStepKey
  /** Required for step nav links and completed-step navigation. */
  eventId?: number
  /** Insert the Sub-events step between Event Details and Layout (ENVELOPE events). */
  includeSubEvents?: boolean
}

interface StepDefinition {
  key: WizardStepKey
  label: string
  /** Shown on phones, where the full label does not fit beside its neighbours. */
  shortLabel: string
  href: (id: number) => string
}

const BASE_STEPS: StepDefinition[] = [
  { key: 'details', label: 'Event Details', shortLabel: 'Details', href: (id) => `/host/events/${id}/details` },
  { key: 'layout', label: 'Layout', shortLabel: 'Layout', href: (id) => `/host/events/${id}/layout` },
  { key: 'page-editor', label: 'Page Editor', shortLabel: 'Editor', href: (id) => `/host/events/${id}/page-editor` },
]

const SUB_EVENTS_STEP: StepDefinition = {
  key: 'sub-events',
  label: 'Sub-events',
  shortLabel: 'Sub-events',
  href: (id) => `/host/events/${id}/sub-events-setup`,
}

/** Build the visible step sequence, inserting Sub-events after Event Details when needed. */
function buildSteps(includeSubEvents: boolean): StepDefinition[] {
  if (!includeSubEvents) return BASE_STEPS
  return [BASE_STEPS[0], SUB_EVENTS_STEP, ...BASE_STEPS.slice(1)]
}

type StepState = 'completed' | 'active' | 'active-completed' | 'available' | 'future'

/**
 * Done comes from the event (lib/host/wizardSteps.ts), not from position: a host
 * back on Event Details sees Layout already done, and can jump to it.
 */
function stepState(stepIndex: number, currentIndex: number, done: boolean, reachable: boolean): StepState {
  if (stepIndex === currentIndex) return done ? 'active-completed' : 'active'
  if (done || stepIndex < currentIndex) return 'completed'
  // Not done, but everything before it is (the editor before publishing): open.
  if (reachable) return 'available'
  return 'future'
}

/** Checkmark icon rendered for completed steps. */
function CheckIcon(): React.ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="w-3.5 h-3.5"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

interface StepCircleProps {
  state: StepState
  number: number
}

function StepCircle({ state, number }: StepCircleProps): React.ReactElement {
  if (state === 'completed') {
    return (
      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-eco-green text-white ring-2 ring-eco-green flex-shrink-0">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key="check"
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 28 }}
            className="flex items-center justify-center"
          >
            <CheckIcon />
          </motion.span>
        </AnimatePresence>
      </span>
    )
  }
  if (state === 'active-completed') {
    // Here, and already done: the check, with the ring that marks where you are.
    return (
      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-eco-green text-white ring-2 ring-eco-green ring-offset-2 flex-shrink-0">
        <CheckIcon />
      </span>
    )
  }
  if (state === 'active') {
    return (
      <motion.span
        className="flex items-center justify-center w-7 h-7 rounded-full bg-eco-green text-white ring-2 ring-eco-green flex-shrink-0 text-sm font-bold"
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        {number}
      </motion.span>
    )
  }
  if (state === 'available') {
    return (
      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-white text-eco-green ring-2 ring-eco-green flex-shrink-0 text-sm font-semibold">
        {number}
      </span>
    )
  }
  // future
  return (
    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-white text-gray-400 ring-2 ring-gray-300 flex-shrink-0 text-sm font-medium">
      {number}
    </span>
  )
}

interface StepNodeProps {
  step: StepDefinition
  state: StepState
  displayNumber: number
  eventId?: number
}

/** What a screen reader hears after the step's name. */
const STATE_TEXT: Record<StepState, string> = {
  completed: 'completed',
  'active-completed': 'current step, completed',
  active: 'current step',
  available: 'next',
  future: 'not started',
}

function StepNode({ step, state, displayNumber, eventId }: StepNodeProps): React.ReactElement {
  const isClickable = (state === 'completed' || state === 'available') && eventId != null
  const circle = <StepCircle state={state} number={displayNumber} />

  // Greys dark enough to read at this size (the lighter ones were ~2.5:1).
  const labelClasses =
    state === 'active' || state === 'active-completed'
      ? 'font-semibold text-eco-green'
      : state === 'completed' || state === 'available'
      ? 'font-medium text-gray-600'
      : 'font-medium text-gray-500'

  // Labels show on every screen: short on phones, where three bare circles
  // would not say which step is which.
  const label = (
    <span className={`text-[11px] sm:text-xs leading-tight text-center whitespace-nowrap ${labelClasses}`}>
      <span className="sm:hidden">{step.shortLabel}</span>
      <span className="hidden sm:inline">{step.label}</span>
      <span className="sr-only">, {STATE_TEXT[state]}</span>
    </span>
  )

  if (isClickable) {
    // The whole step - circle and label - is the target, at least 44px, though
    // the circle itself is small.
    return (
      <Link
        href={step.href(eventId!)}
        className="group flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-1 rounded-lg px-1 sm:px-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-eco-green"
      >
        <motion.span
          whileHover={{ scale: 1.08 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          className="flex items-center justify-center flex-shrink-0"
        >
          {circle}
        </motion.span>
        <span className="transition-colors group-hover:text-eco-green">{label}</span>
      </Link>
    )
  }

  return (
    <div className="flex min-h-[44px] flex-col items-center justify-center gap-1 px-1 sm:px-2">
      {circle}
      {label}
    </div>
  )
}

/** Connector line between two step nodes. */
function Connector({ leftState }: { leftState: StepState }): React.ReactElement {
  return (
    <div
      className={`flex-1 h-0.5 mx-1 ${leftState === 'future' ? 'bg-gray-200' : 'bg-eco-green'}`}
      aria-hidden="true"
    />
  )
}

export default function WizardProgress({
  currentStep,
  eventId,
  includeSubEvents = false,
}: WizardProgressProps): React.ReactElement {
  // What this event has already done; until it loads, position alone decides.
  const [done, setDone] = useState<Record<WizardStepKey, boolean> | null>(null)
  useEffect(() => {
    if (eventId == null || isNaN(eventId)) return
    let cancelled = false
    api
      .get<WizardEvent>(`/api/events/${eventId}/`)
      .then((res) => {
        if (!cancelled) setDone(completedSteps(res.data))
      })
      .catch(() => { /* the stepper still works by position */ })
    return () => {
      cancelled = true
    }
  }, [eventId])

  // The Sub-events step must appear when we're standing on it, even if the caller
  // didn't pass includeSubEvents.
  const effectiveInclude = includeSubEvents || currentStep === 'sub-events'
  const steps = buildSteps(effectiveInclude)
  const currentIndex = steps.findIndex((s) => s.key === currentStep)

  return (
    <nav
      aria-label="Invitation creation wizard progress"
      className="w-full bg-white border-b border-gray-100 px-3 py-1.5 sm:px-4"
    >
      <div className="max-w-2xl mx-auto">
        <ol className="flex items-center w-full" role="list">
          {steps.map((step, index) => {
            // Reachable once every step before it is done.
            const reachable = !!done && steps.slice(0, index).every((s) => done[s.key])
            const state = stepState(index, currentIndex, !!done?.[step.key], reachable)
            const isLast = index === steps.length - 1
            return (
              <React.Fragment key={step.key}>
                <li className="flex items-center justify-center" aria-current={index === currentIndex ? 'step' : undefined}>
                  <StepNode step={step} state={state} displayNumber={index + 1} eventId={eventId} />
                </li>
                {!isLast && <Connector leftState={state} />}
              </React.Fragment>
            )
          })}
        </ol>
      </div>
    </nav>
  )
}
