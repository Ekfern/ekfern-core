'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import Logo from '@/components/Logo'

const C = {
  dark:  '#0B3D2E',
  earth: '#8B5E3C',
} as const

const NAV_LINKS = [
  { href: '/',           label: 'Home' },
  { href: '/features',   label: 'Features' },
  { href: '/use-cases',  label: 'Use Cases' },
  { href: '/about',      label: 'About' },
  { href: '/contact',    label: 'Contact' },
] as const

type NavPage = typeof NAV_LINKS[number]['href']

export default function SiteNav({ activePage }: { activePage?: NavPage }) {
  return (
    <nav
      className="sticky top-0 z-50"
      style={{
        background: 'rgba(232,216,195,0.88)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(139,94,60,0.12)',
      }}
    >
      <div className="max-w-6xl mx-auto px-6 py-5 flex justify-between items-center">
        <Logo href="/" iconClassName="text-bright-teal" textClassName="text-bright-teal" />
        <div className="flex gap-3 items-center">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-sm transition-colors duration-200 hidden sm:block"
              style={{
                color: activePage === href ? C.dark : C.earth,
                fontWeight: activePage === href ? 600 : 500,
              }}
            >
              {label}
            </Link>
          ))}
          <Link href="/host/login">
            <Button variant="ghost" className="text-sm" style={{ color: C.earth }}>
              Host Login
            </Button>
          </Link>
          <Link href="/host/signup">
            <Button
              className="text-white text-sm px-5 rounded-full transition-all duration-200 hover:scale-[0.98]"
              style={{ background: C.dark }}
            >
              Get Started
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  )
}
