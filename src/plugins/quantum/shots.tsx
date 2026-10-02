/** Quantum plugin shots for reels: circuit, bloch, growth. */
import { BlochSphere, slerp, type Vec3 } from './BlochSphere'
import { State, type GateName } from './sim'
import { clamp, easeInOut, easeOut, seg, stagger } from '../../engine/reel/timeline'

const W = 1280
const H = 720

export interface PluginShotProps {
  props: Record<string, unknown>
  p: number
  reduced: boolean
}

/* ─────────── circuit ─────────── */

interface CircGate {
  gate: string
  targets: number[]
  controls?: number[]
  col: number
}

export function CircuitShot({ props, p }: PluginShotProps) {
  const n = Number(props.qubits ?? 2)
  const gates = (props.gates as CircGate[]) ?? []
  const cols = Math.max(1, ...gates.map((g) => g.col + 1))
  const left = 200
  const right = W - (props.showState ? 470 : 140)
  const top = 360 - ((n - 1) * 110) / 2
  const colW = (right - left) / (cols + 1)
  const y = (q: number) => top + q * 110
  const x = (c: number) => left + colW * (c + 1)
  const reveal = (c: number) => easeOut(seg(p, 0.08 + (c / cols) * 0.55, 0.16 + (c / cols) * 0.55))
  const wire = easeInOut(seg(p, 0, 0.12))

  let probs: number[] | null = null
  if (props.showState) {
    const s = new State(n)
    for (const g of [...gates].sort((a, b) => a.col - b.col)) {
      for (const t of g.targets) s.gate(g.gate as GateName, t, g.controls ?? [])
    }
    probs = s.probabilities()
  }
  const showProbs = seg(p, 0.7, 0.85)

  return (
    <div className="r-frame">
      <svg viewBox={`0 0 ${W} ${H}`} className="r-svg">
        {Array.from({ length: n }, (_, q) => (
          <g key={q}>
            <text x={left - 40} y={y(q) + 8} className="r-qlabel" textAnchor="end">
              q{q} |0⟩
            </text>
            <line x1={left - 20} x2={left - 20 + (right - left + 40) * wire} y1={y(q)} y2={y(q)} className="r-wire" />
          </g>
        ))}
        {gates.map((g, i) => {
          const v = reveal(g.col)
          const cx = x(g.col)
          if (g.controls?.length) {
            const all = [...g.controls, ...g.targets]
            const y0 = y(Math.min(...all))
            const y1 = y(Math.max(...all))
            return (
              <g key={i} style={{ opacity: v }}>
                <line x1={cx} x2={cx} y1={y0} y2={y0 + (y1 - y0) * v} className="r-wire-v" />
                {g.controls.map((c) => (
                  <circle key={c} cx={cx} cy={y(c)} r={11} className="r-ctrl" />
                ))}
                {g.targets.map((t) =>
                  g.gate === 'X' ? (
                    <g key={t}>
                      <circle cx={cx} cy={y(t)} r={26} className="r-target" />
                      <line x1={cx - 26} x2={cx + 26} y1={y(t)} y2={y(t)} className="r-target-line" />
                      <line x1={cx} x2={cx} y1={y(t) - 26} y2={y(t) + 26} className="r-target-line" />
                    </g>
                  ) : g.gate === 'Z' ? (
                    <circle key={t} cx={cx} cy={y(t)} r={11} className="r-ctrl" />
                  ) : (
                    <GateBox key={t} x={cx} y={y(t)} label={g.gate} />
                  ),
                )}
              </g>
            )
          }
          return (
            <g key={i} style={{ opacity: v, transform: `translateY(${(1 - v) * -16}px)` }}>
              {g.targets.map((t) => (
                <GateBox key={t} x={cx} y={y(t)} label={g.gate} />
              ))}
            </g>
          )
        })}
        {probs && (
          <g style={{ opacity: showProbs }} transform={`translate(${W - 420} ${200})`}>
            <text x={0} y={-30} className="r-tick">
              measurement probabilities
            </text>
            {probs.map((pr, i) => (
              <g key={i} transform={`translate(0 ${i * (320 / probs!.length)})`}>
                <text x={0} y={22} className="r-qlabel">
                  |{i.toString(2).padStart(n, '0')}⟩
                </text>
                <rect x={110} y={4} width={Math.max(1, 220 * pr * showProbs)} height={Math.min(30, 320 / probs!.length - 8)} className={pr > 0.01 ? 'r-bar r-bar-hi' : 'r-bar'} />
                <text x={120 + 220 * pr} y={24} className="r-value">
                  {pr < 1e-9 ? '0' : pr.toFixed(2)}
                </text>
              </g>
            ))}
          </g>
        )}
      </svg>
    </div>
  )
}

function GateBox({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g>
      <rect x={x - 30} y={y - 30} width={60} height={60} className="r-gate" />
      <text x={x} y={y + 11} textAnchor="middle" className="r-gate-label">
        {label}
      </text>
    </g>
  )
}

/* ─────────── bloch: the vector travels a path ─────────── */

interface BlochPoint {
  theta: number // degrees from |0⟩ (the north pole)
  phi: number // degrees around the equator from +x
  label: string
}

const toRad = (deg: number) => (deg * Math.PI) / 180
const vecOf = (b: BlochPoint): Vec3 => {
  const th = toRad(b.theta)
  const ph = toRad(b.phi)
  return { x: Math.sin(th) * Math.cos(ph), y: Math.sin(th) * Math.sin(ph), z: Math.cos(th) }
}

export function BlochShot({ props, p }: PluginShotProps) {
  const path = (props.path as BlochPoint[]) ?? [{ theta: 0, phi: 0, label: '|0⟩' }]
  const n = path.length
  const pos = n === 1 ? 0 : clamp((p - 0.08) / 0.8) * (n - 1)
  const i0 = Math.floor(pos)
  const i1 = Math.min(n - 1, i0 + 1)
  const local = easeInOut(clamp((pos - i0 - 0.3) / 0.55))
  const v = slerp(vecOf(path[i0]), vecOf(path[i1]), local)
  const trail: Vec3[] = []
  for (let s = 0; s <= 40; s++) {
    const q = (pos * s) / 40
    const a = Math.floor(q)
    const b = Math.min(n - 1, a + 1)
    trail.push(slerp(vecOf(path[a]), vecOf(path[b]), easeInOut(clamp((q - a - 0.3) / 0.55))))
  }
  const current = local > 0.5 ? path[i1] : path[i0]
  return (
    <div className="r-frame r-bloch-frame">
      <div className="r-bloch-sphere">
        <BlochSphere vec={v} tone="theatre" size={560} trail={trail} />
      </div>
      <div className="r-bloch-side">
        <div className="r-kicker">state</div>
        <div className="r-bloch-label">{current.label}</div>
        <ol className="r-bloch-path">
          {path.map((pt, i) => (
            <li key={i} className={i <= Math.round(pos) ? 'on' : ''}>
              {pt.label}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

/* ─────────── growth: 2ⁿ amplitudes and the memory to store them ─────────── */

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB', 'RB', 'QB']
export function bytesLabel(bytes: number) {
  let u = 0
  let v = bytes
  while (v >= 1000 && u < UNITS.length - 1) {
    v /= 1000
    u++
  }
  return `${v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)} ${UNITS[u]}`
}

export function GrowthShot({ props, p }: PluginShotProps) {
  const from = Number(props.from ?? 1)
  const to = Number(props.to ?? 50)
  const n = Math.round(from + (to - from) * easeInOut(seg(p, 0.08, 0.85)))
  const amps = 2 ** n
  const bytes = amps * 16 // complex128: two 8-byte floats
  const cells = Math.min(n, 10)
  const grid = 2 ** cells
  const cols = 2 ** Math.ceil(cells / 2)
  const rows = grid / cols
  const cell = Math.min(380 / cols, 380 / rows)
  return (
    <div className="r-frame r-growth">
      <svg viewBox={`0 0 ${W} ${H}`} className="r-svg">
        <g transform={`translate(${130} ${110})`}>
          {Array.from({ length: grid }, (_, i) => (
            <rect
              key={i}
              x={(i % cols) * cell}
              y={Math.floor(i / cols) * cell}
              width={Math.max(0.5, cell - (cell > 6 ? 2 : 0.5))}
              height={Math.max(0.5, cell - (cell > 6 ? 2 : 0.5))}
              className="r-cell"
              style={{ opacity: 0.35 + 0.65 * stagger(1, i, grid) }}
            />
          ))}
          {n > 10 && (
            <text x={0} y={412} className="r-tick">
              (showing 2¹⁰ of 2{supN(n)} cells)
            </text>
          )}
        </g>
        <g transform={`translate(${700} ${230})`}>
          <text className="r-tick" y={0}>
            qubits
          </text>
          <text className="r-growth-n" y={110}>
            {n}
          </text>
          <text className="r-tick" y={170}>
            complex amplitudes to track
          </text>
          <text className="r-growth-v" y={225}>
            {amps.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </text>
          <text className="r-tick" y={290}>
            memory at 16 bytes each
          </text>
          <text className="r-growth-v r-growth-mem" y={345}>
            {bytesLabel(bytes)}
          </text>
        </g>
      </svg>
    </div>
  )
}

function supN(n: number) {
  const m = '⁰¹²³⁴⁵⁶⁷⁸⁹'
  return String(n)
    .split('')
    .map((d) => m[Number(d)])
    .join('')
}
