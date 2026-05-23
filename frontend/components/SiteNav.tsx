'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import Logo from '@/components/Logo'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'

const C = {
  dark:  '#0B3D2E',
  parch: '#E8D8C3',
  earth: '#8B5E3C',
  teal:  '#218085',
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
  const [open, setOpen] = useState(false)

  return (
    <>
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

          {/* Desktop links */}
          <div className="hidden sm:flex items-center gap-8">
            {/* Nav links */}
            <div className="flex items-center gap-7">
              {NAV_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="text-sm transition-colors duration-200 whitespace-nowrap"
                  style={{
                    color: activePage === href ? C.dark : C.earth,
                    fontWeight: activePage === href ? 600 : 400,
                  }}
                >
                  {label}
                </Link>
              ))}
            </div>

            {/* Divider */}
            <div className="w-px h-5 self-center" style={{ background: 'rgba(139,94,60,0.2)' }} />

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Link href="/host/login">
                <Button variant="ghost" className="text-sm px-4" style={{ color: C.earth }}>
                  Login
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

          {/* Mobile: Get Started + hamburger */}
          <div className="flex sm:hidden items-center gap-2">
            <Link href="/host/signup">
              <Button
                className="text-white text-xs px-4 py-2 rounded-full"
                style={{ background: C.dark }}
              >
                Get Started
              </Button>
            </Link>
            <button
              onClick={() => setOpen(prev => !prev)}
              className="p-2 rounded-lg transition-colors"
              style={{ color: C.dark }}
              aria-label={open ? 'Close menu' : 'Open menu'}
            >
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {open && (
          <div
            className="sm:hidden px-6 pb-6 flex flex-col gap-1"
            style={{ borderTop: '1px solid rgba(139,94,60,0.1)' }}
          >
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="py-3 text-sm border-b"
                style={{
                  color: activePage === href ? C.dark : C.earth,
                  fontWeight: activePage === href ? 600 : 500,
                  borderColor: 'rgba(139,94,60,0.08)',
                }}
              >
                {label}
              </Link>
            ))}
            <Link href="/host/login" onClick={() => setOpen(false)}>
              <button
                className="mt-3 w-full py-3 text-sm rounded-full border text-center"
                style={{ color: C.earth, borderColor: 'rgba(139,94,60,0.25)' }}
              >
                Host Login
              </button>
            </Link>
          </div>
        )}
      </nav>

      {/* Backdrop — tapping outside closes menu */}
      {open && (
        <div
          className="fixed inset-0 z-40 sm:hidden"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  )
}
