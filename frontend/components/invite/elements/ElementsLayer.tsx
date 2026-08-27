'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { InviteElement } from '@/lib/invite/schema'

interface ElementsLayerProps {
  elements?: InviteElement[] | null
}

type ParticleType = 'strip' | 'square' | 'diamond' | 'circle' | 'ribbon'

interface Particle {
  id: number
  type: ParticleType
  x: number
  burstX: number
  fallX: number
  fallY: number
  size: number
  rotation: number
  rotation2: number
  duration: number
  delay: number
  color: string
}

const COLORS = [
  '#E85D75',
  '#F4B942',
  '#4ECDC4',
  '#7C5CFC',
  '#5B8DEF',
  '#F28C28',
]

function createParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, id) => {
    const random = (seed: number) => {
      const value = Math.sin((id + 1) * seed) * 43758.5453
      return value - Math.floor(value)
    }

    const types: ParticleType[] = [
      'strip',
      'strip',
      'square',
      'diamond',
      'circle',
      'ribbon',
    ]

    return {
      id,
      type: types[id % types.length],
      x: 38 + random(12) * 24,
      burstX: -180 + random(17) * 360,
      fallX: -240 + random(23) * 480,
      fallY: 500 + random(31) * 500,
      size: 5 + random(37) * 8,
      rotation: -180 + random(41) * 360,
      rotation2: -360 + random(47) * 720,
      duration: 2.8 + random(53) * 1.6,
      delay: random(59) * 0.35,
      color: COLORS[id % COLORS.length],
    }
  })
}

function ParticleShape({ particle }: { particle: Particle }) {
  const { type, size, color } = particle

  if (type === 'circle') {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: color,
        }}
      />
    )
  }

  if (type === 'diamond') {
    return (
      <div
        style={{
          width: size,
          height: size,
          background: color,
          transform: 'rotate(45deg)',
          borderRadius: 1,
        }}
      />
    )
  }

  if (type === 'ribbon') {
    return (
      <svg
        width={size * 2.2}
        height={size * 5}
        viewBox="0 0 24 55"
        fill="none"
      >
        <path
          d="M5 2C20 12 3 22 18 32C29 39 9 48 14 53"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  if (type === 'square') {
    return (
      <div
        style={{
          width: size,
          height: size,
          background: color,
          borderRadius: 2,
        }}
      />
    )
  }

  return (
    <div
      style={{
        width: Math.max(4, size * 0.55),
        height: size * 1.8,
        background: color,
        borderRadius: 2,
      }}
    />
  )
}

function PartyPopperAnimation() {
  const particles = useMemo(() => createParticles(48), [])

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute"
          style={{
            left: `${particle.x}%`,
            top: '4%',
            transformOrigin: 'center center',
          }}
          initial={{
            x: 0,
            y: 0,
            opacity: 0,
            scale: 0.35,
            rotate: 0,
          }}
          animate={{
            x: [
              0,
              particle.burstX,
              particle.fallX,
            ],
            y: [
              0,
              -70,
              particle.fallY,
            ],
            opacity: [
              0,
              1,
              1,
              0,
            ],
            scale: [
              0.35,
              1,
              0.95,
              0.8,
            ],
            rotate: [
              0,
              particle.rotation,
              particle.rotation2,
            ],
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            ease: 'easeOut',
            times: [0, 0.14, 0.72, 1],
          }}
        >
          <ParticleShape particle={particle} />
        </motion.div>
      ))}
    </div>
  )
}

export default function ElementsLayer({
  elements = [],
}: ElementsLayerProps) {
  const [hasTriggered, setHasTriggered] = useState(false)
  const triggerRef = useRef<HTMLDivElement | null>(null)

  const enabledElements = (elements ?? []).filter(
    (element) => element.enabled
  )

  const partyPopper = enabledElements.find(
    (element) =>
      element.type === 'party-popper' &&
      element.animation === 'pop'
  )

  useEffect(() => {
    if (!partyPopper || hasTriggered) {
      return
    }

    const handleScroll = () => {
      setHasTriggered(true)
      window.removeEventListener('scroll', handleScroll)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [partyPopper, hasTriggered])

  if (!partyPopper) {
    return null
  }

  return (
    <div
      ref={triggerRef}
      className="absolute inset-0 pointer-events-none overflow-hidden z-20"
      aria-hidden="true"
    >
      {hasTriggered && <PartyPopperAnimation />}
    </div>
  )
}