import type { CSSProperties } from 'react'

export type ButtonVariant =
  | 'classic'
  | 'gloss'
  | 'soft'
  | 'metal'
  | 'raised'
  | 'glow'
  | 'bracket'
  | 'ornate'
  | 'glass'
  | 'link'

export type ButtonRadius = 'sharp' | 'subtle' | 'round' | 'pill'

// CSS injected once per render for variants that need pseudo-elements / keyframes
export const BUTTON_CSS = `
  /* ── Metal: diagonal face-sweep on hover (metallic sheen) ── */
  .fern-btn-metal {
    position: relative;
    overflow: hidden;
    transition: transform 0.15s ease, filter 0.15s ease;
  }
  .fern-btn-metal::before {
    content: '';
    position: absolute;
    top: -60%;
    left: -110%;
    width: 55%;
    height: 220%;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(255,255,255,0.55) 50%,
      transparent 100%
    );
    transform: skewX(-18deg);
    pointer-events: none;
  }
  .fern-btn-metal:hover::before {
    animation: fern-metal-sweep 0.65s ease-in-out forwards;
  }
  .fern-btn-metal:active {
    filter: brightness(0.88);
  }
  @keyframes fern-metal-sweep {
    0%   { left: -110%; }
    100% { left: 130%; }
  }

  .fern-btn-ornate {
    transition: transform 0.18s ease, filter 0.18s ease, box-shadow 0.18s ease;
  }
  .fern-btn-ornate:hover {
    transform: translateY(-2px);
    filter: brightness(1.22);
    box-shadow:
      inset 0 1px 0 rgba(255,220,80,0.6),
      inset 0 -2px 0 rgba(0,0,0,0.45),
      inset 3px 0 6px rgba(0,0,0,0.18),
      inset -3px 0 6px rgba(0,0,0,0.18),
      0 10px 24px rgba(0,0,0,0.55),
      0 0 40px rgba(210,155,0,0.55),
      0 0 80px rgba(180,120,0,0.22) !important;
  }
  .fern-btn-ornate:active {
    transform: translateY(2px);
    filter: brightness(0.85);
    box-shadow:
      inset 0 3px 6px rgba(0,0,0,0.55),
      0 1px 3px rgba(0,0,0,0.4),
      0 0 10px rgba(160,110,0,0.2) !important;
  }

  .fern-btn-glass {
    transition: transform 0.18s ease, background-color 0.18s ease, box-shadow 0.18s ease;
  }
  .fern-btn-glass:hover {
    background-color: rgba(255,255,255,0.22) !important;
    transform: translateY(-1px);
  }
  .fern-btn-glass:active {
    transform: translateY(0);
    background-color: rgba(255,255,255,0.16) !important;
  }

  .fern-btn-bracket {
    transition: letter-spacing 0.2s ease, opacity 0.2s ease;
  }
  .fern-btn-bracket:hover {
    opacity: 0.7;
  }
`

export const RADIUS_MAP: Record<ButtonRadius, string> = {
  sharp: '0px',
  subtle: '4px',
  round: '8px',
  pill: '9999px',
}

export function getButtonStyles(
  buttonColor: string,
  variant: string,
  radius: string,
): { extraClass: string; style: CSSProperties } {
  const borderRadius = RADIUS_MAP[radius as ButtonRadius] ?? '8px'

  if (variant === 'link') {
    return {
      extraClass: 'font-semibold underline underline-offset-2',
      style: { color: buttonColor, background: 'none', padding: '4px 0', borderRadius: 0 },
    }
  }

  if (variant === 'classic') {
    return {
      extraClass: 'font-semibold',
      style: {
        backgroundColor: buttonColor,
        borderRadius,
        color: 'white',
        boxShadow: '0 4px 0 rgba(0,0,0,0.25)',
        border: '1px solid rgba(0,0,0,0.08)',
      },
    }
  }

  if (variant === 'gloss') {
    return {
      extraClass: 'font-semibold',
      style: {
        background: `linear-gradient(180deg, rgba(255,255,255,0.48) 0%, rgba(255,255,255,0.1) 50%, rgba(0,0,0,0.06) 100%), ${buttonColor}`,
        borderRadius,
        color: 'white',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.65), 0 1px 4px rgba(0,0,0,0.22)',
        border: '1px solid rgba(0,0,0,0.1)',
      },
    }
  }

  if (variant === 'soft') {
    return {
      extraClass: 'font-semibold',
      style: {
        backgroundColor: buttonColor,
        borderRadius,
        color: 'white',
        boxShadow: '0 8px 24px rgba(0,0,0,0.22), 0 2px 6px rgba(0,0,0,0.12)',
      },
    }
  }

  if (variant === 'metal') {
    return {
      extraClass: 'font-semibold fern-btn-metal',
      style: {
        background: `linear-gradient(160deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.08) 45%, rgba(0,0,0,0.18) 100%), ${buttonColor}`,
        borderRadius,
        color: 'white',
        border: '1px solid rgba(0,0,0,0.18)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -2px 0 rgba(0,0,0,0.28), 0 2px 6px rgba(0,0,0,0.2)',
      },
    }
  }

  if (variant === 'raised') {
    // Neo-brutalist hard offset shadow (Button 53 style) — bold, tactile, unmistakable
    return {
      extraClass: 'font-semibold',
      style: {
        backgroundColor: buttonColor,
        borderRadius,
        color: 'white',
        border: '2px solid rgba(0,0,0,0.85)',
        boxShadow: '5px 5px 0 rgba(0,0,0,0.82)',
      },
    }
  }

  if (variant === 'glow') {
    // Colored halo that pulses around the button matching its own color (Button 85 style)
    return {
      extraClass: 'font-semibold',
      style: {
        backgroundColor: buttonColor,
        borderRadius,
        color: 'white',
        boxShadow: `0 0 6px ${buttonColor}, 0 0 20px ${buttonColor}, 0 0 40px ${buttonColor}`,
      },
    }
  }

  if (variant === 'bracket') {
    // Corner-bracket marks only — elegant editorial style (Button 89 style)
    // Eight gradient segments draw two perpendicular lines at each corner
    const arm = '14px'
    const w = '2px'
    return {
      extraClass: 'font-semibold tracking-widest uppercase fern-btn-bracket',
      style: {
        backgroundColor: 'transparent',
        backgroundImage: [
          `linear-gradient(to right, ${buttonColor} 100%, transparent 0)`,
          `linear-gradient(to right, ${buttonColor} 100%, transparent 0)`,
          `linear-gradient(to left,  ${buttonColor} 100%, transparent 0)`,
          `linear-gradient(to left,  ${buttonColor} 100%, transparent 0)`,
          `linear-gradient(to bottom, ${buttonColor} 100%, transparent 0)`,
          `linear-gradient(to bottom, ${buttonColor} 100%, transparent 0)`,
          `linear-gradient(to top,   ${buttonColor} 100%, transparent 0)`,
          `linear-gradient(to top,   ${buttonColor} 100%, transparent 0)`,
        ].join(', '),
        backgroundSize: [
          `${arm} ${w}`, `${arm} ${w}`, `${arm} ${w}`, `${arm} ${w}`,
          `${w} ${arm}`, `${w} ${arm}`, `${w} ${arm}`, `${w} ${arm}`,
        ].join(', '),
        backgroundPosition: '0 0, 0 100%, 100% 0, 100% 100%, 0 0, 100% 0, 0 100%, 100% 100%',
        backgroundRepeat: 'no-repeat',
        borderRadius: 0,
        color: buttonColor,
      },
    }
  }

  if (variant === 'ornate') {
    // Fantasy-game / Baldur's Gate: rich bronze gradient, golden text, ornate layered border
    return {
      extraClass: 'fern-btn-ornate tracking-widest',
      style: {
        background: 'linear-gradient(180deg, #9A7520 0%, #5C3D08 35%, #3A2500 55%, #7A5510 100%)',
        borderRadius,
        color: '#F0D060',
        border: '1px solid #C9A832',
        textShadow: '0 0 14px rgba(255,210,0,0.65), 0 1px 3px rgba(0,0,0,0.95)',
        letterSpacing: '0.12em',
        boxShadow: [
          'inset 0 1px 0 rgba(255,220,80,0.45)',
          'inset 0 -2px 0 rgba(0,0,0,0.55)',
          'inset 3px 0 6px rgba(0,0,0,0.25)',
          'inset -3px 0 6px rgba(0,0,0,0.25)',
          '0 4px 12px rgba(0,0,0,0.5)',
          '0 0 20px rgba(180,130,0,0.3)',
        ].join(', '),
      },
    }
  }

  if (variant === 'glass') {
    // Frosted glass pill — translucent white over rich/dark backgrounds, soft blur + hairline border
    return {
      extraClass: 'font-medium tracking-wide fern-btn-glass',
      style: {
        backgroundColor: 'rgba(255,255,255,0.14)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRadius,
        color: '#FFFFFF',
        border: '1px solid rgba(255,255,255,0.35)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.25)',
      } as CSSProperties,
    }
  }

  // fallback
  return {
    extraClass: 'font-semibold',
    style: { backgroundColor: buttonColor, borderRadius, color: 'white' },
  }
}
