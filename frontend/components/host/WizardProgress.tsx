/**
 * WizardProgress — horizontal step indicator for the invitation creation wizard.
 *
 * Steps:
 *   Event Details  (/host/events/new to create; /host/events/[eventId]/details to edit)
 *   Sub-events     (/host/events/[eventId]/sub-events-setup) — only for multi-sub-event (ENVELOPE) events
 *   Layout         (/host/events/[eventId]/layout)
 *   Design         (/host/events/[eventId]/design)
 *   Page Editor    (/host/events/[eventId]/page-editor)
 *
 * The Sub-events step is inserted only when `includeSubEvents` is set (i.e. the
 * host chose "multiple sub-events" and the event is/became ENVELOPE). Step
 * numbers are derived from position so the same component renders both the
 * 4-step and 5-step journeys. Completed steps are clickable when eventId is set.
 */

import React from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

export type WizardStepKey = 'details' | 'sub-events' | 'layout' | 'design' | 'page-editor'

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
  href: (id: number) => string
}

const BASE_STEPS: StepDefinition[] = [
  { key: 'details', label: 'Event Details', href: (id) => `/host/events/${id}/details` },
  { key: 'layout', label: 'Layout', href: (id) => `/host/events/${id}/layout` },
  { key: 'design', label: 'Design', href: (id) => `/host/events/${id}/design` },
  { key: 'page-editor', label: 'Page Editor', href: (id) => `/host/events/${id}/page-editor` },
]

const SUB_EVENTS_STEP: StepDefinition = {
  key: 'sub-events',
  label: 'Sub-events',
  href: (id) => `/host/events/${id}/sub-events-setup`,
}

/** Build the visible step sequence, inserting Sub-events after Event Details when needed. */
function buildSteps(includeSubEvents: boolean): StepDefinition[] {
  if (!includeSubEvents) return BASE_STEPS
  return [BASE_STEPS[0], SUB_EVENTS_STEP, ...BASE_STEPS.slice(1)]
}

type StepState = 'completed' | 'active' | 'future'

function stepState(stepIndex: number, currentIndex: number): StepState {
  if (stepIndex < currentIndex) return 'completed'
  if (stepIndex === currentIndex) return 'active'
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
      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-eco-green text-white ring-2 ring-eco-green flex-shrink-0">
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
  if (state === 'active') {
    return (
      <motion.span
        className="flex items-center justify-center w-8 h-8 rounded-full bg-eco-green text-white ring-2 ring-eco-green flex-shrink-0 text-sm font-bold"
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        {number}
      </motion.span>
    )
  }
  // future
  return (
    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white text-gray-400 ring-2 ring-gray-300 flex-shrink-0 text-sm font-medium">
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

function StepNode({ step, state, displayNumber, eventId }: StepNodeProps): React.ReactElement {
  const isClickable = state === 'completed' && eventId != null
  const circle = <StepCircle state={state} number={displayNumber} />

  const labelClasses =
    state === 'active'
      ? 'font-semibold text-eco-green'
      : state === 'completed'
      ? 'font-medium text-gray-500'
      : 'font-medium text-gray-400'

  const inner = (
    <div className="flex flex-col items-center gap-1.5">
      {circle}
      {/* Label: hidden on very small screens, shown sm+ */}
      <span className={`hidden sm:block text-xs leading-tight text-center ${labelClasses}`}>
        {step.label}
      </span>
    </div>
  )

  if (isClickable) {
    return (
      <Link
        href={step.href(eventId!)}
        className="flex flex-col items-center gap-1.5 group focus:outline-none"
        aria-label={`Go to step ${displayNumber}: ${step.label}`}
      >
        <motion.span
          whileHover={{ scale: 1.1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          className="flex items-center justify-center w-8 h-8 rounded-full bg-eco-green text-white ring-2 ring-eco-green flex-shrink-0"
        >
          <CheckIcon />
        </motion.span>
        <span className={`hidden sm:block text-xs leading-tight text-center ${labelClasses} group-hover:text-eco-green transition-colors`}>
          {step.label}
        </span>
      </Link>
    )
  }

  return inner
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
  // The Sub-events step must appear when we're standing on it, even if the caller
  // didn't pass includeSubEvents.
  const effectiveInclude = includeSubEvents || currentStep === 'sub-events'
  const steps = buildSteps(effectiveInclude)
  const currentIndex = steps.findIndex((s) => s.key === currentStep)

  return (
    <nav
      aria-label="Invitation creation wizard progress"
      className="w-full bg-white border-b border-gray-100 px-4 py-4"
    >
      <div className="max-w-2xl mx-auto">
        <ol className="flex items-center w-full" role="list">
          {steps.map((step, index) => {
            const state = stepState(index, currentIndex)
            const isLast = index === steps.length - 1
            return (
              <React.Fragment key={step.key}>
                <li className="flex items-center justify-center">
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
