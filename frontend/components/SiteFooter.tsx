'use client'

import Link from 'next/link'
import { BRAND_NAME } from '@/lib/brand_utility'

const C = {
  dark:  '#0B3D2E',
  gold:  '#D4A017',
  earth: '#8B5E3C',
} as const

const SERIF = "'Cormorant Garamond', Georgia, serif"

const FOOTER_LINKS = [
  { href: '/',          label: 'Home' },
  { href: '/features',  label: 'Features' },
  { href: '/use-cases', label: 'Use Cases' },
  { href: '/about',     label: 'About' },
  { href: '/contact',   label: 'Contact' },
  { href: '/privacy',   label: 'Privacy' },
]

export default function SiteFooter() {
  return (
    <footer className="py-8 px-6" style={{ background: C.dark, borderTop: '1px solid rgba(212,160,23,0.12)' }}>
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">

        {/* Left: brand + tagline */}
        <div className="text-center sm:text-left">
          <p className="text-sm font-medium mb-1" style={{ color: C.gold, fontFamily: SERIF }}>{BRAND_NAME}</p>
          <p className="text-xs italic" style={{ color: 'rgba(232,216,195,0.4)' }}>Simple. Smart. Sustainable.</p>
        </div>

        {/* Right: links + copyright */}
        <div className="flex flex-col items-center sm:items-end gap-2">
          <div className="flex flex-wrap justify-center sm:justify-end gap-5">
            {FOOTER_LINKS.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className="text-xs hover:opacity-100 transition-opacity"
                style={{ color: C.gold, opacity: 0.5 }}
              >
                {link.label}
              </Link>
            ))}
          </div>
          <p className="text-xs" style={{ color: 'rgba(232,216,195,0.2)' }} suppressHydrationWarning>
            © {new Date().getFullYear()} {BRAND_NAME}
          </p>
        </div>

      </div>
    </footer>
  )
}
