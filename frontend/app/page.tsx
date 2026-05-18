'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CheckCircle, Users, BellRing, BarChart2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import SiteNav from '@/components/SiteNav'
import { BRAND_NAME } from '@/lib/brand_utility'
import dynamic from 'next/dynamic'
import type { Tile } from '@/lib/invite/schema'

const TilePreview      = dynamic(() => import('@/components/invite/tiles/TilePreview'),  { ssr: false })
const HeroCanvas       = dynamic(() => import('@/components/HeroCanvas'),                { ssr: false })
const TryItLiveSection = dynamic(() => import('@/components/TryItLiveSection'),          { ssr: false })

const SERIF = "'Cormorant Garamond', Georgia, serif"

// ── Brand palette ────────────────────────────────────────────────
const C = {
  dark:    '#0B3D2E',   // bottle green  — dark sections, hero, CTA, footer
  parch:   '#E8D8C3',   // warm parchment — light sections background
  gold:    '#D4A017',   // deep gold     — accents, decorative lines
  earth:   '#8B5E3C',   // earth brown   — body text, subtle details
  teal:    '#218085',   // brand teal    — interactive elements only
  darkMid: '#0f3326',
  darkEdge:'#1a4d38',
} as const

// Hardcoded decorative invite tile — no API call
const HERO_TITLE_TILE: Tile = {
  id: 'hero-title',
  type: 'title',
  enabled: true,
  order: 0,
  settings: {
    text: 'The Annual Retreat',
    font: 'Cormorant Garamond',
    color: '#2D5F3F',
    size: 'large',
    subtitle: 'You are warmly invited to join us',
    subtitleSize: 'small',
  },
}


// Framer Motion variants for staggered headline reveal
const heroContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.2 } },
}
const heroWord = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
}

export default function LandingPage() {
  const stepsRef = useRef<(HTMLDivElement | null)[]>([])
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const steps = stepsRef.current.filter(Boolean) as HTMLDivElement[]
    const observer = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('step-visible') }),
      { threshold: 0.15, rootMargin: '0px 0px -80px 0px' }
    )
    steps.forEach(s => observer.observe(s))
    return () => steps.forEach(s => observer.unobserve(s))
  }, [])

  return (
    <div className="min-h-screen overflow-x-hidden scroll-smooth" style={{ background: C.parch, cursor: `url('/cursor-fern.svg') 2 21, auto` }}>

      <SiteNav activePage="/" />

      <main>

        {/* ── Hero ───────────────────────────────────────────────── */}
        <section
          className="relative min-h-[92vh] flex items-center overflow-hidden px-6 py-20"
          style={{ background: C.dark }}  /* fallback if WebGL unavailable */
          suppressHydrationWarning
        >
          {/* WebGL displacement shader — full-section background */}
          <HeroCanvas />

          {/* Ghost invite card — sits above canvas, below content */}
          <div
            className="absolute right-[-8%] top-[50%] pointer-events-none overflow-hidden rounded-[2.5rem]"
            style={{
              width: 'min(54%, 560px)',
              transform: 'translateY(-50%) rotate(4deg)',
              opacity: 0.06,
              zIndex: 1,
              boxShadow: '0 60px 120px rgba(0,0,0,0.6)',
            }}
          >
            <div className="animate-ken-burns-slow origin-center" style={{ background: C.parch, padding: '3rem 2.5rem' }}>
              <p style={{ fontFamily: SERIF, fontSize: 'clamp(2rem,5vw,3.5rem)', color: C.dark, textAlign: 'center', marginBottom: '0.5rem', fontWeight: 300 }}>
                The Annual Retreat
              </p>
              <p style={{ fontFamily: SERIF, fontSize: '1rem', color: C.earth, textAlign: 'center', fontStyle: 'italic', marginBottom: '2rem' }}>
                You are warmly invited to join us
              </p>
              <div style={{ height: 1, background: `linear-gradient(to right, transparent, ${C.gold}, transparent)`, marginBottom: '2rem' }} />
              <div style={{ textAlign: 'center', color: C.earth, fontSize: '0.85rem', lineHeight: 2 }}>
                <p style={{ color: C.dark, fontWeight: 500 }}>Saturday, November 15, 2025</p>
                <p>10:00 AM onwards</p>
                <p>The Greenfield Estate, Pune</p>
              </div>
              <div style={{ marginTop: '2rem', background: C.dark, color: 'white', textAlign: 'center', borderRadius: 999, padding: '0.75rem', fontSize: '0.85rem' }}>
                RSVP Now
              </div>
            </div>
          </div>

          {/* Radial glow overlay — softens WebGL into content area */}
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 2,
            background: 'radial-gradient(ellipse 55% 60% at 65% 50%, rgba(33,128,133,0.08) 0%, transparent 65%)' }} />

          <div className="max-w-6xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-16 items-center relative" style={{ zIndex: 10 }}>

            {/* Left: staggered copy reveal */}
            <div className="flex flex-col items-start">
              {/* Headline — word-by-word stagger */}
              <motion.h1
                variants={heroContainer}
                initial="hidden"
                animate={mounted ? 'visible' : 'hidden'}
                className="font-light leading-[1.08] mb-6 overflow-hidden"
                style={{ fontFamily: SERIF, color: C.parch, fontSize: 'clamp(2.8rem, 5vw, 4.5rem)' }}
                aria-label="Everything you need to host an experience"
              >
                {['Everything', 'you', 'need', 'to', 'host', 'an', 'experience'].map((word) => (
                  <motion.span key={word} variants={heroWord} className="inline-block mr-[0.25em]">
                    {word === 'experience' ? <em>{word}</em> : word}
                  </motion.span>
                ))}
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={mounted ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.8, delay: 0.65 }}
                className="text-base md:text-lg leading-relaxed mb-5 max-w-md"
                style={{ color: '#a8c4b0' }}
              >
                No more juggling WhatsApp, spreadsheets, forms, and manual follow-ups.
              </motion.p>

              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={mounted ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.7, delay: 0.8 }}
                className="text-sm mb-10 max-w-md"
                style={{ color: 'rgba(168,196,176,0.7)' }}
              >
                🎉 Events &nbsp;•&nbsp; 🎨 Workshops &nbsp;•&nbsp; 🧘 Sessions &nbsp;•&nbsp; ⛰️ Experiences &nbsp;–&nbsp; And many more
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={mounted ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.7, delay: 0.95 }}
                className="flex gap-4 flex-wrap mb-8"
              >
                <Link href="/host/signup">
                  <Button className="bg-bright-teal hover:bg-[#1a6870] text-white px-8 py-6 text-base font-medium rounded-full shadow-lg transition-all duration-200 hover:scale-[0.97]">
                    Start Hosting Smarter
                  </Button>
                </Link>
                <Link href="/features">
                  <Button
                    variant="outline"
                    className="border border-white/20 text-white/80 hover:bg-white/10 hover:text-white px-8 py-6 text-base font-medium rounded-full transition-all duration-200"
                    style={{ background: 'transparent' }}
                  >
                    Explore Features
                  </Button>
                </Link>
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={mounted ? { opacity: 1 } : {}}
                transition={{ duration: 0.6, delay: 1.1 }}
                className="text-xs"
                style={{ color: '#6a9e7f' }}
              >
                No credit card required &nbsp;·&nbsp; Free for every celebration
              </motion.p>
            </div>

            {/* Right: floating phone mockup */}
            <div className="flex justify-center items-center">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={mounted ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 1, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                <motion.div
                  animate={{ y: [0, -14, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
                  className="w-[260px] sm:w-[300px]"
                >
                  <div
                    className="rounded-[2.5rem] overflow-hidden"
                    style={{
                      border: '3px solid rgba(255,255,255,0.12)',
                      boxShadow: '0 40px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)',
                    }}
                  >
                    <div className="h-5 flex justify-center items-center" style={{ background: '#071a11' }}>
                      <div className="w-16 h-2.5 rounded-full" style={{ background: '#050f0a' }} />
                    </div>
                    <div className="flex flex-col" style={{ background: C.parch, minHeight: 460 }}>
                      <TilePreview tile={HERO_TITLE_TILE} />
                      <div className="px-5 pb-6 flex flex-col items-center gap-3">
                        <div className="w-full flex items-center gap-2">
                          <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, transparent, ${C.gold}, transparent)` }} />
                          <span className="text-xs" style={{ color: C.gold }}>❦</span>
                          <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, transparent, ${C.gold}, transparent)` }} />
                        </div>
                        <div className="text-center space-y-1.5 text-xs" style={{ color: C.earth }}>
                          <p className="font-medium text-sm" style={{ color: C.dark }}>November 15, 2025</p>
                          <p>10:00 AM onwards</p>
                          <p style={{ opacity: 0.65 }}>The Greenfield Estate, Pune</p>
                        </div>
                        <div className="mt-3 w-full">
                          <div className="text-white text-center py-2.5 rounded-full text-xs font-medium" style={{ background: C.dark }}>
                            RSVP Now
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── Template Marquee ─────────────── hidden for now ──── */}

        {/* ── Problem Section ────────────────────────────────────── */}
        <section className="py-24 px-6" style={{ background: C.dark }}>
          <div className="max-w-4xl mx-auto">

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.7 }}
              className="text-center mb-16"
            >
              <h2
                className="text-4xl md:text-5xl font-light mb-4"
                style={{ fontFamily: SERIF, color: C.parch }}
              >
                Hosting people shouldn&rsquo;t feel chaotic
              </h2>
              <p className="text-lg md:text-xl" style={{ color: '#a8c4b0' }}>
                Planning an experience should feel exciting, not stressful.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">

              {/* Pain points */}
              <motion.div
                initial={{ opacity: 0, x: -24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              >
                <p className="text-sm font-medium mb-6" style={{ color: C.gold, opacity: 0.8 }}>
                  But most hosts today are stuck:
                </p>
                <ul className="space-y-4">
                  {[
                    'Managing guest lists on spreadsheets',
                    'Sending endless WhatsApp follow-ups',
                    'Tracking RSVPs from scattered replies',
                    'Handling slots and capacity confusion',
                    'Switching between multiple tools',
                  ].map((item, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -16 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true, margin: '-40px' }}
                      transition={{ duration: 0.5, delay: i * 0.08 }}
                      className="flex items-start gap-3"
                    >
                      <span className="mt-0.5 text-base flex-shrink-0" style={{ color: C.teal }}>✦</span>
                      <span className="text-base leading-relaxed" style={{ color: '#a8c4b0' }}>{item}</span>
                    </motion.li>
                  ))}
                </ul>
                <motion.p
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.6, delay: 0.5 }}
                  className="mt-10 text-xl md:text-2xl font-light italic text-center"
                  style={{ fontFamily: SERIF, color: C.gold }}
                >
                  The result? More coordination. Less connection.
                </motion.p>
              </motion.div>

              {/* Bridge */}
              <motion.div
                initial={{ opacity: 0, x: 24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="rounded-3xl p-10"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(212,160,23,0.14)' }}
              >
                <h3
                  className="text-2xl md:text-3xl font-light mb-4"
                  style={{ fontFamily: SERIF, color: C.parch }}
                >
                  Ekfern brings everything together
                </h3>
                <p className="text-base leading-relaxed mb-8" style={{ color: '#a8c4b0' }}>
                  From invites and RSVPs to reminders and guest management, Ekfern helps you run experiences smoothly from start to finish.
                </p>
                <div
                  className="h-px mb-8"
                  style={{ background: `linear-gradient(to right, transparent, ${C.gold}, transparent)` }}
                />
                <p className="text-lg font-medium" style={{ color: C.teal }}>
                  No chaos. Just smooth execution.
                </p>
              </motion.div>

            </div>
          </div>
        </section>

        {/* ── Try It Live ────────────────────────────────────────── */}
        {mounted && <TryItLiveSection />}

        {/* ── How It Works ───────────────────────────────────────── */}
        <section id="how-it-works" className="py-20 px-6" style={{ background: C.parch }}>
          <div className="max-w-3xl mx-auto">
            <p className="text-center text-xs uppercase tracking-[0.2em] font-medium mb-3" style={{ color: C.gold }}>
              How it works
            </p>
            <h2
              className="text-center text-4xl md:text-5xl font-light mb-16"
              style={{ fontFamily: SERIF, color: C.dark }}
            >
              One simple flow for your entire experience
            </h2>

            <div className="relative">
              {/* Vertical connecting line */}
              <div
                className="absolute left-8 top-8 bottom-8 w-px hidden md:block"
                style={{ background: `linear-gradient(to bottom, transparent, ${C.gold}, transparent)` }}
              />

              <div className="space-y-6">
                {[
                  { number: '01', img: '/how-it-works/create.svg',      title: 'Create',      description: 'Design beautiful digital invite pages in minutes.' },
                  { number: '02', img: '/how-it-works/collect.svg',     title: 'Collect',     description: 'Track RSVPs and attendee responses effortlessly.' },
                  { number: '03', img: '/how-it-works/organize.svg',    title: 'Organize',    description: 'Manage slots, sessions, and guest capacity clearly.' },
                  { number: '04', img: '/how-it-works/communicate.svg', title: 'Communicate', description: 'Send updates, reminders, and announcements in one click.' },
                  { number: '05', img: '/how-it-works/automate.svg',    title: 'Automate',    description: 'Reduce manual follow-ups with smart reminders and scheduling.' },
                ].map((step, idx) => (
                  <div
                    key={idx}
                    ref={el => { stepsRef.current[idx] = el }}
                    className="flex items-center gap-6 opacity-0 -translate-x-8 transition-all duration-700"
                    style={{ transitionDelay: `${idx * 100}ms` }}
                  >
                    {/* Illustration node */}
                    <div
                      className="flex-shrink-0 w-16 h-16 rounded-2xl overflow-hidden relative z-10"
                      style={{ boxShadow: '0 6px 20px rgba(11,61,46,0.12)' }}
                    >
                      <img src={step.img} alt={step.title} className="w-full h-full object-cover" />
                    </div>

                    {/* Content card */}
                    <div
                      className="flex-1 rounded-2xl px-7 py-5 transition-all duration-300 hover:-translate-y-0.5"
                      style={{ background: 'white', border: `1px solid rgba(139,94,60,0.13)`, boxShadow: '0 2px 12px rgba(11,61,46,0.06)' }}
                    >
                      <div className="flex items-baseline gap-3 mb-1">
                        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: C.gold }}>{step.number}</span>
                        <h3 className="text-xl font-light" style={{ fontFamily: SERIF, color: C.dark }}>{step.title}</h3>
                      </div>
                      <p className="text-sm leading-relaxed" style={{ color: C.earth }}>{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Feature Preview ─────────────────────────────────────── */}
        <section className="py-28 px-6" style={{ background: C.parch }}>
          <div className="max-w-6xl mx-auto">
            <p className="text-center text-xs uppercase tracking-[0.2em] font-medium mb-4" style={{ color: C.gold }}>
              Features
            </p>
            <h2
              className="text-center text-4xl md:text-5xl font-light mb-4"
              style={{ fontFamily: SERIF, color: C.dark }}
            >
              Powerful tools for modern hosts
            </h2>
            <p className="text-center text-base mb-16 max-w-xl mx-auto" style={{ color: C.earth }}>
              One platform for every kind of experience
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
              {[
                {
                  Icon: CheckCircle,
                  title: 'Smart RSVP Tracking',
                  desc: 'Know exactly who\'s coming, in real time.',
                },
                {
                  Icon: Users,
                  title: 'Slots & Capacity Management',
                  desc: 'Perfect for workshops, sessions, and limited-capacity experiences.',
                },
                {
                  Icon: BellRing,
                  title: 'Messaging & Reminders',
                  desc: 'Send updates, reminders, and invites without switching tools.',
                },
                {
                  Icon: BarChart2,
                  title: 'Analytics & Insights',
                  desc: 'Track engagement and attendee responses effortlessly.',
                },
              ].map((f, idx) => (
                <div
                  key={idx}
                  className="group p-8 rounded-3xl transition-all duration-300 hover:-translate-y-1"
                  style={{ border: `1px solid rgba(139,94,60,0.18)`, background: 'white' }}
                >
                  <f.Icon className="w-8 h-8 mb-6 transition-colors duration-200" style={{ color: C.gold }} />
                  <h3 className="text-xl font-light mb-3" style={{ fontFamily: SERIF, color: C.dark }}>{f.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: C.earth }}>{f.desc}</p>
                </div>
              ))}
            </div>
            <div className="text-center">
              <Link href="/features">
                <Button
                  className="px-8 py-5 text-sm font-medium rounded-full transition-all duration-200 hover:scale-[0.97]"
                  style={{ background: C.dark, color: 'white' }}
                >
                  Explore All Features →
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* ── Use Cases ──────────────────────────────────────────── */}
        <section className="py-24 px-6" style={{ background: C.parch }}>
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.7 }}
            >
              <p className="text-xs uppercase tracking-[0.22em] font-medium mb-4" style={{ color: C.gold }}>
                Use Cases
              </p>
              <h2
                className="text-4xl md:text-5xl font-light mb-6"
                style={{ fontFamily: SERIF, color: C.dark }}
              >
                Built for every kind of experience
              </h2>
              <p className="text-base mb-14 max-w-xl mx-auto" style={{ color: C.earth }}>
                From intimate workshops to large celebrations — Ekfern adapts to the way you host.
              </p>
            </motion.div>

            <div className="flex flex-wrap justify-center gap-4 mb-12">
              {[
                { emoji: '🎨', label: 'Art & pottery workshops' },
                { emoji: '🧘', label: 'Yoga & wellness sessions' },
                { emoji: '⛰️', label: 'Treks & outdoor experiences' },
                { emoji: '🎉', label: 'Weddings & celebrations' },
                { emoji: '🏢', label: 'Communities & corporate gatherings' },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.5, delay: i * 0.07 }}
                  className="flex items-center gap-2.5 px-5 py-3 rounded-full text-sm font-medium"
                  style={{ background: 'white', border: `1px solid rgba(139,94,60,0.18)`, color: C.dark, boxShadow: '0 2px 8px rgba(11,61,46,0.06)' }}
                >
                  <span>{item.emoji}</span>
                  <span>{item.label}</span>
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              <Link href="/use-cases">
                <Button
                  className="px-8 py-5 text-sm font-medium rounded-full transition-all duration-200 hover:scale-[0.97]"
                  style={{ background: C.dark, color: 'white' }}
                >
                  Explore Use Cases →
                </Button>
              </Link>
            </motion.div>
          </div>
        </section>

        {/* ── Sustainability Strip ────────────────────────────────── */}
        <section className="py-16 px-6" style={{ background: C.dark }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.7 }}
            className="max-w-3xl mx-auto text-center"
          >
            <p className="text-xs uppercase tracking-[0.22em] font-medium mb-4" style={{ color: C.teal }}>
              Sustainability
            </p>
            <h2
              className="text-3xl md:text-4xl font-light mb-5"
              style={{ fontFamily: SERIF, color: C.parch }}
            >
              Better experiences. Less waste.
            </h2>
            <p className="text-base leading-relaxed mb-4 max-w-2xl mx-auto" style={{ color: '#a8c4b0' }}>
              Every digital invite sent through Ekfern helps reduce unnecessary paper waste and supports more conscious celebrations.
            </p>
            <p className="text-sm italic" style={{ color: 'rgba(168,196,176,0.6)' }}>
              Because modern hosting can be both seamless and sustainable.
            </p>
          </motion.div>
        </section>

        {/* ── About Preview ──────────────────────────────────────── */}
        <section className="py-24 px-6" style={{ background: C.parch }}>
          <div className="max-w-3xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.7 }}
            >
              <p className="text-xs uppercase tracking-[0.22em] font-medium mb-4" style={{ color: C.gold }}>
                Our story
              </p>
              <h2
                className="text-4xl md:text-5xl font-light mb-8"
                style={{ fontFamily: SERIF, color: C.dark }}
              >
                Built from a real hosting experience
              </h2>
              <p className="text-base leading-relaxed mb-10 max-w-2xl mx-auto" style={{ color: C.earth }}>
                Ekfern started while planning our own wedding, when we realized how chaotic hosting people had become. Between invites, RSVPs, spreadsheets, reminders, and endless coordination, we kept asking: Why is this so complicated?
              </p>
              <div className="space-y-2 mb-10">
                {['So we built something simpler.', 'Something smart.', 'Something seamless.', 'Something sustainable.'].map((line, i) => (
                  <motion.p
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-40px' }}
                    transition={{ duration: 0.5, delay: i * 0.1 }}
                    className="text-xl md:text-2xl font-light italic"
                    style={{ fontFamily: SERIF, color: C.teal }}
                  >
                    {line}
                  </motion.p>
                ))}
              </div>
              <Link href="/about">
                <Button
                  className="px-8 py-5 text-sm font-medium rounded-full transition-all duration-200 hover:scale-[0.97]"
                  style={{ background: C.dark, color: 'white' }}
                >
                  Read Our Story →
                </Button>
              </Link>
            </motion.div>
          </div>
        </section>

        {/* ── CTA ────────────────────────────────────────────────── */}
        <section className="py-28 px-6 text-center" style={{ background: C.dark }}>
          <p className="text-xs uppercase tracking-[0.2em] font-medium mb-6" style={{ color: C.gold, opacity: 0.8 }}>
            Get started today
          </p>
          <h2
            className="text-4xl md:text-5xl lg:text-6xl font-light mb-8 mx-auto max-w-2xl leading-[1.15]"
            style={{ fontFamily: SERIF, color: C.parch }}
          >
            Beautiful experiences deserve smoother planning
          </h2>
          <Link href="/host/signup">
            <Button className="px-10 py-6 text-base font-medium rounded-full transition-all duration-200 hover:scale-[0.97]" style={{ background: C.gold, color: C.dark }}>
              Start Hosting Smarter →
            </Button>
          </Link>
          <p className="mt-6 text-xs" style={{ color: '#6a9e7f' }}>
            No credit card required · Free forever for small celebrations
          </p>
        </section>

      </main>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="py-10 px-6" style={{ background: C.dark, borderTop: `1px solid rgba(212,160,23,0.12)` }}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-6">
          <div>
            <p className="text-sm font-medium" style={{ color: C.gold, fontFamily: SERIF }}>{BRAND_NAME}</p>
            <p className="text-xs mt-1" style={{ color: C.teal, opacity: 0.7 }}>Simple. Smart. Sustainable.</p>
          </div>
          <div className="flex flex-wrap gap-5 items-center justify-center">
            {[
              { href: '/', label: 'Home' },
              { href: '/features', label: 'Features' },
              { href: '/about', label: 'About' },
              { href: '/contact', label: 'Contact' },
              { href: '/privacy', label: 'Privacy Policy' },
            ].map(link => (
              <Link key={link.href} href={link.href} className="text-xs transition-opacity duration-200 hover:opacity-100" style={{ color: C.gold, opacity: 0.45 }}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>

      <style jsx global>{`
        .step-visible {
          opacity: 1 !important;
          transform: translateX(0) !important;
        }
      `}</style>
    </div>
  )
}
