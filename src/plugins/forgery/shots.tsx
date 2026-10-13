/** Forgery plugin shots for reels: layers (paint cross-section) and scan (examination wipe). */
import { useMemo } from 'react'
import { easeInOut, easeOut, seg, stagger } from '../../engine/reel/timeline'
import { MODE_LABEL, PAINTING_H, PAINTING_W, PaintingArt, type ExamMode } from './Painting'

const W = 1280
const H = 720

export interface PluginShotProps {
  props: Record<string, unknown>
  p: number
  reduced: boolean
}

/* ─────────── layers: a paint cross-section built from the bottom up ─────────── */

type LayerKind = 'support' | 'canvas' | 'ground' | 'underdrawing' | 'paint' | 'glaze' | 'varnish' | 'dirt'

const LAYER: Record<LayerKind, { h: number; fill: string; opacity?: number; dots?: string }> = {
  support: { h: 120, fill: 'var(--art-panel)' },
  canvas: { h: 60, fill: 'var(--art-panel-dark)' },
  ground: { h: 54, fill: 'var(--art-ground)' },
  underdrawing: { h: 7, fill: 'var(--art-carbon)' },
  paint: { h: 44, fill: 'var(--art-flesh)', dots: 'var(--art-red)' },
  glaze: { h: 20, fill: 'var(--art-red)', opacity: 0.55 },
  varnish: { h: 20, fill: 'var(--art-varnish)', opacity: 0.6 },
  dirt: { h: 8, fill: 'var(--art-umber)', opacity: 0.7 },
}

function wavy(x0: number, x1: number, y: number, amp: number, seed: number) {
  let d = ''
  for (let x = x0; x <= x1; x += 20) d += `${x === x0 ? 'M' : 'L'}${x},${(y + Math.sin(x * 0.021 + seed) * amp + Math.sin(x * 0.057 + seed * 2) * amp * 0.5).toFixed(1)}`
  return d
}

export function LayersShot({ props, p }: PluginShotProps) {
  const layers = ((props.layers as { kind: LayerKind; label: string }[]) ?? []).filter((l) => LAYER[l.kind])
  const highlight = props.highlight as number | undefined
  const x0 = 140
  const x1 = 720
  let y = 540
  const geo = layers.map((l, i) => {
    const spec = LAYER[l.kind]
    const bottom = y
    y -= spec.h
    return { ...l, spec, top: y, bottom, i }
  })
  const dots = useMemo(() => {
    const out: { x: number; y: number; r: number }[] = []
    let s = 11
    const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
    for (let k = 0; k < 140; k++) out.push({ x: x0 + 10 + r() * (x1 - x0 - 20), y: r(), r: 1.5 + r() * 3 })
    return out
  }, [])
  return (
    <div className="r-frame">
      <svg viewBox={`0 0 ${W} ${H}`} className="r-svg">
        {geo.map((g) => {
          const v = stagger(p, g.i, geo.length, 0.04, 0.78, 0.2)
          const top = g.top + (1 - v) * -30
          const path = `${wavy(x0, x1, top, g.spec.h > 30 ? 3 : 1.2, g.i)} L${x1},${g.bottom} L${x0},${g.bottom} Z`
          const hi = highlight === g.i
          return (
            <g key={g.i} style={{ opacity: v }}>
              <path d={path} fill={g.spec.fill} opacity={g.spec.opacity ?? 1} stroke={hi ? 'var(--t-accent)' : 'none'} strokeWidth={hi ? 4 : 0} />
              {g.spec.dots &&
                dots.map((d, k) => (
                  <circle key={k} cx={d.x} cy={g.top + 6 + d.y * (g.bottom - g.top - 12)} r={d.r} fill={k % 3 ? g.spec.dots : 'var(--art-lead)'} opacity={0.8} />
                ))}
              <line x1={x1 + 18} x2={x1 + 70} y1={(g.top + g.bottom) / 2} y2={(g.top + g.bottom) / 2} className="r-axis" />
              <text x={x1 + 84} y={(g.top + g.bottom) / 2 + 8} className={hi ? 'r-series-label r-tone-accent' : 'r-series-label r-tone-ink'}>
                {g.label}
              </text>
            </g>
          )
        })}
        <text x={x0} y={590} className="r-tick">
          cross-section · not to scale
        </text>
      </svg>
    </div>
  )
}

/* ─────────── scan: the case-file portrait, wiped from visible light to another mode ─────────── */

export function ScanShot({ props, p, reduced }: PluginShotProps) {
  const mode = (props.mode as ExamMode) ?? 'xray'
  const notes = (props.notes as string[]) ?? []
  const scale = 500 / PAINTING_H
  const pw = PAINTING_W * scale
  const left = notes.length ? 150 : (W - pw) / 2
  const top = 40
  const wipe = reduced ? 1 : easeInOut(seg(p, 0.1, 0.55))
  const clipW = PAINTING_W * wipe
  const id = `scan-${mode}`
  return (
    <div className="r-frame">
      <svg viewBox={`0 0 ${W} ${H}`} className="r-svg">
        <defs>
          <clipPath id={id}>
            <rect x={0} y={0} width={clipW} height={PAINTING_H} />
          </clipPath>
        </defs>
        <g transform={`translate(${left} ${top}) scale(${scale})`}>
          <PaintingArt mode="visible" />
          <g clipPath={`url(#${id})`}>
            <PaintingArt mode={mode} />
          </g>
          {wipe > 0 && wipe < 1 && <line x1={clipW} x2={clipW} y1={-6} y2={PAINTING_H + 6} stroke="var(--t-accent)" strokeWidth={3 / scale} />}
          <rect x={0} y={0} width={PAINTING_W} height={PAINTING_H} fill="none" stroke="var(--t-line-strong)" strokeWidth={2 / scale} />
        </g>
        <text x={left} y={top + 500 + 34} className="r-tick">
          {MODE_LABEL[mode].toLowerCase()} · synthetic case-file portrait
        </text>
        {notes.map((n, i) => {
          const v = easeOut(seg(p, 0.45 + i * 0.12, 0.6 + i * 0.12))
          return (
            <g key={i} style={{ opacity: v }} transform={`translate(${left + pw + 70} ${150 + i * 90})`}>
              <circle cx={0} cy={-8} r={7} className="r-dot r-dot-signal" />
              <text x={24} y={0} className="r-annot">
                {n}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
