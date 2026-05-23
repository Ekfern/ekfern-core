import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

type InvitePublishStatus = 'Published' | 'Draft' | 'Not created' | 'Unknown'

interface NextActionCardProps {
  eventId: string
  invitePublishStatus: InvitePublishStatus
  totalGuests: number
  responseRate: number
  isExpired?: boolean
}

interface ActionConfig {
  message: string
  cta: string
  href: string
  variant: 'warning' | 'info' | 'nudge'
}

export default function NextActionCard({
  eventId,
  invitePublishStatus,
  totalGuests,
  responseRate,
  isExpired,
}: NextActionCardProps) {
  if (isExpired) return null

  const variantStyles: Record<ActionConfig['variant'], string> = {
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    nudge: 'bg-eco-green/5 border-eco-green-light text-eco-green',
  }

  const arrowStyles: Record<ActionConfig['variant'], string> = {
    warning: 'text-amber-600',
    info: 'text-blue-600',
    nudge: 'text-eco-green',
  }

  let action: ActionConfig | null = null

  if (invitePublishStatus === 'Not created') {
    action = {
      message: 'Your invite page is not set up yet.',
      cta: 'Design your invite',
      href: `/host/page-layouts/new`,
      variant: 'warning',
    }
  } else if (invitePublishStatus === 'Draft') {
    action = {
      message: 'Invite page is configured but not published.',
      cta: 'Publish to go live',
      href: `/host/events/${eventId}/layout`,
      variant: 'warning',
    }
  } else if (totalGuests === 0) {
    action = {
      message: 'No guests added to your list yet.',
      cta: 'Build your guest list',
      href: `/host/events/${eventId}/guests`,
      variant: 'info',
    }
  } else if (responseRate < 30 && totalGuests > 0) {
    action = {
      message: `Response rate is low — ${responseRate}% of guests have responded.`,
      cta: 'Send a reminder',
      href: `/host/events/${eventId}/communications`,
      variant: 'nudge',
    }
  }

  if (!action) return null

  return (
    <div
      className={`flex items-center justify-between rounded-lg border px-4 py-3 mb-6 ${variantStyles[action.variant]}`}
    >
      <p className="text-sm">{action.message}</p>
      <Link
        href={action.href}
        className={`ml-4 flex items-center gap-1 text-sm font-semibold whitespace-nowrap ${arrowStyles[action.variant]}`}
      >
        {action.cta}
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}
