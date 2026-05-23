'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import SiteNav from '@/components/SiteNav'
import SiteFooter from '@/components/SiteFooter'
import { BRAND_NAME } from '@/lib/brand_utility'
import {
  Palette, ListChecks, Users, MessageCircle, BellRing, BarChart2,
  Check, X,
} from 'lucide-react'

const SERIF = "'Cormorant Garamond', Georgia, serif"

const C = {
  dark:    '#0B3D2E',
  parch:   '#E8D8C3',
  gold:    '#D4A017',
  earth:   '#8B5E3C',
  teal:    '#218085',
} as const

// Solid colored badges cycling through brand palette — white icons on solid bg
const BADGES = [
  { bg: C.gold,  iconColor: 'white', glow: 'rgba(212,160,23,0.35)'  },
  { bg: C.teal,  iconColor: 'white', glow: 'rgba(33,128,133,0.3)'   },
  { bg: C.earth, iconColor: 'white', glow: 'rgba(139,94,60,0.3)'    },
  { bg: C.gold,  iconColor: 'white', glow: 'rgba(212,160,23,0.35)'  },
  { bg: C.teal,  iconColor: 'white', glow: 'rgba(33,128,133,0.3)'   },
  { bg: C.earth, iconColor: 'white', glow: 'rgba(139,94,60,0.3)'    },
] as const

const FEATURES = [
  {
    Icon: Palette,
    title: 'Beautiful Digital Invites',
    description: 'Create elegant invite pages that reflect your celebration beautifully.',
    bullets: [
      'Curated template library',
      'Customise fonts, colours & photos',
      'Mobile-optimised, loads instantly',
      'QR code for in-person sharing',
      'Share via WhatsApp, email or link',
      'Live in minutes, not hours',
    ],
    tagline: '👉 Your invite is the first impression — make it count.',
  },
  {
    Icon: ListChecks,
    title: 'Smart RSVP & Guest Tracking',
    description: 'Know exactly who is coming without chasing anyone down.',
    bullets: [
      'Single-event RSVP',
      'Multi-event RSVP',
      'One-tap response, no login needed',
      'Live dashboard: attending & pending',
      'Capture meal prefs & guest counts',
      'Auto-reminders to non-responders',
    ],
    tagline: '👉 No more spreadsheets. No more WhatsApp threads.',
  },
  {
    Icon: Users,
    title: 'Slots & Capacity Management',
    description: 'Built for workshops, tastings, or any limited-seat experience.',
    bullets: [
      'Per-session capacity limits',
      'Guests self-select their slot',
      'Real-time availability updates',
      'Auto-waitlist when slots fill',
    ],
    tagline: '👉 Fill every seat without overbooking a single one.',
  },
  {
    Icon: MessageCircle,
    title: 'Messaging & Communication',
    description: 'Reach every guest on the channels they actually use.',
    bullets: [
      'Ready-to-use templates',
      'Guest updates & announcements',
      'One-tap WhatsApp sharing',
      'Bulk messages to full guest list',
      'Personalised name merge',
      'Branded email delivery',
    ],
    tagline: '👉 Communication that feels personal, at scale.',
  },
  {
    Icon: BellRing,
    title: 'Automations & Reminders',
    description: 'Set it once and let your event run itself.',
    bullets: [
      'One-click follow-ups',
      'RSVP-based groups',
      'Scheduled pre-event reminders',
      'Auto follow-ups for non-responders',
    ],
    tagline: '👉 Less time managing guests. More time celebrating.',
  },
  {
    Icon: BarChart2,
    title: 'Analytics & Insights',
    description: 'Understand your event performance at a glance.',
    bullets: [
      'Invite views & engagement data',
      'RSVP conversion rates over time',
      'Guest response breakdown',
      'Sustainability impact report',
    ],
    tagline: '👉 Data that helps you plan the next one even better.',
  },
]

type CellValue = 'check' | 'cross' | 'limited' | 'strong'

const COMPARISON: { feature: string; others: CellValue; ekfern: CellValue }[] = [
  { feature: 'RSVP tracking',               others: 'check',   ekfern: 'strong' },
  { feature: 'Custom guest questions',       others: 'limited', ekfern: 'strong' },
  { feature: 'Slots & capacity management', others: 'limited', ekfern: 'strong' },
  { feature: 'WhatsApp sending',             others: 'cross',   ekfern: 'strong' },
  { feature: 'Bulk messaging',               others: 'cross',   ekfern: 'strong' },
  { feature: 'Group segmentation',           others: 'limited', ekfern: 'strong' },
  { feature: 'Scheduled reminders',          others: 'cross',   ekfern: 'strong' },
  { feature: 'Recurring event use',          others: 'cross',   ekfern: 'strong' },
]

function CompCell({ value }: { value: CellValue }) {
  if (value === 'check') {
    return (
      <div className="flex justify-center">
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(33,128,133,0.12)', border: '1.5px solid rgba(33,128,133,0.25)' }}
        >
          <Check className="w-3.5 h-3.5" style={{ color: C.teal }} />
        </span>
      </div>
    )
  }
  if (value === 'strong') {
    // Solid filled — clearly dominant vs the 'check' cell
    return (
      <div className="flex justify-center">
        <span
          className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
          style={{ background: C.teal, color: 'white' }}
        >
          <Check className="w-3 h-3" style={{ color: 'white' }} />
          Strong
        </span>
      </div>
    )
  }
  if (value === 'cross') {
    return (
      <div className="flex justify-center">
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(220,38,38,0.1)', border: '1.5px solid rgba(220,38,38,0.2)' }}
        >
          <X className="w-3.5 h-3.5" style={{ color: '#dc2626' }} />
        </span>
      </div>
    )
  }
  // limited
  return (
    <div className="flex justify-center">
      <span
        className="px-3 py-1 rounded-full text-xs font-semibold"
        style={{ background: 'rgba(212,160,23,0.18)', color: '#92600A', border: '1.5px solid rgba(212,160,23,0.3)' }}
      >
        Limited
      </span>
    </div>
  )
}

export default function FeaturesPage() {
  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: C.parch }}>

      {/* ── Navigation ─────────────────────────────────────────── */}
      <SiteNav activePage="/features" />

      <main>

        {/* ── Hero ───────────────────────────────────────────────── */}
        <section
          className="relative py-24 px-6 text-center overflow-hidden"
          style={{ background: C.parch }}
        >
          {/* Stronger radial gradients — visible, not just a whisper */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: [
                'radial-gradient(ellipse 65% 80% at 5% 0%,   rgba(212,160,23,0.32) 0%, transparent 55%)',
                'radial-gradient(ellipse 55% 70% at 95% 100%, rgba(33,128,133,0.24) 0%, transparent 55%)',
                'radial-gradient(ellipse 45% 55% at 50% 50%,  rgba(139,94,60,0.1)  0%, transparent 60%)',
              ].join(', '),
            }}
          />

          <div className="max-w-2xl mx-auto relative">
            <p className="text-xs uppercase tracking-[0.25em] font-semibold mb-5" style={{ color: C.gold }}>
              Features
            </p>
            <h1
              className="font-light leading-[1.08] mb-5"
              style={{ fontFamily: SERIF, color: C.dark, fontSize: 'clamp(2.4rem, 4.5vw, 3.8rem)' }}
            >
              Experience management{' '}
              <em style={{ color: C.teal }}>made simple</em>
            </h1>
            <p className="text-base md:text-lg leading-relaxed mb-10" style={{ color: C.earth }}>
              Everything you need to organize, communicate, and manage experiences —
              without switching between multiple tools.
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <Link href="/host/signup">
                <Button
                  className="text-white px-7 py-5 text-sm font-medium rounded-full transition-all hover:scale-[0.97]"
                  style={{ background: C.dark }}
                >
                  Get started free →
                </Button>
              </Link>
              <Link href="/#how-it-works">
                <Button
                  variant="outline"
                  className="px-7 py-5 text-sm font-medium rounded-full"
                  style={{ borderColor: 'rgba(139,94,60,0.35)', color: C.earth, background: 'transparent' }}
                >
                  See how it works
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* ── Feature Cards ──────────────────────────────────────── */}
        <section className="py-16 px-6" style={{ background: C.parch }}>
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
            {FEATURES.map((feat, i) => (
              <div
                key={i}
                className="rounded-3xl p-8 flex flex-col transition-transform duration-300 hover:-translate-y-1"
                style={{
                  background: 'white',
                  border: '1px solid rgba(139,94,60,0.18)',
                  boxShadow: '0 8px 32px -6px rgba(11,61,46,0.16), 0 2px 8px -2px rgba(11,61,46,0.08)',
                }}
              >
                {/* Solid icon badge with glow */}
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 flex-shrink-0"
                  style={{
                    background: BADGES[i].bg,
                    boxShadow: `0 8px 24px -4px ${BADGES[i].glow}`,
                  }}
                >
                  <feat.Icon className="w-7 h-7" style={{ color: BADGES[i].iconColor }} />
                </div>

                {/* Title */}
                <h3
                  className="font-semibold mb-2"
                  style={{ fontFamily: SERIF, color: C.dark, fontSize: '1.3rem' }}
                >
                  {feat.title}
                </h3>

                {/* Description */}
                <p className="text-sm leading-relaxed mb-5" style={{ color: C.earth }}>
                  {feat.description}
                </p>

                {/* Bullets — 2-column sub-grid */}
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5 flex-1 mb-6">
                  {feat.bullets.map((b, bi) => (
                    <li key={bi} className="flex items-start gap-2">
                      <Check
                        className="w-4 h-4 flex-shrink-0 mt-0.5 stroke-[2.5]"
                        style={{ color: C.teal }}
                      />
                      <span className="text-xs leading-relaxed" style={{ color: '#5a4030' }}>{b}</span>
                    </li>
                  ))}
                </ul>

                {/* Tagline */}
                <p
                  className="text-xs pt-4 border-t"
                  style={{
                    borderColor: 'rgba(139,94,60,0.12)',
                    color: C.teal,
                    fontStyle: 'italic',
                    fontWeight: 500,
                  }}
                >
                  {feat.tagline}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Comparison Table ───────────────────────────────────── */}
        <section className="py-24 px-6" style={{ background: C.parch }}>
          <div className="max-w-3xl mx-auto">
            <p className="text-center text-xs uppercase tracking-[0.25em] font-semibold mb-4" style={{ color: C.gold }}>
              The simplified truth
            </p>
            <h2
              className="text-center font-light mb-3"
              style={{ fontFamily: SERIF, color: C.dark, fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)' }}
            >
              How {BRAND_NAME} compares
            </h2>
            <p className="text-center text-sm mb-12" style={{ color: C.earth }}>
              Typical event tools vs. one platform built for celebrations.
            </p>

            <div
              className="rounded-3xl overflow-hidden"
              style={{
                background: 'white',
                border: '1px solid rgba(139,94,60,0.18)',
                boxShadow: '0 8px 32px -6px rgba(11,61,46,0.16), 0 2px 8px -2px rgba(11,61,46,0.08)',
              }}
            >
              {/* Header */}
              <div
                className="grid grid-cols-3 px-6 py-4"
                style={{
                  background: 'rgba(232,216,195,0.75)',
                  borderBottom: '1px solid rgba(139,94,60,0.15)',
                }}
              >
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: C.earth }}>Feature</span>
                <span className="text-xs font-bold uppercase tracking-widest text-center" style={{ color: C.earth }}>Others</span>
                <span className="text-xs font-bold uppercase tracking-widest text-center" style={{ color: C.dark }}>
                  {BRAND_NAME}
                </span>
              </div>

              {COMPARISON.map((row, i) => (
                <div
                  key={i}
                  className="grid grid-cols-3 px-6 py-4 items-center"
                  style={{
                    borderBottom: i < COMPARISON.length - 1 ? '1px solid rgba(139,94,60,0.08)' : 'none',
                    background: i % 2 === 1 ? 'rgba(232,216,195,0.25)' : 'white',
                  }}
                >
                  <span className="text-sm font-medium" style={{ color: C.dark }}>{row.feature}</span>
                  <CompCell value={row.others} />
                  <CompCell value={row.ekfern} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA — floating gradient card ───────────────────── */}
        <section className="py-16 px-6" style={{ background: C.parch }}>
          <div className="max-w-5xl mx-auto">
            <div
              className="rounded-3xl px-8 py-20 text-center"
              style={{
                background: 'linear-gradient(135deg, #f4dfa0 0%, #e8d8c3 45%, #bcd9da 100%)',
              }}
            >
              <h2
                className="font-light mb-4 mx-auto leading-[1.1]"
                style={{ fontFamily: SERIF, color: C.dark, fontSize: 'clamp(2rem, 4vw, 3rem)' }}
              >
                Ready to host smarter?
              </h2>
              <p className="text-base mb-8 max-w-lg mx-auto" style={{ color: C.earth }}>
                Bring invites, RSVPs, reminders and guest management into one beautiful flow.
              </p>
              <Link href="/host/signup">
                <Button
                  className="px-8 py-5 text-sm font-medium rounded-full transition-all duration-200 hover:scale-[0.97]"
                  style={{ background: C.dark, color: 'white' }}
                >
                  See it in action →
                </Button>
              </Link>
            </div>
          </div>
        </section>

      </main>

      <SiteFooter />

    </div>
  )
}
