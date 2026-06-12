'use client'

import React, { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Copy, GripVertical, Pencil, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { ActionType, CatalogItem, ItemType } from '@/lib/catalog/types'
import { formatRupees } from '@/lib/catalog/types'

const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  pledge_amount: 'Pledge amount',
  submit_interest: 'Submit interest',
  open_external_link: 'Open external link',
  contact_host: 'Contact host',
}

const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  contribution: 'Contribution',
  offer_addon: 'Offer / Add-on',
  info_link: 'Info / Link',
}

const ITEM_TYPE_COLORS: Record<ItemType, string> = {
  contribution: 'bg-green-100 text-green-800',
  offer_addon: 'bg-blue-100 text-blue-800',
  info_link: 'bg-gray-100 text-gray-800',
}

function SortableCatalogRow({
  item,
  onEdit,
  onDuplicate,
  onDeleteRequest,
}: {
  item: CatalogItem
  onEdit: (item: CatalogItem) => void
  onDuplicate: (item: CatalogItem) => void
  onDeleteRequest: (item: CatalogItem) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <Card className={item.status === 'hidden' ? 'opacity-60' : ''}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <button
              type="button"
              className="mt-1 p-1 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing touch-none"
              {...attributes}
              {...listeners}
              aria-label="Drag to reorder"
            >
              <GripVertical className="h-5 w-5" />
            </button>
            {item.image_url ? (
              <img
                src={item.image_url}
                alt={item.title}
                className="h-20 w-20 rounded-lg object-cover flex-shrink-0"
              />
            ) : (
              <div className="h-20 w-20 rounded-lg bg-gray-100 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${ITEM_TYPE_COLORS[item.item_type]}`}
                >
                  {ITEM_TYPE_LABELS[item.item_type]}
                </span>
                {item.status === 'hidden' && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">
                    Hidden
                  </span>
                )}
              </div>
              <p className="font-medium text-gray-900">{item.title}</p>
              <p className="text-sm text-gray-500">{ACTION_TYPE_LABELS[item.action_type]}</p>
              {item.amount_type === 'fixed' && item.fixed_amount && (
                <p className="text-sm text-eco-green font-medium">{formatRupees(item.fixed_amount)}</p>
              )}
              {item.amount_type === 'suggested' && item.suggested_amounts && (
                <p className="text-sm text-gray-500">
                  {item.suggested_amounts.map(formatRupees).join(' · ')}
                </p>
              )}
              {item.amount_type === 'flexible' && (
                <p className="text-sm text-gray-500">Any amount</p>
              )}
            </div>
            <div className="flex gap-0.5 flex-shrink-0">
              <button
                type="button"
                onClick={() => onEdit(item)}
                className="p-2 text-gray-400 hover:text-eco-green rounded-md hover:bg-gray-50"
                title="Edit"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onDuplicate(item)}
                className="p-2 text-gray-400 hover:text-eco-green rounded-md hover:bg-gray-50"
                title="Duplicate"
              >
                <Copy className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onDeleteRequest(item)}
                className="p-2 text-gray-400 hover:text-red-500 rounded-md hover:bg-gray-50"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function CatalogItemList({
  items,
  onReorder,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  items: CatalogItem[]
  onReorder: (items: CatalogItem[]) => void
  onEdit: (item: CatalogItem) => void
  onDuplicate: (item: CatalogItem) => void
  onDelete: (item: CatalogItem) => void
}) {
  const [deleteTarget, setDeleteTarget] = useState<CatalogItem | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((i) => i.id === active.id)
    const newIndex = items.findIndex((i) => i.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const reordered = arrayMove(items, oldIndex, newIndex).map((item, idx) => ({
      ...item,
      sort_order: idx,
    }))
    onReorder(reordered)
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-gray-200 p-10 text-center text-gray-400">
        No items yet. Add your first catalog item or use a quick template.
      </div>
    )
  }

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {items.map((item) => (
              <SortableCatalogRow
                key={item.id}
                item={item}
                onEdit={onEdit}
                onDuplicate={onDuplicate}
                onDeleteRequest={setDeleteTarget}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <p className="font-semibold text-gray-900">Delete item?</p>
            <p className="text-sm text-gray-600">
              &ldquo;{deleteTarget.title}&rdquo; will be removed permanently.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDelete(deleteTarget)
                  setDeleteTarget(null)
                }}
                className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
