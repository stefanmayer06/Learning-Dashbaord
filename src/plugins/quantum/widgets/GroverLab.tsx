import { useEffect, useMemo, useState } from 'react'
import type { WidgetApi } from '../../types'
import { LabFrame, Readout, Segmented } from '../../../ui/LabFrame'
import { Glyph } from '../../../ui/Glyph'
import { LineChart } from '../../../ui/charts'
import { groverOptimalIterations, groverStep, groverSuccess } from '../sim'

type Phase = 'ready' | 'oracled'

/**
 * Amplitude amplification, one half-step at a time: the oracle flips the sign
 * of the marked item; the diffuser reflects every amplitude about the mean.
 */
export function GroverLab({ props, complete, done }: WidgetApi) {
  const [n, setN] = useState(Number(props.qubits ?? 4))
  const N = 2 ** n
  const [marked, setMarked] = useState(Math.min(N - 1, 11))
  const [amps, setAmps] = useState<number[]>(() => new Array(N).fill(1 / Math.sqrt(N)))
  const [phase, setPhase] = useState<Phase>('ready')
  const [k, setK] = useState(0)
  const [mean, setMean] = useState<number | null>(null)
  const [best, setBest] = useState(0)

  useEffect(() => {
    setAmps(new Array(N).fill(1 / Math.sqrt(N)))
    setMarked((m) => Math.min(m, N - 1))
    setPhase('ready')
    setK(0)
    setMean(null)
  }, [N])

  const success = amps[marked] ** 2
  const kOpt = groverOptimalIterations(N)
  useEffect(() => setBest((b) => Math.max(b, success)), [success])
  const met = best >= 0.9
  useEffect(() => {
    if (met && !done) complete()
  }, [met, done, complete])

  const oracle = () => {
    if (phase !== 'ready') return
    setAmps((a) => a.map((v, i) => (i === marked ? -v : v)))
    setMean(amps.reduce((s, v, i) => s + (i === marked ? -v : v), 0) / N)
    setPhase('oracled')
  }
  const diffuse = () => {
    if (phase !== 'oracled') return
    const m = amps.reduce((s, v) => s + v, 0) / N
    setAmps(amps.map((v) => 2 * m - v))
    setMean(null)
    setPhase('ready')
    setK((x) => x + 1)
  }
  const iterate = () => {
    if (phase === 'oracled') return diffuse()
    setAmps((a) => groverStep(a, marked).after)
    setK((x) => x + 1)
  }
  const reset = () => {
    setAmps(new Array(N).fill(1 / Math.sqrt(N)))
    setPhase('ready')
    setK(0)
    setMean(null)
  }
  const choose = (i: number) => {
    setMarked(i)
    setAmps(new Array(N).fill(1 / Math.sqrt(N)))
    setPhase('ready')
    setK(0)
    setMean(null)
  }

  const curve = useMemo(() => Array.from({ length: Math.max(kOpt * 2 + 3, 6) }, (_, j) => [j, groverSuccess(N, j)] as [number, number]), [N, kOpt])
  const maxAbs = 1 // fixed scale: amplitudes never exceed 1, so growth is visible
  const H = 200

  return (
    <LabFrame goal="Amplify the marked item until measuring finds it ≥ 90% of the time" met={done || met} aside={<>Best <span className="mono">{(best * 100).toFixed(1)}%</span></>}>
      <div className="grover">
        <div className="grover-top">
          <Segmented
            label="Search space"
            value={n}
            onChange={setN}
            options={[3, 4, 5, 6].map((q) => ({ value: q, label: `${q} qubits · N=${2 ** q}` }))}
          />
          <label className="grover-pick">
            Marked item
            <select className="select grover-select" value={marked} onChange={(e) => choose(Number(e.target.value))}>
              {Array.from({ length: N }, (_, i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </label>
          <span className="grover-tip">
            <Glyph name="info" size={16} /> Or click a bar to mark it.
          </span>
        </div>
        <div className="grover-bars lab-panel" style={{ height: H * 2 + 20 }}>
          <div className="grover-zero" style={{ top: H + 10 }} />
          {mean !== null && <div className="grover-mean" style={{ top: H + 10 - (mean / maxAbs) * H }}><span className="grover-mean-label">mean</span></div>}
          {amps.map((a, i) => (
            <button
              key={i}
              className={`grover-bar ${i === marked ? 'marked' : ''}`}
              onClick={() => choose(i)}
              tabIndex={-1}
              aria-label={`Item ${i}${i === marked ? ' (marked)' : ''}: amplitude ${a.toFixed(3)}`}
              style={{ width: `${100 / N}%` }}
            >
              <span
                style={{
                  height: `${(Math.abs(a) / maxAbs) * H}px`,
                  top: a >= 0 ? `${H + 10 - (Math.abs(a) / maxAbs) * H}px` : `${H + 10}px`,
                }}
              />
            </button>
          ))}
        </div>
        <div className="grover-controls">
          <div className="lab-actions" role="group" aria-label="Grover steps">
            <button className="btn btn-small btn-secondary" onClick={oracle} disabled={phase !== 'ready'}>
              1 · Oracle: flip the marked sign
            </button>
            <button className="btn btn-small btn-secondary" onClick={diffuse} disabled={phase !== 'oracled'}>
              2 · Diffuse: reflect about the mean
            </button>
            <button className="btn btn-small btn-ghost" onClick={iterate}>
              Full iteration <Glyph name="arrow" size={14} />
            </button>
            <button className="btn btn-small btn-ghost" onClick={reset}>
              Reset <Glyph name="restart" size={14} />
            </button>
          </div>
        </div>
        <div className="grover-stats">
          <h2 className="lab-h">Where you are</h2>
          <div className="readouts">
            <Readout label="Iterations" value={k} />
            <Readout label="P(find marked)" value={`${(success * 100).toFixed(1)}%`} tone={success >= 0.9 ? 'good' : 'accent'} />
            <Readout label="Best iteration count ≈ (π/4)√N" value={kOpt} />
            <Readout label="Classical guessing, same budget" value={`${Math.min(100, ((k + 1) / N) * 100).toFixed(1)}%`} />
          </div>
          {k > kOpt && (
            <p className="callout callout-warn lab-callout" role="status">
              <Glyph name="info" size={18} />
              <span>You've gone past the optimum — the amplitude is rotating away again. Quantum search must know when to stop.</span>
            </p>
          )}
        </div>
        <div className="grover-chart">
          <h2 className="lab-h">Success odds by iteration</h2>
          <LineChart series={[{ name: 'theory', points: curve, tone: 'faint' }]} xLabel="Iterations" yLabel="P(success)" yDomain={[0, 1]} marker={{ x: k, y: groverSuccess(N, k), label: 'you' }} height={240} />
        </div>
      </div>
    </LabFrame>
  )
}
