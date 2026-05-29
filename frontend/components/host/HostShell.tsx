'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CalendarCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GalleryHorizontal,
  Gift,
  HelpCircle,
  LayoutDashboard,
  Layers,
  Menu,
  MessageSquare,
  Palette,
  Paintbrush,
  PlusCircle,
  User,
  Users,
  LogOut,
  type LucideIcon,
} from 'lucide-react'
import Logo from '@/components/Logo'
import { TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import api from '@/lib/api'
import { cn } from '@/lib/utils'

const AUTH_ROUTES = new Set([
  '/host/login',
  '/host/signup',
  '/host/forgot-password',
  '/host/reset-password',
])

function isActivePath(pathname: string, href: string, exact = false) {
  if (exact) return pathname === href
  if (href === '/host/dashboard') return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

function getEventIdFromPath(pathname: string): string | null {
  const eventRouteMatch = pathname.match(/^\/host\/events\/(\d+)(?:\/|$)/)
  if (eventRouteMatch) return eventRouteMatch[1]
  const registryRouteMatch = pathname.match(/^\/host\/items\/(\d+)(?:\/|$)/)
  if (registryRouteMatch) return registryRouteMatch[1]
  return null
}

export default function HostShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isDesktopNavCollapsed, setIsDesktopNavCollapsed] = useState(false)
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const switcherRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const stored = localStorage.getItem('host-nav-collapsed')
    if (stored === 'true') setIsDesktopNavCollapsed(true)
  }, [])

  const [eventSettings, setEventSettings] = useState<{
    title: string
    has_rsvp: boolean
    has_registry: boolean
    event_structure: 'SIMPLE' | 'ENVELOPE'
  } | null>(null)
  const [allEvents, setAllEvents] = useState<{ id: number; title: string }[]>([])
  const [isStaff, setIsStaff] = useState(false)

  const isAuthRoute = AUTH_ROUTES.has(pathname)
  const eventId = getEventIdFromPath(pathname)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (isAuthRoute) return
    api.get('/api/auth/me/').then((r) => {
      if (r?.data?.is_staff === true) setIsStaff(true)
    }).catch(() => {})
    api.get('/api/events/').then((r) => {
      const list = r.data.results ?? r.data
      setAllEvents(list.map((e: { id: number; title: string }) => ({ id: e.id, title: e.title })))
    }).catch(() => {})
  }, [isAuthRoute])

  useEffect(() => {
    if (!eventId) { setEventSettings(null); return }
    let isCancelled = false
    api.get(`/api/events/${eventId}/`).then((r) => {
      if (!isCancelled && r.data) {
        setEventSettings({
          title: r.data.title ?? '',
          has_rsvp: r.data.has_rsvp ?? true,
          has_registry: r.data.has_registry ?? true,
          event_structure: r.data.event_structure || 'SIMPLE',
        })
      }
    }).catch(() => { if (!isCancelled) setEventSettings(null) })
    return () => { isCancelled = true }
  }, [eventId])

  // Close switcher on outside click
  useEffect(() => {
    if (!switcherOpen) return
    const handler = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setSwitcherOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [switcherOpen])

  const globalNavItems = useMemo(() => [
    { href: '/host/dashboard',  label: 'Dashboard',    icon: LayoutDashboard },
    { href: '/host/events/new', label: 'Create Event', icon: PlusCircle },
    { href: '/host/profile',    label: 'Profile',      icon: User },
  ], [])

  const eventTabItems = useMemo(() => {
    if (!eventId) return []
    const hasRsvp     = eventSettings?.has_rsvp      ?? true
    const hasRegistry = eventSettings?.has_registry   ?? true
    const isEnvelope  = eventSettings?.event_structure === 'ENVELOPE'
    const items: { href: string; label: string; icon: LucideIcon }[] = [
      { href: `/host/events/${eventId}`,               label: 'Overview',   icon: LayoutDashboard },
      { href: `/host/events/${eventId}/page-editor`,    label: 'Page Editor', icon: Paintbrush },
      { href: `/host/events/${eventId}/guests`,        label: 'Guests',     icon: Users },
    ]
    if (hasRsvp)     items.push({ href: `/host/events/${eventId}/rsvp`,        label: 'RSVP',       icon: CalendarCheck })
    if (isEnvelope)  items.push({ href: `/host/events/${eventId}/sub-events`,  label: 'Sub-Events', icon: Layers })
    items.push(        { href: `/host/events/${eventId}/communications`, label: 'Messages',   icon: MessageSquare })
    if (hasRegistry) items.push({ href: `/host/items/${eventId}`,              label: 'Registry',   icon: Gift })
    return items
  }, [eventId, eventSettings])

  if (isAuthRoute) return <>{children}</>

  const handleLogout = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    router.push('/host/login')
  }

  return (
    <div className="min-h-screen bg-eco-beige md:flex">
      {isMobileDrawerOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={() => setIsMobileDrawerOpen(false)}
        />
      )}

      {/* ── Sidebar ───────────────────────────────────────────────── */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 bg-white border-r border-eco-green-light shadow-sm transition-all md:static md:translate-x-0',
          isMobileDrawerOpen ? 'translate-x-0' : '-translate-x-full',
          isDesktopNavCollapsed ? 'md:w-20' : 'md:w-64',
          'w-72'
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-eco-green-light px-4 py-4">
            <Logo href="/host/dashboard" textClassName={cn(isDesktopNavCollapsed && 'md:hidden')} />
            <button
              type="button"
              className="hidden rounded-md p-1 text-eco-green hover:bg-eco-green-light md:inline-flex"
              aria-label={isDesktopNavCollapsed ? 'Expand navigation panel' : 'Collapse navigation panel'}
              onClick={() => setIsDesktopNavCollapsed((prev) => {
                const next = !prev
                localStorage.setItem('host-nav-collapsed', String(next))
                return next
              })}
            >
              {isDesktopNavCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          </div>

          <nav className="flex-1 space-y-1 p-3">
            <TooltipProvider delayDuration={400}>
              {globalNavItems.map((item) => {
                const isActive = isActivePath(pathname, item.href)
                const Icon = item.icon
                const link = (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive ? 'bg-eco-green text-white' : 'text-gray-700 hover:bg-eco-green-light',
                      isDesktopNavCollapsed && 'md:justify-center md:px-0'
                    )}
                    onClick={() => setIsMobileDrawerOpen(false)}
                  >
                    <Icon size={18} />
                    <span className={cn(isDesktopNavCollapsed && 'md:hidden')}>{item.label}</span>
                  </Link>
                )
                return isDesktopNavCollapsed ? (
                  <div key={item.href} className="group relative">
                    {link}
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </div>
                ) : link
              })}

              {isStaff && (() => {
                const active = isActivePath(pathname, '/host/page-layouts') && !pathname.startsWith('/host/templates/designs')
                const link = (
                  <Link
                    href="/host/page-layouts"
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      active ? 'bg-eco-green text-white' : 'text-gray-700 hover:bg-eco-green-light',
                      isDesktopNavCollapsed && 'md:justify-center md:px-0'
                    )}
                    onClick={() => setIsMobileDrawerOpen(false)}
                  >
                    <Palette size={18} />
                    <span className={cn(isDesktopNavCollapsed && 'md:hidden')}>Page Layout Studio</span>
                  </Link>
                )
                return isDesktopNavCollapsed ? (
                  <div className="group relative">{link}<TooltipContent side="right">Page Layout Studio</TooltipContent></div>
                ) : link
              })()}

              {isStaff && (() => {
                const active = pathname.startsWith('/host/templates/designs')
                const link = (
                  <Link
                    href="/host/templates/designs"
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      active ? 'bg-eco-green text-white' : 'text-gray-700 hover:bg-eco-green-light',
                      isDesktopNavCollapsed && 'md:justify-center md:px-0'
                    )}
                    onClick={() => setIsMobileDrawerOpen(false)}
                  >
                    <GalleryHorizontal size={18} />
                    <span className={cn(isDesktopNavCollapsed && 'md:hidden')}>Design Studio</span>
                  </Link>
                )
                return isDesktopNavCollapsed ? (
                  <div className="group relative">{link}<TooltipContent side="right">Design Studio</TooltipContent></div>
                ) : link
              })()}
            </TooltipProvider>
          </nav>

          <div className="border-t border-eco-green-light p-3">
            <TooltipProvider delayDuration={400}>
              {isDesktopNavCollapsed ? (
                <div className="group relative">
                  <Link
                    href="/contact"
                    className="flex items-center justify-center rounded-md px-0 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-eco-green-light hover:text-eco-green"
                    onClick={() => setIsMobileDrawerOpen(false)}
                  >
                    <HelpCircle size={18} />
                  </Link>
                  <TooltipContent side="right">Help &amp; Support</TooltipContent>
                </div>
              ) : (
                <Link
                  href="/contact"
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-eco-green-light hover:text-eco-green"
                  onClick={() => setIsMobileDrawerOpen(false)}
                >
                  <HelpCircle size={18} />
                  <span>Help &amp; Support</span>
                </Link>
              )}
            </TooltipProvider>
          </div>
        </div>
      </aside>

      {/* ── Main column ───────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">

        {/* Primary header */}
        <header className="sticky top-0 z-20 border-b border-eco-green-light bg-white/95 backdrop-blur-sm">
          <div className="flex items-center justify-between px-4 py-3 md:px-6">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                className="rounded-md p-2 text-eco-green hover:bg-eco-green-light md:hidden"
                aria-label="Open navigation menu"
                onClick={() => setIsMobileDrawerOpen(true)}
              >
                <Menu size={20} />
              </button>

              {/* Breadcrumb */}
              <div className="flex items-center gap-1.5 min-w-0 text-sm">
                <Link
                  href="/host/dashboard"
                  className="font-semibold text-eco-green hover:text-eco-green/80 transition-colors whitespace-nowrap"
                >
                  Host Workspace
                </Link>

                {mounted && eventId && (
                  <>
                    <span className="text-eco-green-light select-none">/</span>

                    {/* Event switcher */}
                    <div ref={switcherRef} className="relative min-w-0">
                      <button
                        type="button"
                        onClick={() => setSwitcherOpen((o) => !o)}
                        className={cn(
                          'flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium transition-colors max-w-[180px] md:max-w-[260px]',
                          switcherOpen
                            ? 'bg-eco-green text-white'
                            : 'text-gray-800 hover:bg-eco-green-light'
                        )}
                      >
                        <span className="truncate">
                          {eventSettings?.title ?? '…'}
                        </span>
                        <ChevronDown
                          size={14}
                          className={cn('shrink-0 transition-transform duration-150', switcherOpen && 'rotate-180')}
                        />
                      </button>

                      <AnimatePresence>
                        {switcherOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.12 }}
                            className="absolute left-0 top-full mt-1.5 z-50 w-64 rounded-xl border border-eco-green-light bg-white shadow-lg overflow-hidden"
                          >
                            <div className="px-3 py-2 border-b border-eco-green-light">
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                                Switch Event
                              </p>
                            </div>
                            <ul className="max-h-64 overflow-y-auto py-1">
                              {allEvents.map((ev) => (
                                <li key={ev.id}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSwitcherOpen(false)
                                      router.push(`/host/events/${ev.id}`)
                                    }}
                                    className={cn(
                                      'w-full text-left px-4 py-2.5 text-sm transition-colors',
                                      String(ev.id) === eventId
                                        ? 'bg-eco-green/10 text-eco-green font-medium'
                                        : 'text-gray-700 hover:bg-eco-green-light/60'
                                    )}
                                  >
                                    {ev.title}
                                  </button>
                                </li>
                              ))}
                              {allEvents.length === 0 && (
                                <li className="px-4 py-3 text-sm text-gray-400">No events found</li>
                              )}
                            </ul>
                            <div className="border-t border-eco-green-light px-3 py-2">
                              <Link
                                href="/host/events/new"
                                onClick={() => setSwitcherOpen(false)}
                                className="flex items-center gap-2 text-sm font-medium text-eco-green hover:underline"
                              >
                                <PlusCircle size={14} />
                                Create new event
                              </Link>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </>
                )}
              </div>
            </div>

            <button
              type="button"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-eco-green-light hover:text-eco-green shrink-0"
              onClick={handleLogout}
            >
              <LogOut size={18} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>

          {/* Event pill tab bar — only shown when inside an event */}
          {mounted && eventId && eventTabItems.length > 0 && (
            <div className="border-t border-eco-green-light/60 bg-white/95 px-4 md:px-6">
              <div className="flex items-center gap-1.5 overflow-x-auto py-2 scrollbar-none">
                {eventTabItems.map((item) => {
                  const isRoot = item.href === `/host/events/${eventId}`
                  const isActive = isActivePath(pathname, item.href, isRoot)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors shrink-0',
                        isActive
                          ? 'bg-eco-green text-white shadow-sm'
                          : 'border border-eco-green-light text-gray-600 hover:border-eco-green hover:text-eco-green hover:bg-eco-green-light/30'
                      )}
                    >
                      <item.icon size={13} />
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </header>

        <main className="min-w-0 flex-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
