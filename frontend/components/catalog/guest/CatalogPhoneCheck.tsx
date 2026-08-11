'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import type { CatalogTheme } from '../shared/catalogTheme'

/**
 * Phone step for a guest who reached the registry without an invite link.
 *
 * A private event is guest-list only, so we need to know the visitor's number
 * is on it. This is the same check the RSVP page runs, offered here instead of
 * a dead end, and it is skipped entirely for anyone arriving from a personal
 * link or straight from a completed RSVP.
 */
export function CatalogPhoneCheck({
  slug,
  displayTitle,
  theme,
  value,
  onChange,
  onSubmit,
  submitting,
  error,
}: {
  slug: string
  displayTitle: string
  theme: CatalogTheme
  value: string
  onChange: (next: string) => void
  onSubmit: () => void
  submitting: boolean
  error?: string
}) {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: theme.bg }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8 shadow-lg text-center space-y-5"
        style={{ background: '#fff' }}
      >
        <p
          className="text-xs font-semibold uppercase tracking-[0.15em]"
          style={{ color: theme.primary, opacity: 0.55 }}
        >
          {displayTitle}
        </p>
        <ShieldCheck
          className="h-12 w-12 mx-auto"
          style={{ color: theme.primary, opacity: 0.35 }}
        />
        <h1 className="text-xl font-semibold" style={{ color: theme.fg }}>
          Confirm your number
        </h1>
        <p className="text-sm leading-relaxed" style={{ color: theme.muted }}>
          This is a private event. Enter the phone number the host invited you on
          and we&apos;ll take you straight through.
        </p>

        <form
          className="space-y-3 text-left"
          onSubmit={(e) => {
            e.preventDefault()
            if (!submitting) onSubmit()
          }}
        >
          <label htmlFor="catalog-phone" className="sr-only">
            Phone number
          </label>
          <input
            id="catalog-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="Phone number"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={!!error}
            aria-describedby={error ? 'catalog-phone-error' : undefined}
            className="w-full rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2"
            style={{ borderColor: `${theme.primary}33`, color: theme.fg }}
          />
          {error && (
            <p id="catalog-phone-error" role="alert" className="text-sm" style={{ color: '#b3261e' }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: theme.primary }}
          >
            {submitting ? 'Checking…' : 'Continue'}
          </button>
        </form>

        <Link
          href={`/invite/${slug}`}
          className="inline-flex items-center justify-center gap-1.5 text-sm font-medium py-2"
          style={{ color: theme.primary }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to invitation
        </Link>
      </div>
    </div>
  )
}
