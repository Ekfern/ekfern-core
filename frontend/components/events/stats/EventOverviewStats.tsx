'use client'

import { Card, CardContent } from '@/components/ui/card'
import type { EventStatsResult } from '@/lib/events/computeEventStats'
import CapacityStrip from './CapacityStrip'
import StatTileGrid from './StatTileGrid'
import SubEventAttendanceTable from './SubEventAttendanceTable'

interface EventOverviewStatsProps {
  stats: EventStatsResult
}

function PopulationSection({
  title,
  stats,
  isPerSubeventRsvp,
  hasSubEvents,
}: {
  title: string
  stats: EventStatsResult['invited']
  isPerSubeventRsvp: boolean
  hasSubEvents: boolean
}) {
  const subEventEmptyMessage = 'No sub-events created. Add sub-events to see attendance by session.'

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">{title}</p>
      {isPerSubeventRsvp ? (
        hasSubEvents ? (
          <SubEventAttendanceTable rows={stats.subEventRows} />
        ) : (
          <p className="text-sm text-gray-400 italic">{subEventEmptyMessage}</p>
        )
      ) : (
        <StatTileGrid tiles={stats.tiles} />
      )}
    </div>
  )
}

export default function EventOverviewStats({ stats }: EventOverviewStatsProps) {
  const singleBlock =
    stats.showInvitedBlock && !stats.showOpenBlock
      ? 'invited'
      : !stats.showInvitedBlock && stats.showOpenBlock
        ? 'open'
        : null

  if (!stats.showInvitedBlock && !stats.showOpenBlock && !stats.showCapacityStrip) {
    return (
      <Card className="bg-white border-2 border-eco-green-light mb-6">
        <CardContent className="pt-6">
          <p className="text-sm text-gray-400 italic">No RSVP activity yet</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-white border-2 border-eco-green-light mb-6">
      <CardContent className="pt-6 space-y-6">
        {stats.showCapacityStrip && stats.capacity && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
              Capacity
            </p>
            <CapacityStrip capacity={stats.capacity} showSlotRows={stats.isSlotMode} />
          </div>
        )}

        {singleBlock === 'invited' && (
          <PopulationSection
            title="Invited guests"
            stats={stats.invited}
            isPerSubeventRsvp={stats.isPerSubeventRsvp}
            hasSubEvents={stats.hasSubEvents}
          />
        )}

        {singleBlock === 'open' && (
          <PopulationSection
            title="Open responses"
            stats={stats.open}
            isPerSubeventRsvp={stats.isPerSubeventRsvp}
            hasSubEvents={stats.hasSubEvents}
          />
        )}

        {stats.showInvitedBlock && stats.showOpenBlock && (
          <>
            <PopulationSection
              title="Invited guests"
              stats={stats.invited}
              isPerSubeventRsvp={stats.isPerSubeventRsvp}
              hasSubEvents={stats.hasSubEvents}
            />
            <div className="border-t border-gray-100 pt-6">
              <PopulationSection
                title="Open responses"
                stats={stats.open}
                isPerSubeventRsvp={stats.isPerSubeventRsvp}
                hasSubEvents={stats.hasSubEvents}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
