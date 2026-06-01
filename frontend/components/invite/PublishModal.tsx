'use client'

import { useState } from 'react'
import { X, Copy, Check, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { publishInvitePage } from '@/lib/invite/api'
import { logError } from '@/lib/error-handler'
import { getSiteUrl } from '@/lib/site-url'

interface PublishModalProps {
  isOpen: boolean
  onClose: () => void
  slug: string
  isPublished?: boolean  // Add this prop to track current publish status
  /** Force which flow to show. Falls back to deriving from isPublished when omitted. */
  mode?: 'publish' | 'pullback'
  onPublishChange: (isPublished: boolean) => void
  onExportImage?: () => void
}

export default function PublishModal({
  isOpen,
  onClose,
  slug,
  isPublished = false,  // Default to false
  mode,
  onPublishChange,
  onExportImage,
}: PublishModalProps) {
  const { showToast } = useToast()
  const [isPublishing, setIsPublishing] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  // Which flow to render: explicit mode wins, otherwise derive from current state.
  const showPullBackFlow = mode ? mode === 'pullback' : isPublished

  const publicUrl = `${getSiteUrl()}/invite/${slug}?source=link`

  const handlePublish = async () => {
    if (!slug) {
      showToast('Event slug not found', 'error')
      return
    }
    
    setIsPublishing(true)
    try {
      const updated = await publishInvitePage(slug, true)
      onPublishChange(true)
      showToast('Invite page published successfully!', 'success')
      onClose()
    } catch (error: any) {
      logError('Failed to publish invite page:', error)
      // Provide more specific error messages
      if (error.response?.status === 404) {
        showToast('Invite page not found. Please save your design first.', 'error')
      } else if (error.response?.status === 403 || error.response?.status === 401) {
        showToast('You do not have permission to publish this invite page.', 'error')
      } else if (error.response?.data?.error) {
        // Show backend error message if available
        showToast(error.response.data.error, 'error')
      } else if (error.message) {
        showToast(`Failed to publish: ${error.message}`, 'error')
      } else {
        showToast('Failed to publish invite page. Please try again.', 'error')
      }
    } finally {
      setIsPublishing(false)
    }
  }

  const handleUnpublish = async () => {
    if (!slug) {
      showToast('Event slug not found', 'error')
      return
    }
    
    setIsPublishing(true)
    try {
      const updated = await publishInvitePage(slug, false)
      onPublishChange(false)
      showToast('Invite pulled back — guests now see a Coming Soon page', 'success')
      onClose()
    } catch (error: any) {
      logError('Failed to unpublish invite page:', error)
      // Provide more specific error messages
      if (error.response?.status === 404) {
        showToast('Invite page not found.', 'error')
      } else if (error.response?.status === 403 || error.response?.status === 401) {
        showToast('You do not have permission to unpublish this invite page.', 'error')
      } else if (error.response?.data?.error) {
        // Show backend error message if available
        showToast(error.response.data.error, 'error')
      } else if (error.message) {
        showToast(`Failed to unpublish: ${error.message}`, 'error')
      } else {
        showToast('Failed to unpublish invite page. Please try again.', 'error')
      }
    } finally {
      setIsPublishing(false)
    }
  }

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      showToast('URL copied to clipboard!', 'success')
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      showToast('Failed to copy URL', 'error')
    }
  }

  const handleExport = () => {
    if (onExportImage) {
      onExportImage()
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="relative w-full max-w-md bg-white rounded-lg shadow-2xl p-6">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-eco-green mb-2">
              {showPullBackFlow ? 'Pull Back Invite' : 'Publish Invite Page'}
            </h2>
            <p className="text-gray-600">
              {showPullBackFlow 
                ? 'Temporarily take your invite offline'
                : 'Make your invitation page public and shareable'}
            </p>
          </div>

          {showPullBackFlow ? (
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-yellow-800 font-medium">⚠️ Pull-back Notice</p>
                <p className="text-sm text-yellow-600 mt-1">
                  Guests will see a branded “Coming Soon” page instead of your invite. Your design is kept,
                  so you can publish again anytime and it goes live instantly.
                </p>
              </div>

              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <code className="flex-1 text-sm text-gray-700 truncate">{publicUrl}</code>
                <Button
                  onClick={handleCopyUrl}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>

              <Button
                onClick={handleUnpublish}
                disabled={isPublishing}
                className="w-full bg-yellow-600 hover:bg-yellow-700 text-white"
              >
                {isPublishing ? 'Pulling back…' : '↩️ Pull back invite'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Once published, your invite page will be accessible at:
              </p>
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <code className="flex-1 text-sm text-gray-700 truncate">{publicUrl}</code>
                <Button
                  onClick={handleCopyUrl}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>

              <Button
                onClick={handlePublish}
                disabled={isPublishing}
                className="w-full bg-eco-green hover:bg-green-600 text-white"
              >
                {isPublishing ? 'Publishing...' : '🚀 Publish Now'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

