'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import SiteNav from '@/components/SiteNav'
import SiteFooter from '@/components/SiteFooter'

const SERIF = "'Cormorant Garamond', Georgia, serif"

const C = {
  dark:  '#0B3D2E',
  parch: '#E8D8C3',
  gold:  '#D4A017',
  earth: '#8B5E3C',
  teal:  '#218085',
} as const

const USE_CASES = [
  {
    tag: '🍾 Private Party',
    title: 'Jeff & Jasmin',
    subtitle: 'Pre-Wedding Terrace Dinner',
    story: `Jeff and Jasmin wanted something more personal than a WhatsApp blast. They created a private invite page — closed guest list, private links, each RSVP tracked individually. A gift registry was attached so guests could browse and claim what they wanted to bring; nothing got duplicated, no one had to ask. Every response landed in a live dashboard showing exactly who was Attending, Pending, or Declined. When the headcount still had gaps three days out, one click sent a nudge to every non-responder. By the time they confirmed the catering order, they had exact numbers — no spreadsheet, no chase.`,
    features: [
      'Closed guest list with private invite links',
      'Individual RSVP tracking — Attending / Pending / Declined',
      'Gift registry for guests to browse and claim',
      'Live capacity fill — headcount at a glance',
      'One-click reminder to all non-responders',
    ],
    bg: 'white' as const,
  },
  {
    tag: '🏃 NGO Event',
    title: 'Hope Foundation',
    subtitle: 'Annual Fundraising Walk',
    story: `Hope Foundation needed hundreds of public registrations without a ticketing platform or an IT team. They published an open event page — no invite list, no login, anyone could register via the link or QR code on their campaign poster. Two walk waves managed capacity so the route never got overcrowded, with live registrant counts per wave. Donation tiers replaced a gift registry — each registrant picked a contribution level when they signed up. A bulk message reached all confirmed walkers on the morning of the walk. After the event, the response dashboard gave them exactly the numbers their donor report needed. High scale, zero overhead.`,
    features: [
      'Open public registration — no guest list needed',
      'QR code for posters and offline promotion',
      'Two waves with live registrant count per wave',
      'Donation tiers in place of a gift registry',
      'Bulk day-of message to all confirmed registrants',
      'Post-event response data for donor reporting',
    ],
    bg: C.parch as string,
  },
  {
    tag: '🏺 Workshop',
    title: 'Studio Klay',
    subtitle: 'Slot-Based Pottery Sessions',
    story: `Studio Klay runs paid sessions across two batches every weekend — 11 AM and 3 PM, 8 seats each. Participants pick a slot when they register; Ekfern enforces per-slot capacity so no batch ever overfills. The host sees Booked / Available / % Full per slot in real time, making it easy to decide when to open a third batch or close bookings. An exit-shop registry lets participants pre-claim pottery tools or kits before the session ends, so popular items don't run out on the day. A reminder goes out 48 hours before each batch. The whole experience — clean booking page, slot enforcement, pre-claims, reminders — runs without a separate booking tool.`,
    features: [
      'Slot-based booking across multiple batches',
      'Per-slot capacity — enforced, not manual',
      'Live stats: Booked / Available / % Full per slot',
      'Exit-shop registry for pre-claiming tools & kits',
      'Scheduled pre-session reminder to all booked participants',
    ],
    bg: 'white' as const,
  },
  {
    tag: '🤝 Conference',
    title: 'Meridian Ventures Summit',
    subtitle: 'University Entrepreneurship Cell',
    story: `The entrepreneurship cell was hosting a curated, invite-only conclave with a morning keynote and two parallel workshop sessions. Access was gated — only delegates who received the private link could register, keeping the list selective. Each attendee chose their preferred workshop slot, and per-session capacity was capped so rooms wouldn't overflow. The organising team had a live RSVP view across both sessions, letting them finalise seating before anything was printed. Pending delegates received a follow-up message, and a single day-of brief — agenda, venue directions, session assignment — reached every confirmed attendee at once. Post-event analytics showed who opened the invite, who registered, and where drop-off happened.`,
    features: [
      'Invite-only gated access via private link',
      'Parallel session RSVPs with per-session capacity',
      'Live confirmation dashboard across all sessions',
      'Follow-up messaging to unconfirmed delegates',
      'One-click day-of brief to all confirmed attendees',
      'Analytics: invite opens, registrations, drop-off',
    ],
    bg: C.parch as string,
  },
  {
    tag: '🕯️ Supper Club',
    title: 'The Ember Table',
    subtitle: 'Sophie Marsh · Monthly Curated Dining',
    story: `Sophie runs a monthly supper club from her converted townhouse — 24 seats, a themed tasting menu, a waiting list that refills within hours of each announcement. Invites go out as private links to a handpicked list; the exclusivity is part of what people are paying for. The invite page is built to match the evening — the typography, a photo of the laid table, a line about the menu theme. It is the first impression of the experience, and it looks the part. When Sophie sends 50 invites and 20 confirm quickly, Ekfern shows her exactly who opened the link but hasn't responded — that is her follow-up list, no manual tracking needed. Those who confirm fill in their dietary restrictions and preferred courses directly in the RSVP, so Sophie has everything she needs before she shops. The morning before dinner, one message goes to every confirmed guest — address, parking note, dress suggestion, a hint about the evening. No group chat, no back-and-forth.`,
    features: [
      'Invite page styled to match the evening\'s aesthetic',
      'Invite engagement tracking — see who opened but didn\'t respond',
      'Custom data collection at RSVP — dietary needs & course preferences',
      'Private links only — no public listing',
      'One targeted message to all confirmed guests the day before',
    ],
    bg: 'white' as const,
  },
]

export default function UseCasesPage() {
  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: C.parch }}>

      <SiteNav activePage="/use-cases" />

      <main>

        {/* ── Hero ───────────────────────────────────────────────── */}
        <section className="py-24 px-6 text-center" style={{ background: C.dark }}>
          <motion.div
            suppressHydrationWarning
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-2xl mx-auto"
          >
            <p className="text-xs uppercase tracking-[0.25em] font-medium mb-5" style={{ color: C.gold }}>
              Use Cases
            </p>
            <h1
              className="font-light leading-[1.1] mb-6"
              style={{ fontFamily: SERIF, color: C.parch, fontSize: 'clamp(2.4rem, 4.5vw, 3.8rem)' }}
            >
              Real hosts. Real results.
            </h1>
            <p className="text-base md:text-lg leading-relaxed" style={{ color: '#a8c4b0' }}>
              See how different kinds of hosts use Ekfern to run experiences that feel effortless — from intimate dinners to large-scale events.
            </p>
          </motion.div>
        </section>

        {/* ── Use Case Sections ──────────────────────────────────── */}
        {USE_CASES.map((uc, i) => {
          const flip = i % 2 !== 0
          const cardBg = uc.bg === 'white' ? C.parch : 'white'

          const storyBlock = (
            <div className={flip ? 'order-1 md:order-2' : ''}>
              <p className="text-xs uppercase tracking-[0.2em] font-medium mb-3" style={{ color: C.teal }}>
                {uc.tag}
              </p>
              <h2
                className="font-light mb-1"
                style={{ fontFamily: SERIF, color: C.dark, fontSize: 'clamp(1.9rem, 3.5vw, 2.8rem)' }}
              >
                {uc.title}
              </h2>
              <p className="text-sm italic mb-7" style={{ color: C.earth }}>
                {uc.subtitle}
              </p>
              <p className="text-base leading-[1.85]" style={{ color: C.earth }}>
                {uc.story}
              </p>
            </div>
          )

          const featuresBlock = (
            <div
              className={`rounded-2xl p-7 ${flip ? 'order-2 md:order-1' : ''}`}
              style={{
                background: cardBg,
                border: `1px solid rgba(139,94,60,0.15)`,
                boxShadow: '0 4px 20px rgba(11,61,46,0.07)',
              }}
            >
              <p className="text-xs uppercase tracking-[0.2em] font-semibold mb-5" style={{ color: C.gold }}>
                Ekfern at work
              </p>
              <ul className="space-y-3.5">
                {uc.features.map((feat, j) => (
                  <motion.li
                    key={j}
                    initial={{ opacity: 0, x: flip ? -12 : 12 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: '-20px' }}
                    transition={{ duration: 0.4, delay: j * 0.06 }}
                    className="flex items-start gap-3"
                  >
                    <span
                      className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: C.teal }}
                    />
                    <span className="text-sm leading-snug" style={{ color: C.dark }}>{feat}</span>
                  </motion.li>
                ))}
              </ul>
            </div>
          )

          return (
            <section key={i} className="py-20 px-6" style={{ background: uc.bg }}>
              <div className="max-w-5xl mx-auto">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.7 }}
                  suppressHydrationWarning
                  className={`grid grid-cols-1 gap-12 items-center ${flip ? 'md:grid-cols-[2fr_3fr]' : 'md:grid-cols-[3fr_2fr]'}`}
                >
                  {flip ? (
                    <>
                      {featuresBlock}
                      {storyBlock}
                    </>
                  ) : (
                    <>
                      {storyBlock}
                      {featuresBlock}
                    </>
                  )}
                </motion.div>
              </div>
            </section>
          )
        })}

        {/* ── CTA ────────────────────────────────────────────────── */}
        <section className="py-28 px-6 text-center" style={{ background: C.dark }}>
          <motion.div
            suppressHydrationWarning
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.7 }}
            className="max-w-xl mx-auto"
          >
            <p className="text-xs uppercase tracking-[0.2em] font-medium mb-6" style={{ color: C.gold, opacity: 0.8 }}>
              Your turn
            </p>
            <h2
              className="text-4xl md:text-5xl font-light mb-5 leading-[1.15]"
              style={{ fontFamily: SERIF, color: C.parch }}
            >
              What will you host?
            </h2>
            <p className="text-base mb-10" style={{ color: '#a8c4b0' }}>
              Join hosts who've replaced spreadsheets, WhatsApp threads, and duct-taped tools with one smooth platform.
            </p>
            <Link href="/host/signup">
              <Button
                className="px-10 py-6 text-base font-medium rounded-full transition-all duration-200 hover:scale-[0.97]"
                style={{ background: C.gold, color: C.dark }}
              >
                Start Hosting Smarter →
              </Button>
            </Link>
            <p className="mt-6 text-xs" style={{ color: '#6a9e7f' }}>
              No credit card required · Free to get started
            </p>
          </motion.div>
        </section>

      </main>

      <SiteFooter />

    </div>
  )
}
