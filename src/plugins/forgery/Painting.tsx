/**
 * A synthetic "newly discovered" Dutch portrait (the course's case file), drawn
 * as SVG and rendered as it would appear under different examination methods.
 * Synthetic: no real painting is depicted. Colours come from the --art-* tokens.
 */
import { useId, useMemo, type ReactElement } from 'react'

/** Gradient ids must be unique per SVG instance (a reel shows two renderings at once). */
function useSvgId() {
  return useId().replace(/[^a-zA-Z0-9_-]/g, '')
}

export type ExamMode = 'visible' | 'raking' | 'uv' | 'ir' | 'xray'

export const PAINTING_W = 300
export const PAINTING_H = 380

export type RegionId = 'face' | 'hand' | 'signature' | 'background' | 'surface'

/** Hot regions in painting coordinates (used to outline what is being inspected). */
export const REGIONS: Record<RegionId, { label: string; x: number; y: number; w: number; h: number }> = {
  face: { label: 'Face', x: 96, y: 86, w: 108, h: 140 },
  hand: { label: 'Hand', x: 48, y: 292, w: 92, h: 70 },
  signature: { label: 'Signature', x: 206, y: 340, w: 86, h: 32 },
  background: { label: 'Background', x: 8, y: 8, w: 284, h: 70 },
  surface: { label: 'Whole surface', x: 3, y: 3, w: 294, h: 374 },
}

const FACE = 'M150 96c30 0 46 26 46 60 0 40-20 68-46 68s-46-28-46-68c0-34 16-60 46-60z'
const CAP = 'M98 128c-4-40 22-66 52-68 34-2 58 24 54 70-10-24-30-36-54-36s-42 12-52 34z'
const GARMENT = 'M40 380c6-62 34-104 110-112 76 8 104 50 110 112z'
const RUFF_INNER = 'M96 246c16 12 34 18 54 18s38-6 54-18'
const HAND = 'M62 336c6-22 26-30 46-26 16 4 24 16 22 28-4 14-22 18-40 16-14-2-26-6-28-18z'
const HAND_FIRST = 'M66 356c6-20 24-26 42-22 14 4 22 14 20 24-4 12-20 16-36 14-12-2-24-6-26-16z' // the first, lower position

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), a | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A sharp, too-regular crack network: the artificial craquelure the raking light catches. */
function cracks(seed = 7) {
  const r = rng(seed)
  const paths: string[] = []
  for (let i = 0; i < 46; i++) {
    let x = 10 + r() * 280
    let y = 10 + r() * 360
    let d = `M${x.toFixed(1)} ${y.toFixed(1)}`
    const steps = 3 + Math.floor(r() * 4)
    const dir = r() * Math.PI * 2
    for (let s = 0; s < steps; s++) {
      const a = dir + (r() - 0.5) * 1.2
      x += Math.cos(a) * (10 + r() * 16)
      y += Math.sin(a) * (10 + r() * 16)
      d += ` L${x.toFixed(1)} ${y.toFixed(1)}`
    }
    paths.push(d)
  }
  return paths
}

function Visible() {
  const id = useSvgId()
  return (
    <g>
      <defs>
        <radialGradient id={`${id}-bg`} cx="30%" cy="22%" r="85%">
          <stop offset="0" stopColor="var(--art-umber-2)" />
          <stop offset="1" stopColor="var(--art-umber)" />
        </radialGradient>
        <radialGradient id={`${id}-face`} cx="42%" cy="38%" r="70%">
          <stop offset="0" stopColor="var(--art-flesh)" />
          <stop offset="1" stopColor="var(--art-flesh-shade)" />
        </radialGradient>
      </defs>
      <rect width={PAINTING_W} height={PAINTING_H} fill={`url(#${id}-bg)`} />
      <path d={GARMENT} fill="var(--art-black)" />
      <ellipse cx="150" cy="250" rx="86" ry="27" fill="var(--art-lead)" />
      {Array.from({ length: 22 }, (_, i) => {
        const a = (i / 22) * Math.PI * 2
        return <line key={i} x1={150 + Math.cos(a) * 40} y1={250 + Math.sin(a) * 12} x2={150 + Math.cos(a) * 84} y2={250 + Math.sin(a) * 26} stroke="var(--art-ground)" strokeWidth="1.4" />
      })}
      <path d={RUFF_INNER} fill="none" stroke="var(--art-flesh-shade)" strokeWidth="2" />
      <path d={FACE} fill={`url(#${id}-face)`} />
      <path d={CAP} fill="var(--art-lead)" />
      <ellipse cx="134" cy="152" rx="6" ry="3.6" fill="var(--art-umber)" />
      <ellipse cx="168" cy="152" rx="6" ry="3.6" fill="var(--art-umber)" />
      <path d="M126 142q8-5 16 0M160 142q8-5 16 0" stroke="var(--art-flesh-shade)" strokeWidth="2" fill="none" />
      <path d="M151 156q-4 18 2 24" stroke="var(--art-flesh-shade)" strokeWidth="2" fill="none" />
      <path d="M140 198q11 6 22 0" stroke="var(--art-red)" strokeWidth="4" strokeLinecap="round" fill="none" />
      <ellipse cx="128" cy="178" rx="9" ry="6" fill="var(--art-red)" opacity="0.18" />
      <ellipse cx="174" cy="178" rx="9" ry="6" fill="var(--art-red)" opacity="0.18" />
      <path d={HAND} fill={`url(#${id}-face)`} />
      <text x="248" y="364" textAnchor="middle" fill="var(--art-red)" fontSize="13" fontFamily="Georgia, serif" fontStyle="italic">
        HM · 1631
      </text>
      <rect width={PAINTING_W} height={PAINTING_H} fill="var(--art-varnish)" opacity="0.12" />
    </g>
  )
}

function Raking() {
  const id = useSvgId()
  const c = useMemo(() => cracks(), [])
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-rake`} x1="0" x2="1">
          <stop offset="0" stopColor="var(--art-ir-light)" />
          <stop offset="1" stopColor="var(--art-ir-dark)" />
        </linearGradient>
      </defs>
      <rect width={PAINTING_W} height={PAINTING_H} fill={`url(#${id}-rake)`} />
      <path d={GARMENT} fill="var(--art-ir-dark)" opacity="0.55" />
      <ellipse cx="150" cy="250" rx="86" ry="27" fill="var(--art-ir-light)" />
      {Array.from({ length: 22 }, (_, i) => {
        const a = (i / 22) * Math.PI * 2
        return <line key={i} x1={150 + Math.cos(a) * 40} y1={250 + Math.sin(a) * 12} x2={150 + Math.cos(a) * 84} y2={250 + Math.sin(a) * 26} stroke="var(--art-ir-dark)" strokeWidth="2" />
      })}
      <path d={FACE} fill="var(--art-ir-mid)" />
      <path d={CAP} fill="var(--art-ir-light)" />
      <path d={HAND} fill="var(--art-ir-mid)" />
      {c.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="var(--art-crack)" strokeWidth="1.1" strokeLinejoin="miter" />
      ))}
    </g>
  )
}

function Ultraviolet() {
  return (
    <g>
      <rect width={PAINTING_W} height={PAINTING_H} fill="var(--art-uv-bg)" />
      <path d={GARMENT} fill="var(--art-uv-dark)" opacity="0.6" />
      <ellipse cx="150" cy="250" rx="86" ry="27" fill="var(--art-uv-glow)" opacity="0.5" />
      <path d={FACE} fill="var(--art-uv-glow)" opacity="0.35" />
      <path d={CAP} fill="var(--art-uv-glow)" opacity="0.55" />
      <path d={HAND} fill="var(--art-uv-glow)" opacity="0.3" />
      {/* the aged varnish glows evenly across the picture */}
      <rect width={PAINTING_W} height={PAINTING_H} fill="var(--art-uv-glow)" opacity="0.26" />
      {/* the signature sits on top of the varnish: it blocks the UV and reads dark */}
      <rect x="208" y="347" width="80" height="22" rx="3" fill="var(--art-uv-dark)" />
      <text x="248" y="364" textAnchor="middle" fill="var(--art-uv-dark)" fontSize="13" fontFamily="Georgia, serif" fontStyle="italic" opacity="0.9">
        HM · 1631
      </text>
    </g>
  )
}

function Infrared() {
  return (
    <g>
      <rect width={PAINTING_W} height={PAINTING_H} fill="var(--art-ir-mid)" />
      <path d={GARMENT} fill="var(--art-ir-dark)" opacity="0.45" />
      <ellipse cx="150" cy="250" rx="86" ry="27" fill="var(--art-ir-light)" />
      <path d={FACE} fill="var(--art-ir-light)" />
      <path d={CAP} fill="var(--art-ir-light)" />
      <path d={HAND} fill="var(--art-ir-light)" />
      {/* carbon-black underdrawing shows through the paint */}
      <g fill="none" stroke="var(--art-carbon)" strokeWidth="1.3">
        <path d={FACE} />
        <path d="M128 152h14M160 152h14M151 156q-4 18 2 24M140 198q11 6 22 0" />
        <path d={HAND} />
        <path d={HAND_FIRST} strokeDasharray="4 3" />
        <path d="M44 380c6-62 34-104 106-112 76 8 104 50 108 112" />
      </g>
    </g>
  )
}

function Xray() {
  return (
    <g>
      <rect width={PAINTING_W} height={PAINTING_H} fill="var(--art-xray-dark)" />
      {/* wood grain of the oak panel */}
      {Array.from({ length: 16 }, (_, i) => (
        <path key={i} d={`M${12 + i * 18} 0 q 6 ${190} 0 ${PAINTING_H}`} stroke="var(--art-ir-dark)" strokeWidth="0.8" fill="none" opacity="0.5" />
      ))}
      {/* an earlier picture underneath: a lead-white sky over a flat horizon, two trees */}
      <rect x="0" y="0" width={PAINTING_W} height="196" fill="var(--art-xray-bright)" opacity="0.32" />
      <path d="M0 196 C 60 188 120 200 180 192 S 270 198 300 194" stroke="var(--art-xray-bright)" strokeWidth="3" fill="none" opacity="0.7" />
      <path d="M232 196 v-60 M232 150 q-26-30 0-58 q26 28 0 58 M262 196 v-40 M262 166 q-16-20 0-38 q16 18 0 38" stroke="var(--art-xray-bright)" strokeWidth="2.4" fill="none" opacity="0.55" />
      {/* lead-white passages of the portrait */}
      <ellipse cx="150" cy="250" rx="86" ry="27" fill="var(--art-xray-bright)" opacity="0.85" />
      <path d={CAP} fill="var(--art-xray-bright)" opacity="0.8" />
      <path d={FACE} fill="var(--art-xray-bright)" opacity="0.45" />
      <path d={HAND} fill="var(--art-xray-bright)" opacity="0.4" />
    </g>
  )
}

const RENDER: Record<ExamMode, () => ReactElement> = { visible: Visible, raking: Raking, uv: Ultraviolet, ir: Infrared, xray: Xray }

export const MODE_LABEL: Record<ExamMode, string> = {
  visible: 'Visible light',
  raking: 'Raking light',
  uv: 'Ultraviolet',
  ir: 'Infrared',
  xray: 'X-ray',
}

/** The painting in one mode. `highlight` outlines a region being inspected. */
export function PaintingArt({ mode, highlight }: { mode: ExamMode; highlight?: RegionId | null }) {
  const Mode = RENDER[mode]
  const h = highlight ? REGIONS[highlight] : null
  return (
    <g>
      <Mode />
      {h && <rect x={h.x} y={h.y} width={h.w} height={h.h} rx="6" fill="none" stroke="var(--accent-fg, var(--primary))" strokeWidth="3" strokeDasharray="7 5" />}
    </g>
  )
}

export function Painting({ mode, highlight, title }: { mode: ExamMode; highlight?: RegionId | null; title?: string }) {
  return (
    <svg viewBox={`0 0 ${PAINTING_W} ${PAINTING_H}`} className="fg-painting" role="img" aria-label={title ?? `The case-file portrait under ${MODE_LABEL[mode].toLowerCase()}`}>
      <PaintingArt mode={mode} highlight={highlight} />
    </svg>
  )
}
