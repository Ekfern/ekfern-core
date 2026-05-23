export type RsvpBarVariant = 'yes_no_maybe' | 'guest_list' | 'auto_confirm'

interface RsvpBarProps {
  variant?: RsvpBarVariant
  yes: number
  no: number
  maybe?: number
  pending?: number
  expectedAttendees?: number
  responseRate?: number
}

export default function RsvpBar({
  variant = 'yes_no_maybe',
  yes,
  no,
  maybe = 0,
  pending = 0,
  expectedAttendees = 0,
  responseRate,
}: RsvpBarProps) {
  const showMaybe = variant === 'yes_no_maybe' || (variant === 'guest_list' && maybe > 0)
  const secondTile =
    variant === 'guest_list'
      ? { value: pending, label: 'Pending', color: 'text-amber-600' }
      : variant === 'auto_confirm'
        ? { value: pending, label: 'Pending', color: 'text-amber-600' }
        : { value: maybe, label: 'Maybe', color: 'text-amber-500' }

  const fourthLabel = "RSVP'd"
  const fourthValue = responseRate !== undefined ? `${responseRate}%` : '—'

  const barTotal = yes + no + (showMaybe ? maybe : 0)

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-eco-green-light bg-eco-green/5 p-3 text-center">
          <p className="text-2xl font-bold text-eco-green leading-none">{yes}</p>
          <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wide font-semibold">
            {variant === 'auto_confirm' ? 'Confirmed' : 'Attending'}
          </p>
        </div>
        <div className="rounded-xl border border-eco-green-light bg-eco-green/5 p-3 text-center">
          <p className={`text-2xl font-bold leading-none ${secondTile.color}`}>{secondTile.value}</p>
          <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wide font-semibold">
            {secondTile.label}
          </p>
        </div>
        <div className="rounded-xl border border-eco-green-light bg-eco-green/5 p-3 text-center">
          <p className="text-2xl font-bold text-red-500 leading-none">{no}</p>
          <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wide font-semibold">
            Declined
          </p>
        </div>
        <div className="rounded-xl border border-eco-green-light bg-eco-green/5 p-3 text-center">
          <p className="text-2xl font-bold text-eco-green leading-none">{fourthValue}</p>
          <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wide font-semibold">
            {fourthLabel}
          </p>
        </div>
      </div>

      {expectedAttendees > 0 && variant !== 'auto_confirm' && (
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-bold text-eco-green leading-none">{expectedAttendees}</p>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Expected attendance</p>
        </div>
      )}

      {variant !== 'auto_confirm' && barTotal > 0 ? (
        <div className="space-y-2">
          <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5">
            {yes > 0 && (
              <div className="bg-green-500 rounded-l-full" style={{ flex: yes }} title={`Attending: ${yes}`} />
            )}
            {showMaybe && maybe > 0 && (
              <div className="bg-yellow-400" style={{ flex: maybe }} title={`Maybe: ${maybe}`} />
            )}
            {no > 0 && (
              <div className="bg-red-400 rounded-r-full" style={{ flex: no }} title={`Declined: ${no}`} />
            )}
            <div className="flex-1 bg-gray-100 rounded-r-full" />
          </div>
        </div>
      ) : variant !== 'auto_confirm' ? (
        <p className="text-xs text-gray-400 italic">No RSVP responses yet</p>
      ) : null}
    </div>
  )
}
