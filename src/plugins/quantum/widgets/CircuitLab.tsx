import { useEffect, useMemo, useState } from 'react'
import type { WidgetApi } from '../../types'
import { LabFrame } from '../../../ui/LabFrame'
import { Glyph } from '../../../ui/Glyph'
import { BlochSphere } from '../BlochSphere'
import { State, c, mulberry32, type GateName } from '../sim'

type Palette = 'H' | 'X' | 'Y' | 'Z' | 'S' | 'T' | 'CX' | 'CZ' | 'erase'

interface Op {
  col: number
  gate: GateName
  target: number
  control?: number
}

const CHALLENGES: Record<string, { label: string; qubits: number; target?: (n: number) => State; hint: string }> = {
  bell: {
    label: 'Build the Bell state (|00⟩ + |11⟩)/√2',
    qubits: 2,
    target: () => State.fromAmplitudes([c(Math.SQRT1_2), c(0), c(0), c(Math.SQRT1_2)]),
    hint: 'Superpose one qubit, then let it control the other.',
  },
  ghz: {
    label: 'Build a 3-qubit GHZ state (|000⟩ + |111⟩)/√2',
    qubits: 3,
    target: () => {
      const a = new Array(8).fill(0).map(() => c(0))
      a[0] = c(Math.SQRT1_2)
      a[7] = c(Math.SQRT1_2)
      return State.fromAmplitudes(a)
    },
    hint: 'Same trick as the Bell state, one more link in the chain.',
  },
  ones: {
    label: 'Flip every qubit to 1',
    qubits: 2,
    target: (n) => {
      const a = new Array(2 ** n).fill(0).map(() => c(0))
      a[2 ** n - 1] = c(1)
      return State.fromAmplitudes(a)
    },
    hint: 'X is the quantum NOT.',
  },
  free: { label: 'Free play: place at least three gates and run the circuit', qubits: 3, hint: '' },
}

const CELL = 58
const PAD_L = 74

export function CircuitLab({ props, complete, done, capture, captured }: WidgetApi) {
  const challenge = CHALLENGES[(props.challenge as string) ?? 'free'] ?? CHALLENGES.free
  const n = Number(props.qubits ?? challenge.qubits)
  const cols = Number(props.columns ?? 6)
  const [ops, setOps] = useState<Op[]>([])
  const [tool, setTool] = useState<Palette>('H')
  const [pending, setPending] = useState<{ col: number; control: number } | null>(null)
  const [counts, setCounts] = useState<number[] | null>(null)

  const state = useMemo(() => {
    const s = new State(n)
    for (const op of [...ops].sort((a, b) => a.col - b.col)) s.gate(op.gate, op.target, op.control !== undefined ? [op.control] : [])
    return s
  }, [ops, n])

  const fidelity = challenge.target ? state.fidelity(challenge.target(n)) : 0
  const met = challenge.target ? fidelity > 0.999 : ops.length >= 3 && counts !== null

  useEffect(() => {
    if (met && !done) complete()
  }, [met, done, complete])
  useEffect(() => setCounts(null), [ops])

  const occupied = (col: number, q: number) => ops.find((o) => o.col === col && (o.target === q || o.control === q))
  const colHasControlled = (col: number) => ops.some((o) => o.col === col && o.control !== undefined)

  const clickCell = (col: number, q: number) => {
    if (tool === 'erase') {
      setOps((o) => o.filter((op) => !(op.col === col && (op.target === q || op.control === q))))
      return
    }
    if (tool === 'CX' || tool === 'CZ') {
      if (!pending) {
        if (ops.some((o) => o.col === col)) setOps((o) => o.filter((op) => op.col !== col))
        setPending({ col, control: q })
        return
      }
      if (pending.col !== col || pending.control === q) {
        setPending(null)
        return
      }
      setOps((o) => [...o.filter((op) => op.col !== col), { col, gate: tool === 'CX' ? 'X' : 'Z', target: q, control: pending.control }])
      setPending(null)
      return
    }
    setPending(null)
    setOps((o) => {
      const rest = colHasControlled(col) ? o.filter((op) => op.col !== col) : o.filter((op) => !(op.col === col && op.target === q))
      return [...rest, { col, gate: tool as GateName, target: q }]
    })
  }

  const run = () => setCounts(state.sample(1024, mulberry32(ops.length * 31 + 7)))

  const probs = state.probabilities()
  const width = PAD_L + cols * CELL + 24
  const height = n * CELL + 18
  const y = (q: number) => 12 + q * CELL + CELL / 2
  const x = (col: number) => PAD_L + col * CELL + CELL / 2

  const describe = () =>
    [...ops]
      .sort((a, b) => a.col - b.col)
      .map((o) => (o.control !== undefined ? `C${o.gate} q${o.control}→q${o.target}` : `${o.gate} q${o.target}`))
      .join(', ')

  return (
    <LabFrame
      goal={challenge.label}
      met={done || met}
      aside={challenge.target ? <>Fidelity <span className="mono">{fidelity.toFixed(3)}</span></> : null}
      onSave={
        capture
          ? () =>
              capture(`${describe() || 'empty circuit'}${challenge.target ? ` · fidelity ${fidelity.toFixed(3)}` : ''}`, {
                qubits: n,
                ops,
                probabilities: probs,
              })
          : undefined
      }
      captured={captured}
    >
      <div className="clab">
        <h3 className="lab-h">Pick a gate, then click the circuit</h3>
        <div className="clab-palette" role="toolbar" aria-label="Gate palette">
          {(['H', 'X', 'Y', 'Z', 'S', 'T', 'CX', 'CZ', 'erase'] as Palette[]).map((g) => (
            <button
              key={g}
              className={`gate-btn ${tool === g ? 'on' : ''} ${g === 'erase' ? 'gate-btn-erase' : ''}`}
              onClick={() => (setTool(g), setPending(null))}
              aria-pressed={tool === g}
              aria-label={g === 'erase' ? 'Eraser' : g === 'CX' ? 'CX (controlled NOT)' : g === 'CZ' ? 'CZ (controlled Z)' : undefined}
              title={g === 'erase' ? 'Eraser' : undefined}
            >
              {g === 'erase' ? <Glyph name="cross" size={16} /> : g === 'CX' ? '●⊕' : g === 'CZ' ? '●●' : g}
            </button>
          ))}
        </div>
        <p className="clab-hint" aria-live="polite">
          <Glyph name="info" size={16} />
          {pending ? 'Now click the target qubit in the same column' : tool === 'CX' || tool === 'CZ' ? 'Click the control qubit first' : tool === 'erase' ? 'Click a gate to remove it' : 'Click a cell to place the gate'}
        </p>
        <div className="clab-board lab-panel">
          <svg viewBox={`0 0 ${width} ${height}`} className="clab-svg" style={{ maxWidth: width * 1.3 }}>
            {Array.from({ length: n }, (_, q) => (
              <g key={q}>
                <text x={8} y={y(q) + 5} className="clab-qlabel">
                  q{q}
                </text>
                <line x1={PAD_L - 14} x2={width - 10} y1={y(q)} y2={y(q)} className="clab-wire" />
              </g>
            ))}
            {Array.from({ length: cols }, (_, col) =>
              Array.from({ length: n }, (_, q) => {
                const isPendingCol = pending?.col === col
                return (
                  <rect
                    key={`${col}-${q}`}
                    x={PAD_L + col * CELL + 4}
                    y={12 + q * CELL + 4}
                    width={CELL - 8}
                    height={CELL - 8}
                    rx={7}
                    className={`clab-cell ${isPendingCol && pending?.control !== q ? 'candidate' : ''} ${occupied(col, q) ? 'filled' : ''}`}
                    onClick={() => clickCell(col, q)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Column ${col + 1}, qubit ${q}`}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && clickCell(col, q)}
                  />
                )
              }),
            )}
            {pending && <circle cx={x(pending.col)} cy={y(pending.control)} r={8} className="clab-ctrl pending" />}
            {ops.map((op, i) =>
              op.control !== undefined ? (
                <g key={i} className="clab-op" pointerEvents="none">
                  <line x1={x(op.col)} x2={x(op.col)} y1={y(op.control)} y2={y(op.target)} className="clab-vline" />
                  <circle cx={x(op.col)} cy={y(op.control)} r={7} className="clab-ctrl" />
                  {op.gate === 'X' ? (
                    <g>
                      <circle cx={x(op.col)} cy={y(op.target)} r={15} className="clab-target" />
                      <line x1={x(op.col) - 15} x2={x(op.col) + 15} y1={y(op.target)} y2={y(op.target)} className="clab-vline" />
                      <line x1={x(op.col)} x2={x(op.col)} y1={y(op.target) - 15} y2={y(op.target) + 15} className="clab-vline" />
                    </g>
                  ) : (
                    <circle cx={x(op.col)} cy={y(op.target)} r={7} className="clab-ctrl" />
                  )}
                </g>
              ) : (
                <g key={i} className="clab-op" pointerEvents="none">
                  <rect x={x(op.col) - 19} y={y(op.target) - 19} width={38} height={38} rx={7} className="clab-gate" />
                  <text x={x(op.col)} y={y(op.target) + 6} textAnchor="middle" className="clab-gate-label">
                    {op.gate}
                  </text>
                </g>
              ),
            )}
          </svg>
        </div>
        <div className="lab-actions">
          <button className="btn btn-small" onClick={run}>
            Run 1,024 shots <Glyph name="play" size={12} />
          </button>
          <button className="btn btn-small btn-ghost" onClick={() => (setOps([]), setPending(null))}>
            Clear <Glyph name="restart" size={14} />
          </button>
          {challenge.hint && !met && (
            <span className="clab-tip">
              <Glyph name="lamp" size={16} /> Hint: {challenge.hint}
            </span>
          )}
        </div>

        <div className="clab-results">
          <div className="clab-amps">
            <h3 className="lab-h">Exact state</h3>
            <div className="lab-table-wrap">
              <table className="amp-table lab-table">
                <thead>
                  <tr>
                    <th scope="col">Basis</th>
                    <th scope="col" className="num-col">Amplitude</th>
                    <th scope="col">Phase</th>
                    <th scope="col" colSpan={2}>Probability</th>
                    {counts && (
                      <th scope="col" className="num-col">
                        Counts
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {probs.map((pr, i) => {
                    const a = state.amp(i)
                    const ph = Math.atan2(a[1], a[0])
                    return (
                      <tr key={i} className={pr < 1e-9 ? 'zero' : ''}>
                        <td className="mono">|{state.label(i)}⟩</td>
                        <td className="mono amp-val">{pr < 1e-9 ? '0' : `${Math.sqrt(pr).toFixed(3)}`}</td>
                        <td>
                          <svg width="22" height="22" viewBox="-11 -11 22 22" aria-label={`phase ${((ph * 180) / Math.PI).toFixed(0)} degrees`}>
                            <circle r="9" fill="none" stroke="var(--border-strong)" />
                            {pr > 1e-9 && <line x1="0" y1="0" x2={9 * Math.cos(ph)} y2={-9 * Math.sin(ph)} stroke="var(--accent-fg)" strokeWidth="2" strokeLinecap="round" />}
                          </svg>
                        </td>
                        <td className="amp-bar-cell">
                          <span className="amp-bar" style={{ width: `${pr * 100}%` }} />
                        </td>
                        <td className="mono amp-p">{pr.toFixed(3)}</td>
                        {counts && <td className="mono amp-count">{counts[i]}</td>}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {counts && <p className="small soft lab-note">Counts come from 1,024 simulated measurements — close to, but never exactly, the probabilities.</p>}
          </div>
          <div className="clab-blochs">
            <h3 className="lab-h">Each qubit on its own</h3>
            <div className="mini-blochs">
              {Array.from({ length: n }, (_, q) => {
                const b = state.bloch(q)
                const len = Math.hypot(b.x, b.y, b.z)
                return (
                  <div key={q} className="mini-bloch">
                    <BlochSphere vec={b} size={140} showAxes={false} />
                    <span className="mini-bloch-cap">
                      <span className="mono">q{q}</span> · length <span className="mono">{len.toFixed(2)}</span>
                    </span>
                  </div>
                )
              })}
            </div>
            <p className="small soft lab-note">A vector shorter than 1 means that qubit is entangled: its state only makes sense together with the others.</p>
          </div>
        </div>
      </div>
    </LabFrame>
  )
}
