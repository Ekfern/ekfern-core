import type { SubEventRowStats } from '@/lib/events/computeEventStats'

interface SubEventAttendanceTableProps {
  rows: SubEventRowStats[]
  emptyMessage?: string
}

export default function SubEventAttendanceTable({
  rows,
  emptyMessage = 'No RSVP responses yet',
}: SubEventAttendanceTableProps) {
  if (rows.length === 0) {
    return <p className="text-sm text-gray-400 italic">{emptyMessage}</p>
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div
          key={row.title}
          className="flex items-center justify-between gap-3 py-1.5 border-b border-gray-100 last:border-0"
        >
          <span className="text-sm font-medium text-gray-800 truncate flex-1">{row.title}</span>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
              {row.attending}
            </span>
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
              {row.declined}
            </span>
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
              {row.pending}
            </span>
          </div>
        </div>
      ))}
      <p className="text-[10px] text-gray-400 pt-1">
        Attending · Declined · Pending
      </p>
    </div>
  )
}
