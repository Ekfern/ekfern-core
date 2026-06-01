'use client'

import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { Tile } from '@/lib/invite/schema'
import TileSettings from './TileSettings'

interface SortableTileSettingsProps {
  tile: Tile
  onUpdate: (tile: Tile) => void
  onToggle: (tileId: string, enabled: boolean) => void
  onRemove?: () => void
  eventId: number
  hasRsvp?: boolean
  hasRegistry?: boolean
  forceExpanded?: boolean
  isFooter?: boolean
  /** Highlight that this tile differs from the published version (unpublished change). */
  isChanged?: boolean
}

export default function SortableTileSettings({
  tile,
  onUpdate,
  onToggle,
  onRemove,
  eventId,
  hasRsvp = false,
  hasRegistry = false,
  forceExpanded = false,
  isFooter = false,
  isChanged = false,
}: SortableTileSettingsProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: tile.id,
    disabled: isFooter, // Footer is not draggable
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative w-full ${isDragging ? 'z-50' : ''}`}
    >
      <div className="relative">
        {!isFooter && (
          <div
            {...attributes}
            {...listeners}
            className="absolute left-2 top-3 z-10 p-1 cursor-grab active:cursor-grabbing bg-white rounded shadow-sm hover:bg-gray-50 border border-gray-200"
          >
            <GripVertical className="w-4 h-4 text-gray-400" />
          </div>
        )}
        {isChanged && (
          <span
            className="absolute right-2 -top-2 z-20 inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-[10px] font-semibold text-amber-700 shadow-sm"
            title="This tile has changes that are not published yet"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Edited
          </span>
        )}
        <TileSettings
          tile={tile}
          onUpdate={onUpdate}
          onToggle={onToggle}
          onRemove={onRemove}
          eventId={eventId}
          hasRsvp={hasRsvp}
          hasRegistry={hasRegistry}
          forceExpanded={forceExpanded}
        />
      </div>
    </div>
  )
}

