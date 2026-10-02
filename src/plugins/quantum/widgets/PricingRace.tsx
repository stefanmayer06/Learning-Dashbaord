import { useEffect, useMemo, useState } from 'react'
import type { WidgetApi } from '../../types'
import { LabFrame, Readout, Slider } from '../../../ui/LabFrame'
import { Glyph } from '../../../ui/Glyph'
import { LineChart, Legend } from '../../../ui/charts'
import { blackScholesCall, monteCarloCall, priceGrid, qaeDistribution, qaeErrorBound, sampleQae, type CallParams, type McResult } from '../finance'
import { mulberry32 } from '../sim'

const money = (v: number) => `$${v.toFixed(v < 1 ? 4 : 3)}`

/**
 * Both curves are errors achieved with the same confidence, 8/π² ≈ 81%:
 * Brassard et al. guarantee their QAE bound with at least that probability,
 * and a normal Monte Carlo estimate is within z·σ/√N with that probability.
 */
const CONFIDENCE = 8 / (Math.PI * Math.PI)
const Z_81 = 1.3114 // two-sided normal quantile for 81.06%

export function PricingRace({ complete, done, capture, captured, Cite, props }: WidgetApi) {
  const [S0, setS0] = useState(100)
  const [K, setK] = useState(105)
  const [sigma, setSigma] = useState(0.2)
  const [T, setT] = useState(1)
  const [r, setR] = useState(0.03)
  const params: CallParams = { S0, K, sigma, T, r }
  const bs = useMemo(() => blackScholesCall(params), [S0, K, sigma, T, r]) // eslint-disable-line react-hooks/exhaustive-deps

  /* classical */
  const [logN, setLogN] = useState(4)
  const [mc, setMc] = useState<McResult | null>(null)
  const [mcSeed, setMcSeed] = useState(1)

  /* quantum (ideal) */
  const [gridQ, setGridQ] = useState(5)
  const [evalQ, setEvalQ] = useState(7)
  const [qae, setQae] = useState<{ estimate: number; price: number } | null>(null)
  const [qaeRuns, setQaeRuns] = useState(0)

  const [eps, setEps] = useState(-2) // log10 target accuracy in $

  useEffect(() => {
    setMc(null)
    setQae(null)
  }, [S0, K, sigma, T, r])
  useEffect(() => setQae(null), [gridQ, evalQ])

  const grid = useMemo(() => priceGrid(params, gridQ), [S0, K, sigma, T, r, gridQ]) // eslint-disable-line react-hooks/exhaustive-deps
  const disc = Math.exp(-r * T)
  const dist = useMemo(() => qaeDistribution(grid.a, evalQ), [grid.a, evalQ])
  // outcomes y and M−y give the same estimate sin²(πy/M): fold them together
  const folded = useMemo(() => {
    const all = dist.probs.slice(0, dist.M / 2 + 1).map((p, y) => ({ y, p: p + (y > 0 && y < dist.M / 2 ? dist.probs[dist.M - y] : 0) }))
    const peak = all.reduce((b, x) => (x.p > b.p ? x : b), all[0]).y
    return all.slice(Math.max(0, peak - 14), peak + 15) // zoom to where the outcomes land
  }, [dist])

  // payoff spread from a pilot run, for the error-vs-cost curves
  const pilotSd = useMemo(() => {
    const pilot = monteCarloCall(params, 40_000, 99)
    return pilot.stderr * Math.sqrt(40_000)
  }, [S0, K, sigma, T, r]) // eslint-disable-line react-hooks/exhaustive-deps

  const curves = useMemo(() => {
    const mcPts: [number, number][] = []
    for (let e = 1; e <= 8; e += 0.25) {
      const N = 10 ** e
      mcPts.push([N, (Z_81 * pilotSd) / Math.sqrt(N)])
    }
    // ideal QAE error bound for m = 1..24 evaluation qubits, in dollars; calls = A-applications
    const qErr = Array.from({ length: 24 }, (_, i) => {
      const M = 2 ** (i + 1)
      return { m: i + 1, calls: 2 * (M - 1) + 1, err: disc * grid.fmax * qaeErrorBound(grid.a, M) }
    })
    const qPts = qErr.filter((q) => q.calls <= 2e8).map((q) => [q.calls, q.err] as [number, number])
    return { mcPts, qPts, qErr }
  }, [pilotSd, disc, grid])

  const target = 10 ** eps
  const mcNeeded = Math.ceil(((Z_81 * pilotSd) / target) ** 2)
  const qNeeded = curves.qErr.find((q) => q.err <= target) ?? null

  const ranBoth = mc !== null && qaeRuns > 0
  useEffect(() => {
    if (ranBoth && !done) complete()
  }, [ranBoth, done, complete])

  const runMc = () => {
    const seed = mcSeed + 1
    setMcSeed(seed)
    setMc(monteCarloCall(params, Math.round(10 ** logN), seed))
  }
  const runQae = () => {
    const s = sampleQae(grid.a, evalQ, mulberry32(Date.now() % 1e9))
    setQae({ estimate: s.estimate, price: disc * grid.fmax * s.estimate })
    setQaeRuns((x) => x + 1)
  }

  const mcChart = mc && (
    <LineChart
      series={[
        {
          name: 'running estimate',
          points: mc.path.map((p) => [p.n, p.price]),
          tone: 'ink',
          band: mc.path.map((p) => [p.n, p.price - 2 * p.stderr, p.price + 2 * p.stderr]),
        },
      ]}
      logX
      xLabel="simulated paths (log)"
      yLabel="price estimate ($)"
      hline={{ y: bs, label: `exact ${money(bs)}` }}
      width={340}
      height={240}
    />
  )

  return (
    <LabFrame
      goal="Price the option both ways: run classical Monte Carlo and sample the quantum estimator"
      met={done || ranBoth}
      onSave={
        capture
          ? () =>
              capture(
                `S₀=${S0} K=${K} σ=${(sigma * 100).toFixed(0)}% T=${T}y · BS ${money(bs)} · MC ${mc ? money(mc.price) + ' ± ' + money(mc.stderr) : '—'} · QAE ${qae ? money(qae.price) : '—'} · for ±${money(target)}: MC ${mcNeeded.toLocaleString()} paths vs ideal QAE ${qNeeded ? qNeeded.calls.toLocaleString() : '>33M'} calls`,
                { params, blackScholes: bs, mc: mc && { price: mc.price, stderr: mc.stderr, n: mc.path[mc.path.length - 1].n }, qae, gridQubits: gridQ, evalQubits: evalQ, gridPrice: grid.gridPrice, target, mcNeeded, qaeNeeded: qNeeded },
              )
          : undefined
      }
      captured={captured}
    >
      <div className="race">
        <section className="race-params">
          <div className="label race-h">The contract · European call</div>
          <Slider label="Spot S₀" value={S0} min={50} max={150} step={1} onChange={setS0} format={(v) => `$${v}`} />
          <Slider label="Strike K" value={K} min={50} max={150} step={1} onChange={setK} format={(v) => `$${v}`} />
          <Slider label="Volatility σ" value={sigma} min={0.05} max={0.6} step={0.01} onChange={setSigma} format={(v) => `${(v * 100).toFixed(0)}%`} />
          <Slider label="Maturity T" value={T} min={0.1} max={3} step={0.1} onChange={setT} format={(v) => `${v.toFixed(1)} y`} />
          <Slider label="Rate r" value={r} min={0} max={0.08} step={0.005} onChange={setR} format={(v) => `${(v * 100).toFixed(1)}%`} />
          <div className="race-truth">
            <span className="label">Exact answer (Black–Scholes 1973)</span>
            <span className="race-truth-v display">{money(bs)}</span>
            <span className="small soft">Closed form exists here, so we can grade both methods. Real exotic derivatives usually have none — hence Monte Carlo.</span>
          </div>
        </section>

        <section className="race-lane">
          <div className="race-lane-h">
            <span className="chip">Classical</span>
            <h4>Monte Carlo</h4>
          </div>
          <Slider label="Paths to simulate" value={logN} min={2} max={6} step={0.25} onChange={setLogN} format={(v) => Math.round(10 ** v).toLocaleString()} />
          <button className="btn btn-small" onClick={runMc}>
            Simulate <Glyph name="play" size={12} />
          </button>
          {mc ? (
            <>
              <div className="readouts">
                <Readout label="estimate" value={money(mc.price)} />
                <Readout label="± std. error" value={money(mc.stderr)} />
                <Readout label="actual error" value={money(Math.abs(mc.price - bs))} tone="red" />
              </div>
              {mcChart}
            </>
          ) : (
            <div className="chart-empty">Simulate to see the estimate wander towards the truth.</div>
          )}
        </section>

        <section className="race-lane race-lane-q">
          <div className="race-lane-h">
            <span className="chip chip-accent">Quantum · ideal</span>
            <h4>Amplitude estimation</h4>
          </div>
          <Slider label="Price-grid qubits (2ⁿ price points)" value={gridQ} min={3} max={7} step={1} onChange={setGridQ} format={(v) => `${v} · ${2 ** v} pts`} />
          <Slider label="Evaluation qubits m (precision)" value={evalQ} min={3} max={11} step={1} onChange={setEvalQ} format={(v) => `${v} · M=${2 ** v}`} />
          <button className="btn btn-small btn-accent" onClick={runQae}>
            Sample one run <Glyph name="play" size={12} />
          </button>
          <div className="qae-dist" aria-label="Distribution of possible QAE outcomes">
            {folded.map(({ p, y }) => {
              const price = disc * grid.fmax * dist.estimates[y]
              const picked = qae && Math.abs(qae.estimate - dist.estimates[y]) < 1e-12
              return (
                <span
                  key={y}
                  className={`qae-bar ${picked ? 'picked' : ''}`}
                  style={{ height: `${Math.min(100, p * 160)}%` }}
                  title={`${money(price)} · probability ${(p * 100).toFixed(1)}%`}
                />
              )
            })}
          </div>
          <div className="qae-axis mono">
            <span>{money(disc * grid.fmax * dist.estimates[folded[0].y])}</span>
            <span>{money(disc * grid.fmax * dist.estimates[folded[folded.length - 1].y])}</span>
          </div>
          <p className="small soft">Where one run's answer can land on an ideal machine. More evaluation qubits → a finer, tighter spread.</p>
          <div className="readouts">
            <Readout label="this run" value={qae ? money(qae.price) : '—'} tone="accent" />
            <Readout label="grid-implied price" value={money(grid.gridPrice)} />
            <Readout label="grid bias vs truth" value={money(Math.abs(grid.gridPrice - bs))} tone="red" />
          </div>
        </section>

        <section className="race-verdict">
          <div className="label race-h">The race · error vs. cost</div>
          <LineChart
            series={[
              { name: 'Monte Carlo', points: curves.mcPts, tone: 'ink' },
              { name: 'ideal QAE', points: curves.qPts, tone: 'accent' },
            ]}
            logX
            logY
            xLabel="calls to the pricing model (log)"
            yLabel={`error at ${Math.round(CONFIDENCE * 100)}% confidence ($, log)`}
            hline={{ y: target, label: `target ±${money(target)}` }}
            height={260}
          />
          <Legend items={[{ label: 'Monte Carlo: error ∝ 1/√N', tone: 'ink' }, { label: 'ideal QAE (Brassard et al. bound): ∝ 1/M', tone: 'accent' }]} />
          <Slider label="Target accuracy" value={eps} min={-3} max={0} step={0.25} onChange={setEps} format={(v) => `±$${(10 ** v).toPrecision(2)}`} />
          <div className="race-calls">
            <div>
              <span className="label label-faint">Monte Carlo needs</span>
              <span className="display race-calls-v">{mcNeeded.toLocaleString('en-US')}</span>
              <span className="small">paths</span>
            </div>
            <div>
              <span className="label label-faint">Ideal QAE needs</span>
              <span className="display race-calls-v accent">{qNeeded ? qNeeded.calls.toLocaleString('en-US') : '> 33M'}</span>
              <span className="small">model calls {qNeeded ? `(m = ${qNeeded.m})` : ''}</span>
            </div>
          </div>
          <div className="caveat">
            <span className="label">Read the fine print</span>
            <ul>
              <li>“Ideal” means a fault-tolerant machine with no noise. Today's devices are not that.</li>
              <li>The QAE curve measures error against the grid price; the grid itself adds bias (shown above) that needs more qubits to remove.</li>
              <li>
                Loading the distribution and payoff into the circuit is expensive. A Goldman Sachs/IBM resource study put useful advantage at roughly 8,000 logical
                qubits and a T-depth of 54 million, run in about a second.
                {Array.isArray(props.cite) && <Cite ids={props.cite as string[]} />}
              </li>
            </ul>
          </div>
        </section>
      </div>
    </LabFrame>
  )
}
