/**
 * Generic shots. Every shot renders a 1280×720 frame as a pure function of
 * its progress `p` (0..1) — no internal timers — so scrubbing, pausing and
 * reduced-motion all come for free.
 */
import { Fragment, type ReactNode } from 'react'
import type { Shot } from '../../content/schema'
import { Rich, Tex, tokenize } from '../../ui/Tex'
import { clamp, easeInOut, easeOut, lerp, seg, stagger } from './timeline'

export interface ShotProps<K extends Shot['kind'] = Shot['kind']> {
  shot: Extract<Shot, { kind: K }>
  p: number
  t: number
  d: number
  reduced: boolean
}

const W = 1280
const H = 720

/** Slide-up-and-fade entrance; `reduced` drops the motion, keeps the fade. */
function rise(v: number, reduced: boolean, dist = 26) {
  return { opacity: v, transform: reduced ? undefined : `translateY(${(1 - v) * dist}px)` }
}

function Kicker({ children, v = 1 }: { children: ReactNode; v?: number }) {
  return (
    <div className="r-kicker" style={{ opacity: v }}>
      {children}
    </div>
  )
}

/* ─────────── title ─────────── */
export function TitleShot({ shot, p, reduced }: ShotProps<'title'>) {
  const lines = shot.title.split('\n')
  return (
    <div className="r-frame r-center-left">
      {shot.kicker && <Kicker v={easeOut(seg(p, 0.02, 0.15))}>{shot.kicker}</Kicker>}
      <h2 className="r-title">
        {lines.map((l, i) => {
          const v = easeOut(seg(p, 0.05 + i * 0.07, 0.3 + i * 0.07))
          return (
            <span key={i} className="r-mask">
              <span style={{ display: 'inline-block', transform: reduced ? undefined : `translateY(${(1 - v) * 105}%)`, opacity: reduced ? v : 1 }}>
                {l}
              </span>
            </span>
          )
        })}
      </h2>
      <div className="r-rule" style={{ transform: `scaleX(${easeInOut(seg(p, 0.18, 0.5))})` }} />
      {shot.subtitle && (
        <p className="r-subtitle" style={rise(easeOut(seg(p, 0.3, 0.5)), reduced)}>
          <Rich text={shot.subtitle} />
        </p>
      )}
    </div>
  )
}

/* ─────────── statement: words light up as they are spoken ─────────── */
export function StatementShot({ shot, p, reduced }: ShotProps<'statement'>) {
  const tokens = tokenize(shot.text)
  const words: { text: string; em: boolean; tex?: boolean }[] = []
  for (const tk of tokens) {
    if (tk.kind === 'tex') words.push({ text: tk.value, em: false, tex: true })
    else for (const w of tk.value.split(/(\s+)/)) if (w) words.push({ text: w, em: tk.kind === 'em' })
  }
  const visible = words.filter((w) => w.text.trim()).length
  let k = -1
  const long = visible > 26
  return (
    <div className="r-frame r-center-left">
      <p className={`r-statement${long ? ' r-statement-long' : ''}`}>
        {words.map((w, i) => {
          if (!w.text.trim()) return <Fragment key={i}>{w.text}</Fragment>
          k++
          const v = seg(p, 0.03 + (k / visible) * 0.72, 0.03 + (k / visible) * 0.72 + 0.08)
          const style = { opacity: 0.16 + 0.84 * v }
          if (w.tex) return <Tex key={i} tex={w.text} className="r-word" />
          return (
            <span key={i} className={w.em ? 'r-word r-em' : 'r-word'} style={style}>
              {w.text}
              {w.em && <span className="r-em-line" style={{ transform: `scaleX(${reduced ? v : easeOut(v)})` }} />}
            </span>
          )
        })}
      </p>
      {shot.footnote && (
        <p className="r-footnote" style={{ opacity: seg(p, 0.6, 0.75) }}>
          <Rich text={shot.footnote} />
        </p>
      )}
    </div>
  )
}

/* ─────────── equation ─────────── */
export function EquationShot({ shot, p, reduced }: ShotProps<'equation'>) {
  const n = shot.tex.length
  return (
    <div className="r-frame r-center">
      <div className="r-equations">
        {shot.tex.map((tx, i) => (
          <div key={i} className="r-eq" style={rise(stagger(p, i, n, 0.04, n > 1 ? 0.55 : 0.2, 0.16), reduced, 18)}>
            <Tex tex={tx} block />
          </div>
        ))}
      </div>
      {shot.notes.length > 0 && (
        <div className="r-eq-notes">
          {shot.notes.map((note, i) => (
            <div key={i} className="r-eq-note" style={rise(stagger(p, i, shot.notes.length, 0.45, 0.85, 0.12), reduced, 10)}>
              <span className="r-note-mark">{String.fromCharCode(97 + i)}</span>
              <Rich text={note} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─────────── bars: morph between frames ─────────── */
export function BarsShot({ shot, p }: ShotProps<'bars'>) {
  const frames = shot.frames
  const nf = frames.length
  // spend 10% at the start settling, then morph through frames
  const pos = nf === 1 ? 0 : clamp((p - 0.06) / 0.8) * (nf - 1)
  const i0 = Math.floor(pos)
  const i1 = Math.min(nf - 1, i0 + 1)
  const local = easeInOut(clamp(((pos - i0) - 0.25) / 0.5))
  const values = frames[i0].values.map((v, i) => lerp(v, frames[i1].values[i], local))
  const current = local > 0.5 ? frames[i1] : frames[i0]
  const max = shot.max ?? Math.max(1e-9, ...frames.flatMap((f) => f.values.map(Math.abs)))
  const n = shot.labels.length
  const left = 120
  const right = W - 90
  const top = 210
  const bottom = 520
  const zeroY = shot.signed ? (top + bottom) / 2 : bottom
  const span = shot.signed ? (bottom - top) / 2 : bottom - top
  const slot = (right - left) / n
  const bw = Math.min(110, slot * 0.62)
  const grow = easeOut(seg(p, 0, 0.12))
  return (
    <div className="r-frame">
      <div className="r-bars-caption">{current.caption ? <Rich text={current.caption} /> : null}</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="r-svg">
        <line x1={left - 20} x2={right + 20} y1={zeroY} y2={zeroY} className="r-axis" />
        {shot.signed && (
          <>
            <text x={left - 34} y={top + 6} className="r-tick" textAnchor="end">+{fmt(max)}</text>
            <text x={left - 34} y={bottom + 6} className="r-tick" textAnchor="end">−{fmt(max)}</text>
          </>
        )}
        {values.map((v, i) => {
          const h = (Math.abs(v) / max) * span * grow
          const x = left + slot * i + (slot - bw) / 2
          const y = v >= 0 ? zeroY - h : zeroY
          const hi = current.highlight.includes(i)
          return (
            <g key={i}>
              <rect x={x} y={y} width={bw} height={Math.max(0.5, h)} className={hi ? 'r-bar r-bar-hi' : 'r-bar'} />
              <text x={x + bw / 2} y={(v >= 0 ? y : y + h) + (v >= 0 ? -12 : 28)} className="r-value" textAnchor="middle">
                {fmt(v)}
              </text>
              <text x={x + bw / 2} y={bottom + 46} className="r-tick" textAnchor="middle">
                {shot.labels[i]}
              </text>
            </g>
          )
        })}
        {shot.unit && (
          <text x={left - 20} y={top - 22} className="r-tick">
            {shot.unit}
          </text>
        )}
      </svg>
    </div>
  )
}

function fmt(v: number) {
  const a = Math.abs(v)
  if (a === 0) return '0'
  if (a >= 1000) return v.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (a >= 10) return v.toFixed(0)
  if (a >= 1) return v.toFixed(2).replace(/\.?0+$/, '')
  return v.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
}

/* ─────────── chart: series draw in ─────────── */
export function ChartShot({ shot, p }: ShotProps<'chart'>) {
  const left = 150
  const right = W - 120
  const top = 140
  const bottom = 520
  const xs = shot.series.flatMap((s) => s.points.map((pt) => pt[0]))
  const ys = shot.series.flatMap((s) => s.points.map((pt) => pt[1]))
  const tx = (v: number) => (shot.logX ? Math.log10(v) : v)
  const ty = (v: number) => (shot.logY ? Math.log10(v) : v)
  const [x0, x1] = [Math.min(...xs.map(tx)), Math.max(...xs.map(tx))]
  const [y0, y1] = [Math.min(...ys.map(ty)), Math.max(...ys.map(ty))]
  const sx = (v: number) => left + ((tx(v) - x0) / (x1 - x0 || 1)) * (right - left)
  const sy = (v: number) => bottom - ((ty(v) - y0) / (y1 - y0 || 1)) * (bottom - top)
  const n = shot.series.length
  const ticks = (lo: number, hi: number, log: boolean) => {
    if (log) {
      const out: number[] = []
      for (let e = Math.ceil(lo); e <= Math.floor(hi); e++) out.push(10 ** e)
      return out
    }
    return Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4)
  }
  const tickLabel = (v: number, log: boolean) => (log ? `10${sup(Math.round(Math.log10(v)))}` : fmt(v))
  return (
    <div className="r-frame">
      <svg viewBox={`0 0 ${W} ${H}`} className="r-svg">
        <line x1={left} x2={right} y1={bottom} y2={bottom} className="r-axis" />
        <line x1={left} x2={left} y1={top} y2={bottom} className="r-axis" />
        {ticks(x0, x1, shot.logX).map((v, i) => (
          <text key={i} x={sx(v)} y={bottom + 34} className="r-tick" textAnchor="middle">
            {tickLabel(v, shot.logX)}
          </text>
        ))}
        {ticks(y0, y1, shot.logY).map((v, i) => (
          <g key={i}>
            <line x1={left} x2={right} y1={sy(v)} y2={sy(v)} className="r-grid" />
            <text x={left - 16} y={sy(v) + 6} className="r-tick" textAnchor="end">
              {tickLabel(v, shot.logY)}
            </text>
          </g>
        ))}
        <text x={(left + right) / 2} y={bottom + 70} className="r-axis-label" textAnchor="middle">
          {shot.xLabel}
        </text>
        <text x={left - 20} y={top - 34} className="r-axis-label">
          {shot.yLabel}
        </text>
        {shot.series.map((s, si) => {
          const draw = easeInOut(seg(p, 0.06 + si * 0.12, 0.6 + si * 0.12))
          const d = s.points.map((pt, i) => `${i ? 'L' : 'M'}${sx(pt[0]).toFixed(1)},${sy(pt[1]).toFixed(1)}`).join('')
          const last = s.points[s.points.length - 1]
          return (
            <g key={si}>
              <path d={d} pathLength={1} className={`r-line r-tone-${s.tone}`} style={{ strokeDasharray: 1, strokeDashoffset: 1 - draw }} />
              {n === 1 && (
                <text x={sx(last[0])} y={sy(last[1]) - 16} textAnchor="end" className={`r-series-label r-tone-${s.tone}`} style={{ opacity: seg(draw, 0.85, 1) }}>
                  {s.name}
                </text>
              )}
            </g>
          )
        })}
        {shot.annotations.map((a, i) => {
          const v = seg(p, 0.65 + i * 0.06, 0.75 + i * 0.06)
          return (
            <g key={i} style={{ opacity: v }}>
              <circle cx={sx(a.x)} cy={sy(a.y)} r={7} className="r-dot" />
              <text x={sx(a.x) + 16} y={sy(a.y) - 14} className="r-annot">
                {a.text}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="r-legend" style={{ opacity: seg(p, 0.1, 0.2) }}>
        {n > 1 &&
          shot.series.map((s, i) => (
            <span key={i} className={`r-legend-item r-tone-${s.tone}`}>
              <i />
              {s.name}
            </span>
          ))}
      </div>
    </div>
  )
}

function sup(n: number) {
  const map: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' }
  return String(n)
    .split('')
    .map((c) => map[c] ?? c)
    .join('')
}

/* ─────────── list ─────────── */
export function ListShot({ shot, p, reduced }: ShotProps<'list'>) {
  const n = shot.items.length
  return (
    <div className="r-frame r-top-left">
      {shot.heading && <Kicker v={easeOut(seg(p, 0, 0.1))}>{shot.heading}</Kicker>}
      <ol className={`r-list${n > 4 ? ' r-list-dense' : ''}`}>
        {shot.items.map((it, i) => {
          const v = stagger(p, i, n, 0.06, 0.82, 0.14)
          return (
            <li key={i} style={rise(v, reduced, 16)}>
              <span className="r-num">{String(i + 1).padStart(2, '0')}</span>
              <span className="r-li-text">
                <Rich text={it} />
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/* ─────────── compare ─────────── */
export function CompareShot({ shot, p, reduced }: ShotProps<'compare'>) {
  const rows = Math.max(shot.left.items.length, shot.right.items.length)
  const col = (side: 'left' | 'right') => {
    const c = shot[side]
    return (
      <div className={`r-col r-col-${side}`}>
        <div className="r-col-head" style={{ opacity: seg(p, side === 'left' ? 0.02 : 0.08, side === 'left' ? 0.1 : 0.16) }}>
          {c.heading}
        </div>
        {c.items.map((it, i) => {
          const v = stagger(p, i * 2 + (side === 'right' ? 1 : 0), rows * 2, 0.12, 0.85, 0.12)
          return (
            <div key={i} className="r-col-item" style={rise(v, reduced, 12)}>
              <Rich text={it} />
            </div>
          )
        })}
      </div>
    )
  }
  return (
    <div className="r-frame r-compare">
      {col('left')}
      <div className="r-compare-rule" style={{ transform: `scaleY(${easeInOut(seg(p, 0, 0.2))})` }} />
      {col('right')}
    </div>
  )
}

/* ─────────── timeline: the camera pans along the years ─────────── */
export function TimelineShot({ shot, p, reduced }: ShotProps<'timeline'>) {
  const n = shot.events.length
  const gap = 340
  const span = (n - 1) * gap
  const pan = reduced ? 0 : Math.max(0, span - (W - 360)) * easeInOut(seg(p, 0.08, 0.92))
  return (
    <div className="r-frame">
      <svg viewBox={`0 0 ${W} ${H}`} className="r-svg">
        <g transform={`translate(${180 - pan} 0)`}>
          <line x1={-200} x2={span + 400} y1={330} y2={330} className="r-axis" />
          {shot.events.map((e, i) => {
            const v = stagger(p, i, n, 0.04, 0.9, 0.12)
            const x = i * gap
            return (
              <g key={i} style={{ opacity: v }}>
                <line x1={x} x2={x} y1={330} y2={330 - 34 * v} className="r-axis" />
                <circle cx={x} cy={330} r={8} className={i === n - 1 ? 'r-dot r-dot-signal' : 'r-dot'} />
                <text x={x} y={280 - 10 * v} className="r-year" textAnchor="start">
                  {e.year}
                </text>
                <foreignObject x={x - 2} y={356} width={gap - 40} height={200}>
                  <div className="r-event">
                    <div className="r-event-label">{e.label}</div>
                    {e.detail && <div className="r-event-detail">{e.detail}</div>}
                  </div>
                </foreignObject>
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}

/* ─────────── stat: a number counts up ─────────── */
export function StatShot({ shot, p, reduced }: ShotProps<'stat'>) {
  const v = reduced ? 1 : easeOut(seg(p, 0.02, 0.42))
  const value = shot.value * v
  const text = value.toLocaleString('en-US', { minimumFractionDigits: shot.decimals, maximumFractionDigits: shot.decimals })
  return (
    <div className="r-frame r-center-left">
      <div className="r-stat">
        {shot.prefix && <span className="r-stat-affix">{shot.prefix}</span>}
        {text}
        {shot.suffix && <span className="r-stat-affix">{shot.suffix}</span>}
      </div>
      <div className="r-rule" style={{ transform: `scaleX(${easeInOut(seg(p, 0.08, 0.3))})` }} />
      <div className="r-stat-label" style={rise(easeOut(seg(p, 0.1, 0.3)), reduced)}>
        <Rich text={shot.label} />
      </div>
      {shot.context && (
        <div className="r-footnote" style={{ opacity: seg(p, 0.3, 0.45) }}>
          <Rich text={shot.context} />
        </div>
      )}
    </div>
  )
}

/* ─────────── code: typed, then focus moves through line groups ─────────── */
const KW = /\b(import|from|as|def|return|for|in|if|else|elif|print|class|with|lambda|True|False|None|const|let|function|new|await|async)\b/
export function CodeShot({ shot, p }: ShotProps<'code'>) {
  const lines = shot.code.split('\n')
  const total = shot.code.length
  const typed = Math.floor(total * easeOut(seg(p, 0.02, shot.focus.length ? 0.45 : 0.75)))
  const focusPhase = seg(p, 0.5, 0.95)
  const group = shot.focus.length ? shot.focus[Math.min(shot.focus.length - 1, Math.floor(focusPhase * shot.focus.length))] : null
  let consumed = 0
  return (
    <div className="r-frame r-code-frame">
      <div className="r-code-head">
        <span>{shot.language}</span>
      </div>
      <pre className="r-code">
        {lines.map((line, i) => {
          const visible = line.slice(0, Math.max(0, typed - consumed))
          consumed += line.length + 1
          const dim = group && p > 0.5 && !group.includes(i + 1)
          return (
            <div key={i} className={`r-code-line${dim ? ' r-dim' : ''}${group?.includes(i + 1) && p > 0.5 ? ' r-focus' : ''}`}>
              <span className="r-ln">{i + 1}</span>
              <span>{highlight(visible)}</span>
            </div>
          )
        })}
      </pre>
    </div>
  )
}

function highlight(src: string) {
  const out: ReactNode[] = []
  const re = /(#.*$|\/\/.*$)|("[^"]*"?|'[^']*'?)|(\b\d+(\.\d+)?\b)|(\b[A-Za-z_]\w*\b)/g
  let last = 0
  let m: RegExpExecArray | null
  let k = 0
  while ((m = re.exec(src))) {
    if (m.index > last) out.push(src.slice(last, m.index))
    const [tok] = m
    const cls = m[1] ? 'c-com' : m[2] ? 'c-str' : m[3] ? 'c-num' : KW.test(tok) ? 'c-kw' : undefined
    out.push(cls ? <span key={k++} className={cls}>{tok}</span> : tok)
    last = m.index + tok.length
  }
  if (last < src.length) out.push(src.slice(last))
  return out
}

/* ─────────── diagram ─────────── */
export function DiagramShot({ shot, p }: ShotProps<'diagram'>) {
  const n = shot.nodes.length
  const pos = Object.fromEntries(shot.nodes.map((nd, i) => [nd.id, { x: 120 + (nd.x / 100) * (W - 240), y: 120 + (nd.y / 100) * 400, i }]))
  const appear = (i: number) => stagger(p, i, n, 0.04, 0.7, 0.12)
  return (
    <div className="r-frame">
      <svg viewBox={`0 0 ${W} ${H}`} className="r-svg">
        <defs>
          <marker id="r-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" className="r-arrowhead" />
          </marker>
        </defs>
        {shot.edges.map((e, i) => {
          const a = pos[e.from]
          const b = pos[e.to]
          const v = easeInOut(seg(Math.min(appear(a.i), appear(b.i)), 0.7, 1)) * easeInOut(seg(p, 0.1, 0.85))
          const dx = b.x - a.x
          const dy = b.y - a.y
          const len = Math.hypot(dx, dy) || 1
          const pad = 92
          const x1 = a.x + (dx / len) * pad
          const y1 = a.y + (dy / len) * 40
          const x2 = b.x - (dx / len) * pad
          const y2 = b.y - (dy / len) * 40
          return (
            <g key={i}>
              <path d={`M${x1},${y1} L${x2},${y2}`} pathLength={1} className="r-edge" markerEnd="url(#r-arrow)" style={{ strokeDasharray: 1, strokeDashoffset: 1 - v, opacity: v > 0 ? 1 : 0 }} />
              {e.label && (
                <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 12} className="r-edge-label" textAnchor="middle" style={{ opacity: seg(v, 0.7, 1) }}>
                  {e.label}
                </text>
              )}
            </g>
          )
        })}
        {shot.nodes.map((nd) => {
          const { x, y, i } = pos[nd.id]
          const v = appear(i)
          return (
            <g key={nd.id} style={{ opacity: v }} transform={`translate(${x} ${y + (1 - v) * 14})`}>
              <rect x={-96} y={-36} width={192} height={72} className={`r-node r-node-${nd.tone}`} />
              <foreignObject x={-90} y={-34} width={180} height={68}>
                <div className="r-node-label">{nd.label}</div>
              </foreignObject>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/* ─────────── quote ─────────── */
export function QuoteShot({ shot, p, reduced }: ShotProps<'quote'>) {
  return (
    <div className="r-frame r-center-left">
      <div className="r-quote-mark" style={{ opacity: seg(p, 0, 0.1) }}>
        “
      </div>
      <blockquote className="r-quote" style={rise(easeOut(seg(p, 0.04, 0.3)), reduced)}>
        <Rich text={shot.text} />
      </blockquote>
      <div className="r-quote-by" style={{ opacity: seg(p, 0.3, 0.45) }}>
        — {shot.by}
      </div>
    </div>
  )
}

export const SHOT_COMPONENTS = {
  title: TitleShot,
  statement: StatementShot,
  equation: EquationShot,
  bars: BarsShot,
  chart: ChartShot,
  list: ListShot,
  compare: CompareShot,
  timeline: TimelineShot,
  stat: StatShot,
  code: CodeShot,
  diagram: DiagramShot,
  quote: QuoteShot,
} as const

export const FRAME = { W, H }
