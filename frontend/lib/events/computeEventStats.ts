export type RsvpExperienceMode = 'standard' | 'sub_event' | 'slot_based' | 'auto_confirm'

export interface BookingSlotLike {
  id: number
  label?: string
  slot_date?: string
  start_at?: string
  capacity_total: number
  remaining_seats: number
}

export interface SubEventLike {
  id: number
  title: string
}

export interface EventStatsInput {
  eventId: string
  rsvpExperienceMode?: RsvpExperienceMode
  rsvpMode?: 'PER_SUBEVENT' | 'ONE_TAP_ALL'
  rsvpTotalCapacity?: number | null
  guests: any[]
  rsvps: any[]
  bookingSlots: BookingSlotLike[]
  subEvents?: SubEventLike[]
}

export interface StatTile {
  value: number | string
  label: string
  colorClass?: string
}

export interface SubEventRowStats {
  title: string
  attending: number
  declined: number
  pending: number
}

export interface PopulationStats {
  attending: number
  maybe: number
  declined: number
  pending: number
  rsvpPercent: number
  totalBooked: number
  available: number
  totalResponse: number
  tiles: StatTile[]
  subEventRows: SubEventRowStats[]
}

export interface CapacityStats {
  booked: number
  available: number
  percentFull: number
  maxCapacity: number
  slotRows: Array<{ label: string; booked: number; capacity: number; percent: number }>
}

export interface EventStatsResult {
  showInvitedBlock: boolean
  showOpenBlock: boolean
  showCapacityStrip: boolean
  capacity: CapacityStats | null
  invited: PopulationStats
  open: PopulationStats
  isSlotMode: boolean
  isSubEventMode: boolean
  isAutoConfirmMode: boolean
  isPerSubeventRsvp: boolean
  hasSubEvents: boolean
}

function normalizePhoneKey(record: {
  phone?: string | null
  country_code?: string | null
  local_number?: string | null
}): string {
  const ccDigits = String(record?.country_code || '').replace(/\D/g, '')
  const localDigits = String(record?.local_number || '').replace(/\D/g, '')
  if (localDigits.length >= 10) {
    return `phone:${ccDigits}:${localDigits.slice(-10)}`
  }
  const phoneDigits = String(record?.phone || '').replace(/\D/g, '')
  if (phoneDigits.length >= 10) {
    return `phone:${ccDigits}:${phoneDigits.slice(-10)}`
  }
  if (phoneDigits) return `phone_raw:${ccDigits}:${phoneDigits}`
  return ''
}

function buildInvitedPhoneKeys(guests: any[]): Set<string> {
  const keys = new Set<string>()
  guests.forEach((g) => {
    const key = normalizePhoneKey(g)
    if (key) keys.add(key)
  })
  return keys
}

function isInvitedRsvp(rsvp: any, invitedPhoneKeys: Set<string>): boolean {
  if (rsvp?.guest_id) return true
  if (rsvp?.is_core_guest) return true
  const key = normalizePhoneKey(rsvp)
  return key !== '' && invitedPhoneKeys.has(key)
}

function getAttendeeKey(eventId: string, rsvp: any): string {
  if (rsvp?.guest_id) return `event:${eventId}:guest:${String(rsvp.guest_id)}`
  const phoneKey = normalizePhoneKey(rsvp)
  if (phoneKey) return `event:${eventId}:${phoneKey}`
  return `event:${eventId}:rsvp:${String(rsvp?.id ?? '')}`
}

type GuestAgg = {
  hasYes: boolean
  hasMaybe: boolean
  hasNo: boolean
}

function aggregateRsvpsByAttendee(rsvps: any[], eventId: string): Map<string, GuestAgg> {
  const map = new Map<string, GuestAgg>()
  rsvps.forEach((r) => {
    const key = getAttendeeKey(eventId, r)
    const entry = map.get(key) || { hasYes: false, hasMaybe: false, hasNo: false }
    if (r.will_attend === 'yes') entry.hasYes = true
    else if (r.will_attend === 'maybe') entry.hasMaybe = true
    else if (r.will_attend === 'no') entry.hasNo = true
    map.set(key, entry)
  })
  return map
}

function countFromAgg(map: Map<string, GuestAgg>) {
  const values = Array.from(map.values())
  return {
    attending: values.filter((v) => v.hasYes).length,
    maybe: values.filter((v) => !v.hasYes && v.hasMaybe).length,
    declined: values.filter((v) => !v.hasYes && !v.hasMaybe && v.hasNo).length,
    totalResponse: map.size,
  }
}

function guestListStatus(g: any): 'yes' | 'no' | 'maybe' | null {
  const raw = String(g?.rsvp_status || g?.rsvp_will_attend || '').toLowerCase()
  if (raw === 'yes' || raw === 'no' || raw === 'maybe') return raw
  if (g?.slot_booking_status === 'confirmed') return 'yes'
  return null
}

function invitedGuestCounts(guests: any[]) {
  let attending = 0
  let maybe = 0
  let declined = 0
  let pending = 0
  guests.forEach((g) => {
    const status = guestListStatus(g)
    if (status === 'yes') attending++
    else if (status === 'maybe') maybe++
    else if (status === 'no') declined++
    else pending++
  })
  const responded = attending + maybe + declined
  const rsvpPercent = guests.length > 0 ? Math.round((responded / guests.length) * 100) : 0
  return { attending, maybe, declined, pending, responded, rsvpPercent }
}

function buildSubEventRows(
  rsvps: any[],
  guests: any[],
  subEvents: SubEventLike[],
  invitedOnly: boolean,
  invitedPhoneKeys: Set<string>,
): SubEventRowStats[] {
  const titles =
    subEvents.length > 0
      ? subEvents.map((s) => ({ id: s.id, title: s.title }))
      : Array.from(
          new Set(
            rsvps
              .map((r) => ({
                id: r.sub_event_id as number | undefined,
                title: (r.sub_event_title as string | undefined) || 'Main Event',
              }))
              .map((x) => JSON.stringify(x)),
          ),
        ).map((s) => JSON.parse(s) as { id?: number; title: string })

  const filtered = rsvps.filter((r) => {
    const invited = isInvitedRsvp(r, invitedPhoneKeys)
    return invitedOnly ? invited : !invited
  })

  return titles.map(({ id, title }) => {
    const rows = filtered.filter(
      (r) =>
        (id != null && r.sub_event_id === id) ||
        (r.sub_event_title || 'Main Event') === title,
    )
    const attending = rows.filter((r) => r.will_attend === 'yes').length
    const declined = rows.filter((r) => r.will_attend === 'no').length

    let pending = 0
    if (invitedOnly && id != null) {
      pending = guests.filter((g) => {
        const invites: number[] = g.sub_event_invites || []
        if (!invites.includes(id)) return false
        return guestListStatus(g) == null
      }).length
    }

    return { title, attending, declined, pending }
  })
}

function buildTiles(
  mode: RsvpExperienceMode,
  block: 'invited' | 'open',
  counts: {
    attending: number
    maybe: number
    declined: number
    pending: number
    rsvpPercent: number
    totalBooked: number
    available: number
    totalResponse: number
  },
): StatTile[] {
  if (mode === 'slot_based' && block === 'invited') {
    return [
      { value: counts.attending, label: 'Slot booked', colorClass: 'text-eco-green' },
      { value: counts.declined, label: 'Declined', colorClass: 'text-red-500' },
      { value: counts.pending, label: 'No response', colorClass: 'text-amber-600' },
    ]
  }

  if (mode === 'slot_based' && block === 'open') {
    return [{ value: counts.totalBooked, label: 'Total booked', colorClass: 'text-eco-green' }]
  }

  if (mode === 'slot_based') {
    return []
  }

  if (mode === 'auto_confirm' && block === 'invited') {
    return [
      { value: counts.totalBooked, label: 'Total booked', colorClass: 'text-eco-green' },
      { value: counts.available, label: 'Available', colorClass: 'text-gray-700' },
      { value: `${counts.rsvpPercent}%`, label: "RSVP'd", colorClass: 'text-eco-green' },
    ]
  }

  if (mode === 'auto_confirm' && block === 'open') {
    return [{ value: counts.totalBooked, label: 'Total booked', colorClass: 'text-eco-green' }]
  }

  if (block === 'open') {
    return [
      { value: counts.attending, label: 'Attending', colorClass: 'text-eco-green' },
      { value: counts.maybe, label: 'Maybe', colorClass: 'text-amber-500' },
      { value: counts.declined, label: 'Declined', colorClass: 'text-red-500' },
      { value: counts.totalResponse, label: 'Total response', colorClass: 'text-eco-green' },
    ]
  }

  return [
    { value: counts.attending, label: 'Attending', colorClass: 'text-eco-green' },
    { value: counts.pending, label: 'Pending', colorClass: 'text-amber-600' },
    { value: counts.declined, label: 'Declined', colorClass: 'text-red-500' },
    { value: `${counts.rsvpPercent}%`, label: "RSVP'd", colorClass: 'text-eco-green' },
  ]
}

export function computeEventStats(input: EventStatsInput): EventStatsResult {
  const {
    eventId,
    rsvpExperienceMode = 'standard',
    rsvpMode = 'ONE_TAP_ALL',
    rsvpTotalCapacity = null,
    guests,
    rsvps,
    bookingSlots,
    subEvents = [],
  } = input

  const activeGuests = guests.filter((g) => !g.is_removed)
  const activeRsvps = rsvps.filter((r) => !r.is_removed)
  const invitedPhoneKeys = buildInvitedPhoneKeys(activeGuests)

  const invitedRsvps = activeRsvps.filter((r) => isInvitedRsvp(r, invitedPhoneKeys))
  const openRsvps = activeRsvps.filter((r) => !isInvitedRsvp(r, invitedPhoneKeys))

  const isSlotMode = rsvpExperienceMode === 'slot_based'
  const isSubEventMode = rsvpExperienceMode === 'sub_event'
  const isAutoConfirmMode = rsvpExperienceMode === 'auto_confirm'
  const isPerSubeventRsvp = isSubEventMode && rsvpMode === 'PER_SUBEVENT'

  const openAgg = aggregateRsvpsByAttendee(openRsvps, eventId)
  const openCounts = countFromAgg(openAgg)
  const listCounts = invitedGuestCounts(activeGuests)

  const combinedYesCount = countFromAgg(
    aggregateRsvpsByAttendee(activeRsvps, eventId),
  ).attending

  let capacity: CapacityStats | null = null
  let showCapacityStrip = false

  if (isSlotMode && bookingSlots.length > 0) {
    const booked = bookingSlots.reduce(
      (s, sl) => s + (sl.capacity_total - sl.remaining_seats),
      0,
    )
    const maxCapacity = bookingSlots.reduce((s, sl) => s + sl.capacity_total, 0)
    const available = maxCapacity - booked
    capacity = {
      booked,
      available,
      maxCapacity,
      percentFull: maxCapacity > 0 ? Math.round((booked / maxCapacity) * 100) : 0,
      slotRows: bookingSlots.map((slot) => {
        const slotBooked = slot.capacity_total - slot.remaining_seats
        return {
          label: slot.label || `${slot.slot_date || ''} ${slot.start_at || ''}`.trim(),
          booked: slotBooked,
          capacity: slot.capacity_total,
          percent:
            slot.capacity_total > 0
              ? Math.round((slotBooked / slot.capacity_total) * 100)
              : 0,
        }
      }),
    }
    showCapacityStrip = true
  } else if (rsvpTotalCapacity != null && rsvpTotalCapacity > 0) {
    const booked = combinedYesCount
    const available = Math.max(0, rsvpTotalCapacity - booked)
    capacity = {
      booked,
      available,
      maxCapacity: rsvpTotalCapacity,
      percentFull:
        rsvpTotalCapacity > 0 ? Math.round((booked / rsvpTotalCapacity) * 100) : 0,
      slotRows: [],
    }
    showCapacityStrip = true
  }

  const invitedAvailableRegistration = Math.max(0, activeGuests.length - listCounts.attending)

  const invited: PopulationStats = {
    attending: listCounts.attending,
    maybe: listCounts.maybe,
    declined: listCounts.declined,
    pending: listCounts.pending,
    rsvpPercent: listCounts.rsvpPercent,
    totalBooked: listCounts.attending,
    available: invitedAvailableRegistration,
    totalResponse: listCounts.responded,
    subEventRows: isPerSubeventRsvp
      ? buildSubEventRows(activeRsvps, activeGuests, subEvents, true, invitedPhoneKeys)
      : [],
    tiles: [],
  }
  invited.tiles = buildTiles(rsvpExperienceMode, 'invited', invited)

  const open: PopulationStats = {
    ...openCounts,
    pending: 0,
    rsvpPercent: 0,
    totalBooked: openCounts.attending,
    available: 0,
    totalResponse: openCounts.totalResponse,
    subEventRows: isPerSubeventRsvp
      ? buildSubEventRows(activeRsvps, activeGuests, subEvents, false, invitedPhoneKeys)
      : [],
    tiles: [],
  }
  open.tiles = buildTiles(rsvpExperienceMode, 'open', open)

  return {
    showInvitedBlock: activeGuests.length > 0 || invitedRsvps.length > 0,
    showOpenBlock: openRsvps.length > 0,
    showCapacityStrip,
    capacity,
    invited,
    open,
    isSlotMode,
    isSubEventMode,
    isAutoConfirmMode,
    isPerSubeventRsvp,
    hasSubEvents: subEvents.length > 0,
  }
}
