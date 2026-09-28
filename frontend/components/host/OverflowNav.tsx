'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { MoreHorizontal } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface OverflowNavItem {
  href: string
  label: string
  /** Shorter label for the cramped stacked variant; the menu always uses `label`. */
  shortLabel?: string
  icon: LucideIcon
  isActive: boolean
}

export interface OverflowNavProps {
  items: OverflowNavItem[]
  /** 'inline' = icon beside label (header). 'stacked' = icon above label (bottom bar). */
  variant?: 'inline' | 'stacked'
  /** Which way the More menu opens. A bottom bar has to open upward. */
  menuPlacement?: 'bottom' | 'top'
  /** Show labels at all. Off on the narrowest screens, where icons alone fit more tabs. */
  showLabels?: boolean
  /** Gap between items, in px. Applied as an inline style so the layout and the
   *  fit calculation can never disagree about it. */
  gap?: number
  className?: string
}

/**
 * A nav row that moves whatever does not fit into a "More" menu.
 *
 * The alternative — letting the row scroll — hides items with no hint they
 * exist, which is how Overview and Host Catalog ended up unreachable at the
 * edges. Here every item is always reachable: visible if it fits, in the menu
 * if it does not.
 *
 * Widths come from a hidden copy of the full row, including a copy of the More
 * button, because once an item moves into the menu it can no longer be measured
 * where it used to be, and the button's real width beats a guessed constant.
 */
export default function OverflowNav({
  items,
  variant = 'inline',
  menuPlacement = 'bottom',
  showLabels = true,
  gap = 20,
  className,
}: OverflowNavProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = useState(items.length)
  const [menuOpen, setMenuOpen] = useState(false)

  const stacked = variant === 'stacked'

  const recompute = useCallback(() => {
    const container = containerRef.current
    const measure = measureRef.current
    if (!container || !measure) return

    const available = container.clientWidth
    const nodes = Array.from(measure.children) as HTMLElement[]
    // Last child of the measure row is the More button stand-in.
    const widths = nodes.slice(0, -1).map((n) => n.offsetWidth)
    const moreWidth = nodes[nodes.length - 1]?.offsetWidth ?? 0

    let used = 0
    let fits = 0
    for (let i = 0; i < widths.length; i += 1) {
      const next = used + widths[i] + (i > 0 ? gap : 0)
      if (next > available) break
      used = next
      fits += 1
    }

    // Making room for the More button may itself cost another item.
    if (fits < widths.length) {
      while (fits > 0 && used + gap + moreWidth > available) {
        fits -= 1
        used -= widths[fits] + (fits > 0 ? gap : 0)
      }
    }
    setVisibleCount(fits)
  }, [gap])

  useLayoutEffect(() => {
    recompute()
    const container = containerRef.current
    if (!container || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(recompute)
    observer.observe(container)
    return () => observer.disconnect()
  }, [recompute, items, showLabels, variant])

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

  // Close after navigating, so the menu does not linger over the new page.
  useEffect(() => {
    setMenuOpen(false)
  }, [items])

  const visible = items.slice(0, visibleCount)
  const hidden = items.slice(visibleCount)
  const hiddenHasActive = hidden.some((i) => i.isActive)

  const itemClass = (isActive: boolean) =>
    cn(
      'transition-colors',
      stacked
        ? 'flex min-w-[44px] shrink-0 flex-col items-center gap-1 rounded-xl px-2 py-2'
        : 'inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap',
      isActive
        ? 'bg-eco-green text-white'
        : 'text-gray-600 hover:bg-eco-green-light hover:text-eco-green',
    )

  const labelClass = stacked ? 'whitespace-nowrap text-[9px] font-medium' : undefined
  const iconSize = 18

  const renderContent = (item: OverflowNavItem) => (
    <>
      <item.icon size={iconSize} />
      {showLabels ? (
        <span className={labelClass}>{stacked ? item.shortLabel ?? item.label : item.label}</span>
      ) : null}
    </>
  )

  return (
    // flex-1 in both variants on purpose: if the root were sized by its own
    // contents, dropping an item would shrink the measured space, which would
    // drop another item, and it could never grow back.
    <div ref={containerRef} className={cn('relative flex min-w-0 flex-1 items-center', className)}>
      {/*
        Hidden full-width copy: the source of truth for widths, More included.
        It sits in a zero-size overflow-hidden box so it can never widen the
        page - at 375px the row itself is ~445px, and only a clipping ancestor
        was keeping that from becoming horizontal scroll. Clipping does not
        affect the children's offsetWidth, so the measurements are unchanged.
      */}
      <div className="pointer-events-none absolute h-0 w-0 overflow-hidden" aria-hidden>
        <div ref={measureRef} className="flex items-center" style={{ gap }}>
          {items.map((item) => (
            <span key={item.href} className={itemClass(false)}>
              {renderContent(item)}
            </span>
          ))}
          <span className={itemClass(false)}>
            <MoreHorizontal size={iconSize} />
            {showLabels ? <span className={labelClass}>More</span> : null}
          </span>
        </div>
      </div>

      <div
        className={cn('flex min-w-0 flex-1 items-center', stacked ? '' : 'justify-center')}
        style={{ gap }}
      >
        {visible.map((item) => (
          <Link key={item.href} href={item.href} className={itemClass(item.isActive)}>
            {renderContent(item)}
          </Link>
        ))}

        {hidden.length > 0 ? (
          <div ref={menuRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={`More — ${hidden.length} more section${hidden.length === 1 ? '' : 's'}`}
              className={cn(itemClass(hiddenHasActive), 'cursor-pointer')}
            >
              <MoreHorizontal size={iconSize} />
              {showLabels ? <span className={labelClass}>More</span> : null}
            </button>

            {menuOpen ? (
              <div
                role="menu"
                className={cn(
                  'absolute right-0 z-50 w-56 overflow-hidden rounded-xl border border-eco-green-light bg-white py-1 shadow-lg',
                  menuPlacement === 'top' ? 'bottom-full mb-2' : 'top-full mt-1.5',
                )}
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
