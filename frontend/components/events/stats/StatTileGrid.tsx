import type { StatTile } from '@/lib/events/computeEventStats'

interface StatTileGridProps {
  tiles: StatTile[]
}

export default function StatTileGrid({ tiles }: StatTileGridProps) {
  if (tiles.length === 0) return null

  const gridClass =
    tiles.length === 1
      ? 'grid grid-cols-1 gap-2 max-w-xs'
      : tiles.length === 3
        ? 'grid grid-cols-3 gap-2'
        : 'grid grid-cols-2 gap-2'

  return (
    <div className={gridClass}>
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="rounded-xl border border-eco-green-light bg-eco-green/5 p-3 text-center"
        >
          <p className={`text-2xl font-bold leading-none ${tile.colorClass || 'text-eco-green'}`}>
            {tile.value}
          </p>
          <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wide font-semibold">
            {tile.label}
          </p>
        </div>
      ))}
    </div>
  )
}
