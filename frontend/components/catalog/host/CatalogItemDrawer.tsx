'use client'

import React from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ActionType, AmountType, CatalogItem, ItemType } from '@/lib/catalog/types'
import type { CatalogItemFormData } from './itemTemplates'

const ACTION_HINTS: Record<ActionType, string> = {
  pledge_amount: 'Guest selects or enters an amount; you follow up for payment.',
  submit_interest: 'Guest signals interest; no amount required.',
  open_external_link: 'Guest is sent to your URL; we log the click.',
  contact_host: 'Guest sends a message directly to you.',
}

export function CatalogItemDrawer({
  open,
  editingItem,
  itemForm,
  setItemForm,
  suggestedInput,
  setSuggestedInput,
  pendingImagePreview,
  onImageSelect,
  saving,
  onSave,
  onClose,
}: {
  open: boolean
  editingItem: CatalogItem | null
  itemForm: CatalogItemFormData
  setItemForm: React.Dispatch<React.SetStateAction<CatalogItemFormData>>
  suggestedInput: string
  setSuggestedInput: (v: string) => void
  pendingImagePreview: string | null
  onImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  saving: boolean
  onSave: () => void
  onClose: () => void
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative ml-auto h-full w-full max-w-md bg-white shadow-xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="font-semibold text-lg">{editingItem ? 'Edit Item' : 'Add Item'}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <Input
              value={itemForm.title}
              onChange={(e) => setItemForm({ ...itemForm, title: e.target.value })}
              placeholder="e.g. Honeymoon Fund"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-eco-green"
              value={itemForm.description}
              onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
              placeholder="Help us create memories on our first trip together."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Image (optional)</label>
            {(pendingImagePreview || itemForm.image_url) && (
              <img
                src={pendingImagePreview || itemForm.image_url!}
                alt=""
                className="h-32 w-full object-cover rounded-lg mb-2"
              />
            )}
            <label className="flex items-center gap-2 cursor-pointer text-sm text-eco-green">
              <Upload className="h-4 w-4" />
              {pendingImagePreview || itemForm.image_url ? 'Change image' : 'Upload image'}
              <input type="file" accept="image/*" className="hidden" onChange={onImageSelect} />
            </label>
            {!editingItem && pendingImagePreview && (
              <p className="text-xs text-gray-400 mt-1">Image will be uploaded when you save.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Item type</label>
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-eco-green"
              value={itemForm.item_type}
              onChange={(e) => setItemForm({ ...itemForm, item_type: e.target.value as ItemType })}
            >
              <option value="contribution">Contribution</option>
              <option value="offer_addon">Offer / Add-on</option>
              <option value="info_link">Info / Link</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Action type</label>
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-eco-green"
              value={itemForm.action_type}
              onChange={(e) => {
                const val = e.target.value as ActionType
                setItemForm({
                  ...itemForm,
                  action_type: val,
                  amount_type: val === 'pledge_amount' ? 'flexible' : null,
                })
              }}
            >
              <option value="pledge_amount">Pledge amount</option>
              <option value="submit_interest">Submit interest</option>
              <option value="open_external_link">Open external link</option>
              <option value="contact_host">Contact host</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">{ACTION_HINTS[itemForm.action_type]}</p>
          </div>

          {itemForm.action_type === 'pledge_amount' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
              <select
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-eco-green mb-2"
                value={itemForm.amount_type ?? 'flexible'}
                onChange={(e) =>
                  setItemForm({ ...itemForm, amount_type: e.target.value as AmountType })
                }
              >
                <option value="flexible">Flexible (guest enters any amount)</option>
                <option value="fixed">Fixed amount</option>
                <option value="suggested">Suggested amounts</option>
                <option value="none">No amount</option>
              </select>
              {itemForm.amount_type === 'fixed' && (
                <Input
                  type="number"
                  placeholder="Amount in ₹ (e.g. 2000)"
                  value={itemForm.fixed_amount ? itemForm.fixed_amount / 100 : ''}
                  onChange={(e) =>
                    setItemForm({
                      ...itemForm,
                      fixed_amount: parseFloat(e.target.value) * 100 || null,
                    })
                  }
                />
              )}
              {itemForm.amount_type === 'suggested' && (
                <Input
                  placeholder="Comma-separated ₹ amounts, e.g. 500, 1000, 2000"
                  value={suggestedInput}
                  onChange={(e) => setSuggestedInput(e.target.value)}
                />
              )}
            </div>
          )}

          {itemForm.action_type === 'open_external_link' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">External link URL</label>
              <Input
                type="url"
                placeholder="https://…"
                value={itemForm.external_url ?? ''}
                onChange={(e) =>
                  setItemForm({ ...itemForm, external_url: e.target.value || null })
                }
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Manual instructions{' '}
              <span className="text-gray-400 font-normal">(shown after submission)</span>
            </label>
            <textarea
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-eco-green"
              placeholder="e.g. UPI ID: host@upi — please use reference: wedding2024"
              value={itemForm.manual_instructions}
              onChange={(e) => setItemForm({ ...itemForm, manual_instructions: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-eco-green"
              value={itemForm.status}
              onChange={(e) =>
                setItemForm({ ...itemForm, status: e.target.value as 'published' | 'hidden' })
              }
            >
              <option value="published">Published</option>
              <option value="hidden">Hidden</option>
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              onClick={onSave}
              disabled={!itemForm.title.trim() || saving}
              className="flex-1 bg-eco-green text-white hover:bg-eco-green-dark"
            >
              {saving ? 'Saving…' : 'Save Item'}
            </Button>
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
