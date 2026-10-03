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

import React from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'

export type WizardStepKey = 'details' | 'sub-events' | 'layout' | 'page-editor'

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
function StepCircle({ state }: StepCircleProps): React.ReactElement {
  if (state === 'active') {
    return (
      <motion.span
        className="relative z-10 bg-gray-300 rounded-full bg-[#C9972B] flex-shrink-0 shadow-[0_0_0_4px_rgba(201,151,43,0.12)]"
        aria-label="Current step"
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2 }}
      />
    )
  }

  if (state === 'completed') {
    return (
      <motion.span
        className="relative z-10 w-2.5 h-2.5 rounded-full bg-[#6F9188] flex-shrink-0"
        aria-label="Completed"
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2 }}
      />
    )
  }

  return (
    <span
      className="relative z-10 w-2.5 h-2.5 rounded-full bg-gray-300 flex-shrink-0"
      aria-label="Upcoming"
    />
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

  const labelClasses =
    state === 'active'
      ? 'font-semibold text-[#173B34]'
      : state === 'completed'
        ? 'font-medium text-[#475C57]'
        : 'font-medium text-[#9AA7A3]'

  const content = (
    <div className="flex flex-col items-center gap-1">
      <StepCircle state={state} number={displayNumber} />

      <span
        className={`hidden sm:block text-[10px] leading-tight text-center whitespace-nowrap transition-colors duration-200 ${labelClasses}`}
      >
        {step.label}
      </span>
    </div>
  )

  if (isClickable) {
    return (
      <Link
        href={step.href(eventId!)}
        className="group focus:outline-none"
        aria-label={`Go to step ${displayNumber}: ${step.label}`}
      >
        <motion.span
          whileHover={{ scale: 1.08 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          className="block"
        >
          {content}
        </motion.span>
      </Link>
    )
  }

  return content
}

/** Connector line between two step nodes. */
function Connector({ leftState }: { leftState: StepState }): React.ReactElement {
  const lineClass =
    leftState === 'completed'
      ? 'bg-[#A8BBB6]'
      : 'bg-gray-200'

  return (
    <div className="flex-1 flex items-center -mx-1" aria-hidden="true">
      <motion.div
        className={`w-full h-px ${lineClass}`}
        initial={false}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
      />
    </div>
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
      className="w-full h-[38px] bg-white border-b border-gray-100 px-4"
    >
      <div className="w-[70%] mx-auto">
        <ol className="flex items-center w-full h-full" role="list">
          {steps.map((step, index) => {
            const state = stepState(index, currentIndex)
            const isLast = index === steps.length - 1
            return (
              <React.Fragment key={step.key}>
                <li className="flex-1 flex items-center justify-center">
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
