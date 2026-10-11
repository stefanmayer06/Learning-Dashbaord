import { useEffect, useMemo, useState } from 'react'
import type { WidgetApi } from '../../types'
import { LabFrame, Readout, Slider } from '../../../ui/LabFrame'
import { Glyph } from '../../../ui/Glyph'
import { LineChart, Legend } from '../../../ui/charts'
import { tabListKeys } from '../../../ui/tabs'
import { GEHAN_6MP, GEHAN_PLACEBO, coxBinary, kaplanMeier, kmPath, logRank, medianSurvival, simulateTrial, type Obs } from '../survival'

type Tab = 'trial' | 'by-hand' | 'simulate'
const pfmt = (p: number) => (p < 1e-4 ? p.toExponential(1) : p.toFixed(p < 0.01 ? 4 : 3))

function analyse(a: Obs[], b: Obs[]) {
  const kmA = kaplanMeier(a)
  const kmB = kaplanMeier(b)
  return { kmA, kmB, medA: medianSurvival(kmA), medB: medianSurvival(kmB), lr: logRank(a, b), cox: coxBinary(a, b) }
}

/** Kaplan–Meier, log-rank and Cox on a real 1963 trial, then on simulated trials of any size. */
export function SurvivalLab({ complete, done, capture, captured, Cite }: WidgetApi) {
  const [tab, setTab] = useState<Tab>('trial')
  const real = useMemo(() => analyse(GEHAN_6MP, GEHAN_PLACEBO), [])
  const [perArm, setPerArm] = useState(30)
  const [hr, setHr] = useState(0.7)
  const [median, setMedian] = useState(12)
  const [seed, setSeed] = useState(1)
  const [sim, setSim] = useState<ReturnType<typeof analyse> | null>(null)
  const [power, setPower] = useState<{ n: number; hr: number; sig: number; reps: number } | null>(null)
  const [visited, setVisited] = useState<Record<Tab, boolean>>({ trial: true, 'by-hand': false, simulate: false })

  useEffect(() => setVisited((v) => ({ ...v, [tab]: true })), [tab])
  useEffect(() => {
    setSim(null)
    setPower(null)
  }, [perArm, hr, median])
  const met = visited['by-hand'] && power !== null
  useEffect(() => {
    if (met && !done) complete()
  }, [met, done, complete])

  const runOne = () => {
    const s = seed + 1
    setSeed(s)
    const t = simulateTrial({ perArm, controlMedian: median, hr, accrual: 24, followUp: 24, seed: s })
    setSim(analyse(t.treated, t.control))
  }
  const runMany = () => {
    const reps = 200
    let sig = 0
    for (let r = 0; r < reps; r++) {
      const t = simulateTrial({ perArm, controlMedian: median, hr, accrual: 24, followUp: 24, seed: 1000 + r })
      if (logRank(t.treated, t.control).p < 0.05) sig++
    }
    setPower({ n: perArm, hr, sig, reps })
  }

  const curves = (r: ReturnType<typeof analyse>, labels: [string, string], until: number) => (
    <>
      <LineChart
        series={[
          { name: labels[0], points: kmPath(r.kmA, until), tone: 'accent' },
          { name: labels[1], points: kmPath(r.kmB, until), tone: 'ink' },
          ...censorTicks(r.kmA, 'accent'),
          ...censorTicks(r.kmB, 'ink'),
        ]}
        xLabel={tab === 'simulate' ? 'Months' : 'Weeks in remission'}
        yLabel="Proportion still in remission"
        yDomain={[0, 1]}
        hline={{ y: 0.5, label: 'median' }}
        height={270}
      />
      <Legend
        items={[
          { label: labels[0], tone: 'accent' },
          { label: labels[1], tone: 'ink' },
        ]}
      />
    </>
  )

  return (
    <LabFrame
      goal="Read a real trial, compute a survival curve by hand, then find how many patients a trial needs"
      met={done || met}
      onSave={
        capture
          ? () =>
              capture(
                `6-MP trial (Freireich 1963): median remission ${real.medA} v ${real.medB} weeks, log-rank χ² ${real.lr.chi2.toFixed(2)} (p ${pfmt(real.lr.p)}), Cox HR ${real.cox.hr.toFixed(2)} (95% CI ${real.cox.lo.toFixed(2)}–${real.cox.hi.toFixed(2)})${power ? ` · simulated power at ${power.n}/arm for true HR ${power.hr}: ${Math.round((100 * power.sig) / power.reps)}%` : ''}`,
                { real: { medA: real.medA, medB: real.medB, chi2: real.lr.chi2, p: real.lr.p, hr: real.cox.hr, ci: [real.cox.lo, real.cox.hi] }, power },
              )
          : undefined
      }
      captured={captured}
    >
      <div className="tabs lab-tabs" role="tablist" aria-label="Lab section" onKeyDown={tabListKeys(['trial', 'by-hand', 'simulate'] as const, tab, setTab, (t) => `sv-tab-${t}`)}>
        {(
          [
            { value: 'trial', label: 'The 1963 trial' },
            { value: 'by-hand', label: 'By hand' },
            { value: 'simulate', label: 'Design a trial' },
          ] as { value: Tab; label: string }[]
        ).map((t, i) => (
          <button key={t.value} type="button" role="tab" id={`sv-tab-${t.value}`} aria-selected={tab === t.value} tabIndex={tab === t.value ? 0 : -1} aria-controls="sv-panel" className="tab" onClick={() => setTab(t.value)}>
            <span className="lab-tab-n" aria-hidden>
              {i + 1}
            </span>
            {t.label}
          </button>
        ))}
      </div>

      <div id="sv-panel" role="tabpanel" aria-labelledby={`sv-tab-${tab}`}>
        {tab === 'trial' && (
          <div className="onc-grid">
            <div>
              <h2 className="lab-h">6-mercaptopurine v. placebo, childhood leukaemia</h2>
              <p className="small soft lab-sub">
                Real data: 42 children in remission, 21 matched pairs. Ticks mark censored patients — still in remission when last seen.
                <Cite ids={['freireich-trial']} />
              </p>
              {curves(real, ['6-MP', 'placebo'], 35)}
            </div>
            <div>
              <h2 className="lab-h">What the trial shows</h2>
              <div className="readouts readouts-2">
                <Readout label="Median remission, 6-MP" value={`${real.medA} weeks`} tone="accent" />
                <Readout label="Median remission, placebo" value={`${real.medB} weeks`} />
                <Readout label="Log-rank χ² (1 df)" value={`${real.lr.chi2.toFixed(2)} · p ${pfmt(real.lr.p)}`} />
                <Readout label="Cox hazard ratio (95% CI)" value={`${real.cox.hr.toFixed(2)} (${real.cox.lo.toFixed(2)}–${real.cox.hi.toFixed(2)})`} tone="good" />
              </div>
              <p className="small lab-note">
                A hazard ratio of {real.cox.hr.toFixed(2)} means that, at any moment, a child on 6-MP relapsed at about a fifth of the rate of a child on placebo.
                <Cite ids={['cox-ph', 'freireich-results']} />
              </p>
              <p className="small soft lab-note">
                Observed relapses on 6-MP: {real.lr.observedA}; expected if the drug did nothing: {real.lr.expectedA.toFixed(1)}. The log-rank test asks whether that gap is bigger than
                chance.
                <Cite ids={['logrank']} />
              </p>
            </div>
          </div>
        )}

        {tab === 'by-hand' && (
          <div className="onc-grid">
            <div>
              <h2 className="lab-h">The Kaplan–Meier table, 6-MP arm</h2>
              <p className="small soft lab-sub">
                At each relapse time, multiply by (1 − relapses ÷ at risk). Censored children leave the “at risk” count without making the curve step.
                <Cite ids={['km-estimator', 'km-rule']} />
              </p>
              <div className="lab-table-wrap">
                <table className="lab-table">
                  <thead>
                    <tr>
                      <th scope="col">Week</th>
                      <th scope="col" className="num-col">At risk</th>
                      <th scope="col" className="num-col">Relapses</th>
                      <th scope="col" className="num-col">Censored</th>
                      <th scope="col" className="num-col">Factor</th>
                      <th scope="col" className="num-col">S(t)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {real.kmA.map((k) => (
                      <tr key={k.t} className={k.events ? '' : 'onc-muted-row'}>
                        <td className="mono">{k.t}</td>
                        <td className="mono num-col">{k.atRisk}</td>
                        <td className="mono num-col">{k.events || '—'}</td>
                        <td className="mono num-col">{k.censored || '—'}</td>
                        <td className="mono num-col">{k.events ? `1 − ${k.events}/${k.atRisk}` : '×1'}</td>
                        <td className="mono num-col">{k.s.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <h2 className="lab-h">Check yourself</h2>
              <ol className="onc-steps small">
                <li>
                  Week 6: 21 at risk, 3 relapse → S = 1 × (1 − 3/21) = <span className="mono">0.8571</span>.
                </li>
                <li>One child is censored at week 6, so 17 remain at risk at week 7.</li>
                <li>
                  Week 7: S = 0.8571 × (1 − 1/17) = <span className="mono">0.8067</span>.
                </li>
                <li>Continue to week 23: the curve first reaches ≤ 0.5, so the median is 23 weeks.</li>
              </ol>
              <p className="callout callout-info lab-callout">
                <Glyph name="info" size={18} />
                <span>
                  Dropping censored patients, or counting them as relapses, gives a different — wrong — curve. Kaplan and Meier's estimator uses every child for as long as
                  they were watched.
                </span>
              </p>
            </div>
          </div>
        )}

        {tab === 'simulate' && (
          <div className="onc-grid">
            <div>
              <p className="small soft onc-synthetic">
                <span className="chip chip-warn">Synthetic trials</span>
                <span>Exponential survival, 24 months' accrual and 24 months' follow-up.</span>
              </p>
              <Slider label="Patients per arm" value={perArm} min={10} max={400} step={10} onChange={setPerArm} />
              <Slider label="True hazard ratio (treatment ÷ control)" value={hr} min={0.4} max={1} step={0.05} onChange={setHr} format={(v) => v.toFixed(2)} />
              <Slider label="Control-arm median survival" value={median} min={6} max={36} step={3} onChange={setMedian} format={(v) => `${v} months`} />
              <div className="lab-actions">
                <button className="btn btn-small btn-secondary" onClick={runOne}>
                  Run one trial <Glyph name="play" size={12} />
                </button>
                <button className="btn btn-small" onClick={runMany}>
                  Run 200 trials <Glyph name="spark" size={14} />
                </button>
              </div>
              {power && (
                <div className="readouts">
                  <Readout label="Trials with p < 0.05 (power)" value={`${Math.round((100 * power.sig) / power.reps)}%`} tone={power.sig / power.reps >= 0.8 ? 'good' : 'red'} />
                  <Readout label="Trials that missed a real effect" value={`${Math.round((100 * (power.reps - power.sig)) / power.reps)}%`} />
                </div>
              )}
              <p className="small soft lab-note">
                {hr === 1
                  ? 'With a true hazard ratio of 1 the drug does nothing: about 5% of trials still come out “significant”. That is the false-positive rate you chose.'
                  : 'Power is the chance a trial detects an effect that is really there. Trials are usually designed for at least 80%.'}
              </p>
            </div>
            <div>
              {sim ? (
                <>
                  {curves(sim, ['treatment', 'control'], 48)}
                  <div className="readouts readouts-2">
                    <Readout label="Estimated HR (95% CI)" value={`${sim.cox.hr.toFixed(2)} (${sim.cox.lo.toFixed(2)}–${sim.cox.hi.toFixed(2)})`} tone="accent" />
                    <Readout label="Log-rank p" value={pfmt(sim.lr.p)} tone={sim.lr.p < 0.05 ? 'good' : 'red'} />
                  </div>
                </>
              ) : (
                <div className="chart-empty">Run one trial to see its curves. Then run 200 to see how often a trial of this size would find the effect.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </LabFrame>
  )
}

/** Short vertical strokes on the curve where patients were censored. */
function censorTicks(km: ReturnType<typeof kaplanMeier>, tone: 'accent' | 'ink') {
  return km
    .filter((k) => k.censored > 0)
    .map((k) => ({ name: `censored ${k.t}`, points: [[k.t, k.s - 0.025], [k.t, k.s + 0.025]] as [number, number][], tone }))
}
