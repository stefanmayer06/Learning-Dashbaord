/**
 * Orthographic Bloch sphere. Axes follow the textbook picture: x toward the
 * viewer, y to the right, z up. Points behind the sphere are drawn faint.
 */
import type { PointerEvent as RPointerEvent } from 'react'
import { useRef } from 'react'

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface View {
  yaw: number
  pitch: number
}

export const DEFAULT_VIEW: View = { yaw: -1.75, pitch: 0.32 }

export function project(v: Vec3, view: View, R: number, cx: number, cy: number) {
  const ca = Math.cos(view.yaw)
  const sa = Math.sin(view.yaw)
  const x1 = v.x * ca - v.y * sa
  const y1 = v.x * sa + v.y * ca
  const cb = Math.cos(view.pitch)
  const sb = Math.sin(view.pitch)
  const y2 = y1 * cb - v.z * sb
  const z2 = y1 * sb + v.z * cb
  return { sx: cx + R * x1, sy: cy - R * z2, front: y2 <= 0.0001, depth: -y2 }
}

function circlePath(points: (t: number) => Vec3, view: View, R: number, cx: number, cy: number) {
  let front = ''
  let back = ''
  let prevFront: boolean | null = null
  for (let i = 0; i <= 96; i++) {
    const t = (i / 96) * Math.PI * 2
    const q = project(points(t), view, R, cx, cy)
    const cmd = `${q.sx.toFixed(1)},${q.sy.toFixed(1)}`
    if (q.front) front += prevFront === true ? `L${cmd}` : `M${cmd}`
    else back += prevFront === false ? `L${cmd}` : `M${cmd}`
    prevFront = q.front
  }
  return { front, back }
}

/** Spherical linear interpolation between two unit vectors. */
export function slerp(a: Vec3, b: Vec3, t: number): Vec3 {
  const dot = Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z))
  const om = Math.acos(dot)
  if (om < 1e-6) return a
  if (Math.PI - om < 1e-4) {
    // antipodal: go through any perpendicular axis (pick one via z)
    const perp = Math.abs(a.z) < 0.9 ? { x: -a.y, y: a.x, z: 0 } : { x: 0, y: -a.z, z: a.y }
    const n = Math.hypot(perp.x, perp.y, perp.z)
    const p = { x: perp.x / n, y: perp.y / n, z: perp.z / n }
    const ang = t * Math.PI
    return { x: a.x * Math.cos(ang) + p.x * Math.sin(ang), y: a.y * Math.cos(ang) + p.y * Math.sin(ang), z: a.z * Math.cos(ang) + p.z * Math.sin(ang) }
  }
  const s = Math.sin(om)
  const wa = Math.sin((1 - t) * om) / s
  const wb = Math.sin(t * om) / s
  return { x: a.x * wa + b.x * wb, y: a.y * wa + b.y * wb, z: a.z * wa + b.z * wb }
}

export function BlochSphere({
  vec,
  view = DEFAULT_VIEW,
  onView,
  size = 360,
  trail = [],
  ghost,
  label,
  tone = 'paper',
  showAxes = true,
}: {
  vec: Vec3
  view?: View
  onView?: (v: View) => void
  size?: number
  trail?: Vec3[]
  ghost?: Vec3 | null
  label?: string
  tone?: 'paper' | 'theatre'
  showAxes?: boolean
}) {
  const R = size * 0.36
  const cx = size / 2
  const cy = size / 2
  const P = (v: Vec3) => project(v, view, R, cx, cy)
  const equator = circlePath((t) => ({ x: Math.cos(t), y: Math.sin(t), z: 0 }), view, R, cx, cy)
  const meridianXZ = circlePath((t) => ({ x: Math.cos(t), y: 0, z: Math.sin(t) }), view, R, cx, cy)
  const meridianYZ = circlePath((t) => ({ x: 0, y: Math.cos(t), z: Math.sin(t) }), view, R, cx, cy)
  const len = Math.hypot(vec.x, vec.y, vec.z)
  const tip = P(vec)
  const origin = P({ x: 0, y: 0, z: 0 })
  const axes: [Vec3, string][] = [
    [{ x: 0, y: 0, z: 1 }, '|0⟩'],
    [{ x: 0, y: 0, z: -1 }, '|1⟩'],
    [{ x: 1, y: 0, z: 0 }, '|+⟩'],
    [{ x: -1, y: 0, z: 0 }, '|−⟩'],
    [{ x: 0, y: 1, z: 0 }, '|+i⟩'],
    [{ x: 0, y: -1, z: 0 }, '|−i⟩'],
  ]

  const drag = useRef<{ x: number; y: number; view: View } | null>(null)
  const down = (e: RPointerEvent<SVGSVGElement>) => {
    if (!onView) return
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, view }
  }
  const move = (e: RPointerEvent<SVGSVGElement>) => {
    if (!drag.current || !onView) return
    const dx = e.clientX - drag.current.x
    const dy = e.clientY - drag.current.y
    onView({
      yaw: drag.current.view.yaw - dx * 0.01,
      pitch: Math.max(-1.2, Math.min(1.2, drag.current.view.pitch + dy * 0.01)),
    })
  }
  const up = () => (drag.current = null)

  const ink = tone === 'theatre' ? 'var(--theatre-ink)' : 'var(--ink)'
  const faint = tone === 'theatre' ? 'var(--theatre-faint)' : 'var(--ink-faint)'
  const accent = tone === 'theatre' ? 'var(--theatre-accent)' : 'var(--accent-fg)'

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width="100%"
      className="bloch"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      style={{ cursor: onView ? 'grab' : undefined, touchAction: onView ? 'none' : undefined, maxWidth: size }}
      role="img"
      aria-label={label ?? `Bloch vector x ${vec.x.toFixed(2)}, y ${vec.y.toFixed(2)}, z ${vec.z.toFixed(2)}`}
    >
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={ink} strokeWidth={1.2} />
      {[equator, meridianXZ, meridianYZ].map((c, i) => (
        <g key={i}>
          <path d={c.back} fill="none" stroke={faint} strokeWidth={0.8} strokeDasharray="2 4" />
          <path d={c.front} fill="none" stroke={ink} strokeOpacity={i === 0 ? 0.55 : 0.28} strokeWidth={0.9} />
        </g>
      ))}
      {showAxes &&
        axes.map(([a, l]) => {
          const q = P(a)
          const o = P({ x: a.x * 1.24, y: a.y * 1.24, z: a.z * 1.24 })
          return (
            <g key={l} opacity={q.front ? 1 : 0.45}>
              <line x1={origin.sx} y1={origin.sy} x2={q.sx} y2={q.sy} stroke={faint} strokeWidth={0.8} />
              <text x={o.sx} y={o.sy + 4} textAnchor="middle" className="bloch-axis" fill={ink}>
                {l}
              </text>
            </g>
          )
        })}
      {trail.length > 1 && (
        <polyline
          points={trail.map((v) => {
            const q = P(v)
            return `${q.sx.toFixed(1)},${q.sy.toFixed(1)}`
          }).join(' ')}
          fill="none"
          stroke={accent}
          strokeOpacity={0.45}
          strokeWidth={1.5}
        />
      )}
      {ghost && (() => {
        const g = P(ghost)
        return (
          <g>
            <line x1={origin.sx} y1={origin.sy} x2={g.sx} y2={g.sy} stroke="var(--margin-red)" strokeWidth={1.2} strokeDasharray="4 4" />
            <circle cx={g.sx} cy={g.sy} r={9} fill="none" stroke="var(--margin-red)" strokeWidth={1.5} />
          </g>
        )
      })()}
      <line x1={origin.sx} y1={origin.sy} x2={tip.sx} y2={tip.sy} stroke={accent} strokeWidth={2.6} strokeLinecap="round" />
      <circle cx={tip.sx} cy={tip.sy} r={len > 0.02 ? 6.5 : 4} fill={accent} opacity={tip.front ? 1 : 0.55} />
      <circle cx={origin.sx} cy={origin.sy} r={2.2} fill={ink} />
    </svg>
  )
}
