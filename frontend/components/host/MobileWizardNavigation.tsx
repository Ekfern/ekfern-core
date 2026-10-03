'use client'

import { useRouter } from 'next/navigation'
import type { WizardStepKey } from './WizardProgress'

interface MobileWizardNavigationProps {
  currentStep: WizardStepKey
  eventId: number
  includeSubEvents?: boolean
  onNext?: () => void | Promise<void>
  onBack?: () => void | Promise<void>
  nextDisabled?: boolean
  backDisabled?: boolean
}

const BASE_STEPS: WizardStepKey[] = [
  'details',
  'layout',
  'page-editor',
]

function getSteps(includeSubEvents: boolean): WizardStepKey[] {
  if (!includeSubEvents) return BASE_STEPS

  return [
    'details',
    'sub-events',
    'layout',
    'page-editor',
  ]
}

function getStepPath(eventId: number, step: WizardStepKey): string {
  switch (step) {
    case 'details':
      return `/host/events/${eventId}/details`
    case 'sub-events':
      return `/host/events/${eventId}/sub-events-setup`
    case 'layout':
      return `/host/events/${eventId}/layout`
    case 'page-editor':
      return `/host/events/${eventId}/page-editor`
  }
}

export default function MobileWizardNavigation({
  currentStep,
  eventId,
  includeSubEvents = false,
  onNext,
  onBack,
  nextDisabled = false,
  backDisabled = false,
}: MobileWizardNavigationProps) {
  const router = useRouter()

  const steps = getSteps(includeSubEvents)
  const currentIndex = steps.indexOf(currentStep)

  if (currentIndex === -1) return null

  const isFirst = currentIndex === 0
  const isLast = currentIndex === steps.length - 1

  async function handleBack() {
    if (isFirst || backDisabled) return

    if (onBack) {
      await onBack()
      return
    }

    router.push(getStepPath(eventId, steps[currentIndex - 1]))
  }

  async function handleNext() {
    if (isLast || nextDisabled) return

    if (onNext) {
      await onNext()
      return
    }

    router.push(getStepPath(eventId, steps[currentIndex + 1]))
  }

  return (
    <div className="md:hidden flex gap-3 border-t border-gray-200 mt-8 pt-4 pb-6">
      {!isFirst && (
        <button
          type="button"
          onClick={() => void handleBack()}
          disabled={backDisabled}
          className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          ← Back
        </button>
      )}

      {!isLast && (
        <button
          type="button"
          onClick={() => void handleNext()}
          disabled={nextDisabled}
          className="flex-1 rounded-lg bg-eco-green px-4 py-3 text-sm font-semibold text-white hover:bg-eco-green-dark disabled:opacity-50"
        >
          Next →
        </button>
      )}
    </div>
  )
}