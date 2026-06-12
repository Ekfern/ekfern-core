'use client'

import React from 'react'
import { Lock } from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { PublicCatalogItem } from '@/lib/catalog/types'
import type { CatalogTheme } from '../shared/catalogTheme'
import { CatalogModal } from '../shared/CatalogModal'
import { CatalogAmountSelector } from './CatalogAmountSelector'
import { CatalogSuccessState } from './CatalogSuccessState'
import { getModalActionLabel, getSubmitLabel } from './itemLabels'

export interface CatalogActionForm {
  name: string
  email: string
  phone: string
  amount: string
  message: string
}

export function CatalogActionModal({
  item,
  theme,
  slug,
  guestToken,
  form,
  setForm,
  needsIdentity,
  submitting,
  submitted,
  formError,
  onSubmit,
  onClose,
  onChooseAnother,
}: {
  item: PublicCatalogItem
  theme: CatalogTheme
  slug: string
  guestToken?: string
  form: CatalogActionForm
  setForm: React.Dispatch<React.SetStateAction<CatalogActionForm>>
  needsIdentity: boolean
  submitting: boolean
  submitted: boolean
  formError: string
  onSubmit: () => void
  onClose: () => void
  onChooseAnother: () => void
}) {
  const isPledge = item.action_type === 'pledge_amount'

  return (
    <CatalogModal onClose={onClose}>
      {submitted ? (
        <CatalogSuccessState
          item={item}
          theme={theme}
          slug={slug}
          guestToken={guestToken}
          onChooseAnother={onChooseAnother}
          onClose={onClose}
        />
      ) : (
        <div className="space-y-4">
          {item.image_url && (
            <div className="relative w-full h-36 rounded-xl overflow-hidden -mt-1">
              <img src={item.image_url} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="pb-1 border-b" style={{ borderColor: `${theme.primary}20` }}>
            <p
              className="text-xs uppercase tracking-widest mb-1"
              style={{ color: theme.primary, opacity: 0.5 }}
            >
              {getModalActionLabel(item.action_type)}
            </p>
            <h2 className="font-semibold text-lg leading-tight" style={{ color: theme.primary }}>
              {item.title}
            </h2>
            {item.description && (
              <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--theme-muted)' }}>
                {item.description}
              </p>
            )}
          </div>

          {needsIdentity && (
            <div className="space-y-2">
              <Input
                placeholder="Your name *"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <Input
                type="email"
                placeholder="Email address *"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <Input
                placeholder="Phone (optional)"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
          )}

          {isPledge && (
            <CatalogAmountSelector
              item={item}
              value={form.amount}
              primary={theme.primary}
              onChange={(v) => setForm({ ...form, amount: v })}
            />
          )}

          <textarea
            rows={3}
            className="w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 resize-none"
            style={
              {
                borderColor: `${theme.primary}25`,
                '--tw-ring-color': `${theme.primary}40`,
              } as React.CSSProperties
            }
            placeholder="Message to the host (optional)"
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
          />

          {(isPledge || item.action_type === 'submit_interest') && (
            <div
              className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs"
              style={{ background: `${theme.primary}0D`, color: theme.primary }}
            >
              <Lock className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span>
                This is not a payment. Your response is shared only with the host, who will reach
                out with next steps.
              </span>
            </div>
          )}

          {formError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{formError}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onSubmit}
              disabled={submitting}
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: theme.primary }}
            >
              {getSubmitLabel(item, submitting)}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl text-sm font-medium border transition-colors hover:opacity-80"
              style={{ borderColor: `${theme.primary}25`, color: theme.primary }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </CatalogModal>
  )
}
