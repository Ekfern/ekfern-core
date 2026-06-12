'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Heart } from 'lucide-react'
import { getPublicCatalog, submitCatalogResponse } from '@/lib/catalog/api'
import { getCatalogCopy, getCatalogContextLine } from '@/lib/catalog/copy'
import { isEmptyIntroHtml } from '@/lib/catalog/introHtml'
import { parseCatalogSource } from '@/lib/catalog/source'
import type { CatalogPurpose, PublicCatalog, PublicCatalogItem } from '@/lib/catalog/types'
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
import { CatalogShelf } from '@/components/catalog/guest/CatalogShelf'
import { CatalogEmptyState } from '@/components/catalog/guest/CatalogEmptyState'

const EMPTY_FORM: CatalogActionForm = {
  name: '',
  email: '',
  phone: '',
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

      const invitePromise = api
        .get(`/api/events/invite/${slug}/`, { params: guestToken ? { g: guestToken } : {} })
        .catch(() => null)

      const [inviteRes, catalogResult] = await Promise.all([
        invitePromise,
        getPublicCatalog(slug, guestToken).then(
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
      } else {
        const err = catalogResult.e as {
          response?: { data?: { error?: string; code?: string }; status?: number }
        }
        const code = err?.response?.data?.code
        const status = err?.response?.status
        if (
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
  }, [slug, guestToken])

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

  async function handleExternalClick() {
    if (!externalItem) return
    try {
      await submitCatalogResponse(
        slug,
        { catalog_item_id: externalItem.id, response_type: 'external_click', source },
        guestToken,
      )
    } catch {
      /* fire-and-forget */
    }
    window.open(externalItem.external_url!, '_blank', 'noopener,noreferrer')
    setExternalItem(null)
  }

  async function handleSubmit() {
    if (!activeItem) return
    if (!form.name && !guestToken) {
      setFormError('Please enter your name.')
      return
    }
    if (!form.email && !guestToken) {
      setFormError('Please enter your email.')
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
          amount: form.amount ? Math.round(parseFloat(form.amount) * 100) : undefined,
          message: form.message || undefined,
          source,
        },
        guestToken,
      )
      setSubmitted(true)
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
  const needsIdentity = !guestToken
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
