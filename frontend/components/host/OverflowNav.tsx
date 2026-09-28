'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { MoreHorizontal } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface OverflowNavItem {
  href: string
  label: string
  icon: LucideIcon
  isActive: boolean
}

export interface OverflowNavProps {
  items: OverflowNavItem[]
  /** Show labels beside icons. Off on narrower screens where icons alone fit. */
  showLabels?: boolean
  className?: string
}

const MORE_BUTTON_WIDTH = 92
const GAP = 20

/**
 * A nav row that moves whatever does not fit into a "More" menu.
 *
 * The alternative — letting the row scroll — hides items with no hint that
 * they exist, which is how Overview and Host Catalog ended up unreachable at
 * the edges. Here every item is always reachable: visible if it fits, in the
 * menu if it does not.
 *
 * Widths are measured from a hidden copy of the full row rather than from the
 * rendered one, because once an item moves into the menu it can no longer be
 * measured where it used to be.
 */
export default function OverflowNav({ items, showLabels = true, className }: OverflowNavProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState(items.length)
  const [menuOpen, setMenuOpen] = useState(false)

  const recompute = useCallback(() => {
    const container = containerRef.current
    const measure = measureRef.current
    if (!container || !measure) return

    const available = container.clientWidth
    const widths = Array.from(measure.children).map((c) => (c as HTMLElement).offsetWidth)

    let used = 0
    let fits = 0
    for (let i = 0; i < widths.length; i += 1) {
      const next = used + widths[i] + (i > 0 ? GAP : 0)
      if (next > available) break
      used = next
      fits += 1
    }

    // If something had to be dropped, the More button needs room too, which may
    // cost one more item.
    if (fits < widths.length) {
      while (fits > 0 && used + GAP + MORE_BUTTON_WIDTH > available) {
        fits -= 1
        used -= widths[fits] + (fits > 0 ? GAP : 0)
      }
    }
    setVisibleCount(fits)
  }, [])

  useLayoutEffect(() => {
    recompute()
    const container = containerRef.current
    if (!container || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(recompute)
    observer.observe(container)
    return () => observer.disconnect()
  }, [recompute, items, showLabels])

  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  // Close the menu after navigating, so it does not linger over the new page.
  useEffect(() => {
    setMenuOpen(false)
  }, [items])

  const visible = items.slice(0, visibleCount)
  const hidden = items.slice(visibleCount)
  const hiddenHasActive = hidden.some((i) => i.isActive)

  const itemClass = (isActive: boolean) =>
    cn(
      'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-all',
      isActive
        ? 'bg-eco-green text-white'
        : 'text-gray-600 hover:bg-eco-green-light hover:text-eco-green',
    )

  return (
    <div ref={containerRef} className={cn('relative flex min-w-0 flex-1 items-center', className)}>
      {/* Hidden full-width copy: the source of truth for item widths. */}
      <div
        ref={measureRef}
        aria-hidden
        className="pointer-events-none absolute -z-10 flex items-center gap-5 opacity-0"
      >
        {items.map((item) => (
          <span key={item.href} className={itemClass(false)}>
            <item.icon size={18} />
            {showLabels ? <span>{item.label}</span> : null}
          </span>
        ))}
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-center gap-5">
        {visible.map((item) => (
          <Link key={item.href} href={item.href} className={itemClass(item.isActive)}>
            <item.icon size={18} />
            {showLabels ? <span>{item.label}</span> : null}
          </Link>
        ))}

        {hidden.length > 0 ? (
          <div ref={menuRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className={cn(itemClass(hiddenHasActive), 'cursor-pointer')}
            >
              <MoreHorizontal size={18} />
              <span>More</span>
            </button>

            {menuOpen ? (
              <div
                role="menu"
                className="absolute right-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-xl border border-eco-green-light bg-white py-1 shadow-lg"
              >
                {hidden.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors',
                      item.isActive
                        ? 'bg-eco-green-light text-eco-green'
                        : 'text-gray-700 hover:bg-eco-green-light hover:text-eco-green',
                    )}
                  >
                    <item.icon size={16} />
                    {item.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
