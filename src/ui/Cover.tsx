/**
 * Generative course covers — drawn, not stock. Each cover is a deterministic
 * function of the course id, so a course always looks like itself.
 */
import { useMemo } from 'react'

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function rng(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), a | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const W = 300
const H = 400

/** Two-source interference: the double-slit pattern, iso-phase lines. */
function interference(r: () => number) {
  const s1 = { x: W * (0.32 + r() * 0.06), y: H * 0.9 }
  const s2 = { x: W * (0.62 + r() * 0.06), y: H * 0.9 }
  const k = 0.16 + r() * 0.05 // wavenumber
  const halfGap = Math.abs(s2.x - s1.x) / 2
  const cx = (s1.x + s2.x) / 2
  const lines: string[] = []
  // Nodal/antinodal lines are hyperbolae |r1 − r2| = const with the sources as foci.
  for (let d = -12; d <= 12; d++) {
    const a = (d * Math.PI) / k / 4 // half the path difference
    if (Math.abs(a) >= halfGap) continue
    const b = Math.sqrt(halfGap * halfGap - a * a)
    const pts: string[] = []
    for (let t = 0; t <= 1.0001; t += 0.02) {
      const y = t * 520
      const x = a * Math.sqrt(1 + (y * y) / (b * b))
      pts.push(`${(cx + x).toFixed(1)},${(s1.y - y).toFixed(1)}`)
    }
    lines.push(pts.join(' '))
  }
  const rings: { cx: number; cy: number; r: number }[] = []
  for (let i = 1; i < 26; i++) {
    const rad = (i * Math.PI) / k
    rings.push({ cx: s1.x, cy: s1.y, r: rad }, { cx: s2.x, cy: s2.y, r: rad })
  }
  return (
    <g>
      {rings.map((c, i) => (
        <circle key={i} cx={c.cx} cy={c.cy} r={c.r} fill="none" stroke="currentColor" strokeOpacity={0.22} strokeWidth={0.8} />
      ))}
      {lines.map((p, i) => (
        <polyline key={i} points={p} fill="none" stroke="var(--cover-strong)" strokeWidth={1.1} strokeOpacity={i % 2 ? 0.55 : 0.95} />
      ))}
      <circle cx={s1.x} cy={s1.y} r={3.5} fill="var(--cover-strong)" />
      <circle cx={s2.x} cy={s2.y} r={3.5} fill="var(--cover-strong)" />
    </g>
  )
}

/** Topographic contours of a few random Gaussian bumps. */
function contours(r: () => number) {
  const bumps = Array.from({ length: 4 }, () => ({ x: r() * W, y: r() * H, s: 50 + r() * 70, a: 0.6 + r() }))
  const f = (x: number, y: number) => bumps.reduce((acc, b) => acc + b.a * Math.exp(-((x - b.x) ** 2 + (y - b.y) ** 2) / (2 * b.s * b.s)), 0)
  const paths: string[] = []
  const step = 6
  for (let level = 0.15; level < 1.6; level += 0.12) {
    let d = ''
    for (let y = 0; y < H; y += step)
      for (let x = 0; x < W; x += step) {
        const a = f(x, y) > level
        const b = f(x + step, y) > level
        const c = f(x, y + step) > level
        if (a !== b) d += `M${x + step / 2},${y - 2}v4`
        if (a !== c) d += `M${x - 2},${y + step / 2}h4`
      }
    paths.push(d)
  }
  return (
    <g>
      {paths.map((d, i) => (
        <path key={i} d={d} stroke={i % 3 === 0 ? 'var(--cover-strong)' : 'currentColor'} strokeOpacity={i % 3 === 0 ? 0.9 : 0.35} strokeWidth={1} />
      ))}
    </g>
  )
}

/** A lattice of nodes with a few strong bonds. */
function lattice(r: () => number) {
  const cols = 7
  const rows = 9
  const pts = Array.from({ length: cols * rows }, (_, i) => ({
    x: 30 + (i % cols) * ((W - 60) / (cols - 1)) + (r() - 0.5) * 8,
    y: 30 + Math.floor(i / cols) * ((H - 60) / (rows - 1)) + (r() - 0.5) * 8,
  }))
  const edges: [number, number, boolean][] = []
  pts.forEach((_, i) => {
    if (i % cols < cols - 1 && r() < 0.7) edges.push([i, i + 1, r() < 0.2])
    if (i + cols < pts.length && r() < 0.7) edges.push([i, i + cols, r() < 0.2])
  })
  return (
    <g>
      {edges.map(([a, b, s], i) => (
        <line key={i} x1={pts[a].x} y1={pts[a].y} x2={pts[b].x} y2={pts[b].y} stroke={s ? 'var(--cover-strong)' : 'currentColor'} strokeOpacity={s ? 1 : 0.3} strokeWidth={s ? 2 : 1} />
      ))}
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2.4} fill="currentColor" fillOpacity={0.7} />
      ))}
    </g>
  )
}

/** Stacked waves, phase-shifted. */
function tide(r: () => number) {
  const lines = []
  for (let i = 0; i < 34; i++) {
    const amp = 6 + r() * 16
    const fr = 0.015 + r() * 0.02
    const ph = r() * Math.PI * 2
    let d = `M0,${20 + i * 11}`
    for (let x = 0; x <= W; x += 6) d += `L${x},${(20 + i * 11 + amp * Math.sin(x * fr + ph + i * 0.3)).toFixed(1)}`
    lines.push(<path key={i} d={d} fill="none" stroke={i % 6 === 0 ? 'var(--cover-strong)' : 'currentColor'} strokeOpacity={i % 6 === 0 ? 1 : 0.32} strokeWidth={i % 6 === 0 ? 1.6 : 1} />)
  }
  return <g>{lines}</g>
}

const DRAW = { interference, contours, lattice, tide } as const

export function Cover({
  kind,
  seed,
  accent,
  className,
  label,
}: {
  kind: string
  seed: string
  accent: string
  className?: string
  label?: string
}) {
  const art = useMemo(() => {
    const draw = DRAW[kind as keyof typeof DRAW] ?? tide
    return draw(rng(hash(seed + kind)))
  }, [kind, seed])
  return (
    <svg
      className={className}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={label ?? 'Course cover'}
      style={{ ['--cover-strong' as string]: accent, color: 'var(--ink)', background: 'var(--sheet)' }}
    >
      {art}
    </svg>
  )
}
