'use client'

import React from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface StudioConfirmDialogProps {
  isOpen: boolean
  title: string
  /** Body copy. Should state exactly what is about to happen, including counts. */
  message: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** Red confirm button + warning icon for destructive actions. */
  destructive?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Small confirmation modal for Page Layout Studio actions that cannot be undone
 * (delete one layout, delete a selection). Deliberately plain: staff-only tool.
 */
export default function StudioConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: StudioConfirmDialogProps): React.ReactElement | null {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={busy ? undefined : onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          {destructive ? (
            <span className="mt-0.5 shrink-0 rounded-full bg-red-100 p-2 text-red-600">
              <AlertTriangle className="w-4 h-4" aria-hidden />
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            <div className="mt-1 text-sm text-gray-600">{message}</div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={destructive ? 'bg-red-600 hover:bg-red-700 text-white' : undefined}
          >
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
