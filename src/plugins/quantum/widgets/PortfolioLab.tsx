import { useEffect, useMemo, useState } from 'react'
import type { WidgetApi } from '../../types'
import { LabFrame, Readout, Segmented, Slider } from '../../../ui/LabFrame'
import { Glyph } from '../../../ui/Glyph'
import { LineChart } from '../../../ui/charts'
import {
  DEMO_ASSETS,
  DEMO_CORR,
  betaRange,
  bitsOf,
  bruteForce,
  covariance,
  normalise,
  optimiseQaoa,
  qaoaExpectation,
  qaoaLandscape,
  qaoaState,
  quboMatrix,
  ret,
  risk,
  simulatedAnnealing,
  type AnnealTrace,
  type Problem,
  type QaoaMode,
} from '../portfolio'

type Tab = 'problem' | 'classical' | 'quantum'
const n = DEMO_ASSETS.length
const cov = covariance(DEMO_ASSETS, DEMO_CORR)
const mu = DEMO_ASSETS.map((a) => a.mu)
const names = (z: number) =>
  bitsOf(z, n)
    .map((b, i) => (b ? DEMO_ASSETS[i].ticker : null))
    .filter(Boolean)
    .join(' + ') || '(nothing)'
const binom = (a: number, b: number) => {
  let r = 1
  for (let i = 1; i <= b; i++) r = (r * (a - b + i)) / i
  return r
}

export function PortfolioLab({ complete, done, capture, captured, Cite }: WidgetApi) {
  const [tab, setTab] = useState<Tab>('problem')
  const [q, setQ] = useState(0.6)
  const [budget, setBudget] = useState(3)
  const [lambda, setLambda] = useState(0.3)
  const prob: Problem = { mu, cov, q, budget, lambda }
  const bf = useMemo(() => bruteForce(prob), [q, budget, lambda]) // eslint-disable-line react-hooks/exhaustive-deps
  const qubo = useMemo(() => quboMatrix(prob), [q, budget, lambda]) // eslint-disable-line react-hooks/exhaustive-deps
  const bestBits = bitsOf(bf.best, n)
  const feasibleBest = bestBits.reduce((a, b) => a + b, 0) === budget

  const [sa, setSa] = useState<AnnealTrace | null>(null)
  const [saSeed, setSaSeed] = useState(3)
  const [mode, setMode] = useState<QaoaMode>('penalty')
  // best portfolio that respects the budget (what the constraint-preserving mode searches)
  const bestValid = useMemo(() => {
    let b = -1
    bf.costs.forEach((v, z) => {
      if (bitsOf(z, n).reduce((a, c) => a + c, 0) === budget && (b < 0 || v < bf.costs[b])) b = z
    })
    return b
  }, [bf, budget])
  const target = mode === 'xy' ? bestValid : bf.best
  const norm = useMemo(() => (mode === 'xy' ? normalise(bf.costs, budget) : normalise(bf.costs)), [bf, mode, budget])
  const land = useMemo(() => qaoaLandscape(norm, 34, mode, budget), [norm, mode, budget])
  const [angles, setAngles] = useState<{ gammas: number[]; betas: number[] } | null>(null)
  const [p2, setP2] = useState<number | null>(null)
  const [tried, setTried] = useState<Record<QaoaMode, boolean>>({ penalty: false, xy: false })

  useEffect(() => {
    setSa(null)
    setAngles(null)
    setP2(null)
  }, [q, budget, lambda])
  useEffect(() => {
    setAngles(null)
    setP2(null)
  }, [mode])

  const active = angles ?? { gammas: [land.best.gamma], betas: [land.best.beta] }
  const qstate = useMemo(() => qaoaState(norm, active.gammas, active.betas, mode, budget), [norm, active.gammas, active.betas, mode, budget])
  const probs = qstate.probabilities()
  const pOpt = probs[target]
  const pRandom = 1 / 2 ** n
  const pFeasibleRandom = 1 / binom(n, budget)
  const expectation = qaoaExpectation(norm, active.gammas, active.betas, mode, budget)
  const pick = (a: { gammas: number[]; betas: number[] }, depth2: number | null = null) => {
    setAngles(a)
    setP2(depth2)
    setTried((t) => ({ ...t, [mode]: true }))
  }

  const met = sa !== null && tried.penalty && tried.xy
  useEffect(() => {
    if (met && !done) complete()
  }, [met, done, complete])

  const runSa = () => {
    const s = saSeed + 1
    setSaSeed(s)
    setSa(simulatedAnnealing(prob, 600, s))
  }

  const top = useMemo(
    () =>
      probs
        .map((p, z) => ({ z, p }))
        .sort((a, b) => b.p - a.p)
        .slice(0, 8),
    [probs],
  )

  // scatter: equal-weight risk/return of every subset
  const scatter = useMemo(() => {
    const pts: { z: number; x: number; y: number; k: number }[] = []
    for (let z = 1; z < 2 ** n; z++) {
      const b = bitsOf(z, n)
      const k = b.reduce((a, c) => a + c, 0)
      pts.push({ z, k, x: Math.sqrt(risk(b, cov)) / k, y: ret(b, mu) / k })
    }
    return pts
  }, [])
  const sx = (v: number) => 40 + (v / 0.28) * 480
  const sy = (v: number) => 260 - ((v - 0.02) / 0.09) * 230

  return (
    <LabFrame
      goal="Solve it classically, then with both flavours of QAOA, and compare"
      met={done || met}
      aside={<Segmented label="Lab section" value={tab} onChange={setTab} options={[{ value: 'problem', label: '1 · Problem' }, { value: 'classical', label: '2 · Classical' }, { value: 'quantum', label: '3 · QAOA' }]} />}
      onSave={
        capture
          ? () =>
              capture(
                `Hold ${budget}, risk aversion ${q.toFixed(2)} → optimum ${names(bf.best)} · annealing ${sa ? (sa.best === bf.best ? 'found it' : 'missed it') : 'not run'} · ${mode === 'xy' ? 'constraint-preserving' : 'standard'} QAOA depth ${active.gammas.length}: P(optimum) ${(pOpt * 100).toFixed(1)}% vs ${(pFeasibleRandom * 100).toFixed(1)}% for a random valid pick`,
                { q, budget, lambda, optimum: names(bf.best), optimumCost: bf.cost, annealFound: sa ? sa.best === bf.best : null, qaoa: { mode, ...active, pOpt, expectation }, pFeasibleRandom },
              )
          : undefined
      }
      captured={captured}
    >
      <p className="small soft pf-synthetic">
        <span className="chip chip-warn">Synthetic data</span> Six made-up assets with round-number returns and risks, chosen to make the trade-offs visible. Not
        market estimates, not advice.
      </p>

      {tab === 'problem' && (
        <div className="pf-grid">
          <table className="pf-assets">
            <thead>
              <tr>
                <th className="label">Asset</th>
                <th className="label">Exp. return μ</th>
                <th className="label">Volatility σ</th>
                <th className="label">In optimum</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_ASSETS.map((a, i) => (
                <tr key={a.ticker} className={bestBits[i] ? 'on' : ''}>
                  <td>
                    <span className="mono">{a.ticker}</span> <span className="soft small">{a.name}</span>
                  </td>
                  <td className="mono">{(a.mu * 100).toFixed(1)}%</td>
                  <td className="mono">{(a.vol * 100).toFixed(0)}%</td>
                  <td>{bestBits[i] ? <Glyph name="check" size={14} /> : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pf-controls">
            <Slider label="Assets to hold (budget B)" value={budget} min={1} max={5} step={1} onChange={setBudget} />
            <Slider label="Risk aversion q" value={q} min={0} max={3} step={0.05} onChange={setQ} format={(v) => v.toFixed(2)} />
            <Slider label="Budget penalty λ" value={lambda} min={0} max={0.5} step={0.01} onChange={setLambda} format={(v) => v.toFixed(2)} />
            {!feasibleBest && <p className="pf-warn">The penalty is too weak: the “best” answer breaks the budget. This is the classic QUBO tuning problem — try raising λ.</p>}
            <div className="pf-formula">
              minimise &nbsp;<span className="mono">q·xᵀΣx − μᵀx + λ(Σx − B)²</span>, &nbsp;x ∈ {'{0,1}'}⁶
            </div>
          </div>
          <div className="pf-qubo">
            <div className="label label-faint">The QUBO matrix Q — the only thing a quantum optimiser ever sees</div>
            <QuboHeat Q={qubo.Q} />
          </div>
        </div>
      )}

      {tab === 'classical' && (
        <div className="pf-grid pf-grid-2">
          <div>
            <div className="label label-faint">All 63 possible portfolios (equal weights)</div>
            <svg viewBox="0 0 540 300" className="chart" role="img" aria-label="Risk-return scatter of every portfolio">
              <line x1={40} x2={530} y1={260} y2={260} className="chart-axis" />
              <line x1={40} x2={40} y1={20} y2={260} className="chart-axis" />
              <text x={285} y={292} textAnchor="middle" className="chart-label">
                risk (volatility)
              </text>
              <text x={40} y={14} className="chart-label">
                expected return
              </text>
              {scatter.map((pt) => (
                <circle
                  key={pt.z}
                  cx={sx(pt.x)}
                  cy={sy(pt.y)}
                  r={pt.z === bf.best ? 8 : pt.k === budget ? 4.5 : 3}
                  className={pt.z === bf.best ? 'pf-dot best' : sa && pt.z === sa.best ? 'pf-dot sa' : pt.k === budget ? 'pf-dot ok' : 'pf-dot'}
                >
                  <title>
                    {names(pt.z)} · σ {(pt.x * 100).toFixed(1)}% · μ {(pt.y * 100).toFixed(1)}%
                  </title>
                </circle>
              ))}
            </svg>
            <p className="small soft">Filled: portfolios with exactly {budget} assets. Ringed in red: the true optimum (found by checking all 64 — easy for 6 assets, impossible for 600).</p>
          </div>
          <div>
            <div className="readouts">
              <Readout label="brute-force optimum" value={names(bf.best)} tone="red" />
              <Readout label="objective" value={bf.cost.toFixed(4)} />
            </div>
            <button className="btn btn-small" onClick={runSa}>
              Run simulated annealing <Glyph name="play" size={12} />
            </button>
            {sa ? (
              <>
                <LineChart
                  series={[
                    { name: 'current', points: sa.trace.map((t) => [t.step, t.cost]), tone: 'faint' },
                    { name: 'best so far', points: sa.trace.map((t) => [t.step, t.best]), tone: 'ink' },
                  ]}
                  xLabel="annealing step"
                  yLabel="objective"
                  hline={{ y: bf.cost, label: 'optimum' }}
                  height={210}
                />
                <p className={sa.best === bf.best ? 'pf-ok' : 'pf-warn'}>
                  Annealing picked <strong>{names(sa.best)}</strong> — {sa.best === bf.best ? 'the true optimum.' : 'not the optimum. Heuristics can miss; run it again.'}
                </p>
              </>
            ) : (
              <div className="chart-empty">Annealing is a classical heuristic: random moves, accepted more cautiously as the “temperature” falls.</div>
            )}
          </div>
        </div>
      )}

      {tab === 'quantum' && (
        <div className="pf-grid pf-grid-2">
          <div>
            <Segmented
              label="QAOA flavour"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'penalty', label: 'Standard (penalty)' },
                { value: 'xy', label: 'Constraint-preserving (XY mixer)' },
              ]}
            />
            <p className="small soft pf-mode-note">
              {mode === 'penalty'
                ? 'Standard QAOA starts from every portfolio at once and relies on the penalty to rule out the wrong number of assets. Watch how much effort goes into just getting the budget right.'
                : 'The Quantum Alternating Operator Ansatz starts from every valid portfolio and only swaps one held asset for another, so it never breaks the budget — all its effort goes into return and risk.'}
              {mode === 'xy' && Cite ? <Cite ids={['xy-mixer']} /> : null}
            </p>
            <div className="label label-faint">Depth 1 · expected cost over all angle pairs (darker = better). Click to choose.</div>
            <Heatmap
              grid={land.grid}
              best={land.best}
              betaMax={betaRange(mode)}
              chosen={angles && angles.gammas.length === 1 ? { gamma: angles.gammas[0], beta: angles.betas[0] } : null}
              onPick={(gamma, beta) => pick({ gammas: [gamma], betas: [beta] })}
            />
            <div className="lab-actions">
              <button className="btn btn-small btn-ghost" onClick={() => pick({ gammas: [land.best.gamma], betas: [land.best.beta] })}>
                Use best depth-1 angles
              </button>
              <button
                className="btn btn-small btn-accent"
                onClick={() => {
                  const r = optimiseQaoa(norm, 2, [land.best.gamma, land.best.gamma * 0.9, land.best.beta, land.best.beta * 0.9], 300, mode, budget)
                  pick({ gammas: r.angles.slice(0, 2), betas: r.angles.slice(2) }, r.value)
                }}
              >
                Optimise depth 2 <Glyph name="spark" size={14} />
              </button>
            </div>
            <p className="label label-faint">Tried: standard {tried.penalty ? '✓' : '—'} · constraint-preserving {tried.xy ? '✓' : '—'}</p>
          </div>
          <div>
            <div className="readouts">
              <Readout label="P(sample the optimum)" value={`${(pOpt * 100).toFixed(1)}%`} tone="accent" />
              <Readout label="random valid pick" value={`${(pFeasibleRandom * 100).toFixed(1)}%`} />
              <Readout label="random any pick" value={`${(pRandom * 100).toFixed(1)}%`} />
              <Readout label={`⟨cost⟩ (0 best, 1 worst)${p2 !== null ? ' · depth 2' : ''}`} value={expectation.toFixed(3)} />
            </div>
            <div className="label label-faint" style={{ marginTop: 14 }}>
              Most likely measurement outcomes
            </div>
            <ul className="pf-top">
              {top.map(({ z, p }) => (
                <li key={z} className={z === target ? 'best' : ''}>
                  <span className="mono pf-top-bits">{bitsOf(z, n).join('')}</span>
                  <span className="pf-top-name">{names(z)}</span>
                  <span className="pf-top-bar">
                    <span style={{ width: `${Math.min(100, (p / top[0].p) * 100)}%` }} />
                  </span>
                  <span className="mono">{(p * 100).toFixed(1)}%</span>
                </li>
              ))}
            </ul>
            <p className="small soft">
              Exact, noiseless simulation of 6 qubits. QAOA doesn't “try every portfolio at once and pick the best” — it biases the odds, and you still have to
              sample. Deeper circuits help in principle but are harder to tune; on real hardware noise blurs these odds, and at useful scale nobody has shown it
              beats the best classical solvers.
            </p>
          </div>
        </div>
      )}
    </LabFrame>
  )
}

function QuboHeat({ Q }: { Q: number[][] }) {
  const max = Math.max(...Q.flat().map(Math.abs), 1e-9)
  return (
    <div className="qubo" style={{ gridTemplateColumns: `40px repeat(${Q.length}, 1fr)` }}>
      <span />
      {DEMO_ASSETS.map((a) => (
        <span key={a.ticker} className="label qubo-h">
          {a.ticker}
        </span>
      ))}
      {Q.map((row, i) => (
        <div key={i} style={{ display: 'contents' }}>
          <span className="label qubo-h">{DEMO_ASSETS[i].ticker}</span>
          {row.map((v, j) => {
            const t = Math.abs(v) / max
            const colour = j < i ? 'transparent' : v < 0 ? `color-mix(in oklab, var(--accent) ${Math.round(t * 85)}%, var(--sheet))` : `color-mix(in oklab, var(--margin-red) ${Math.round(t * 70)}%, var(--sheet))`
            return (
              <span key={j} className="qubo-cell mono" style={{ background: colour, color: t > 0.6 ? 'var(--paper)' : undefined }} title={j < i ? '' : v.toFixed(4)}>
                {j < i ? '' : v.toFixed(2)}
              </span>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function Heatmap({
  grid,
  best,
  chosen,
  onPick,
  betaMax,
}: {
  grid: number[][]
  best: { gamma: number; beta: number }
  chosen: { gamma: number; beta: number } | null
  onPick: (gamma: number, beta: number) => void
  betaMax: number
}) {
  const res = grid.length
  const flat = grid.flat()
  const lo = Math.min(...flat)
  const hi = Math.max(...flat)
  const W = 420
  const H = 300
  const cw = W / res
  const ch = H / res
  const px = (gamma: number) => 40 + (gamma / (2 * Math.PI)) * W
  const py = (beta: number) => 10 + H - (beta / betaMax) * H
  return (
    <svg
      viewBox={`0 0 ${W + 50} ${H + 44}`}
      className="chart heat"
      onClick={(e) => {
        const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
        const sx = ((e.clientX - r.left) / r.width) * (W + 50)
        const sy = ((e.clientY - r.top) / r.height) * (H + 44)
        const gamma = Math.min(2 * Math.PI, Math.max(0, ((sx - 40) / W) * 2 * Math.PI))
        const beta = Math.min(betaMax, Math.max(0, ((10 + H - sy) / H) * betaMax))
        onPick(gamma, beta)
      }}
      role="img"
      aria-label="QAOA landscape heatmap"
      style={{ cursor: 'crosshair' }}
    >
      {grid.map((row, i) =>
        row.map((v, j) => {
          const t = 1 - (v - lo) / (hi - lo || 1)
          return <rect key={`${i}-${j}`} x={40 + j * cw} y={10 + H - (i + 1) * ch} width={cw + 0.5} height={ch + 0.5} fill={`color-mix(in oklab, var(--accent) ${Math.round(t * t * 92)}%, var(--sheet))`} />
        }),
      )}
      <text x={40 + W / 2} y={H + 40} textAnchor="middle" className="chart-label">
        γ (cost angle) 0 → 2π
      </text>
      <text x={8} y={16} className="chart-label">
        β ↑ 0 → {betaMax > 2 ? 'π' : 'π/2'}
      </text>
      <circle cx={px(best.gamma)} cy={py(best.beta)} r={7} fill="none" stroke="var(--paper)" strokeWidth={2.5} />
      <circle cx={px(best.gamma)} cy={py(best.beta)} r={7} fill="none" stroke="var(--ink)" strokeWidth={1} />
      {chosen && <circle cx={px(chosen.gamma)} cy={py(chosen.beta)} r={6} fill="var(--margin-red)" stroke="var(--paper)" strokeWidth={1.5} />}
    </svg>
  )
}
