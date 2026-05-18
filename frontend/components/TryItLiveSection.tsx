'use client'

import { useState, useCallback, useRef, KeyboardEvent } from 'react'
import { Users, Bell, RefreshCw, UserPlus } from 'lucide-react'
import { BRAND_NAME } from '@/lib/brand_utility'

// ── Brand palette ──────────────────────────────────────────────────────────────
const C = {
  dark:  '#0B3D2E',
  parch: '#E8D8C3',
  gold:  '#D4A017',
  earth: '#8B5E3C',
  teal:  '#218085',
} as const

const SERIF = "'Cormorant Garamond', Georgia, serif"

// ── Types ──────────────────────────────────────────────────────────────────────
type GuestStatus = 'going' | 'pending' | 'declined'

// How the right-panel guest rows behave per event type
type GuestRowMode =
  | 'rsvp'          // Private Party — show Going/Pending/Declined badge
  | 'registration'  // NGO — everyone who appears is confirmed; show "✓ Registered"
  | 'slot'          // Workshop — show which slot/batch they booked
  | 'sessions'      // Conference — show which session they confirmed

type SimulateMode =
  | 'convert'       // flip a pending guest → going
  | 'add'           // add a brand-new registrant (NGO open-registration)

interface Guest {
  initials: string
  name: string
  time: string     // slot/session label; empty = no slot (Private Party)
  status: GuestStatus
}

interface Slot {
  time: string
  capacity: number
  going: number
}

interface DemoEvent {
  icon: string
  label: string
  title: string
  subtitle: string
  date: string
  venue: string
  // Left panel
  slots: Slot[]
  showSlots: boolean
  featureTag: string
  statLabels: { going: string; pending: string; response: string }
  // When set, these fixed values override the guest-derived counts in the stat row.
  // Needed for Workshop/Conference where the guest sample ≠ the real numbers.
  statOverrides?: { going: string; pending: string; response: string }
  // When set, renders a single prominent stat instead of the 3-column grid (e.g. NGO).
  singleStat?: { value: string; label: string }
  // When true, renders a guest-list-derived capacity bar (Private Party).
  // Uses live goingCount / guests.length — no separate slot data needed.
  showGuestCapacityBar?: boolean
  initialActivity: string[]
  // Right panel
  initialGuests: Guest[]
  guestRowMode: GuestRowMode
  guestListLabel: string
  inviteActionLabel: string
  invitePlaceholder: string
  showRemind: boolean
  simulateMode: SimulateMode
  simulateButtonLabel: string
  simulateVerb: string
  // How many pending guests to convert per simulate click (default 1)
  simulateBatchSize?: number
  // Pre-generated names cycled when simulateMode === 'add'
  simulateNames?: { initials: string; name: string }[]
}

// ── Demo data ──────────────────────────────────────────────────────────────────
const DEMO_EVENTS: DemoEvent[] = [
  // ── 1. Private Party ────────────────────────────────────────────────────────
  {
    icon: '🥂',
    label: 'Private Party',
    title: 'Jeff & Jasmin',
    subtitle: 'Pre-Wedding Terrace Dinner',
    date: 'Fri, 6 Jun · 7:30 PM',
    venue: 'The Terrace, Colaba, Mumbai',
    featureTag: 'Private Event · Gift Registry',
    statLabels: { going: 'Attending', pending: 'Pending', response: 'Declined' },
    initialActivity: ['Gift registry activated 🎁', 'Invite created ✨'],
    showSlots: false,
    showGuestCapacityBar: true,
    slots: [],
    guestRowMode: 'rsvp',
    guestListLabel: 'Guest List',
    inviteActionLabel: 'Invite',
    invitePlaceholder: 'Guest name…',
    showRemind: true,
    simulateMode: 'convert',
    simulateButtonLabel: 'Simulate RSVP',
    simulateVerb: 'confirmed attendance',
    simulateBatchSize: 2,
    initialGuests: [
      { initials: 'LC', name: 'Laura Chen',    time: '', status: 'going' },
      { initials: 'MT', name: 'Marcus Torres', time: '', status: 'going' },
      { initials: 'SB', name: 'Sophie Blanc',  time: '', status: 'pending' },
      { initials: 'AK', name: 'Amara Khan',    time: '', status: 'pending' },
      { initials: 'OB', name: 'Oliver Burke',  time: '', status: 'pending' },
      { initials: 'NR', name: 'Nina Rossi',    time: '', status: 'pending' },
      { initials: 'RJ', name: 'Raj Johal',     time: '', status: 'declined' },
    ],
  },

  // ── 2. NGO / Open Registration ──────────────────────────────────────────────
  {
    icon: '🌿',
    label: 'NGO Event',
    title: 'Hope Foundation',
    subtitle: 'Annual Fundraising Walk',
    date: 'Sun, 22 Jun · 7:00 AM',
    venue: 'Cubbon Park, Bengaluru',
    featureTag: 'Public Event · Donation Drive',
    statLabels: { going: 'Registered', pending: '', response: '' },
    singleStat: { value: '195', label: 'Registered' },
    initialActivity: ['Donation tier claimed 💚', 'Open registration live 🌿'],
    showSlots: false,
    slots: [],
    guestRowMode: 'registration',
    guestListLabel: 'Registrants',
    inviteActionLabel: 'Register',
    invitePlaceholder: 'Your name…',
    showRemind: false,
    simulateMode: 'add',
    simulateButtonLabel: 'Simulate Registration',
    simulateVerb: 'registered',
    simulateNames: [
      { initials: 'MS', name: 'Maria Santos' },
      { initials: 'KW', name: 'Kai Williams' },
      { initials: 'FH', name: 'Fatima Hassan' },
      { initials: 'LD', name: 'Lucas Dupont' },
    ],
    // Everyone who appears in the list is confirmed — no pending/declined
    initialGuests: [
      { initials: 'EC', name: 'Emma Clarke',  time: '', status: 'going' },
      { initials: 'JO', name: 'James Obi',    time: '', status: 'going' },
      { initials: 'SC', name: 'Sara Cohen',   time: '', status: 'going' },
      { initials: 'TB', name: 'Tom Blake',    time: '', status: 'going' },
    ],
  },

  // ── 3. Pottery Workshop / Slot Booking ──────────────────────────────────────
  {
    icon: '🏺',
    label: 'Workshop',
    title: 'Pottery Workshop',
    subtitle: 'Batch Bookings · Studio Klay',
    date: 'Every Sat · 11:00 AM & 3:00 PM',
    venue: 'Studio Klay, Indiranagar, Bengaluru',
    featureTag: 'Slot Booking · Exit-Shop Registry',
    statLabels: { going: 'Booked', pending: 'Available', response: '% Full' },
    initialActivity: ['Nitya M. claimed Starter Kit 🛒', 'Booking slots opened 🏺'],
    showSlots: true,
    slots: [
      { time: '11:00 AM', capacity: 8, going: 6 },
      { time: '3:00 PM',  capacity: 8, going: 2 },
    ],
    guestRowMode: 'slot',
    guestListLabel: 'Bookings',
    inviteActionLabel: 'Book',
    invitePlaceholder: 'Your name…',
    showRemind: false,
    simulateMode: 'convert',
    simulateButtonLabel: 'Simulate Booking',
    simulateVerb: 'booked a spot',
    initialGuests: [
      { initials: 'NP', name: 'Nina Park',     time: '11:00 AM', status: 'going' },
      { initials: 'DW', name: 'David Wells',   time: '11:00 AM', status: 'going' },
      { initials: 'CM', name: 'Chloe Martin',  time: '3:00 PM',  status: 'pending' },
      { initials: 'BT', name: 'Ben Torres',    time: '11:00 AM', status: 'going' },
    ],
  },

  // ── 4. Conference / Multi-session ───────────────────────────────────────────
  {
    icon: '🎓',
    label: 'Conference',
    title: 'Founders Roundtable',
    subtitle: 'IIMA Startup Conclave 2025',
    date: 'Thu, 19 Jun · 9:00 AM',
    venue: 'IIMA Campus, Ahmedabad',
    featureTag: 'Multi-Session · Registry Disabled',
    statLabels: { going: 'Confirmed', pending: 'Pending', response: 'Response' },
    initialActivity: ['Session schedule published 📋', 'Invite created ✨'],
    showSlots: true,
    slots: [
      { time: 'Keynote · Hall A',  capacity: 150, going: 112 },
      { time: 'Workshop · Room 3', capacity: 50,  going: 34  },
    ],
    guestRowMode: 'sessions',
    guestListLabel: 'Delegates',
    inviteActionLabel: 'Add',
    invitePlaceholder: 'Delegate name…',
    showRemind: false,
    simulateMode: 'convert',
    simulateButtonLabel: 'Simulate Confirm',
    simulateVerb: 'confirmed their session',
    initialGuests: [
      { initials: 'AM', name: 'Alex Morgan',    time: 'Keynote · Hall A',  status: 'going' },
      { initials: 'SK', name: 'Sarah Kim',      time: 'Keynote · Hall A',  status: 'going' },
      { initials: 'RC', name: 'Robert Chen',    time: 'Workshop · Room 3', status: 'pending' },
      { initials: 'NA', name: 'Nicole Adeyemi', time: 'Keynote · Hall A',  status: 'going' },
      { initials: 'PL', name: 'Priya Lalwani',  time: 'Keynote · Hall A',  status: 'going' },
      { initials: 'JT', name: 'James Turner',   time: 'Workshop · Room 3', status: 'pending' },
      { initials: 'YS', name: 'Yuki Sato',      time: 'Keynote · Hall A',  status: 'pending' },
    ],
  },
]

// ── Helpers ────────────────────────────────────────────────────────────────────
function deepCloneGuests(guests: Guest[]): Guest[] {
  return guests.map(g => ({ ...g }))
}

function deepCloneSlots(slots: Slot[]): Slot[] {
  return slots.map(s => ({ ...s }))
}

function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0 || parts[0] === '') return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const STATUS_STYLES: Record<GuestStatus, { bg: string; color: string; label: string }> = {
  going:    { bg: 'rgba(11,61,46,0.1)',    color: '#0B3D2E', label: 'ATTENDING' },
  pending:  { bg: 'rgba(212,160,23,0.12)', color: '#8B5E3C', label: 'PENDING' },
  declined: { bg: 'rgba(200,50,50,0.1)',   color: '#b91c1c', label: 'DECLINED' },
}

const MAX_ACTIVITY = 6

// ── Guest row right-side element ───────────────────────────────────────────────
function GuestRowRight({ guest, mode }: { guest: Guest; mode: GuestRowMode }) {
  if (mode === 'rsvp') {
    const s = STATUS_STYLES[guest.status]
    return (
      <span
        className="text-[10px] font-semibold tracking-wider px-2 py-0.5 rounded-full flex-shrink-0"
        style={{ background: s.bg, color: s.color }}
      >
        {s.label}
      </span>
    )
  }
  if (mode === 'registration') {
    return (
      <span
        className="text-[10px] font-semibold tracking-wider px-2 py-0.5 rounded-full flex-shrink-0"
        style={{ background: 'rgba(33,128,133,0.1)', color: C.teal }}
      >
        REGISTERED
      </span>
    )
  }
  // slot / sessions — show the time/session label as a teal chip
  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 text-right"
      style={{ background: 'rgba(33,128,133,0.08)', color: C.teal, maxWidth: '120px' }}
    >
      {guest.time}
    </span>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function TryItLiveSection() {
  const [activeIdx, setActiveIdx] = useState(0)
  const [guests, setGuests]       = useState<Guest[]>(() => deepCloneGuests(DEMO_EVENTS[0].initialGuests))
  const [slots, setSlots]         = useState<Slot[]>(() => deepCloneSlots(DEMO_EVENTS[0].slots))
  const [activity, setActivity]   = useState<string[]>(DEMO_EVENTS[0].initialActivity)
  const [inviteName, setInviteName] = useState('')
  const [inviteTime, setInviteTime] = useState(DEMO_EVENTS[0].slots[0]?.time ?? '')
  const [registeredCount, setRegisteredCount] = useState<number | null>(
    () => DEMO_EVENTS[0].singleStat ? parseInt(DEMO_EVENTS[0].singleStat.value) : null
  )
  const simulateAddIdx = useRef(0)  // cycles through simulateNames for 'add' mode

  const activeEvent    = DEMO_EVENTS[activeIdx]
  const showTimeSelect = activeEvent.slots.length > 1

  const pushActivity = useCallback((msg: string) => {
    setActivity(prev => [msg, ...prev].slice(0, MAX_ACTIVITY))
  }, [])

  const resetToEvent = useCallback((ev: DemoEvent) => {
    setGuests(deepCloneGuests(ev.initialGuests))
    setSlots(deepCloneSlots(ev.slots))
    setActivity([...ev.initialActivity])
    setInviteName('')
    setInviteTime(ev.slots[0]?.time ?? '')
    setRegisteredCount(ev.singleStat ? parseInt(ev.singleStat.value) : null)
    simulateAddIdx.current = 0
  }, [])

  const handleSelectEvent = useCallback((idx: number) => {
    setActiveIdx(idx)
    resetToEvent(DEMO_EVENTS[idx])
  }, [resetToEvent])

  const handleReset = useCallback(() => {
    resetToEvent(DEMO_EVENTS[activeIdx])
  }, [activeIdx, resetToEvent])

  // ── Simulate action ───────────────────────────────────────────────────────
  const handleSimulate = useCallback(() => {
    if (activeEvent.simulateMode === 'add') {
      // Open registration: add a brand-new confirmed registrant
      const names = activeEvent.simulateNames ?? []
      if (names.length === 0) return
      const pick = names[simulateAddIdx.current % names.length]
      simulateAddIdx.current += 1
      const newGuest: Guest = { ...pick, time: '', status: 'going' }
      setGuests(prev => [...prev, newGuest])
      setSlots(prev => prev.map(s => ({ ...s, going: Math.min(s.going + 1, s.capacity) })))
      setRegisteredCount(prev => prev !== null ? prev + 1 : null)
      pushActivity(`${pick.name} ${activeEvent.simulateVerb} ✓`)
    } else {
      // Convert: flip up to simulateBatchSize pending guests → going
      const batch = activeEvent.simulateBatchSize ?? 1
      const pendingOnes = guests.filter(g => g.status === 'pending').slice(0, batch)
      if (pendingOnes.length === 0) {
        pushActivity('All guests have responded 🎉')
        return
      }
      const updated = deepCloneGuests(guests)
      pendingOnes.forEach(guest => {
        const idx = updated.findIndex(g => g.name === guest.name)
        if (idx !== -1) updated[idx] = { ...updated[idx], status: 'going' }
      })
      setGuests(updated)
      setSlots(prev => prev.map(s => {
        const extra = pendingOnes.filter(g => g.time === s.time).length
        return extra > 0 ? { ...s, going: Math.min(s.going + extra, s.capacity) } : s
      }))
      pendingOnes.forEach(g => {
        const slotSuffix = g.time ? ` · ${g.time}` : ''
        pushActivity(`${g.name} ${activeEvent.simulateVerb}${slotSuffix} ✓`)
      })
    }
  }, [activeEvent, guests, pushActivity])

  // ── Remind pending ────────────────────────────────────────────────────────
  const handleRemind = useCallback(() => {
    const count = guests.filter(g => g.status === 'pending').length
    pushActivity(
      count === 0
        ? 'No pending guests to remind'
        : `Reminder sent to ${count} pending guest(s) 📩`
    )
  }, [guests, pushActivity])

  // ── Add / Register / Book ─────────────────────────────────────────────────
  const handleInvite = useCallback(() => {
    const trimmed = inviteName.trim()
    if (!trimmed) return
    const time = showTimeSelect ? inviteTime : (activeEvent.slots[0]?.time ?? '')
    const isSlotBased = activeEvent.guestRowMode === 'slot' || activeEvent.guestRowMode === 'sessions'
    const newGuest: Guest = {
      initials: deriveInitials(trimmed),
      name:     trimmed,
      time,
      // NGO (add mode) and slot-based bookings are immediately confirmed
      status: (activeEvent.simulateMode === 'add' || isSlotBased) ? 'going' : 'pending',
    }
    setGuests(prev => [...prev, newGuest])
    if (activeEvent.simulateMode === 'add') {
      setRegisteredCount(prev => prev !== null ? prev + 1 : null)
    }
    if (isSlotBased && time) {
      setSlots(prev => prev.map(s =>
        s.time === time ? { ...s, going: Math.min(s.going + 1, s.capacity) } : s
      ))
    }
    const slotSuffix = isSlotBased && time ? ` · ${time}` : ''
    pushActivity(`${trimmed} ${activeEvent.inviteActionLabel.toLowerCase()}d${slotSuffix} ✨`)
    setInviteName('')
  }, [inviteName, inviteTime, showTimeSelect, activeEvent, pushActivity])

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleInvite()
  }, [handleInvite])

  // ── Stats ─────────────────────────────────────────────────────────────────
  const goingCount      = guests.filter(g => g.status === 'going').length
  const pendingCount    = guests.filter(g => g.status === 'pending').length
  const declinedCount   = guests.filter(g => g.status === 'declined').length
  const respondedCount  = guests.filter(g => g.status !== 'pending').length
  const responsePercent = guests.length > 0 ? Math.round((respondedCount / guests.length) * 100) : 0

  // For Workshop (slot booking), derive Booked/Available/%Full live from slots state
  const slotStats = (() => {
    if (activeEvent.guestRowMode !== 'slot' || activeEvent.statOverrides) return null
    const totalGoing = slots.reduce((sum, s) => sum + s.going, 0)
    const totalCap   = slots.reduce((sum, s) => sum + s.capacity, 0)
    const totalAvail = totalCap - totalGoing
    const pct = totalCap > 0 ? Math.round((totalGoing / totalCap) * 100) : 0
    return { going: String(totalGoing), pending: String(totalAvail), response: `${pct}%` }
  })()

  const stats = activeEvent.statOverrides ?? slotStats ?? {
    going:    String(goingCount),
    pending:  String(pendingCount),
    response: `${responsePercent}%`,
  }

  return (
    <section className="py-20 px-6" style={{ background: C.dark }}>
      <div className="max-w-6xl mx-auto">

        {/* ── Section header ──────────────────────────────────────────────── */}
        <div className="text-center mb-10">
          <p className="text-xs uppercase tracking-[0.25em] font-medium mb-4" style={{ color: C.gold, opacity: 0.85 }}>
            Try it live
          </p>
          <h2
            className="text-4xl md:text-5xl font-light leading-[1.1] mb-4"
            style={{ fontFamily: SERIF, color: C.parch }}
          >
            See how {BRAND_NAME} feels — <em style={{ color: C.gold }}>in 30 seconds</em>
          </h2>
          <p className="text-sm" style={{ color: '#a8c4b0' }}>
            Pick an event, invite guests, and watch your dashboard come alive.
          </p>
        </div>

        {/* ── Two-column grid ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── LEFT: Live Invite panel ───────────────────────────────────── */}
          <div className="rounded-3xl overflow-hidden border" style={{ background: 'white', borderColor: 'rgba(255,255,255,0.1)' }}>
            {/* Panel header */}
            <div className="flex items-center justify-between px-5 py-3 border-b" style={{ background: C.parch, borderColor: 'rgba(139,94,60,0.15)' }}>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#ef4444' }} />
                <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: C.dark }}>Live Invite</span>
              </div>
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1 rounded-full transition-all hover:opacity-80"
                style={{ color: C.earth, background: 'rgba(139,94,60,0.08)' }}
              >
                <RefreshCw size={11} /> Reset
              </button>
            </div>

            <div className="p-5">
              {/* Event tabs */}
              <div className="flex gap-2 mb-5 flex-wrap">
                {DEMO_EVENTS.map((ev, i) => (
                  <button
                    key={ev.label}
                    onClick={() => handleSelectEvent(i)}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all duration-200"
                    style={activeIdx === i
                      ? { background: C.teal, color: 'white' }
                      : { background: 'rgba(33,128,133,0.08)', color: C.earth }}
                  >
                    <span>{ev.icon}</span>{ev.label}
                  </button>
                ))}
              </div>

              {/* Event details */}
              <div className="mb-5">
                <h3 className="text-2xl font-light mb-1" style={{ fontFamily: SERIF, color: C.dark }}>
                  {activeEvent.title}
                </h3>
                <p className="text-xs italic mb-3" style={{ color: C.earth }}>{activeEvent.subtitle}</p>
                <div className="space-y-1 mb-3">
                  <p className="text-xs flex items-center gap-1.5" style={{ color: C.earth }}>
                    <span>📅</span> {activeEvent.date}
                  </p>
                  <p className="text-xs flex items-center gap-1.5" style={{ color: C.earth }}>
                    <span>📍</span> {activeEvent.venue}
                  </p>
                </div>
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(33,128,133,0.1)', color: C.teal }}
                >
                  ✦ {activeEvent.featureTag}
                </span>
              </div>

              {/* Stats */}
              {activeEvent.singleStat ? (
                <div className="rounded-xl p-4 text-center mb-5" style={{ background: C.parch, border: '1px solid rgba(139,94,60,0.1)' }}>
                  <div className="text-3xl font-semibold mb-1" style={{ color: C.teal, fontFamily: SERIF }}>
                    {registeredCount !== null ? registeredCount : activeEvent.singleStat.value}
                  </div>
                  <div className="text-[9px] font-semibold tracking-widest uppercase" style={{ color: C.earth }}>
                    {activeEvent.singleStat.label}
                  </div>
                </div>
              ) : activeEvent.guestRowMode === 'rsvp' ? (
                // Private Party: 2×2 grid — Attending, Pending, Declined, RSVP'd%
                <div className="grid grid-cols-2 gap-2 mb-5">
                  <div className="rounded-xl p-3 text-center" style={{ background: C.parch, border: '1px solid rgba(139,94,60,0.1)' }}>
                    <div className="text-lg font-semibold" style={{ color: C.teal, fontFamily: SERIF }}>{goingCount}</div>
                    <div className="text-[9px] font-semibold tracking-widest uppercase mt-0.5" style={{ color: C.earth }}>Attending</div>
                  </div>
                  <div className="rounded-xl p-3 text-center" style={{ background: C.parch, border: '1px solid rgba(139,94,60,0.1)' }}>
                    <div className="text-lg font-semibold" style={{ color: C.gold, fontFamily: SERIF }}>{pendingCount}</div>
                    <div className="text-[9px] font-semibold tracking-widest uppercase mt-0.5" style={{ color: C.earth }}>Pending</div>
                  </div>
                  <div className="rounded-xl p-3 text-center" style={{ background: C.parch, border: '1px solid rgba(139,94,60,0.1)' }}>
                    <div className="text-lg font-semibold" style={{ color: '#b91c1c', fontFamily: SERIF }}>{declinedCount}</div>
                    <div className="text-[9px] font-semibold tracking-widest uppercase mt-0.5" style={{ color: C.earth }}>Declined</div>
                  </div>
                  <div className="rounded-xl p-3 text-center" style={{ background: C.parch, border: '1px solid rgba(139,94,60,0.1)' }}>
                    <div className="text-lg font-semibold" style={{ color: C.teal, fontFamily: SERIF }}>{responsePercent}%</div>
                    <div className="text-[9px] font-semibold tracking-widest uppercase mt-0.5" style={{ color: C.earth }}>RSVP&apos;d</div>
                  </div>
                </div>
              ) : (
                // Workshop / Conference: 3-column grid
                <div className="grid grid-cols-3 gap-2 mb-5">
                  {([
                    { value: stats.going,    label: activeEvent.statLabels.going,    color: C.teal },
                    { value: stats.pending,  label: activeEvent.statLabels.pending,  color: C.gold },
                    { value: stats.response, label: activeEvent.statLabels.response, color: '#b91c1c' },
                  ] as const).map(({ value, label, color }) => (
                    <div key={label} className="rounded-xl p-3 text-center" style={{ background: C.parch, border: '1px solid rgba(139,94,60,0.1)' }}>
                      <div className="text-lg font-semibold" style={{ color, fontFamily: SERIF }}>{value}</div>
                      <div className="text-[9px] font-semibold tracking-widest uppercase mt-0.5" style={{ color: C.earth }}>{label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Guest capacity bar — Private Party: derived live from guest state */}
              {activeEvent.showGuestCapacityBar && (
                <div>
                  <p className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: C.earth, opacity: 0.6 }}>
                    Guest Capacity
                  </p>
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs flex items-center gap-1.5" style={{ color: C.earth }}>
                        <span>👥</span> Confirmed guests
                      </span>
                      <span className="text-xs font-medium" style={{ color: C.earth }}>
                        {goingCount}/{guests.length}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(33,128,133,0.12)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.round((goingCount / Math.max(guests.length, 1)) * 100)}%`,
                          background: C.teal,
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Slot / session bars — Workshop & Conference */}
              {activeEvent.showSlots && (
                <div>
                  <p className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color: C.earth, opacity: 0.6 }}>
                    {activeEvent.slots.length === 1 ? 'Registration' : 'Slots & Capacity'}
                  </p>
                  <div className="space-y-3">
                    {slots.map(slot => {
                      const pct = slot.capacity > 0 ? Math.round((slot.going / slot.capacity) * 100) : 0
                      return (
                        <div key={slot.time}>
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-xs flex items-center gap-1.5" style={{ color: C.earth }}>
                              <span>⏰</span> {slot.time}
                            </span>
                            <span className="text-xs font-medium" style={{ color: C.earth }}>
                              {slot.going}/{slot.capacity}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(33,128,133,0.12)' }}>
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, background: C.teal }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT: Guest / Registrant / Delegate list + Activity ──────── */}
          <div className="flex flex-col gap-6">

            <div className="rounded-3xl overflow-hidden border flex-1" style={{ background: 'white', borderColor: 'rgba(255,255,255,0.1)' }}>
              {/* Panel header */}
              <div className="flex items-center justify-between px-5 py-3 border-b" style={{ background: C.parch, borderColor: 'rgba(139,94,60,0.15)' }}>
                <div className="flex items-center gap-2">
                  <Users size={13} style={{ color: C.earth }} />
                  <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: C.dark }}>
                    {activeEvent.guestListLabel}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSimulate}
                    className="text-[10px] font-semibold px-2.5 py-1 rounded-full transition-all hover:opacity-80"
                    style={{ background: 'rgba(33,128,133,0.1)', color: C.teal }}
                  >
                    {activeEvent.simulateButtonLabel}
                  </button>
                  {activeEvent.showRemind && (
                    <button
                      onClick={handleRemind}
                      className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full transition-all hover:opacity-80"
                      style={{ background: 'rgba(212,160,23,0.1)', color: C.earth }}
                    >
                      <Bell size={10} /> Remind
                    </button>
                  )}
                </div>
              </div>

              {/* Add row */}
              <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'rgba(139,94,60,0.08)' }}>
                <UserPlus size={13} style={{ color: C.earth, flexShrink: 0 }} />
                <input
                  type="text"
                  value={inviteName}
                  onChange={e => setInviteName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={activeEvent.invitePlaceholder}
                  className="flex-1 min-w-0 text-xs outline-none bg-transparent placeholder:text-gray-300"
                  style={{ color: C.dark }}
                />
                {showTimeSelect && (
                  <select
                    value={inviteTime}
                    onChange={e => setInviteTime(e.target.value)}
                    className="text-xs outline-none bg-transparent border rounded-lg px-2 py-1 cursor-pointer"
                    style={{ borderColor: 'rgba(139,94,60,0.2)', color: C.earth }}
                  >
                    {activeEvent.slots.map(s => (
                      <option key={s.time} value={s.time}>{s.time}</option>
                    ))}
                  </select>
                )}
                <button
                  onClick={handleInvite}
                  className="text-[10px] font-semibold px-3 py-1.5 rounded-full text-white transition-all hover:opacity-80 flex-shrink-0"
                  style={{ background: C.teal }}
                >
                  {activeEvent.inviteActionLabel}
                </button>
              </div>

              {/* Guest rows */}
              <div className="overflow-y-auto divide-y divide-[rgba(139,94,60,0.06)]" style={{ maxHeight: '220px' }}>
                {guests.map((guest, i) => (
                  <div key={`${guest.name}-${i}`} className="flex items-center gap-3 px-4 py-2.5">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0"
                      style={{ background: 'rgba(33,128,133,0.1)', color: C.teal }}
                    >
                      {guest.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: C.dark }}>
                        {guest.name}
                      </p>
                      {/* Sub-text: only for 'rsvp' mode when a time/slot is assigned */}
                      {activeEvent.guestRowMode === 'rsvp' && guest.time && (
                        <p className="text-[10px]" style={{ color: C.earth, opacity: 0.6 }}>{guest.time}</p>
                      )}
                    </div>
                    <GuestRowRight guest={guest} mode={activeEvent.guestRowMode} />
                  </div>
                ))}
              </div>
            </div>

            {/* Activity panel */}
            <div className="rounded-3xl overflow-hidden border" style={{ background: '#1a1a1a', borderColor: 'rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2 px-5 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                <span className="text-[10px]" style={{ color: C.gold }}>✦</span>
                <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Activity
                </span>
              </div>
              <div className="overflow-y-auto px-5 py-3 space-y-2" style={{ maxHeight: '130px' }}>
                {activity.map((item, i) => (
                  <div key={`${item}-${i}`} className="flex items-start gap-2">
                    <span className="text-[10px] mt-0.5 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }}>○</span>
                    <p
                      className="text-[11px] leading-relaxed"
                      style={{ color: i === 0 ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.4)' }}
                    >
                      {item}
                    </p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  )
}
