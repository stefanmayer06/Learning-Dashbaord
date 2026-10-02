/** Small, honest SVG charts for labs (paper theme). */
import type { ReactNode } from 'react'

export interface Series {
  name: string
  points: [number, number][]
  tone?: 'ink' | 'accent' | 'red' | 'faint'
  dashed?: boolean
  band?: [number, number, number][] // x, lo, hi
}

const toneVar = { ink: 'var(--ink)', accent: 'var(--accent-fg)', red: 'var(--margin-red)', faint: 'var(--ink-faint)' }

export function LineChart({
  series,
  width = 560,
  height = 300,
  logX,
  logY,
  xLabel,
  yLabel,
  hline,
  marker,
  yDomain,
  children,
}: {
  series: Series[]
  width?: number
  height?: number
  logX?: boolean
  logY?: boolean
  xLabel: string
  yLabel: string
  hline?: { y: number; label: string }
  marker?: { x: number; y: number; label?: string }
  yDomain?: [number, number]
  children?: ReactNode
}) {
  const m = { l: 58, r: 18, t: 22, b: 46 }
  const pts = series.flatMap((s) => [...s.points, ...(s.band ?? []).flatMap(([x, lo, hi]) => [[x, lo], [x, hi]] as [number, number][])])
  if (hline) pts.push([pts[0]?.[0] ?? 0, hline.y])
  const fx = (v: number) => (logX ? Math.log10(Math.max(v, 1e-300)) : v)
  const fy = (v: number) => (logY ? Math.log10(Math.max(v, 1e-300)) : v)
  const xs = pts.map((p) => fx(p[0]))
  const ys = pts.map((p) => fy(p[1]))
  const x0 = Math.min(...xs)
  const x1 = Math.max(...xs)
  let y0 = yDomain ? fy(yDomain[0]) : Math.min(...ys)
  let y1 = yDomain ? fy(yDomain[1]) : Math.max(...ys)
  if (y0 === y1) {
    y0 -= 1
    y1 += 1
  }
  const pad = (y1 - y0) * 0.06
  if (!yDomain) {
    y0 -= pad
    y1 += pad
  }
  const sx = (v: number) => m.l + ((fx(v) - x0) / (x1 - x0 || 1)) * (width - m.l - m.r)
  const sy = (v: number) => height - m.b - ((fy(v) - y0) / (y1 - y0 || 1)) * (height - m.t - m.b)
  const ticks = (lo: number, hi: number, log?: boolean) => {
    if (log) {
      const out: number[] = []
      for (let e = Math.ceil(lo); e <= Math.floor(hi); e++) out.push(10 ** e)
      return out
    }
    const step = niceStep((hi - lo) / 4)
    const out: number[] = []
    for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-12; v += step) out.push(v)
    return out
  }
  const fmt = (v: number, log?: boolean) => {
    if (log) {
      const e = Math.round(Math.log10(v))
      return e >= 0 && e <= 4 ? String(10 ** e) : `1e${e}`
    }
    return Math.abs(v) >= 1000 ? v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : +v.toFixed(4) + ''
  }
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="chart" role="img" aria-label={`${yLabel} against ${xLabel}`}>
      {ticks(y0, y1, logY).map((v, i) => (
        <g key={'y' + i}>
          <line x1={m.l} x2={width - m.r} y1={sy(v)} y2={sy(v)} className="chart-grid" />
          <text x={m.l - 8} y={sy(v) + 4} textAnchor="end" className="chart-tick">
            {fmt(v, logY)}
          </text>
        </g>
      ))}
      {ticks(x0, x1, logX).map((v, i) => (
        <text key={'x' + i} x={sx(v)} y={height - m.b + 18} textAnchor="middle" className="chart-tick">
          {fmt(v, logX)}
        </text>
      ))}
      <line x1={m.l} x2={width - m.r} y1={height - m.b} y2={height - m.b} className="chart-axis" />
      <line x1={m.l} x2={m.l} y1={m.t} y2={height - m.b} className="chart-axis" />
      <text x={(m.l + width - m.r) / 2} y={height - 8} textAnchor="middle" className="chart-label">
        {xLabel}
      </text>
      <text x={m.l} y={12} className="chart-label">
        {yLabel}
      </text>
      {hline && (
        <g>
          <line x1={m.l} x2={width - m.r} y1={sy(hline.y)} y2={sy(hline.y)} stroke="var(--margin-red)" strokeDasharray="5 4" strokeWidth={1.2} />
          <text x={width - m.r} y={sy(hline.y) - 6} textAnchor="end" className="chart-tick" fill="var(--margin-red)">
            {hline.label}
          </text>
        </g>
      )}
      {series.map((s, i) => (
        <g key={i}>
          {s.band && s.band.length > 1 && (
            <path
              d={
                s.band.map(([x, , hi], j) => `${j ? 'L' : 'M'}${sx(x)},${sy(hi)}`).join('') +
                [...s.band].reverse().map(([x, lo]) => `L${sx(x)},${sy(lo)}`).join('') +
                'Z'
              }
              fill={toneVar[s.tone ?? 'ink']}
              opacity={0.12}
            />
          )}
          <path
            d={s.points.map(([x, y], j) => `${j ? 'L' : 'M'}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join('')}
            fill="none"
            stroke={toneVar[s.tone ?? 'ink']}
            strokeWidth={2}
            strokeDasharray={s.dashed ? '6 5' : undefined}
          />
        </g>
      ))}
      {marker && (
        <g>
          <circle cx={sx(marker.x)} cy={sy(marker.y)} r={5.5} fill="var(--paper)" stroke="var(--margin-red)" strokeWidth={2} />
          {marker.label && (
            <text x={sx(marker.x) + 9} y={sy(marker.y) - 9} className="chart-tick" fill="var(--margin-red)">
              {marker.label}
            </text>
          )}
        </g>
      )}
      {children}
    </svg>
  )
}

function niceStep(raw: number) {
  const p = 10 ** Math.floor(Math.log10(raw || 1))
  const n = raw / p
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p
}

export function Legend({ items }: { items: { label: string; tone: keyof typeof toneVar; dashed?: boolean }[] }) {
  return (
    <div className="legend">
      {items.map((it) => (
        <span key={it.label} className="legend-item">
          <svg width="22" height="8" aria-hidden>
            <line x1="0" x2="22" y1="4" y2="4" stroke={toneVar[it.tone]} strokeWidth="2" strokeDasharray={it.dashed ? '5 4' : undefined} />
          </svg>
          {it.label}
        </span>
      ))}
    </div>
  )
}
