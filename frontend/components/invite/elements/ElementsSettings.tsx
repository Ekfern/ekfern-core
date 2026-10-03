'use client'

import React, { useState } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Sparkles,
  PartyPopper,
  Plus,
  X,
  Leaf,
  Lamp,
  Star,
  Heart,
} from 'lucide-react'
import {
  InviteElement,
  InviteElementAnimation,
  InviteElementPlacement,
  InviteLampType,
} from '@/lib/invite/schema'

interface ElementsSettingsProps {
  elements?: InviteElement[] | null
  onAddElement?: (element: InviteElement) => void
}

export default function ElementsSettings({
  elements = [],
  onAddElement,
}: ElementsSettingsProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [showLampOptions, setShowLampOptions] = useState(false)
  const [placement, setPlacement] =
    useState<InviteElementPlacement>('whole-page')
  const [animation, setAnimation] =
    useState<InviteElementAnimation>('pop')
  const [lampType, setLampType] =
    useState<InviteLampType>('candle')

  const safeElements = elements ?? []

  const handleAddPartyPopper = () => {
    const element: InviteElement = {
      id: `party-popper-${Date.now()}`,
      type: 'party-popper',
      placement,
      animation,
      enabled: true,
    }

    onAddElement?.(element)
    setShowPicker(false)
  }
  const handleAddSpiritual = () => {
    const element: InviteElement = {
      id: `spiritual-${Date.now()}`,
      type: 'spiritual',
      placement,
      animation: 'continuous-fall',
      enabled: true,
    }

    onAddElement?.(element)
    setShowPicker(false)
  }
  const handleAddLamp = (selectedLampType: InviteLampType) => {
    const defaultPosition =
      selectedLampType === 'hanging-samai'
        ? { x: 50, y: 8 }
        : selectedLampType === 'diya'
          ? { x: 88, y: 82 }
          : { x: 90, y: 80 }

    const element: InviteElement = {
      id: `lamp-${selectedLampType}-${Date.now()}`,
      type: 'lamp',
      placement:
        selectedLampType === 'hanging-samai'
          ? 'top'
          : placement,
      animation:
        selectedLampType === 'hanging-samai'
          ? 'swing'
          : selectedLampType === 'diya'
            ? 'glow'
            : 'flicker',
      enabled: true,
      lampType: selectedLampType,
      position: defaultPosition,
    }

    onAddElement?.(element)
    setShowPicker(false)
  }

  const handleAddFallingStars = () => {
    const element: InviteElement = {
      id: `falling-stars-${Date.now()}`,
      type: 'falling-stars',
      placement: 'whole-page',
      animation: 'continuous-fall',
      enabled: true,
    }

    onAddElement?.(element)
    setShowPicker(false)
  }

  const handleAddLoveBurst = () => {
    const element: InviteElement = {
      id: `love-burst-${Date.now()}`,
      type: 'love-burst',
      placement: 'whole-page',
      animation: 'heart-burst',
      enabled: true,
    }

    onAddElement?.(element)
    setShowPicker(false)
  }

  return (
    <div className="border rounded-lg w-full overflow-x-hidden bg-white border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-eco-green flex-shrink-0" />

          <div className="min-w-0">
            <h3 className="font-semibold text-sm sm:text-base text-gray-800 truncate">
              Elements
            </h3>

            <p className="text-xs text-gray-500 mt-0.5">
              Decorative elements for your invitation
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 hover:bg-gray-100 rounded flex-shrink-0"
          aria-label={isExpanded ? 'Collapse elements' : 'Expand elements'}
        >
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5" />
          ) : (
            <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />
          )}
        </button>
      </div>

      {isExpanded && (
        <div className="p-3 sm:p-4 w-full overflow-x-hidden">
          {/* Existing elements */}
          {safeElements.length > 0 && (
            <div className="space-y-2 mb-4">
              {safeElements.map((element) => (
                <div
                  key={element.id}
                  className="border border-gray-200 rounded-lg p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-md bg-eco-green-light/20 flex items-center justify-center">
                      {element.type === 'spiritual' ? (
                        <Leaf className="w-5 h-5 text-eco-green" />
                      ) : (
                        <PartyPopper className="w-5 h-5 text-eco-green" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800">
                        {element.type === 'spiritual' ? 'Spiritual' : 'Party Popper'}
                      </p>

                      <p className="text-xs text-gray-500">
                        {element.placement === 'whole-page'
                          ? 'Whole Page'
                          : element.placement}
                        {' · '}
                        {element.animation === 'pop'
                          ? 'Pop'
                          : element.animation === 'continuous-fall'
                            ? 'Continuous Fall'
                            : element.animation}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!showPicker ? (
            <>
              <p className="text-sm text-gray-600 mb-3">
                Add decorative elements and animations to your invitation.
              </p>

              <button
                type="button"
                onClick={() => setShowPicker(true)}
                className="w-full flex items-center justify-center gap-2 border border-dashed border-eco-green rounded-lg px-4 py-3 text-sm font-medium text-eco-green hover:bg-eco-green-light/20 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add element
              </button>
            </>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Picker header */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50">
                <span className="text-sm font-medium text-gray-700">
                  Add an element
                </span>

                <button
                  type="button"
                  onClick={() => setShowPicker(false)}
                  className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600"
                  aria-label="Close element picker"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3">
                {/* Party Popper */}
                <button
                  type="button"
                  onClick={handleAddPartyPopper}
                  className="w-full flex items-center gap-3 border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-md bg-eco-green-light/20 flex items-center justify-center">
                    <PartyPopper className="w-5 h-5 text-eco-green" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800">
                      Party Popper
                    </p>

                    <p className="text-xs text-gray-500 mt-0.5">
                      Celebration decoration
                    </p>
                  </div>
                </button>

                {/* Spiritual */}
                <button
                  type="button"
                  onClick={handleAddSpiritual}
                  className="w-full mt-2 flex items-center gap-3 border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-md bg-eco-green-light/20 flex items-center justify-center">
                    <Leaf className="w-5 h-5 text-eco-green" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800">
                      Spiritual
                    </p>

                    <p className="text-xs text-gray-500 mt-0.5">
                      Flowers, leaves and peaceful falling elements
                    </p>
                  </div>
                </button>
                {/* Lamp */}
                <button
                  type="button"
                  onClick={() => setShowLampOptions(!showLampOptions)}
                  className="w-full mt-2 flex items-center gap-3 border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-md bg-eco-green-light/20 flex items-center justify-center">
                    <Lamp className="w-5 h-5 text-eco-green" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800">
                      Lamp
                    </p>

                    <p className="text-xs text-gray-500 mt-0.5">
                      Divine light and peaceful ambience
                    </p>
                  </div>

                  {showLampOptions ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </button>
                {showLampOptions && (
                  <div className="mt-2 ml-3 space-y-2">
                    {/* Candle */}
                    <button
                      type="button"
                      onClick={() => handleAddLamp('candle')}
                      className="w-full flex items-center gap-3 border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="w-9 h-9 rounded-md bg-amber-50 flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-amber-600" />
                      </div>

                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          Candle
                        </p>
                        <p className="text-xs text-gray-500">
                          Gentle flickering flame
                        </p>
                      </div>
                    </button>

                    {/* Diya */}
                    <button
                      type="button"
                      onClick={() => handleAddLamp('diya')}
                      className="w-full flex items-center gap-3 border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="w-9 h-9 rounded-md bg-amber-50 flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-amber-600" />
                      </div>

                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          Diya
                        </p>
                        <p className="text-xs text-gray-500">
                          Traditional diya with warm glow
                        </p>
                      </div>
                    </button>

                    {/* Hanging Samai */}
                    <button
                      type="button"

                      onClick={() => handleAddLamp('hanging-samai')}
                      className="w-full flex items-center gap-3 border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="w-9 h-9 rounded-md bg-amber-50 flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-amber-600" />
                      </div>

                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          Hanging Samai
                        </p>
                        <p className="text-xs text-gray-500">
                          Traditional hanging samai with gentle glow
                        </p>
                      </div>
                    </button>
                  </div>
                )}

                {/* Falling Stars */}
                <button
                  type="button"
                  onClick={handleAddFallingStars}
                  className="w-full mt-2 flex items-center gap-3 border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-md bg-eco-green-light/20 flex items-center justify-center">
                    <Star className="w-5 h-5 text-eco-green" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800">
                      Falling Stars
                    </p>

                    <p className="text-xs text-gray-500 mt-0.5">
                      Magical falling stars across the page
                    </p>
                  </div>
                </button>
                {/* Love Burst */}
                <button
                  type="button"
                  onClick={handleAddLoveBurst}
                  className="w-full mt-2 flex items-center gap-3 border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-md bg-rose-50 flex items-center justify-center">
                    <Heart className="w-5 h-5 text-rose-500" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800">
                      Love Burst
                    </p>

                    <p className="text-xs text-gray-500 mt-0.5">
                      Romantic heart burst with rose petals
                    </p>
                  </div>
                </button>

                {/* Placement */}
                <div className="mt-4">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Placement
                  </label>

                  <select
                    value={placement}
                    onChange={(e) =>
                      setPlacement(
                        e.target.value as InviteElementPlacement
                      )
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                  >
                    <option value="whole-page">Whole Page</option>
                    <option value="top">Top</option>
                    <option value="bottom">Bottom</option>
                    <option value="corners">Corners</option>
                  </select>
                </div>

                {/* Animation */}
                <div className="mt-3">
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Animation
                  </label>

                  <select
                    value={animation}
                    onChange={(e) =>
                      setAnimation(
                        e.target.value as InviteElementAnimation
                      )
                    }
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
                  >
                    <option value="pop">Pop</option>
                    <option value="none">None</option>
                  </select>
                </div>

                {/* Add */}
                <button
                  type="button"
                  onClick={handleAddPartyPopper}
                  className="w-full mt-4 flex items-center justify-center gap-2 rounded-md bg-eco-green px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
                >
                  <Plus className="w-4 h-4" />
                  Add Party Popper
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}