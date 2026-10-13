import { useEffect, useMemo, useState } from 'react'
import type { WidgetApi } from '../../types'
import { LabFrame, Readout, Slider } from '../../../ui/LabFrame'
import { Glyph } from '../../../ui/Glyph'
import { tabListKeys } from '../../../ui/tabs'
import { bruteForce, normalise, optimiseQaoa, qaoaLandscape, qaoaState } from '../../quantum/portfolio'
import { GENES, NG, TRAIN, VALIDATION, accuracy, greedyTopK, label, maskOf, panelProblem, scores, subsetOf, swapAnnealing } from '../panel'

type Tab = 'data' | 'solve' | 'verdict'
const pct = (v: number) => `${(v * 100).toFixed(1)}%`
const binom = (a: number, b: number) => {
  let r = 1
  for (let i = 1; i <= b; i++) r = (r * (a - b + i)) / i
  return r
}

/** Choose a k-gene panel: greedy relevance v. a redundancy-aware QUBO solved three ways. */
export function PanelQuboLab({ complete, done, capture, captured, Cite }: WidgetApi) {
  const [tab, setTab] = useState<Tab>('data')
  const { relevance, redundancy } = useMemo(() => scores(TRAIN), [])
  const [k, setK] = useState(3)
  const [alpha, setAlpha] = useState(0.5)
  const lambda = 2
  const prob = useMemo(() => panelProblem(relevance, redundancy, alpha, k, lambda), [relevance, redundancy, alpha, k])
  const bf = useMemo(() => bruteForce(prob), [prob])
  // best panel with exactly k genes (the XY mixer only ever sees these)
  const bestValid = useMemo(() => {
    let b = -1
    bf.costs.forEach((v, z) => {
      if (subsetOf(z).length === k && (b < 0 || v < bf.costs[b])) b = z
    })
    return b
  }, [bf, k])
  const quboPanel = subsetOf(bestValid)
  const greedy = greedyTopK(relevance, k)

  const [sa, setSa] = useState<{ best: number; bestCost: number } | null>(null)
  const [saSeed, setSaSeed] = useState(4)
  const norm = useMemo(() => normalise(bf.costs, k), [bf, k])
  // average normalised cost of a uniformly random valid panel (0 = optimum, 1 = worst)
  const randomCost = useMemo(() => {
    let sum = 0
    let count = 0
    norm.forEach((v, z) => {
      if (subsetOf(z).length === k) {
        sum += v
        count++
      }
    })
    return sum / count
  }, [norm, k])
  const [qaoa, setQaoa] = useState<{ depth: number; probs: number[]; expectation: number } | null>(null)
  useEffect(() => {
    setSa(null)
    setQaoa(null)
  }, [k, alpha])

  const runSa = () => {
    const s = saSeed + 1
    setSaSeed(s)
    setSa(swapAnnealing(prob, 300, s))
  }
  const runQaoa = (depth: 1 | 2) => {
    const land = qaoaLandscape(norm, 28, 'xy', k)
    let gammas = [land.best.gamma]
    let betas = [land.best.beta]
    if (depth === 2) {
      const r = optimiseQaoa(norm, 2, [land.best.gamma, land.best.gamma * 0.9, land.best.beta, land.best.beta * 0.9], 250, 'xy', k)
      gammas = r.angles.slice(0, 2)
      betas = r.angles.slice(2)
    }
    const probs = qaoaState(norm, gammas, betas, 'xy', k).probabilities()
    setQaoa({ depth, probs, expectation: probs.reduce((acc, pz, z) => acc + pz * norm[z], 0) })
  }
  const qaoaTop = qaoa
    ? qaoa.probs
        .map((p, z) => ({ z, p }))
        .filter((x) => subsetOf(x.z).length === k)
        .sort((a, b) => b.p - a.p)
        .slice(0, 5)
    : []

  const acc = (genes: number[]) => accuracy(TRAIN, VALIDATION, genes)
  const accGreedy = acc(greedy)
  const accQubo = acc(quboPanel)
  const met = sa !== null && qaoa !== null
  useEffect(() => {
    if (met && !done) complete()
  }, [met, done, complete])

  return (
    <LabFrame
      goal="Pick a gene panel greedily and with a redundancy-aware QUBO; solve the QUBO by annealing and QAOA; check which panel generalises"
      met={done || met}
      onSave={
        capture
          ? () =>
              capture(
                `${k}-gene panel, redundancy weight α = ${alpha.toFixed(2)}: greedy ${label(greedy)} (validation ${pct(accGreedy)}) v. QUBO optimum ${label(quboPanel)} (${pct(accQubo)}) · annealing ${sa ? (maskOf(subsetOf(sa.best)) === bestValid ? 'found it' : 'missed it') : 'not run'} · QAOA depth ${qaoa?.depth ?? '—'} P(optimum) ${qaoa ? pct(qaoa.probs[bestValid]) : '—'} v. ${pct(1 / binom(NG, k))} at random`,
                { k, alpha, greedy: label(greedy), qubo: label(quboPanel), accGreedy, accQubo, pOptimum: qaoa ? qaoa.probs[bestValid] : null },
              )
          : undefined
      }
      captured={captured}
    >
      <p className="small soft onc-synthetic">
        <span className="chip chip-warn">Synthetic data</span>
        <span>Eight made-up genes, 100 training patients and a 4,000-patient validation cohort, all simulated. Not real biomarkers.</span>
      </p>

      <div className="tabs lab-tabs" role="tablist" aria-label="Lab section" onKeyDown={tabListKeys(['data', 'solve', 'verdict'] as const, tab, setTab, (t) => `pq-tab-${t}`)}>
        {(
          [
            { value: 'data', label: 'Genes' },
            { value: 'solve', label: 'Solve' },
            { value: 'verdict', label: 'Does it generalise?' },
          ] as { value: Tab; label: string }[]
        ).map((t, i) => (
          <button key={t.value} type="button" role="tab" id={`pq-tab-${t.value}`} aria-selected={tab === t.value} tabIndex={tab === t.value ? 0 : -1} aria-controls="pq-panel" className="tab" onClick={() => setTab(t.value)}>
            <span className="lab-tab-n" aria-hidden>
              {i + 1}
            </span>
            {t.label}
          </button>
        ))}
      </div>

      <div id="pq-panel" role="tabpanel" aria-labelledby={`pq-tab-${tab}`}>
        {tab === 'data' && (
          <div className="onc-grid">
            <div>
              <h2 className="lab-h">Relevance to treatment response</h2>
              <p className="small soft lab-sub">|correlation| of each gene with response, in the training patients.</p>
              <ul className="onc-bars">
                {GENES.map((name, i) => (
                  <li key={name} className={greedy.includes(i) ? 'on' : ''}>
                    <span className="onc-bars-name">{name}</span>
                    <span className="onc-bars-track">
                      <span style={{ width: `${(relevance[i] / Math.max(...relevance)) * 100}%` }} />
                    </span>
                    <span className="mono">{relevance[i].toFixed(2)}</span>
                  </li>
                ))}
              </ul>
              <p className="small soft lab-note">Highlighted: the top {k} by relevance — the greedy panel.</p>
            </div>
            <div>
              <h2 className="lab-h">Redundancy between genes</h2>
              <p className="small soft lab-sub">|correlation| between pairs. Dark cells: two genes that carry the same information.</p>
              <div className="qubo onc-heat" style={{ gridTemplateColumns: `28px repeat(${NG}, 1fr)` }}>
                <span />
                {GENES.map((g) => (
                  <span key={g} className="qubo-h mono">
                    {g.replace('Gene ', '')}
                  </span>
                ))}
                {redundancy.map((row, i) => (
                  <div key={i} style={{ display: 'contents' }}>
                    <span className="qubo-h mono">{GENES[i].replace('Gene ', '')}</span>
                    {row.map((v, j) => (
                      <span
                        key={j}
                        className="qubo-cell mono"
                        style={{ background: i === j ? 'var(--bg-subtle)' : `color-mix(in oklab, var(--accent-fg) ${Math.round(v * 85)}%, var(--surface))`, color: v > 0.6 ? 'var(--bg)' : undefined }}
                        title={i === j ? '' : v.toFixed(2)}
                      >
                        {i === j ? '' : v.toFixed(1)}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
              <div className="pf-formula">
                <span className="readout-label">QUBO (mRMR-style)</span>
                <span>
                  minimise <span className="mono">α·Σ x_i x_j R_ij − Σ x_i r_i + λ(Σx − k)²</span>
                  <Cite ids={['mrmr', 'qubo-feature-selection']} />
                </span>
              </div>
            </div>
          </div>
        )}

        {tab === 'solve' && (
          <div className="onc-grid">
            <div>
              <Slider label="Genes in the panel (k)" value={k} min={2} max={4} step={1} onChange={setK} />
              <Slider label="Redundancy weight α" value={alpha} min={0} max={1.5} step={0.05} onChange={setAlpha} format={(v) => v.toFixed(2)} />
              <div className="readouts readouts-2">
                <Readout label="Greedy (top-k relevance)" value={<span className="readout-text">{label(greedy)}</span>} />
                <Readout label="QUBO optimum (brute force)" value={<span className="readout-text">{label(quboPanel)}</span>} tone="accent" />
              </div>
              <p className="small soft lab-note">
                Brute force checks all {binom(NG, k)} panels of {k} — trivial for 8 genes, hopeless for 20,000. That is the only reason to want a better optimiser.
                <Cite ids={['subset-count']} />
              </p>
              <div className="lab-actions">
                <button className="btn btn-small btn-secondary" onClick={runSa}>
                  Simulated annealing <Glyph name="play" size={12} />
                </button>
                <button className="btn btn-small btn-secondary" onClick={() => runQaoa(1)}>
                  QAOA depth 1
                </button>
                <button className="btn btn-small" onClick={() => runQaoa(2)}>
                  QAOA depth 2 <Glyph name="spark" size={14} />
                </button>
              </div>
              {sa && (
                <p className={`callout lab-callout ${maskOf(subsetOf(sa.best)) === bestValid ? 'callout-good' : 'callout-warn'}`} role="status">
                  <Glyph name={maskOf(subsetOf(sa.best)) === bestValid ? 'checkCircle' : 'info'} size={18} />
                  <span>
                    Annealing returned <strong>{label(subsetOf(sa.best))}</strong> — {maskOf(subsetOf(sa.best)) === bestValid ? 'the optimum.' : 'not the optimum. Heuristics can miss; run it again.'} Its moves swap one gene for another, so it keeps exactly {k} genes — the classical twin of QAOA's XY mixer.
                    <Cite ids={['simulated-annealing']} />
                  </span>
                </p>
              )}
            </div>
            <div>
              <h2 className="lab-h">QAOA with a constraint-preserving mixer</h2>
              <p className="small soft lab-sub">
                {NG} qubits, one per gene. The XY mixer only swaps one chosen gene for another, so every outcome has exactly {k} genes.
                <Cite ids={['qaoa']} />
              </p>
              {qaoa ? (
                <>
                  <div className="readouts">
                    <Readout label="Average cost, QAOA (0 = best)" value={qaoa.expectation.toFixed(3)} tone="accent" />
                    <Readout label="Average cost, random panel" value={randomCost.toFixed(3)} />
                    <Readout label="P(sample the optimum)" value={pct(qaoa.probs[bestValid])} tone={qaoa.probs[bestValid] > 1 / binom(NG, k) ? 'good' : 'red'} />
                    <Readout label="P(optimum), random" value={pct(1 / binom(NG, k))} />
                  </div>
                  {qaoa.probs[bestValid] <= 1 / binom(NG, k) && (
                    <p className="callout callout-warn lab-callout" role="status">
                      <Glyph name="info" size={18} />
                      <span>
                        QAOA lowered the average cost but did not raise the odds of the single best panel. At low depth that is common: the angles are tuned for the average,
                        not the optimum. Try the other depth, or another α.
                      </span>
                    </p>
                  )}
                  <ul className="pf-top">
                    {qaoaTop.map(({ z, p }) => (
                      <li key={z} className={z === bestValid ? 'best' : ''}>
                        <span className="mono pf-top-bits">{z.toString(2).padStart(NG, '0')}</span>
                        <span className="pf-top-name">{label(subsetOf(z))}</span>
                        <span className="pf-top-bar">
                          <span style={{ width: `${Math.min(100, (p / qaoaTop[0].p) * 100)}%` }} />
                        </span>
                        <span className="mono">{pct(p)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="small soft lab-note">Exact, noiseless simulation. QAOA raises the odds of good panels; you still sample, and nobody has shown it beats classical solvers on real feature selection.</p>
                </>
              ) : (
                <div className="chart-empty">Run QAOA to see which panels a measurement would return, and how often.</div>
              )}
            </div>
          </div>
        )}

        {tab === 'verdict' && (
          <div className="onc-grid">
            <div>
              <h2 className="lab-h">Accuracy on 4,000 new patients</h2>
              <div className="readouts readouts-2">
                <Readout label={`Greedy: ${label(greedy)}`} value={pct(accGreedy)} />
                <Readout label={`QUBO (α = ${alpha.toFixed(2)}): ${label(quboPanel)}`} value={pct(accQubo)} tone={accQubo > accGreedy ? 'good' : accQubo < accGreedy ? 'red' : undefined} />
              </div>
              <p className="small soft lab-note">
                Nearest-centroid classifier fitted on the 100 training patients, scored on the validation cohort. Try α = 0, 0.5 and 1.5.
                <Cite ids={['panel-sim']} />
              </p>
            </div>
            <div>
              <h2 className="lab-h">What to take away</h2>
              <ul className="onc-steps small">
                <li>The QUBO is a proxy. Its optimum is the best panel for the objective you wrote, not necessarily for patients.</li>
                <li>Too little redundancy penalty keeps near-duplicate genes; too much throws away good genes for noise.</li>
                <li>Choose α with cross-validation inside the training data — never on the validation cohort, or you have rebuilt the leakage lab.</li>
                <li>Which solver found the optimum does not change the panel's accuracy. A quantum solver can only help by finding better optima, faster, on problems too large for classical ones.</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </LabFrame>
  )
}
