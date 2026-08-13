import {
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'

/**
 * Drag sensors for the tile lists, shared so the editor and the settings panel
 * cannot drift apart.
 *
 * A single bare PointerSensor cannot serve both inputs well. On a mouse you
 * want the drag to begin the moment the pointer moves; on a finger you cannot,
 * because every drag gesture starts out identical to a scroll and to a tap.
 * So each input gets the activation rule that fits it:
 *
 * - mouse: a 5px movement threshold, so a click that wobbles still opens the
 *   tile instead of starting a drag;
 * - touch: a short press-and-hold, which is the only unambiguous way to say
 *   "move this" rather than "scroll the list" or "open this";
 * - keyboard: unchanged, for anyone not using a pointer at all.
 *
 * Handles must also set `touch-action: none` (see TILE_DRAG_HANDLE_CLASS), or
 * the browser claims the gesture for scrolling and cancels the drag before it
 * starts - which is what made tile reordering silently impossible on mobile.
 */

/** Long enough to be deliberate, short enough not to feel broken. */
const TOUCH_ACTIVATION_DELAY_MS = 250

/** Finger movement allowed during the hold before it counts as a scroll. */
const TOUCH_ACTIVATION_TOLERANCE_PX = 5

/** Mouse movement before a press turns into a drag rather than a click. */
const MOUSE_ACTIVATION_DISTANCE_PX = 5

/**
 * Every drag handle needs this. `touch-action: none` tells the browser not to
 * treat a touch on the handle as a scroll, which is what lets the drag start;
 * the rest is the grab affordance that used to be repeated at each call site.
 */
export const TILE_DRAG_HANDLE_CLASS = 'touch-none select-none cursor-grab active:cursor-grabbing'

export function useTileDragSensors() {
  return useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: MOUSE_ACTIVATION_DISTANCE_PX },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: TOUCH_ACTIVATION_DELAY_MS,
        tolerance: TOUCH_ACTIVATION_TOLERANCE_PX,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )
}
