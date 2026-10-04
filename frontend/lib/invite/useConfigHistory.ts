'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { InviteConfig } from '@/lib/invite/schema'

/**
 * Undo/redo over a whole InviteConfig, shared by the host's page editor and the
 * staff page layout studio.
 *
 * Callers snapshot before they mutate: `pushHistory()` then change the config.
 * Snapshotting after the fact would record the result, so the first undo would
 * appear to do nothing.
 *
 * The studio had no history at all — a designer could not take back a mis-drag.
 */

const HISTORY_LIMIT = 50

export function useConfigHistory(
  config: InviteConfig,
  setConfig: React.Dispatch<React.SetStateAction<InviteConfig>>,
): { pushHistory: () => void } {
  const undoStack = useRef<InviteConfig[]>([])
  const redoStack = useRef<InviteConfig[]>([])
  const configRef = useRef<InviteConfig>(config)

  useEffect(() => {
    configRef.current = config
  }, [config])

  const pushHistory = useCallback(() => {
    undoStack.current = [
      ...undoStack.current,
      structuredClone(configRef.current),
    ].slice(-HISTORY_LIMIT)

    redoStack.current = []
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement

      // Don't interfere with typing in inputs/textareas/contenteditable
      if (
        target.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      ) {
        return
      }

      // Undo: Ctrl+Z / Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()

        const previous = undoStack.current.pop()

        if (previous) {
          redoStack.current.push(structuredClone(configRef.current))
          setConfig(previous)
        }
      }

      // Redo: Ctrl+Y / Cmd+Y OR Ctrl+Shift+Z / Cmd+Shift+Z
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === 'y' ||
          (e.key.toLowerCase() === 'z' && e.shiftKey))
      ) {
        e.preventDefault()

        const next = redoStack.current.pop()

        if (next) {
          undoStack.current.push(structuredClone(configRef.current))
          setConfig(next)
        }
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [setConfig])

  return { pushHistory }
}
