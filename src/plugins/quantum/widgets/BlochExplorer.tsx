import { useEffect, useRef, useState } from 'react'
import type { WidgetApi } from '../../types'
import { LabFrame, Readout } from '../../../ui/LabFrame'
import { Glyph } from '../../../ui/Glyph'
import { BlochSphere, DEFAULT_VIEW, type Vec3, type View } from '../BlochSphere'
import { State, toAngles, type GateName } from '../sim'

/** Every single-qubit gate is a rotation of the Bloch sphere (up to global phase). */
const ROTATIONS: Record<string, { axis: Vec3; angle: number; about: string }> = {
  X: { axis: { x: 1, y: 0, z: 0 }, angle: Math.PI, about: 'half-turn about x — the quantum NOT' },
  Y: { axis: { x: 0, y: 1, z: 0 }, angle: Math.PI, about: 'half-turn about y' },
  Z: { axis: { x: 0, y: 0, z: 1 }, angle: Math.PI, about: 'half-turn about z — flips the phase' },
  H: { axis: { x: Math.SQRT1_2, y: 0, z: Math.SQRT1_2 }, angle: Math.PI, about: 'half-turn about the x+z diagonal — makes superpositions' },
  S: { axis: { x: 0, y: 0, z: 1 }, angle: Math.PI / 2, about: 'quarter-turn about z' },
  T: { axis: { x: 0, y: 0, z: 1 }, angle: Math.PI / 4, about: 'eighth-turn about z' },
}

const TARGETS: Record<string, { vec: Vec3; label: string }> = {
  plus: { vec: { x: 1, y: 0, z: 0 }, label: '|+⟩ = (|0⟩ + |1⟩)/√2' },
  minus: { vec: { x: -1, y: 0, z: 0 }, label: '|−⟩ = (|0⟩ − |1⟩)/√2' },
  one: { vec: { x: 0, y: 0, z: -1 }, label: '|1⟩' },
  i: { vec: { x: 0, y: 1, z: 0 }, label: '|+i⟩ = (|0⟩ + i|1⟩)/√2' },
  'minus-i': { vec: { x: 0, y: -1, z: 0 }, label: '|−i⟩ = (|0⟩ − i|1⟩)/√2' },
}

function rotate(v: Vec3, k: Vec3, a: number): Vec3 {
  // Rodrigues' rotation formula
  const c = Math.cos(a)
  const s = Math.sin(a)
  const dot = k.x * v.x + k.y * v.y + k.z * v.z
  const cross = { x: k.y * v.z - k.z * v.y, y: k.z * v.x - k.x * v.z, z: k.x * v.y - k.y * v.x }
  return {
    x: v.x * c + cross.x * s + k.x * dot * (1 - c),
    y: v.y * c + cross.y * s + k.y * dot * (1 - c),
    z: v.z * c + cross.z * s + k.z * dot * (1 - c),
  }
}

function fmtC(re: number, im: number) {
  const r = Math.abs(re) < 5e-4 ? 0 : re
  const i = Math.abs(im) < 5e-4 ? 0 : im
  if (i === 0) return r.toFixed(3)
  if (r === 0) return `${i.toFixed(3)}i`
  return `${r.toFixed(3)} ${i < 0 ? '−' : '+'} ${Math.abs(i).toFixed(3)}i`
}

export function BlochExplorer({ props, complete, done, capture, captured }: WidgetApi) {
  const goalKey = props.goal as string | undefined
  const target = goalKey ? TARGETS[goalKey] : undefined
  const [state, setState] = useState(() => new State(1))
  const [shown, setShown] = useState<Vec3>({ x: 0, y: 0, z: 1 })
  const [trail, setTrail] = useState<Vec3[]>([])
  const [view, setView] = useState<View>(DEFAULT_VIEW)
  const [history, setHistory] = useState<string[]>([])
  const [last, setLast] = useState<string>('Start in |0⟩ — the north pole.')
  const [measured, setMeasured] = useState<number | null>(null)
  const anim = useRef(0)
  const busy = useRef(false)

  const vec = state.bloch(0)
  const fidelity = target ? (1 + vec.x * target.vec.x + vec.y * target.vec.y + vec.z * target.vec.z) / 2 : 0
  const met = target ? fidelity > 0.99 : history.length >= 3

  useEffect(() => {
    if (met && !done) complete()
  }, [met, done, complete])

  useEffect(() => () => cancelAnimationFrame(anim.current), [])

  const applyGate = (g: string) => {
    if (busy.current) return
    busy.current = true
    setMeasured(null)
    const rot = ROTATIONS[g]
    const from = state.bloch(0)
    const start = performance.now()
    const dur = 520
    const pts: Vec3[] = []
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / dur)
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
      const v = rotate(from, rot.axis, rot.angle * e)
      pts.push(v)
      setShown(v)
      setTrail([...pts])
      if (t < 1) anim.current = requestAnimationFrame(step)
      else {
        const next = state.clone().gate(g as GateName, 0)
        setState(next)
        setShown(next.bloch(0))
        setHistory((h) => [...h, g])
        setLast(`${g}: ${rot.about}.`)
        busy.current = false
      }
    }
    anim.current = requestAnimationFrame(step)
  }

  const measure = () => {
    if (busy.current) return
    const p1 = state.probOne(0)
    const outcome = Math.random() < p1 ? 1 : 0
    const next = new State(1)
    if (outcome) next.gate('X', 0)
    setState(next)
    setShown(next.bloch(0))
    setTrail([])
    setMeasured(outcome)
    setHistory((h) => [...h, `M→${outcome}`])
    setLast(`Measured ${outcome}. The superposition is gone: the state is now |${outcome}⟩.`)
  }

  const reset = () => {
    cancelAnimationFrame(anim.current)
    busy.current = false
    const s = new State(1)
    setState(s)
    setShown(s.bloch(0))
    setTrail([])
    setHistory([])
    setMeasured(null)
    setLast('Back to |0⟩.')
  }

  const [a, b] = [state.amp(0), state.amp(1)]
  const { theta, phi } = toAngles(a, b)
  const p0 = state.probabilities()[0]

  return (
    <LabFrame
      goal={target ? <>Steer the qubit to {target.label}</> : 'Apply at least three gates and watch the vector move'}
      met={done || met}
      aside={target ? <>Match <span className="mono">{(fidelity * 100).toFixed(0)}%</span></> : null}
      onSave={capture ? () => capture(`${history.join(' → ') || 'no gates'} · ended at θ=${((theta * 180) / Math.PI).toFixed(0)}°, φ=${((phi * 180) / Math.PI).toFixed(0)}°`, { gates: history, alpha: a, beta: b }) : undefined}
      captured={captured}
    >
      <div className="bloch-lab">
        <div className="bloch-lab-sphere lab-panel">
          <BlochSphere vec={shown} view={view} onView={setView} trail={trail} ghost={target?.vec} size={380} />
          <p className="lab-caption bloch-drag">
            Drag to turn the sphere{target ? <> · <span className="bloch-key" aria-hidden /> target</> : null}
          </p>
        </div>
        <div className="bloch-lab-side">
          <section className="lab-section">
            <h3 className="lab-h">Apply a gate</h3>
            <div className="gate-row" role="group" aria-label="Gates">
              {Object.keys(ROTATIONS).map((g) => (
                <button key={g} className="gate-btn" onClick={() => applyGate(g)} title={ROTATIONS[g].about}>
                  {g}
                </button>
              ))}
            </div>
            <p className="bloch-last" aria-live="polite">
              {last}
            </p>
          </section>
          <section className="lab-section">
            <h3 className="lab-h">Current state</h3>
            <div className="ket">
              <span className="ket-psi">|ψ⟩ =</span>
              <span>
                <span className="mono">({fmtC(a[0], a[1])})</span>|0⟩
              </span>
              <span>+</span>
              <span>
                <span className="mono">({fmtC(b[0], b[1])})</span>|1⟩
              </span>
            </div>
            <div className="prob-pair">
              <div className="prob-bar">
                <span className="prob-label">P(0)</span>
                <span className="prob-track">
                  <span style={{ width: `${p0 * 100}%` }} />
                </span>
                <span className="mono prob-v">{p0.toFixed(3)}</span>
              </div>
              <div className="prob-bar">
                <span className="prob-label">P(1)</span>
                <span className="prob-track">
                  <span style={{ width: `${(1 - p0) * 100}%` }} />
                </span>
                <span className="mono prob-v">{(1 - p0).toFixed(3)}</span>
              </div>
            </div>
            <div className="readouts">
              <Readout label="θ (from |0⟩)" value={`${((theta * 180) / Math.PI).toFixed(1)}°`} />
              <Readout label="φ (phase)" value={`${((phi * 180) / Math.PI).toFixed(1)}°`} />
              <Readout label="Gates applied" value={history.length} />
            </div>
          </section>
          <div className="lab-actions">
            <button className="btn btn-small" onClick={measure}>
              Measure {measured !== null ? `(got ${measured})` : ''} <Glyph name="spark" size={14} />
            </button>
            <button className="btn btn-small btn-ghost" onClick={reset}>
              Reset <Glyph name="restart" size={14} />
            </button>
          </div>
        </div>
      </div>
    </LabFrame>
  )
}
