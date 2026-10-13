import { useEffect, useState } from 'react'
import type { WidgetApi } from '../../types'
import { LabFrame, Readout, Segmented, Slider } from '../../../ui/LabFrame'
import { Glyph } from '../../../ui/Glyph'
import { experiment, mean, type LeakageRun } from '../leakage'

const pct = (v: number) => `${Math.round(v * 100)}%`

/** Pure-noise "gene expression": watch a leaky protocol report a great classifier. */
export function LeakageLab({ complete, done, capture, captured, Cite }: WidgetApi) {
  const [n, setN] = useState(40)
  const [logP, setLogP] = useState(Math.log10(2000))
  const [k, setK] = useState(20)
  const [signal, setSignal] = useState<'none' | 'weak'>('none')
  const [seed, setSeed] = useState(1)
  const [run, setRun] = useState<{ res: LeakageRun; n: number; p: number; k: number; signal: 'none' | 'weak' } | null>(null)
  const [busy, setBusy] = useState(false)
  const p = Math.round(10 ** logP)

  const go = () => {
    setBusy(true)
    // let the button repaint before the (synchronous) computation
    setTimeout(() => {
      const s = seed + 1
      setSeed(s)
      const res = experiment({ n, p, k, folds: 5, reps: 12, seed: s, signalGenes: signal === 'weak' ? 10 : 0, effect: 0.8 })
      setRun({ res, n, p, k, signal })
      setBusy(false)
    }, 20)
  }
  const sawLeak = run !== null && run.signal === 'none' && mean(run.res.leaky) - mean(run.res.proper) > 0.2
  useEffect(() => {
    if (sawLeak && !done) complete()
  }, [sawLeak, done, complete])

  return (
    <LabFrame
      goal="On pure noise, make the leaky protocol report a classifier that looks excellent — then read the honest number"
      met={done || sawLeak}
      onSave={
        capture && run
          ? () =>
              capture(
                `${run.n} patients × ${run.p.toLocaleString('en-US')} genes (${run.signal === 'none' ? 'pure noise' : '10 weakly informative genes'}), top-${run.k} panel, 5-fold CV, 12 repeats: leaky ${pct(mean(run.res.leaky))} v. honest ${pct(mean(run.res.proper))} accuracy`,
                { ...run, leakyMean: mean(run.res.leaky), properMean: mean(run.res.proper) },
              )
          : undefined
      }
      captured={captured}
    >
      <p className="small soft onc-synthetic">
        <span className="chip chip-warn">Synthetic data</span>
        <span>Random numbers standing in for gene expression; labels are a coin toss unless you add signal.</span>
      </p>
      <div className="onc-grid">
        <div>
          <h2 className="lab-h">The study</h2>
          <Slider label="Patients" value={n} min={20} max={200} step={10} onChange={setN} />
          <Slider label="Genes measured" value={logP} min={2} max={3.7} step={0.05} onChange={setLogP} format={() => p.toLocaleString('en-US')} />
          <Slider label="Genes in the panel" value={k} min={1} max={100} step={1} onChange={setK} />
          <Segmented
            label="True signal"
            value={signal}
            onChange={setSignal}
            options={[
              { value: 'none', label: 'None (pure noise)' },
              { value: 'weak', label: '10 weakly informative genes' },
            ]}
          />
          <div className="lab-actions">
            <button className="btn btn-small" onClick={go} disabled={busy}>
              {busy ? 'Running…' : 'Run both protocols'} <Glyph name="play" size={12} />
            </button>
          </div>
          <ol className="onc-steps small">
            <li>
              <strong>Leaky:</strong> rank all genes by |t| using <em>every</em> patient, keep the top {k}, then cross-validate a classifier on them.
            </li>
            <li>
              <strong>Honest:</strong> inside each of the 5 folds, rank genes using only that fold's training patients.
            </li>
          </ol>
          <p className="small soft lab-note">
            Ambroise and McLachlan showed in 2002 that published few-gene cancer classifiers with near-zero error had made the leaky mistake.
            <Cite ids={['selection-bias']} />
          </p>
        </div>
        <div>
          <h2 className="lab-h">Reported accuracy over 12 repeats</h2>
          {run ? (
            <>
              <Dots label="Leaky" values={run.res.leaky} tone="red" />
              <Dots label="Honest" values={run.res.proper} tone="good" />
              <div className="readouts">
                <Readout label="Leaky (mean)" value={pct(mean(run.res.leaky))} tone="red" />
                <Readout label="Honest (mean)" value={pct(mean(run.res.proper))} tone="good" />
                <Readout label="Chance" value="50%" />
              </div>
              {run.signal === 'none' && (
                <p className="callout callout-warn lab-callout" role="status">
                  <Glyph name="info" size={18} />
                  <span>
                    There is nothing to find — and the leaky protocol still reports {pct(mean(run.res.leaky))}. With {run.p.toLocaleString('en-US')} genes and {run.n} patients, some
                    genes separate the groups by chance, and choosing them on all patients lets the test folds help pick them.
                    <Cite ids={['p-much-greater-n', 'leakage-sim']} />
                  </span>
                </p>
              )}
            </>
          ) : (
            <div className="chart-empty">Run the study. Each dot is one complete study on a fresh random dataset.</div>
          )}
          <p className="small soft lab-note">
            The same trap catches quantum classifiers: a feature map or QUBO feature-selection step fitted on all the data leaks exactly like this.
            <Cite ids={['leakage-294']} />
          </p>
        </div>
      </div>
    </LabFrame>
  )
}

function Dots({ label, values, tone }: { label: string; values: number[]; tone: 'red' | 'good' }) {
  return (
    <div className="onc-dots" aria-label={`${label}: ${values.map(pct).join(', ')}`}>
      <span className="onc-dots-label">{label}</span>
      <div className="onc-dots-track">
        <span className="onc-dots-chance" style={{ left: '50%' }} aria-hidden />
        {values.map((v, i) => (
          <span key={i} className={`onc-dot onc-dot-${tone}`} style={{ left: `${v * 100}%`, top: `${20 + ((i * 37) % 60)}%` }} title={pct(v)} />
        ))}
      </div>
      <div className="onc-dots-axis mono small" aria-hidden>
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
    </div>
  )
}
