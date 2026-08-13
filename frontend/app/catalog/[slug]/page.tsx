'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Heart } from 'lucide-react'
import { getMyCatalogResponses, getPublicCatalog, submitCatalogResponse } from '@/lib/catalog/api'
import { getCatalogCopy, getCatalogContextLine } from '@/lib/catalog/copy'
import { isEmptyIntroHtml } from '@/lib/catalog/introHtml'
import { parseCatalogSource } from '@/lib/catalog/source'
import type {
  CatalogPurpose,
  MyCatalogResponse,
  PublicCatalog,
  PublicCatalogItem,
} from '@/lib/catalog/types'
import api from '@/lib/api'
import {
  DEFAULT_CATALOG_THEME,
  themeFromInvitePublished,
  catalogThemeStyleVars,
  type CatalogInviteSnapshot,
} from '@/components/catalog/shared/catalogTheme'
import { CatalogHero } from '@/components/catalog/guest/CatalogHero'
import { CatalogItemCard } from '@/components/catalog/guest/CatalogItemCard'
import {
  CatalogActionModal,
  type CatalogActionForm,
} from '@/components/catalog/guest/CatalogActionModal'
import { CatalogExternalLinkModal } from '@/components/catalog/guest/CatalogExternalLinkModal'
import { CatalogUnavailable } from '@/components/catalog/guest/CatalogUnavailable'
import { CatalogGate, type CatalogGateCode } from '@/components/catalog/guest/CatalogGate'
import { CatalogPhoneCheck } from '@/components/catalog/guest/CatalogPhoneCheck'
import { CatalogShelf } from '@/components/catalog/guest/CatalogShelf'
import { CatalogEmptyState } from '@/components/catalog/guest/CatalogEmptyState'
import { CatalogMyContributions } from '@/components/catalog/guest/CatalogMyContributions'

const EMPTY_FORM: CatalogActionForm = {
  name: '',
  email: '',
  phone: '',
  country_code: '+91',
  amount: '',
  message: '',
}

const GATE_CODES = new Set<CatalogGateCode>([
  'guest_required',
  'rsvp_required',
  'confirmed_required',
])

export default function PublicCatalogPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const slug = params.slug as string
  const guestToken = searchParams.get('g') || undefined
  const source = parseCatalogSource(searchParams.get('source'))

  const [catalog, setCatalog] = useState<PublicCatalog | null>(null)
  const [invite, setInvite] = useState<CatalogInviteSnapshot | null>(null)
  const [theme, setTheme] = useState(DEFAULT_CATALOG_THEME)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [gateCode, setGateCode] = useState<CatalogGateCode | null>(null)
  // Proof of guest-list membership for a visitor without an invite link. Seeded
  // from the URL (the RSVP flow forwards it) and renewed from every accepted
  // response, so an unhurried browse never expires mid-decision.
  const [accessPass, setAccessPass] = useState<string | undefined>(
    searchParams.get('p') || undefined,
  )
  const [needsPhone, setNeedsPhone] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [myResponses, setMyResponses] = useState<MyCatalogResponse[]>([])
  const [phoneInput, setPhoneInput] = useState('')
  const [verifyingPhone, setVerifyingPhone] = useState(false)
  const [verifyError, setVerifyError] = useState('')

  const [activeItem, setActiveItem] = useState<PublicCatalogItem | null>(null)
  const [form, setForm] = useState<CatalogActionForm>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [formError, setFormError] = useState('')
  const [externalItem, setExternalItem] = useState<PublicCatalogItem | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      setGateCode(null)
      setCatalog(null)
      setNeedsPhone(false)

      const invitePromise = api
        .get(`/api/events/invite/${slug}/`, { params: guestToken ? { g: guestToken } : {} })
        .catch(() => null)

      const [inviteRes, catalogResult] = await Promise.all([
        invitePromise,
        getPublicCatalog(slug, guestToken, accessPass).then(
          (data) => ({ ok: true as const, data }),
          (e: unknown) => ({ ok: false as const, e }),
        ),
      ])

      if (inviteRes?.data) {
        const data = inviteRes.data as CatalogInviteSnapshot
        setInvite(data)
        setTheme(themeFromInvitePublished(data.published_config?.theme))
      }

      if (catalogResult.ok) {
        setCatalog(catalogResult.data)
        if (catalogResult.data.access_pass) setAccessPass(catalogResult.data.access_pass)
      } else {
        const err = catalogResult.e as {
          response?: { data?: { error?: string; code?: string }; status?: number }
        }
        const code = err?.response?.data?.code
        const status = err?.response?.status
        if (status === 403 && code === 'private_event') {
          // Private event and no credential: offer the same phone check the RSVP
          // page uses rather than a dead end.
          setNeedsPhone(true)
        } else if (
          status === 403 &&
          code &&
          GATE_CODES.has(code as CatalogGateCode)
        ) {
          setGateCode(code as CatalogGateCode)
        } else {
          setError(err?.response?.data?.error || 'Unable to load catalog.')
        }
      }

      setLoading(false)
    }
    load()
    // accessPass is intentionally not a dependency: renewing it from a response
    // must not retrigger the whole load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, guestToken, reloadKey])

  async function verifyPhone() {
    const phone = phoneInput.trim()
    if (phone.replace(/\D/g, '').length < 10) {
      setVerifyError('Please enter a valid phone number')
      return
    }
    setVerifyingPhone(true)
    setVerifyError('')
    try {
      const res = await api.post(`/api/events/invite/${slug}/verify-phone/`, { phone })
      const pass = res.data?.access_pass as string | undefined
      setAccessPass(pass)
      if (pass && typeof window !== 'undefined') {
        // Keep it in the URL so a refresh inside the pass's short life still works.
        const url = new URL(window.location.href)
        url.searchParams.set('p', pass)
        window.history.replaceState({}, '', url.toString())
      }
      setNeedsPhone(false)
      setReloadKey((k) => k + 1)
    } catch (e: any) {
      setVerifyError(
        e?.response?.data?.error || 'Could not check that number. Please try again.',
      )
    } finally {
      setVerifyingPhone(false)
    }
  }

  const refreshMyResponses = useCallback(async () => {
    try {
      const data = await getMyCatalogResponses(slug, guestToken, accessPass)
      setMyResponses(data.results || [])
      if (data.access_pass) setAccessPass(data.access_pass)
    } catch {
      // Not identified, or the pass lapsed: there is simply nothing to show.
      setMyResponses([])
    }
  }, [slug, guestToken, accessPass])

  useEffect(() => {
    if (!catalog?.guest) {
      setMyResponses([])
      return
    }
    refreshMyResponses()
    // refreshMyResponses changes with the pass it renews; running on identity is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog?.guest?.phone, slug])

  function openItem(item: PublicCatalogItem, preselectedAmount?: string) {
    if (item.action_type === 'open_external_link') {
      setExternalItem(item)
      return
    }
    setActiveItem(item)
    setForm({ ...EMPTY_FORM, amount: preselectedAmount || '' })
    setFormError('')
    setSubmitted(false)
  }

  function closeActionModal() {
    setActiveItem(null)
    setSubmitted(false)
    setForm(EMPTY_FORM)
  }

  function handleChooseAnother() {
    setSubmitted(false)
    setActiveItem(null)
    setForm(EMPTY_FORM)
  }

  function handleExternalClick() {
    if (!externalItem) return
    // Open first. Browsers only allow window.open while the tap that triggered
    // it is still active, and awaiting a network call can outlive that - which
    // left the button doing nothing at all on slower connections.
    window.open(externalItem.external_url!, '_blank', 'noopener,noreferrer')
    // Then record the click, fire-and-forget. It carries no identity by design:
    // the guest typed nothing, they opened a link.
    submitCatalogResponse(
      slug,
      { catalog_item_id: externalItem.id, response_type: 'external_click', source },
      guestToken,
      accessPass,
    ).catch(() => {})
    setExternalItem(null)
  }

  async function handleSubmit() {
    if (!activeItem) return
    // Phone identifies the giver, the same way it does on the guest list and
    // the RSVP form. Email is optional - without one they simply read their
    // receipt under "Your contributions" instead of getting it by mail.
    if (!identified && !form.name) {
      setFormError('Please enter your name.')
      return
    }
    if (!identified && form.phone.replace(/\D/g, '').length < 10) {
      setFormError('Please enter a valid phone number.')
      return
    }
    setSubmitting(true)
    setFormError('')
    try {
      const responseType =
        activeItem.action_type === 'pledge_amount'
          ? 'pledge'
          : activeItem.action_type === 'submit_interest'
            ? 'interest'
            : 'host_message'

      await submitCatalogResponse(
        slug,
        {
          catalog_item_id: activeItem.id,
          response_type: responseType,
          name: form.name || undefined,
          email: form.email || undefined,
          phone: form.phone || undefined,
          country_code: form.country_code || undefined,
          amount: form.amount ? Math.round(parseFloat(form.amount) * 100) : undefined,
          message: form.message || undefined,
          source,
        },
        guestToken,
        accessPass,
      )
      setSubmitted(true)
      refreshMyResponses()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } }
      setFormError(err?.response?.data?.error || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const purpose: CatalogPurpose =
    (invite?.catalog_purpose as CatalogPurpose) || catalog?.catalog.purpose || 'general'
  const gateCopy = getCatalogCopy(purpose, invite?.catalog_title)

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: DEFAULT_CATALOG_THEME.bg }}
      >
        <div className="text-center space-y-3">
          <Heart
            className="h-8 w-8 mx-auto animate-pulse"
            style={{ color: DEFAULT_CATALOG_THEME.primary }}
          />
          <p className="text-sm" style={{ color: DEFAULT_CATALOG_THEME.muted }}>
            Loading catalog…
          </p>
        </div>
      </div>
    )
  }

  if (needsPhone) {
    return (
      <CatalogPhoneCheck
        slug={slug}
        displayTitle={gateCopy.title}
        theme={theme}
        value={phoneInput}
        onChange={setPhoneInput}
        onSubmit={verifyPhone}
        submitting={verifyingPhone}
        error={verifyError}
      />
    )
  }

  if (gateCode) {
    return (
      <CatalogGate
        code={gateCode}
        slug={slug}
        guestToken={guestToken}
        hasRsvp={invite?.has_rsvp}
        displayTitle={gateCopy.title}
        theme={theme}
      />
    )
  }

  if (error || !catalog) {
    return (
      <CatalogUnavailable
        error={error || 'This catalog is not available.'}
        slug={slug}
        guestToken={guestToken}
        hasRsvp={invite?.has_rsvp}
        theme={theme}
      />
    )
  }

  const { catalog: cat, items, event } = catalog
  const copy = getCatalogCopy(cat.purpose, cat.catalog_title)
  const introHtml = !isEmptyIntroHtml(cat.intro_text) ? cat.intro_text : undefined
  // Identified by an invite link or by a pass from a phone check. Either way the
  // form confirms who they are rather than asking again.
  const identifiedGuest = catalog?.guest || null
  const identified = !!identifiedGuest
  const needsIdentity = !identified
  const guestName = invite?.guest_context?.name
  const contextLine = getCatalogContextLine(source, cat.purpose)

  const isSingle = items.length === 1
  const gridClass = isSingle
    ? 'flex justify-center'
    : items.length === 2
      ? 'grid grid-cols-1 sm:grid-cols-2 gap-6 justify-items-center'
      : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 justify-items-center'

  return (
    <div className="min-h-screen" style={catalogThemeStyleVars(theme)}>
      <CatalogHero
        slug={slug}
        guestToken={guestToken}
        eventTitle={event.title}
        displayTitle={copy.title}
        introHtml={introHtml}
        introFallback={copy.intro}
        bannerUrl={invite?.background_url}
        inviteEvent={invite ?? undefined}
        guestName={guestName}
        theme={theme}
      />

      <CatalogShelf
        eyebrow={copy.sectionEyebrow}
        contextLine={contextLine}
        trustLine={copy.trustLine}
        theme={theme}
      >
        {items.length === 0 ? (
          <CatalogEmptyState
            message={copy.emptyItems}
            slug={slug}
            guestToken={guestToken}
            theme={theme}
          />
        ) : (
          <div className={gridClass}>
            {items.map((item) => (
              <CatalogItemCard
                key={item.id}
                item={item}
                primary={theme.primary}
                hero={isSingle}
                onAction={(amount) => openItem(item, amount)}
              />
            ))}
          </div>
        )}
      </CatalogShelf>

      <CatalogMyContributions responses={myResponses} theme={theme} />

      <div className="text-center pb-10 px-4">
        <p className="text-xs opacity-40" style={{ color: theme.fg }}>
          {copy.footerLine}
        </p>
      </div>

      {externalItem && (
        <CatalogExternalLinkModal
          item={externalItem}
          theme={theme}
          onContinue={handleExternalClick}
          onClose={() => setExternalItem(null)}
        />
      )}

      {activeItem && (
        <CatalogActionModal
          item={activeItem}
          theme={theme}
          slug={slug}
          guestToken={guestToken}
          form={form}
          setForm={setForm}
          needsIdentity={needsIdentity}
          identifiedPhone={identifiedGuest?.phone}
          submitting={submitting}
          submitted={submitted}
          formError={formError}
          onSubmit={handleSubmit}
          onClose={closeActionModal}
          onChooseAnother={handleChooseAnother}
        />
      )}
    </div>
  )
}
