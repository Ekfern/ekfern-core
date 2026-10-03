'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { InviteElement } from '@/lib/invite/schema'

interface ElementsLayerProps {
  elements?: InviteElement[] | null
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>
}

type ParticleType =
  | 'strip'
  | 'square'
  | 'diamond'
  | 'circle'
  | 'ribbon'
  | 'petal'
type SpiritualType =
  | 'flower'
  | 'petal'
  | 'leaf'
  | 'sparkle'

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
      'petal',
      'petal',
      'petal',
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
  if (type === 'petal') {
    return (
      <svg
        width={size * 1.6}
        height={size * 2}
        viewBox="0 0 20 24"
        fill="none"
      >
        <path
          d="M10 1C16 4 20 9 17 15C14 21 8 24 3 22C1 15 3 7 10 1Z"
          fill={color}
          opacity="0.9"
        />
      </svg>
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
function SpiritualShape({
  type,
  size,
}: {
  type: SpiritualType
  size: number
}) {
  if (type === 'flower') {
    return (
      <svg
        width={size * 2}
        height={size * 2}
        viewBox="0 0 40 40"
        fill="none"
      >
        <circle cx="20" cy="10" r="8" fill="#F6B6C1" opacity="0.8" />
        <circle cx="30" cy="20" r="8" fill="#F4A6B5" opacity="0.8" />
        <circle cx="20" cy="30" r="8" fill="#F6B6C1" opacity="0.8" />
        <circle cx="10" cy="20" r="8" fill="#F4A6B5" opacity="0.8" />
        <circle cx="20" cy="20" r="5" fill="#E9A93A" />
      </svg>
    )
  }

  if (type === 'leaf') {
    return (
      <svg
        width={size * 1.5}
        height={size * 2.2}
        viewBox="0 0 30 44"
        fill="none"
      >
        <path
          d="M15 2C28 9 30 23 22 34C18 40 11 43 5 42C3 32 5 22 11 14C14 10 15 6 15 2Z"
          fill="#6F9B62"
          opacity="0.8"
        />
        <path
          d="M15 6C14 17 13 28 8 38"
          stroke="#4F7747"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.7"
        />
      </svg>
    )
  }

  if (type === 'sparkle') {
    return (
      <svg
        width={size * 1.5}
        height={size * 1.5}
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          d="M12 1L14.5 9.5L23 12L14.5 14.5L12 23L9.5 14.5L1 12L9.5 9.5L12 1Z"
          fill="#D4A84F"
          opacity="0.65"
        />
      </svg>
    )
  }

  return (
    <svg
      width={size * 1.5}
      height={size * 2}
      viewBox="0 0 20 28"
      fill="none"
    >
      <path
        d="M10 1C16 4 19 10 16 17C14 22 9 26 4 27C2 20 3 13 6 8C7 5 9 3 10 1Z"
        fill="#E7A4B3"
        opacity="0.75"
      />
    </svg>
  )
}
function SpiritualFallAnimation() {
  const particles = useMemo(
    () =>
      Array.from({ length: 70 }, (_, id) => {
        const random = (seed: number) => {
          const value = Math.sin((id + 1) * seed) * 43758.5453
          return value - Math.floor(value)
        }

        const types: SpiritualType[] = [
          'flower',
          'leaf',
          'petal',
          'leaf',
          'flower',
          'sparkle',
        ]

        return {
          id,
          type: types[id % types.length],
          x: random(11) * 100,
          size: 7 + random(17) * 9,
          duration: 7 + random(23) * 4,
          delay: random(31) * 7,
          drift: -70 + random(41) * 140,
          rotation: -180 + random(53) * 360,
        }
      }),
    []
  )

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute"
          style={{
            left: `${particle.x}%`,
            top: '-8%',
          }}
          initial={{
            y: '-10vh',
            x: 0,
            rotate: 0,
            opacity: 0,
          }}
          animate={{
            y: '115vh',
            x: [0, particle.drift, particle.drift * -0.6, 0],
            rotate: [
              0,
              particle.rotation,
              particle.rotation * -0.7,
              particle.rotation,
            ],
            opacity: [0, 0.85, 0.8, 0],
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            repeat: Infinity,
            ease: 'linear',
            x: {
              duration: particle.duration,
              repeat: Infinity,
              ease: 'easeInOut',
            },
            rotate: {
              duration: particle.duration,
              repeat: Infinity,
              ease: 'easeInOut',
            },
            opacity: {
              duration: particle.duration,
              repeat: Infinity,
              ease: 'easeInOut',
            },
          }}
        >
          <SpiritualShape
            type={particle.type}
            size={particle.size}
          />
        </motion.div>
      ))}
    </div>
  )
}

function FallingStarsAnimation() {
  const stars = useMemo(
    () =>
      Array.from({ length: 24 }, (_, id) => {
        const random = (seed: number) => {
          const value = Math.sin((id + 1) * seed) * 43758.5453
          return value - Math.floor(value)
        }

        return {
          id,
          startX: random(11) * 120 - 10,
          startY: random(17) * 70,
          distance: 180 + random(23) * 220,
          duration: 2.5 + random(31) * 2,
          delay: random(41) * 5,
          size: 2 + random(53) * 3,
          angle: 25 + random(61) * 20,
        }
      }),
    []
  )

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {stars.map((star) => (
        <motion.div
          key={star.id}
          className="absolute"
          style={{
            left: `${star.startX}%`,
            top: `${star.startY}%`,
            width: star.size,
            height: star.size,
            borderRadius: '50%',
            background: '#FFF4C2',
            boxShadow:
              '0 0 6px rgba(255, 220, 120, 0.9), 0 0 14px rgba(255, 190, 70, 0.55)',
          }}
          initial={{
            x: 0,
            y: 0,
            opacity: 0,
            scale: 0.4,
          }}
          animate={{
            x: star.distance,
            y: star.distance * Math.tan((star.angle * Math.PI) / 180),
            opacity: [0, 1, 1, 0],
            scale: [0.4, 1, 1.1, 0.5],
          }}
          transition={{
            duration: star.duration,
            delay: star.delay,
            repeat: Infinity,
            repeatDelay: 1.5 + star.delay,
            ease: 'easeIn',
            opacity: {
              duration: star.duration,
              delay: star.delay,
              repeat: Infinity,
              repeatDelay: 1.5 + star.delay,
              times: [0, 0.12, 0.72, 1],
            },
            scale: {
              duration: star.duration,
              delay: star.delay,
              repeat: Infinity,
              repeatDelay: 1.5 + star.delay,
              times: [0, 0.12, 0.72, 1],
            },
          }}
        >
          {/* Shooting-star trail */}
          <motion.div
            className="absolute"
            style={{
              width: 70,
              height: 2,
              right: 2,
              top: '50%',
              transform: 'translateY(-50%) rotate(180deg)',
              transformOrigin: 'right center',
              background:
                'linear-gradient(to right, transparent, rgba(255,220,120,0.55), rgba(255,244,194,0.9))',
              filter: 'blur(0.5px)',
            }}
            animate={{
              opacity: [0, 0.8, 0],
              scaleX: [0.2, 1, 0.3],
            }}
            transition={{
              duration: star.duration,
              delay: star.delay,
              repeat: Infinity,
              repeatDelay: 1.5 + star.delay,
              ease: 'easeOut',
            }}
          />
        </motion.div>
      ))}
    </div>
  )
}
function LoveBurstAnimation({
  hasTriggered,
  anchorPosition,
}: {
  hasTriggered: boolean
  anchorPosition: {
    left: number
    top: number
  } | null
}) {
  const burstStyle = anchorPosition
    ? {
      left: anchorPosition.left,
      top: anchorPosition.top,
    }
    : {
      left: '50%',
      top: '8%',
    }
  const burstParticles = useMemo(
    () =>
      Array.from({ length: 42 }, (_, id) => {
        const random = (seed: number) => {
          const value = Math.sin((id + 1) * seed) * 43758.5453
          return value - Math.floor(value)
        }

        const angle = random(17) * Math.PI * 2
        const distance = 120 + random(31) * 180

        return {
          id,
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance,
          size: 5 + random(23) * 9,
          delay: random(41) * 0.16,
          rotation: -180 + random(53) * 360,
          type:
            id % 5 === 0
              ? 'heart'
              : id % 7 === 0
                ? 'sparkle'
                : 'petal',
        }
      }),
    []
  )

  const petals = useMemo(
    () =>
      Array.from({ length: 28 }, (_, id) => {
        const random = (seed: number) => {
          const value = Math.sin((id + 1) * seed) * 43758.5453
          return value - Math.floor(value)
        }

        return {
          id,
          x: random(13) * 100,
          drift: -70 + random(19) * 140,
          size: 8 + random(29) * 10,
          duration: 7 + random(37) * 5,
          delay: random(43) * 6,
          rotation: -220 + random(53) * 440,
        }
      }),
    []
  )

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">

      {/* ========================================================= */}
      {/* INITIAL HEART                                             */}
      {/* ========================================================= */}

      {!hasTriggered && (
        <motion.div
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={burstStyle}
          initial={{
            opacity: 0,
            scale: 0.7,
          }}
          animate={{
            opacity: [0.8, 1, 0.85, 1, 0.8],
            scale: [0.94, 1.05, 0.97, 1.06, 0.94],
            y: [0, -5, 0, -4, 0],
          }}
          transition={{
            duration: 2.8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          {/* Soft outer glow */}
          <motion.div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            animate={{
              scale: [0.9, 1.25, 0.9],
              opacity: [0.25, 0.45, 0.25],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            style={{
              width: 120,
              height: 120,
              background:
                'radial-gradient(circle, rgba(244,63,94,0.35) 0%, rgba(244,63,94,0.08) 45%, transparent 72%)',
              filter: 'blur(6px)',
            }}
          />

          {/* Heart */}
          <svg
            width="88"
            height="88"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            style={{
              filter:
                'drop-shadow(0 0 8px rgba(217,79,112,0.55)) drop-shadow(0 0 18px rgba(244,63,94,0.28))',
            }}
          >
            <defs>
              <linearGradient
                id="loveHeartGradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#F43F5E" />
                <stop offset="45%" stopColor="#E11D48" />
                <stop offset="100%" stopColor="#BE123C" />
              </linearGradient>
            </defs>

            <path
              fill="url(#loveHeartGradient)"
              d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5
                C2 5.42 4.42 3 7.5 3
                c1.74 0 3.41.81 4.5 2.09
                C13.09 3.81 14.76 3 16.5 3
                C19.58 3 22 5.42 22 8.5
                c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
            />

            {/* Highlight */}
            <path
              d="M6.2 7.2c.5-1.25 1.6-1.9 2.8-1.9"
              fill="none"
              stroke="rgba(255,255,255,0.75)"
              strokeWidth="0.8"
              strokeLinecap="round"
            />
          </svg>
        </motion.div>
      )}

      {/* ========================================================= */}
      {/* BIG HEART BURST                                           */}
      {/* ========================================================= */}

      {hasTriggered && (
        <>
          {/* Expanding glow */}
          <motion.div
            className="absolute left-1/2 top-[8%] -translate-x-1/2 -translate-y-1/2 rounded-full"
            initial={{
              width: 40,
              height: 40,
              opacity: 0.8,
            }}
            animate={{
              width: [40, 180, 420, 650],
              height: [40, 180, 420, 650],
              opacity: [0.8, 0.6, 0.2, 0],
            }}
            transition={{
              duration: 1.15,
              ease: 'easeOut',
            }}
            style={{
              background:
                'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(244,63,94,0.4) 15%, rgba(244,63,94,0.12) 40%, transparent 70%)',
              filter: 'blur(4px)',
            }}
          />

          {/* Shockwave ring */}
          <motion.div
            className="absolute left-1/2 top-[8%] -translate-x-1/2 -translate-y-1/2 rounded-full"
            initial={{
              width: 50,
              height: 50,
              opacity: 0.9,
              borderWidth: 3,
            }}
            animate={{
              width: 500,
              height: 500,
              opacity: 0,
              borderWidth: 1,
            }}
            transition={{
              duration: 1.05,
              ease: 'easeOut',
            }}
            style={{
              borderStyle: 'solid',
              borderColor: 'rgba(244,63,94,0.7)',
              boxShadow:
                '0 0 25px rgba(244,63,94,0.35)',
            }}
          />

          {/* Second softer ring */}
          <motion.div
            className="absolute left-1/2 top-[8%] -translate-x-1/2 -translate-y-1/2 rounded-full"
            initial={{
              width: 70,
              height: 70,
              opacity: 0.7,
            }}
            animate={{
              width: 700,
              height: 700,
              opacity: 0,
            }}
            transition={{
              duration: 1.35,
              delay: 0.08,
              ease: 'easeOut',
            }}
            style={{
              border: '1px solid rgba(255,180,195,0.55)',
            }}
          />

          {/* Main heart expanding before disappearing */}
          <motion.div
            className="absolute left-1/2 top-[8%] -translate-x-1/2 -translate-y-1/2"
            initial={{
              scale: 0.9,
              opacity: 1,
            }}
            animate={{
              scale: [0.9, 1.15, 1.5, 2.8],
              opacity: [1, 1, 0.85, 0],
            }}
            transition={{
              duration: 0.9,
              ease: [0.2, 0.8, 0.2, 1],
            }}
          >
            <svg
              width="88"
              height="88"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              style={{
                filter:
                  'drop-shadow(0 0 10px rgba(244,63,94,0.8)) drop-shadow(0 0 25px rgba(244,63,94,0.45))',
              }}
            >
              <defs>
                <linearGradient
                  id="burstHeartGradient"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#FF6B81" />
                  <stop offset="45%" stopColor="#E11D48" />
                  <stop offset="100%" stopColor="#9F1239" />
                </linearGradient>
              </defs>

              <path
                fill="url(#burstHeartGradient)"
                d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5
                  C2 5.42 4.42 3 7.5 3
                  c1.74 0 3.41.81 4.5 2.09
                  C13.09 3.81 14.76 3 16.5 3
                  C19.58 3 22 5.42 22 8.5
                  c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
              />
            </svg>
          </motion.div>

          {/* ===================================================== */}
          {/* RADIAL BURST PARTICLES                                */}
          {/* ===================================================== */}

          {burstParticles.map((particle) => (
            <motion.div
              key={particle.id}
              className="absolute left-1/2 top-[8%]"
              style={{
                transformOrigin: 'center',
              }}
              initial={{
                x: 0,
                y: 0,
                opacity: 0,
                scale: 0.1,
                rotate: 0,
              }}
              animate={{
                x: particle.x,
                y: particle.y,
                opacity: [0, 1, 1, 0],
                scale: [0.1, 1.2, 0.85, 0.2],
                rotate: particle.rotation,
              }}
              transition={{
                duration: 1.25,
                delay: particle.delay,
                ease: [0.15, 0.75, 0.25, 1],
              }}
            >
              {particle.type === 'heart' ? (
                <svg
                  width={particle.size * 2}
                  height={particle.size * 2}
                  viewBox="0 0 24 24"
                  fill="#E11D48"
                  xmlns="http://www.w3.org/2000/svg"
                  style={{
                    filter:
                      'drop-shadow(0 0 5px rgba(244,63,94,0.55))',
                  }}
                >
                  <path
                    d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5
                      C2 5.42 4.42 3 7.5 3
                      c1.74 0 3.41.81 4.5 2.09
                      C13.09 3.81 14.76 3 16.5 3
                      C19.58 3 22 5.42 22 8.5
                      c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                  />
                </svg>
              ) : particle.type === 'sparkle' ? (
                <div
                  style={{
                    width: particle.size,
                    height: particle.size,
                    borderRadius: '50%',
                    background: '#FFFFFF',
                    boxShadow:
                      '0 0 7px rgba(255,255,255,0.95), 0 0 15px rgba(244,63,94,0.7)',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: particle.size,
                    height: particle.size * 1.55,
                    background:
                      particle.id % 3 === 0
                        ? '#F28FA5'
                        : '#D94F70',
                    borderRadius: '70% 30% 70% 30%',
                    opacity: 0.9,
                    transform: 'rotate(35deg)',
                    boxShadow:
                      '0 1px 5px rgba(190,18,60,0.25)',
                  }}
                />
              )}
            </motion.div>
          ))}

          {/* ===================================================== */}
          {/* CONTINUOUS FALLING ROSE PETALS                        */}
          {/* ===================================================== */}

          {petals.map((petal) => (
            <motion.div
              key={`falling-${petal.id}`}
              className="absolute"
              style={{
                left: `${petal.x}%`,
                top: '-5%',
              }}
              initial={{
                y: -30,
                x: 0,
                opacity: 0,
                rotate: 0,
              }}
              animate={{
                y: '110vh',
                x: [
                  0,
                  petal.drift,
                  petal.drift * -0.6,
                  petal.drift,
                ],
                opacity: [0, 0.75, 0.8, 0],
                rotate: [
                  0,
                  petal.rotation,
                  petal.rotation * -0.5,
                  petal.rotation,
                ],
              }}
              transition={{
                duration: petal.duration,
                delay: petal.delay,
                repeat: Infinity,
                ease: 'linear',
              }}
            >
              <div
                style={{
                  width: petal.size,
                  height: petal.size * 1.5,
                  background:
                    petal.id % 4 === 0
                      ? '#C93652'
                      : petal.id % 3 === 0
                        ? '#F28FA5'
                        : '#D94F70',
                  borderRadius: '70% 30% 70% 30%',
                  opacity: 0.75,
                  transform: 'rotate(35deg)',
                  boxShadow:
                    '0 1px 5px rgba(190,18,60,0.18)',
                }}
              />
            </motion.div>
          ))}
        </>
      )}
    </div>
  )
}

function PartyPopperAnimation() {
  const particles = useMemo(() => createParticles(120), [])

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((particle) => {
        const isPetal = particle.type === 'petal'

        return (
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
              x: isPetal
                ? [0, particle.burstX * 0.7, particle.fallX * 1.25]
                : [0, particle.burstX, particle.fallX],

              y: isPetal
                ? [0, -45, particle.fallY]
                : [0, -70, particle.fallY],

              opacity: [
                0,
                1,
                1,
                0,
              ],

              scale: isPetal
                ? [0.35, 1, 0.95, 0.8]
                : [0.35, 1, 0.95, 0.8],

              rotate: isPetal
                ? [
                  0,
                  particle.rotation * 0.5,
                  particle.rotation2 * 1.5,
                ]
                : [
                  0,
                  particle.rotation,
                  particle.rotation2,
                ],
            }}

            transition={{
              duration: isPetal
                ? particle.duration + 0.8
                : particle.duration,
              delay: particle.delay,
              ease: isPetal ? 'easeInOut' : 'easeOut',
              times: [0, 0.14, 0.72, 1],
            }}
          >
            <ParticleShape particle={particle} />

          </motion.div>
        )
      })}
    </div>
  )
}

function LampAnimation({
  lampType,
}: {
  lampType: 'candle' | 'diya' | 'hanging-samai'
}) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <motion.div
        className="absolute"
        style={{
          left: lampType === 'hanging-samai' ? '50%' : 'auto',
          right: lampType === 'hanging-samai' ? 'auto' : '6%',
          top: lampType === 'hanging-samai' ? '0%' : 'auto',
          bottom: lampType === 'hanging-samai' ? 'auto' : '6%',
          transform: 'translateX(-50%)',
        }}
        animate={
          lampType === 'hanging-samai'
            ? {
              rotate: [-2, 2, -1.5, 1.5, -2],
            }
            : {}
        }
        transition={
          lampType === 'hanging-samai'
            ? {
              duration: 5,
              repeat: Infinity,
              ease: 'easeInOut',
            }
            : undefined
        }
      >
        {/* Warm ambient glow */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: lampType === 'hanging-samai' ? 180 : 140,
            height: lampType === 'hanging-samai' ? 180 : 140,
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            background:
              'radial-gradient(circle, rgba(255,180,60,0.28) 0%, rgba(255,150,30,0.12) 35%, transparent 70%)',
            filter: 'blur(8px)',
          }}
          animate={{
            scale: [0.9, 1.08, 0.94, 1.04, 0.9],
            opacity: [0.45, 0.7, 0.5, 0.65, 0.45],
          }}
          transition={{
            duration: 2.4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        {/* Lamp body */}
        {lampType === 'candle' && (
          <svg
            width="90"
            height="150"
            viewBox="0 0 90 150"
            fill="none"
          >
            <rect
              x="27"
              y="42"
              width="36"
              height="78"
              rx="5"
              fill="#E8CFA0"
            />

            <path
              d="M27 48C34 53 56 53 63 48"
              stroke="#C49A55"
              strokeWidth="2"
            />

            <path
              d="M30 120H60L67 128H23L30 120Z"
              fill="#B87928"
            />

            <ellipse
              cx="45"
              cy="128"
              rx="24"
              ry="7"
              fill="#D69A36"
            />

            {/* Flame */}
            <motion.path
              d="M45 39C35 28 45 17 49 9C57 22 57 32 45 39Z"
              fill="#FFB52E"
              animate={{
                scaleY: [1, 1.15, 0.92, 1.08, 1],
                scaleX: [1, 0.9, 1.08, 0.95, 1],
              }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              style={{ transformOrigin: '45px 39px' }}
            />

            <motion.path
              d="M45 36C40 29 45 23 48 19C51 26 51 32 45 36Z"
              fill="#FFF4C2"
              animate={{
                scaleY: [1, 1.2, 0.9, 1.1, 1],
              }}
              transition={{
                duration: 0.55,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              style={{ transformOrigin: '45px 36px' }}
            />
          </svg>
        )}

        {lampType === 'diya' && (
          <svg
            width="120"
            height="100"
            viewBox="0 0 120 100"
            fill="none"
          >
            <path
              d="M20 55C27 78 43 88 60 88C77 88 93 78 100 55C79 62 41 62 20 55Z"
              fill="#A96825"
            />

            <path
              d="M29 55C42 64 78 64 91 55"
              stroke="#E0A33B"
              strokeWidth="3"
            />

            <ellipse
              cx="60"
              cy="55"
              rx="27"
              ry="7"
              fill="#D28A27"
            />

            {/* Flame */}
            <motion.path
              d="M60 54C48 40 60 26 65 16C74 31 73 45 60 54Z"
              fill="#FFB52E"
              animate={{
                scaleY: [1, 1.18, 0.9, 1.12, 1],
                scaleX: [1, 0.88, 1.1, 0.94, 1],
              }}
              transition={{
                duration: 0.75,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              style={{ transformOrigin: '60px 54px' }}
            />

            <motion.path
              d="M60 51C55 43 61 35 63 30C68 39 67 47 60 51Z"
              fill="#FFF5C7"
              animate={{
                scaleY: [1, 1.2, 0.9, 1],
              }}
              transition={{
                duration: 0.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              style={{ transformOrigin: '60px 51px' }}
            />
          </svg>
        )}

        {lampType === 'hanging-samai' && (
          <svg
            width="150"
            height="250"
            viewBox="0 0 150 250"
            fill="none"
          >
            {/* Hanging chain */}
            <path
              d="M75 0V75"
              stroke="#B87928"
              strokeWidth="3"
            />

            <circle
              cx="75"
              cy="80"
              r="9"
              stroke="#D69A36"
              strokeWidth="3"
            />

            {/* Samai */}
            <path
              d="M62 92H88L98 130H52L62 92Z"
              fill="#B87928"
            />

            <ellipse
              cx="75"
              cy="132"
              rx="45"
              ry="13"
              fill="#D69A36"
            />

            <path
              d="M45 132C50 160 58 176 75 176C92 176 100 160 105 132"
              fill="#A96825"
            />

            <ellipse
              cx="75"
              cy="178"
              rx="30"
              ry="9"
              fill="#D69A36"
            />

            {/* Central flame */}
            <motion.path
              d="M75 116C64 103 75 91 79 82C87 96 87 108 75 116Z"
              fill="#FFB52E"
              animate={{
                scaleY: [1, 1.16, 0.92, 1.1, 1],
                scaleX: [1, 0.9, 1.08, 0.95, 1],
              }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              style={{ transformOrigin: '75px 116px' }}
            />

            {/* Side flames */}
            {[45, 105].map((x) => (
              <motion.path
                key={x}
                d={`M${x} 136C${x - 7} 127 ${x} 119 ${x + 3} 113C${x + 8} 124 ${x + 7} 132 ${x} 136Z`}
                fill="#FFB52E"
                animate={{
                  scaleY: [1, 1.15, 0.9, 1],
                }}
                transition={{
                  duration: 0.65,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: x === 45 ? 0 : 0.2,
                }}
                style={{
                  transformOrigin: `${x}px 136px`,
                }}
              />
            ))}
          </svg>
        )}
      </motion.div>
    </div>
  )
}

export default function ElementsLayer({
  elements,
  scrollContainerRef,
}: ElementsLayerProps) {
  const [hasTriggered, setHasTriggered] = useState(false)
  const [anchorPosition, setAnchorPosition] = useState<{
    left: number
    top: number
  } | null>(null)

  const triggerRef = useRef<HTMLDivElement | null>(null)

  const enabledElements = (elements ?? []).filter(
    (element) => element.enabled
  )

  const partyPopper = enabledElements.find(
    (element) =>
      element.type === 'party-popper' &&
      element.animation === 'pop'
  )
  const spiritual = enabledElements.find(
    (element) =>
      element.type === 'spiritual' &&
      element.animation === 'continuous-fall'
  )
  const fallingStars = enabledElements.find(
    (element) =>
      element.type === 'falling-stars' &&
      element.animation === 'continuous-fall'
  )
  const loveBurst = enabledElements.find(
    (element) =>
      element.type === 'love-burst' &&
      element.animation === 'heart-burst'


  )
  const hasScrollTriggeredElement =
    partyPopper || loveBurst
  console.log('[ELEMENTS DEBUG]', {
    enabledElements,
    fallingStars,
    loveBurst,
  })

  useEffect(() => {
    if (!hasScrollTriggeredElement || hasTriggered) {
      return
    }

    const scrollContainer = scrollContainerRef?.current

    const handleScroll = () => {
      const scrollPosition = scrollContainer
        ? scrollContainer.scrollTop
        : window.scrollY

      if (scrollPosition <= 0) {
        return
      }

      setHasTriggered(true)

      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', handleScroll)
      } else {
        window.removeEventListener('scroll', handleScroll)
      }
    }

    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll, {
        passive: true,
      })
    } else {
      window.addEventListener('scroll', handleScroll, {
        passive: true,
      })
    }

    return () => {
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', handleScroll)
      } else {
        window.removeEventListener('scroll', handleScroll)
      }
    }
  }, [hasScrollTriggeredElement, hasTriggered, scrollContainerRef])

  useEffect(() => {
    if (!loveBurst) {
      return
    }

    const updateAnchorPosition = () => {
      const anchor = document.querySelector(
        '[data-love-burst-anchor="true"]'
      )

      const layer = triggerRef.current

      if (!anchor || !layer) {
        return
      }

      const anchorRect = anchor.getBoundingClientRect()
      const layerRect = layer.getBoundingClientRect()

      setAnchorPosition({
        left: anchorRect.left - layerRect.left + anchorRect.width / 2,
        top: anchorRect.top - layerRect.top,
      })
    }

    updateAnchorPosition()

    window.addEventListener('resize', updateAnchorPosition)

    const scrollContainer = scrollContainerRef?.current

    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', updateAnchorPosition, {
        passive: true,
      })
    } else {
      window.addEventListener('scroll', updateAnchorPosition, {
        passive: true,
      })
    }

    return () => {
      window.removeEventListener('resize', updateAnchorPosition)
      window.removeEventListener('scroll', updateAnchorPosition)

      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', updateAnchorPosition)
      }
    }
  }, [loveBurst, scrollContainerRef])

  return (
    <div
      ref={triggerRef}
      className="absolute inset-0 pointer-events-none overflow-hidden z-20"
      aria-hidden="true"
    >

      {hasTriggered && partyPopper && <PartyPopperAnimation />}

      {spiritual && <SpiritualFallAnimation />}

      {fallingStars && <FallingStarsAnimation />}

      {loveBurst && (
        <LoveBurstAnimation
          hasTriggered={hasTriggered}
          anchorPosition={anchorPosition}
        />
      )}

      {
        enabledElements
          .filter(
            (element) =>
              element.type === 'lamp' &&
              element.lampType
          )
          .map((element) => (
            <LampAnimation
              key={element.id}
              lampType={element.lampType!}
            />
          ))
      }

    </div>
  )
}