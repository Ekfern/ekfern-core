'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ExternalLink, Plus } from 'lucide-react'
import api from '@/lib/api'
import {
  createCatalogItem,
  deleteCatalogItem,
  getCatalog,
  getCatalogItems,
  getCatalogResponses,
  updateCatalog,
  updateCatalogItem,
  uploadCatalogItemImage,
} from '@/lib/catalog/api'
import type { CatalogItem, HostCatalog } from '@/lib/catalog/types'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { CatalogSettingsCard } from '@/components/catalog/host/CatalogSettingsCard'
import { CatalogSharingCard } from '@/components/catalog/host/CatalogSharingCard'
import { CatalogItemList } from '@/components/catalog/host/CatalogItemList'
import { CatalogItemDrawer } from '@/components/catalog/host/CatalogItemDrawer'
import {
  CATALOG_ITEM_TEMPLATES,
  EMPTY_CATALOG_ITEM,
  type CatalogItemFormData,
} from '@/components/catalog/host/itemTemplates'

export default function HostCatalogPage() {
  const params = useParams()
  const { showToast } = useToast()
  const eventId = parseInt(params.eventId as string)

  const [catalog, setCatalog] = useState<HostCatalog | null>(null)
  const [items, setItems] = useState<CatalogItem[]>([])
  const [eventSlug, setEventSlug] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [responseCount, setResponseCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'settings' | 'items'>('items')

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null)
  const [itemForm, setItemForm] = useState<CatalogItemFormData>({ ...EMPTY_CATALOG_ITEM })
  const [itemSaving, setItemSaving] = useState(false)
  const [suggestedInput, setSuggestedInput] = useState('')
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null)
  const [pendingImagePreview, setPendingImagePreview] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [eventId])

  async function load() {
    try {
      const [cat, its, eventRes, responses] = await Promise.all([
        getCatalog(eventId),
        getCatalogItems(eventId),
        api.get(`/api/events/${eventId}/`),
        getCatalogResponses(eventId).catch(() => []),
      ])
      setCatalog(cat)
      setItems(its.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id))
      setEventSlug(eventRes.data.slug || '')
      setIsPublic(eventRes.data.is_public ?? true)
      setResponseCount(responses.length)
    } catch {
      showToast('Failed to load catalog.', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function saveCatalogSettings(patch: Partial<HostCatalog>) {
    if (!catalog) return
    try {
      const updated = await updateCatalog(eventId, patch)
      setCatalog(updated)
      showToast('Saved.', 'success')
    } catch {
      showToast('Failed to save.', 'error')
    }
  }

  function catalogPatchLocal(patch: Partial<HostCatalog>) {
    if (catalog) setCatalog({ ...catalog, ...patch })
  }

  function openNewItem(template?: CatalogItemFormData) {
    setEditingItem(null)
    setItemForm(template ? { ...template, sort_order: items.length } : { ...EMPTY_CATALOG_ITEM, sort_order: items.length })
    setSuggestedInput(
      template?.suggested_amounts
        ? template.suggested_amounts.map((p) => String(p / 100)).join(', ')
        : '',
    )
    setPendingImageFile(null)
    setPendingImagePreview(null)
    setDrawerOpen(true)
  }

  function openEditItem(item: CatalogItem) {
    setEditingItem(item)
    setItemForm({
      title: item.title,
      description: item.description,
      image_url: item.image_url,
      item_type: item.item_type,
      action_type: item.action_type,
      amount_type: item.amount_type,
      fixed_amount: item.fixed_amount,
      suggested_amounts: item.suggested_amounts,
      external_url: item.external_url,
      manual_instructions: item.manual_instructions,
      status: item.status,
      sort_order: item.sort_order,
    })
    setSuggestedInput(
      item.suggested_amounts ? item.suggested_amounts.map((p) => String(p / 100)).join(', ') : '',
    )
    setPendingImageFile(null)
    setPendingImagePreview(null)
    setDrawerOpen(true)
  }

  function handleImageFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingImageFile(file)
    setPendingImagePreview(URL.createObjectURL(file))
  }

  function parseSuggestedAmounts(): number[] | null {
    if (!suggestedInput.trim()) return null
    return suggestedInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => Math.round(parseFloat(s) * 100))
  }

  async function saveItem() {
    setItemSaving(true)
    const payload = {
      ...itemForm,
      suggested_amounts:
        itemForm.amount_type === 'suggested' ? parseSuggestedAmounts() : null,
      fixed_amount:
        itemForm.amount_type === 'fixed' && itemForm.fixed_amount
          ? Math.round(itemForm.fixed_amount)
          : null,
    }
    try {
      if (editingItem) {
        let finalImageUrl = itemForm.image_url
        if (pendingImageFile) {
          const { image_url } = await uploadCatalogItemImage(
            eventId,
            editingItem.id,
            pendingImageFile,
          )
          finalImageUrl = image_url
        }
        const updated = await updateCatalogItem(eventId, editingItem.id, {
          ...payload,
          image_url: finalImageUrl,
        })
        setItems((prev) =>
          prev.map((i) => (i.id === updated.id ? updated : i)).sort((a, b) => a.sort_order - b.sort_order),
        )
      } else {
        const created = await createCatalogItem(eventId, payload)
        if (pendingImageFile) {
          try {
            const { image_url } = await uploadCatalogItemImage(eventId, created.id, pendingImageFile)
            const withImage = await updateCatalogItem(eventId, created.id, { image_url })
            setItems((prev) => [...prev, withImage].sort((a, b) => a.sort_order - b.sort_order))
          } catch {
            setItems((prev) => [...prev, created].sort((a, b) => a.sort_order - b.sort_order))
            showToast('Item saved, but image upload failed.', 'error')
            setDrawerOpen(false)
            return
          }
        } else {
          setItems((prev) => [...prev, created].sort((a, b) => a.sort_order - b.sort_order))
        }
      }
      setDrawerOpen(false)
      showToast('Item saved.', 'success')
    } catch {
      showToast('Failed to save item.', 'error')
    } finally {
      setItemSaving(false)
    }
  }

  async function handleReorder(reordered: CatalogItem[]) {
    setItems(reordered)
    try {
      await Promise.all(
        reordered.map((item, idx) =>
          updateCatalogItem(eventId, item.id, { sort_order: idx }),
        ),
      )
    } catch {
      showToast('Failed to save order.', 'error')
      load()
    }
  }

  async function handleDuplicate(item: CatalogItem) {
    try {
      const created = await createCatalogItem(eventId, {
        title: `${item.title} (copy)`,
        description: item.description,
        image_url: item.image_url,
        item_type: item.item_type,
        action_type: item.action_type,
        amount_type: item.amount_type,
        fixed_amount: item.fixed_amount,
        suggested_amounts: item.suggested_amounts,
        external_url: item.external_url,
        manual_instructions: item.manual_instructions,
        status: 'hidden',
        sort_order: items.length,
      })
      setItems((prev) => [...prev, created].sort((a, b) => a.sort_order - b.sort_order))
      showToast('Item duplicated as hidden draft.', 'success')
      openEditItem(created)
    } catch {
      showToast('Failed to duplicate.', 'error')
    }
  }

  async function handleDeleteItem(item: CatalogItem) {
    try {
      await deleteCatalogItem(eventId, item.id)
      setItems((prev) => prev.filter((i) => i.id !== item.id))
      showToast('Item deleted.', 'success')
    } catch {
      showToast('Failed to delete.', 'error')
    }
  }

  if (loading || !catalog) {
    return <div className="p-8 text-center text-gray-500">Loading catalog…</div>
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-eco-green">Host Catalog</h1>
        <div className="flex flex-wrap gap-2">
          {eventSlug && (
            <>
              <a href={`/catalog/${eventSlug}`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Preview
                </Button>
              </a>
            </>
          )}
          <Link href={`/host/events/${eventId}/catalog/responses`}>
            <Button variant="outline" size="sm">
              Responses ({responseCount})
            </Button>
          </Link>
        </div>
      </div>

      {eventSlug && (
        <CatalogSharingCard
          eventSlug={eventSlug}
          isPublic={isPublic}
          onCopied={(label) =>
            showToast(label, label.endsWith('copied') ? 'success' : 'error')
          }
        />
      )}

      <div className="flex gap-1 border-b border-gray-200">
        {(['items', 'settings'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab
                ? 'border-eco-green text-eco-green'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'items' ? `Items (${items.length})` : 'Settings'}
          </button>
        ))}
      </div>

      {activeTab === 'settings' && (
        <CatalogSettingsCard
          catalog={catalog}
          onCatalogChange={catalogPatchLocal}
          onSave={saveCatalogSettings}
        />
      )}

      {activeTab === 'items' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-500">Drag to reorder · {responseCount} total responses</p>
            <Button
              onClick={() => openNewItem()}
              size="sm"
              className="bg-eco-green text-white hover:bg-eco-green-dark"
            >
              <Plus className="h-4 w-4 mr-1" /> Add Item
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-gray-500 w-full">Quick add:</span>
            {CATALOG_ITEM_TEMPLATES.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => openNewItem(t.data)}
                className="text-xs px-3 py-1.5 rounded-full border border-gray-200 hover:border-eco-green hover:text-eco-green transition-colors"
              >
                {t.label}
              </button>
            ))}
          </div>

          <CatalogItemList
            items={items}
            onReorder={handleReorder}
            onEdit={openEditItem}
            onDuplicate={handleDuplicate}
            onDelete={handleDeleteItem}
          />
        </div>
      )}

      <CatalogItemDrawer
        open={drawerOpen}
        editingItem={editingItem}
        itemForm={itemForm}
        setItemForm={setItemForm}
        suggestedInput={suggestedInput}
        setSuggestedInput={setSuggestedInput}
        pendingImagePreview={pendingImagePreview}
        onImageSelect={handleImageFileSelect}
        saving={itemSaving}
        onSave={saveItem}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  )
}


