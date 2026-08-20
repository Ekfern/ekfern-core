'use client'

import React, { useId, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ImagePlus, Trash2 } from 'lucide-react'
import { GALLERY_MAX_IMAGES, type GalleryImage, type GalleryTileSettings } from '@/lib/invite/schema'
import { colorInputValue } from '@/lib/invite/colorInputValue'
import { uploadImage } from '@/lib/api'

interface GalleryTileSettingsProps {
  settings: GalleryTileSettings
  onChange: (settings: GalleryTileSettings) => void
  eventId: number
}

const newImageId = () => `img-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

export default function GalleryTileSettings({ settings, onChange, eventId }: GalleryTileSettingsProps) {
  const uid = useId()
  const fieldId = (name: string) => `gallery-${name}-${uid}`
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const images = settings.images ?? []
  const isFull = images.length >= GALLERY_MAX_IMAGES

  const update = (patch: Partial<GalleryTileSettings>) => onChange({ ...settings, ...patch })
  const setImages = (next: GalleryImage[]) => update({ images: next })

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) return

    // Take only what fits, rather than uploading files that would be discarded.
    const room = GALLERY_MAX_IMAGES - images.length
    const accepted = files.slice(0, room)

    setUploading(true)
    try {
      const uploaded: GalleryImage[] = []
      for (const file of accepted) {
        if (file.size > 5 * 1024 * 1024) {
          alert(`${file.name} is larger than 5MB and was skipped.`)
          continue
        }
        if (!file.type.startsWith('image/')) continue
        const src = await uploadImage(file, eventId)
        uploaded.push({ id: newImageId(), src })
      }
      if (uploaded.length > 0) setImages([...images, ...uploaded])
      if (files.length > room) {
        alert(`A gallery holds up to ${GALLERY_MAX_IMAGES} photos, so ${files.length - room} were not added.`)
      }
    } catch {
      alert('Failed to upload. Please try again.')
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= images.length) return
    const next = [...images]
    ;[next[index], next[target]] = [next[target]!, next[index]!]
    setImages(next)
  }

  return (
    <div className="space-y-4">
      <div>
        <span className="block text-sm font-medium">Photos</span>
        {/* A hidden input driven by a real button, which is how every other
            upload in this app is built. The gallery was the one place using a
            bare `<input type="file">` styled through Tailwind's `file:`
            pseudo-variants, and its button did not reliably open a chooser. */}
        <input
          ref={fileInputRef}
          id={fieldId('upload')}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={handleUpload}
        />
        <button
          type="button"
          disabled={uploading || isFull}
          onClick={() => fileInputRef.current?.click()}
          className="mt-1 inline-flex items-center gap-2 rounded-md bg-eco-green px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ImagePlus className="h-4 w-4" aria-hidden="true" />
          {uploading ? 'Uploading\u2026' : images.length > 0 ? 'Add more photos' : 'Choose photos'}
        </button>
        <p className="mt-1 text-xs text-gray-500">
          {uploading
            ? 'Uploading…'
            : isFull
              ? `Gallery is full — ${GALLERY_MAX_IMAGES} photos maximum. Remove one to add another.`
              : `${images.length} of ${GALLERY_MAX_IMAGES} added. JPG, PNG or WEBP, up to 5MB each.`}
        </p>
      </div>

      {images.length > 0 && (
        <ul className="space-y-2">
          {images.map((image, index) => (
            <li key={image.id} className="flex items-start gap-2 rounded-md border border-gray-200 p-2">
              <img
                src={image.src}
                alt=""
                className="h-14 w-14 shrink-0 rounded object-cover"
                loading="lazy"
              />
              <div className="min-w-0 flex-1">
                <label htmlFor={fieldId(`caption-${image.id}`)} className="sr-only">
                  Caption for photo {index + 1}
                </label>
                <input
                  id={fieldId(`caption-${image.id}`)}
                  type="text"
                  value={image.caption ?? ''}
                  onChange={(e) =>
                    setImages(images.map((candidate) =>
                      candidate.id === image.id ? { ...candidate, caption: e.target.value } : candidate,
                    ))
                  }
                  placeholder="Caption (optional)"
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                />
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label={`Move photo ${index + 1} earlier`}
                  className="rounded border border-gray-200 p-1 disabled:opacity-30"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === images.length - 1}
                  aria-label={`Move photo ${index + 1} later`}
                  className="rounded border border-gray-200 p-1 disabled:opacity-30"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setImages(images.filter((candidate) => candidate.id !== image.id))}
                aria-label={`Remove photo ${index + 1}`}
                className="shrink-0 rounded border border-gray-200 p-1 text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div>
        <label htmlFor={fieldId('arrangement')} className="block text-sm font-medium">
          Arrangement
        </label>
        <select
          id={fieldId('arrangement')}
          value={settings.arrangement ?? 'stacked'}
          onChange={(e) => update({ arrangement: e.target.value as GalleryTileSettings['arrangement'] })}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="stacked">Stacked &mdash; one photo at a time, as guests scroll</option>
          <option value="grid">Grid &mdash; all of them at once</option>
        </select>
        <p className="mt-1 text-xs text-gray-500">
          Stacked gives each photo its own moment and reads as prints laid down; grid shows the
          whole set without scrolling. Both stay centred.
        </p>
      </div>

      <div>
        <label htmlFor={fieldId('frame')} className="block text-sm font-medium">
          Frame
        </label>
        <select
          id={fieldId('frame')}
          value={settings.frame ?? 'none'}
          onChange={(e) => update({ frame: e.target.value as GalleryTileSettings['frame'] })}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="none">Frameless</option>
          <option value="simple">Simple photo frame</option>
          <option value="polaroid">Polaroid</option>
        </select>
        <p className="mt-1 text-xs text-gray-500">Applied to every photo in this gallery.</p>
      </div>

      {settings.frame === 'simple' && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor={fieldId('frame-color')} className="block text-sm font-medium">
              Frame colour
            </label>
            <input
              id={fieldId('frame-color')}
              type="color"
              value={colorInputValue(settings.frameColor, '#D9CFC0')}
              onChange={(e) => update({ frameColor: e.target.value })}
              className="mt-1 h-9 w-full rounded border border-gray-300"
            />
          </div>
          <div>
            <label htmlFor={fieldId('frame-width')} className="block text-sm font-medium">
              Frame width
            </label>
            <input
              id={fieldId('frame-width')}
              type="range"
              min={2}
              max={16}
              value={settings.frameWidth ?? 6}
              onChange={(e) => update({ frameWidth: Number(e.target.value) })}
              className="mt-2 w-full"
            />
          </div>
        </div>
      )}

      <details className="rounded-md border border-gray-200 p-3">
        <summary className="cursor-pointer text-sm font-medium">Appearance</summary>
        <div className="mt-3 space-y-4">
          <div>
            <label htmlFor={fieldId('spacing')} className="block text-sm font-medium">
              Spacing
            </label>
            <select
              id={fieldId('spacing')}
              value={settings.spacing ?? 'normal'}
              onChange={(e) => update({ spacing: e.target.value as GalleryTileSettings['spacing'] })}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="tight">Tight</option>
              <option value="normal">Normal</option>
              <option value="spacious">Spacious</option>
            </select>
          </div>

          <div>
            <label htmlFor={fieldId('shadow')} className="block text-sm font-medium">
              Shadow
            </label>
            <select
              id={fieldId('shadow')}
              value={settings.shadow ?? 'sm'}
              onChange={(e) => update({ shadow: e.target.value as GalleryTileSettings['shadow'] })}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              {(['none', 'sm', 'md', 'lg', 'xl'] as const).map((value) => (
                <option key={value} value={value}>
                  {value === 'none' ? 'None' : value.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {settings.frame !== 'polaroid' && (
            <div>
              <label htmlFor={fieldId('radius')} className="block text-sm font-medium">
                Corner radius
              </label>
              <input
                id={fieldId('radius')}
                type="range"
                min={0}
                max={24}
                value={settings.cornerRadius ?? 8}
                onChange={(e) => update({ cornerRadius: Number(e.target.value) })}
                className="mt-1 w-full"
              />
              <p className="text-xs text-gray-500">{settings.cornerRadius ?? 8}px</p>
            </div>
          )}
        </div>
      </details>
    </div>
  )
}
