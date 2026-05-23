import type { CapacityStats } from '@/lib/events/computeEventStats'

interface CapacityStripProps {
  capacity: CapacityStats
  showSlotRows?: boolean
}

export default function CapacityStrip({ capacity, showSlotRows = false }: CapacityStripProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-eco-green-light bg-eco-green/5 p-4 text-center">
          <p className="text-3xl font-bold text-eco-green leading-none">{capacity.booked}</p>
          <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide font-medium">Booked</p>
        </div>
        <div className="rounded-xl border border-eco-green-light bg-eco-green/5 p-4 text-center">
          <p className="text-3xl font-bold text-gray-700 leading-none">{capacity.available}</p>
          <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide font-medium">Available</p>
        </div>
        <div className="rounded-xl border border-eco-green-light bg-eco-green/5 p-4 text-center">
          <p className="text-3xl font-bold text-amber-600 leading-none">{capacity.percentFull}%</p>
          <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide font-medium">Full</p>
        </div>
      </div>
      {showSlotRows && capacity.slotRows.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">By time slot</p>
          {capacity.slotRows.map((slot) => (
            <div key={slot.label}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-700">{slot.label}</span>
                <span className="text-xs font-medium text-gray-600">
                  {slot.booked}/{slot.capacity}
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden bg-eco-green-light">
                <div
                  className="h-full rounded-full bg-eco-green transition-all duration-500"
                  style={{ width: `${slot.percent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
