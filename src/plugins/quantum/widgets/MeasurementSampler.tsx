import { useEffect, useMemo, useRef, useState } from 'react'
import type { WidgetApi } from '../../types'
import { LabFrame, Readout, Slider } from '../../../ui/LabFrame'
import { LineChart } from '../../../ui/charts'
import { mulberry32 } from '../sim'

/**
 * One qubit, measured over and over. The estimate of P(1) wanders, then
 * settles — with error shrinking like 1/√shots. That same law governs classical
 * Monte Carlo, which is exactly what quantum amplitude estimation improves on.
 */
export function MeasurementSampler({ props, complete, done }: WidgetApi) {
  const [thetaDeg, setThetaDeg] = useState(Number(props.theta ?? 60))
  const [ones, setOnes] = useState(0)
  const [shots, setShots] = useState(0)
  const [history, setHistory] = useState<[number, number][]>([])
  const [recent, setRecent] = useState<boolean[]>([])
  const rng = useRef(mulberry32(2026))
  const nextCheckpoint = useRef(1)
  const p = Math.sin((thetaDeg * Math.PI) / 360) ** 2

  useEffect(() => {
    setOnes(0)
    setShots(0)
    setHistory([])
    setRecent([])
    nextCheckpoint.current = 1
  }, [thetaDeg])

  const met = shots >= 1000
  useEffect(() => {
    if (met && !done) complete()
  }, [met, done, complete])

  const run = (k: number) => {
    let o = ones
    let s = shots
    const h = [...history]
    const r = [...recent]
    for (let i = 0; i < k; i++) {
      const one = rng.current() < p
      if (one) o++
      s++
      r.push(one)
      // log-spaced checkpoints keep the chart light at any shot count
      if (s >= nextCheckpoint.current || i === k - 1) {
        h.push([s, o / s])
        while (nextCheckpoint.current <= s) nextCheckpoint.current = Math.ceil(nextCheckpoint.current * 1.12)
      }
    }
    setOnes(o)
    setShots(s)
    setHistory(h)
    setRecent(r.slice(-64))
  }

  const band = useMemo(() => {
    const xs = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000]
    const maxN = Math.max(shots, 10)
    return xs
      .filter((x) => x <= maxN * 1.01)
      .map((x) => {
        const half = 1.96 * Math.sqrt((p * (1 - p)) / x)
        return [x, Math.max(0, p - half), Math.min(1, p + half)] as [number, number, number]
      })
  }, [p, shots])

  const est = shots ? ones / shots : 0
  const se = shots ? Math.sqrt((p * (1 - p)) / shots) : 0

  return (
    <LabFrame goal="Measure at least 1,000 times and watch the estimate settle" met={done || met} aside={<><span className="mono">{shots.toLocaleString()}</span> shots</>}>
      <div className="sampler">
        <div className="sampler-controls">
          <section className="lab-section">
            <h3 className="lab-h">1 · Prepare the qubit</h3>
            <Slider label="Tilt θ away from |0⟩" value={thetaDeg} min={0} max={180} step={1} onChange={setThetaDeg} format={(v) => `${v}°`} />
            <p className="soft small sampler-theory">
              Theory (Born rule): P(1) = sin²(θ/2) = <span className="mono">{p.toFixed(4)}</span>
            </p>
          </section>
          <section className="lab-section">
            <h3 className="lab-h">2 · Measure it, again and again</h3>
            <div className="shot-row" role="group" aria-label="Run shots">
              {[1, 10, 100, 1000].map((k) => (
                <button key={k} className="btn btn-small btn-ghost" onClick={() => run(k)}>
                  ×{k.toLocaleString()}
                </button>
              ))}
              <button className="btn btn-small btn-ghost" onClick={() => run(10000)}>
                ×10,000
              </button>
            </div>
            <div className="readouts">
              <Readout label="Ones measured" value={ones.toLocaleString()} />
              <Readout label="Estimate of P(1)" value={shots ? est.toFixed(4) : '—'} tone="accent" />
              <Readout label="Typical error ≈ √(p(1−p)/N)" value={shots ? `±${se.toFixed(4)}` : '—'} />
            </div>
            {recent.length > 0 && <p className="lab-caption">Last {recent.length} outcomes · filled squares are 1s</p>}
            <div className="coin-strip" aria-hidden>
              {recent.map((one, i) => (
                <span key={i} className={one ? 'one' : ''} />
              ))}
            </div>
          </section>
        </div>
        <div className="sampler-chart">
          <h3 className="lab-h">How the estimate settles</h3>
          {history.length > 1 ? (
            <LineChart
              series={[
                { name: 'estimate', points: history, tone: 'accent' },
                { name: '95% band', points: band.map(([x, lo]) => [x, lo]), tone: 'faint', dashed: true, band },
              ]}
              logX
              xLabel="Shots (log scale)"
              yLabel="Estimated P(1)"
              hline={{ y: p, label: `true ${p.toFixed(3)}` }}
              yDomain={[0, 1]}
            />
          ) : (
            <div className="chart-empty">Run some shots to draw the convergence chart.</div>
          )}
          <p className="small soft lab-note">
            10× more shots buys only ~3.2× (√10) more precision. Keep that in mind for Unit 3.
          </p>
        </div>
      </div>
    </LabFrame>
  )
}
