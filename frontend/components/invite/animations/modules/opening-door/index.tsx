'use client'

import { useEffect, useRef, useState } from 'react'
import type { OpeningModuleProps } from '@/lib/invite/animations/types'

export default function OpeningDoorModule({
  children,
  onComplete,
}: OpeningModuleProps) {
  const [finished, setFinished] = useState(false)
  const completedRef = useRef(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (completedRef.current) return

      completedRef.current = true
      setFinished(true)
      onComplete()
    }, 2400)

    return () => window.clearTimeout(timer)
  }, [onComplete])
  
  return (
    <div className="relative min-h-full w-full overflow-hidden">
      {children}

      {!finished && (
        <div className="fixed inset-0 z-[9999] overflow-hidden bg-[#24150d]">
          {/* Warm light behind the doors */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at center, #fff7d6 0%, #f6c66b 28%, #7a3f20 65%, #24150d 100%)',
              animation: 'opening-door-light 2.4s ease-in-out forwards',
            }}
          />

          {/* Left door */}
          <div
            className="absolute inset-y-0 left-0 w-1/2 origin-left"
            style={{
              background:
                'linear-gradient(90deg, #2b120b 0%, #6e3820 35%, #9a5b31 100%)',
              boxShadow: 'inset -18px 0 35px rgba(0,0,0,0.45)',
              animation: 'opening-door-left 2.4s cubic-bezier(0.65, 0, 0.35, 1) forwards',
              transformStyle: 'preserve-3d',
            }}
          >
            {/* Door decoration */}
            <div className="absolute inset-5 rounded-[24px] border border-[#d5a45c]/60">
              <div className="absolute inset-4 rounded-[18px] border border-[#d5a45c]/30" />
            </div>

            {/* Handle */}
            <div className="absolute right-7 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-[#d6a64d] shadow-[0_0_12px_rgba(255,214,120,0.5)]" />
          </div>

          {/* Right door */}
          <div
            className="absolute inset-y-0 right-0 w-1/2 origin-right"
            style={{
              background:
                'linear-gradient(270deg, #2b120b 0%, #6e3820 35%, #9a5b31 100%)',
              boxShadow: 'inset 18px 0 35px rgba(0,0,0,0.45)',
              animation: 'opening-door-right 2.4s cubic-bezier(0.65, 0, 0.35, 1) forwards',
              transformStyle: 'preserve-3d',
            }}
          >
            {/* Door decoration */}
            <div className="absolute inset-5 rounded-[24px] border border-[#d5a45c]/60">
              <div className="absolute inset-4 rounded-[18px] border border-[#d5a45c]/30" />
            </div>

            {/* Handle */}
            <div className="absolute left-7 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-[#d6a64d] shadow-[0_0_12px_rgba(255,214,120,0.5)]" />
          </div>

          {/* Center light beam */}
          <div
            className="absolute left-1/2 top-0 h-full w-1 -translate-x-1/2 bg-[#fff8dc] shadow-[0_0_30px_15px_rgba(255,220,130,0.65)]"
            style={{
              animation: 'opening-door-gap 2.4s ease-in-out forwards',
            }}
          />
        </div>
      )}

      <style jsx>{`
        @keyframes opening-door-left {
          0% {
            transform: perspective(1400px) rotateY(0deg);
          }

          15% {
            transform: perspective(1400px) rotateY(0deg);
          }

          100% {
            transform: perspective(1400px) rotateY(-92deg);
          }
        }

        @keyframes opening-door-right {
          0% {
            transform: perspective(1400px) rotateY(0deg);
          }

          15% {
            transform: perspective(1400px) rotateY(0deg);
          }

          100% {
            transform: perspective(1400px) rotateY(92deg);
          }
        }

        @keyframes opening-door-light {
          0% {
            opacity: 0.15;
            transform: scale(0.75);
          }

          20% {
            opacity: 0.2;
          }

          55% {
            opacity: 0.65;
            transform: scale(1);
          }

          100% {
            opacity: 1;
            transform: scale(1.15);
          }
        }

        @keyframes opening-door-gap {
          0% {
            opacity: 0;
            width: 2px;
          }

          20% {
            opacity: 0.15;
            width: 3px;
          }

          55% {
            opacity: 0.8;
            width: 8px;
          }

          100% {
            opacity: 1;
            width: 100px;
          }
        }
      `}</style>
    </div>
  )
}