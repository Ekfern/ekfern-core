'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Maximize2 } from 'lucide-react'
import RichTextEditor, { type RichTextEditorRef } from '@/components/invite/RichTextEditor'
import DescriptionEditorModal from '@/components/invite/DescriptionEditorModal'
import { Button } from '@/components/ui/button'

export function CatalogIntroEditor({
  value,
  onChange,
  onSave,
}: {
  value: string
  onChange: (html: string) => void
  onSave: (html: string) => void
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const editorRef = useRef<RichTextEditorRef>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFirstRender = useRef(true)
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => onSaveRef.current(value), 1000)
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [value])

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-gray-700">Intro message</label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setModalOpen(true)}
          className="text-xs border-eco-green text-eco-green hover:bg-eco-green hover:text-white"
        >
          <Maximize2 className="h-3 w-3 mr-1" />
          Full Screen Editor
        </Button>
      </div>
      <RichTextEditor
        ref={editorRef}
        value={value}
        onChange={onChange}
        placeholder="Celebrate with us by contributing to something meaningful."
      />
      <p className="text-xs text-gray-500 mt-2">
        Use the toolbar to format text and add links. Click &quot;Full Screen Editor&quot; for a
        larger editing area.
      </p>
      <DescriptionEditorModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false)
          onSave(value)
        }}
        value={value}
        onChange={onChange}
        placeholder="Write an intro message for your catalog…"
      />
    </div>
  )
}
