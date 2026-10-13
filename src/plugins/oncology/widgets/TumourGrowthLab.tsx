import { useEffect, useMemo, useState } from 'react'
import type { WidgetApi } from '../../types'
import { LabFrame, Readout, Segmented, Slider } from '../../../ui/LabFrame'
import { Glyph } from '../../../ui/Glyph'
import { LineChart, Legend } from '../../../ui/charts'
import { DETECTABLE, gompertzB, simulate, timeTo, type GrowthModel, type KillModel } from '../growth'

const K = 1e12
const sci = (v: number) => (v < 1 ? '< 1 cell' : v >= 1e4 ? `10^${Math.log10(v).toFixed(1)}` : Math.round(v).toLocaleString('en-US'))
const years = (d: number) => (d >= 365 ? `${(d / 365).toFixed(1)} y` : `${Math.round(d)} d`)

/**
 * Grow a tumour from one cell, find when it becomes detectable, then design a
 * chemotherapy schedule under log-kill and see what Norton–Simon does to it.
 */
export function TumourGrowthLab({ complete, done, capture, captured, Cite }: WidgetApi) {
  const [model, setModel] = useState<GrowthModel>('gompertz')
  const [td, setTd] = useState(60) // initial doubling time, days
  const [treat, setTreat] = useState(false)
  const [cycles, setCycles] = useState(6)
  const [interval, setGap] = useState(21)
  const [logKill, setLogKill] = useState(2)
  const [kill, setKill] = useState<KillModel>('log-kill')
  const [seen, setSeen] = useState({ cureLogKill: false, nortonSimon: false })

  const p = { n0: 1, doublingDays: td, K, b: gompertzB(td, K) }
  const tDetect = timeTo(model, 1, DETECTABLE, p)
  const start = Math.round(tDetect)
  const horizon = Math.round(tDetect + Math.max(cycles * interval + 400, 600))

  const untreated = useMemo(() => simulate(model, p, null, horizon, 2), [model, td, horizon]) // eslint-disable-line react-hooks/exhaustive-deps
  const treated = useMemo(
    () => (treat ? simulate(model, p, { start, cycles, interval, logKill, kill }, horizon, 1) : null),
    [treat, model, td, start, cycles, interval, logKill, kill, horizon], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const lg = (n: number) => (n <= 0 ? -0.5 : Math.log10(n))

  useEffect(() => {
    if (!treated) return
    if (treated.cured && kill === 'log-kill') setSeen((s) => ({ ...s, cureLogKill: true }))
    if (kill === 'norton-simon' && model === 'gompertz') setSeen((s) => ({ ...s, nortonSimon: true }))
  }, [treated, kill, model])
  const met = seen.cureLogKill && seen.nortonSimon
  useEffect(() => {
    if (met && !done) complete()
  }, [met, done, complete])

  const end = treated ? treated.points[treated.points.length - 1].n : untreated.points[untreated.points.length - 1].n
  const totalLogs = cycles * logKill

  return (
    <LabFrame
      goal="Find a schedule that cures under log-kill, then switch to Norton–Simon and see if it still works"
      met={done || met}
      aside={
        <span>
          {seen.cureLogKill ? '✓' : '○'} cure · {seen.nortonSimon ? '✓' : '○'} Norton–Simon
        </span>
      }
      onSave={
        capture
          ? () =>
              capture(
                `${model === 'gompertz' ? 'Gompertz' : 'Exponential'} growth, initial doubling ${td} d → detectable (10⁹ cells) after ${years(tDetect)} (${(Math.log2(DETECTABLE)).toFixed(0)} doublings) · treatment ${treat ? `${cycles} × ${logKill}-log doses every ${interval} d, ${kill}` : 'none'} → ${treated ? (treated.cured ? 'below one cell' : `nadir ${sci(treated.nadir)} cells, regrows`) : '—'}`,
                { model, td, tDetect, treat, cycles, interval, logKill, kill, cured: treated?.cured ?? null, nadir: treated?.nadir ?? null },
              )
          : undefined
      }
      captured={captured}
    >
      <div className="onc-grid">
        <div>
          <h2 className="lab-h">Growth law</h2>
          <Segmented
            label="Growth model"
            value={model}
            onChange={setModel}
            options={[
              { value: 'exponential', label: 'Exponential' },
              { value: 'gompertz', label: 'Gompertz' },
            ]}
          />
          <Slider label="Doubling time of a small tumour" value={td} min={20} max={200} step={5} onChange={setTd} format={(v) => `${v} days`} />
          <p className="small soft lab-note">
            {model === 'gompertz'
              ? 'Gompertz growth slows as the tumour grows towards a plateau (here 10¹² cells). Same starting speed as the exponential.'
              : 'Exponential growth never slows: every doubling takes the same time.'}
            <Cite ids={['growth-laws']} />
          </p>
          <div className="readouts">
            <Readout label="1 cell → 10⁹ cells (≈1 g)" value={years(tDetect)} tone="accent" />
            <Readout label="Doublings needed" value={Math.log2(DETECTABLE).toFixed(1)} />
          </div>

          <h2 className="lab-h onc-h-gap">Chemotherapy</h2>
          <label className="onc-check">
            <input type="checkbox" checked={treat} onChange={(e) => setTreat(e.target.checked)} /> Start treatment when the tumour becomes detectable
          </label>
          <Slider label="Cycles" value={cycles} min={1} max={12} step={1} onChange={setCycles} />
          <Slider label="Days between doses" value={interval} min={7} max={42} step={7} onChange={setGap} format={(v) => `${v} d`} />
          <Slider label="Kill per dose (at full strength)" value={logKill} min={0.5} max={3} step={0.25} onChange={setLogKill} format={(v) => `${v} logs (${(100 * (1 - 10 ** -v)).toFixed(v >= 2 ? 1 : 0)}%)`} />
          <Segmented
            label="Kill model"
            value={kill}
            onChange={setKill}
            options={[
              { value: 'log-kill', label: 'Log-kill (Skipper)' },
              { value: 'norton-simon', label: 'Norton–Simon' },
            ]}
          />
          <p className="small soft lab-note">
            {kill === 'log-kill'
              ? 'Each dose removes the same fraction of cells — the same number of logs — whatever the tumour size.'
              : 'Each dose kills in proportion to how fast the tumour is growing now. A big Gompertzian tumour grows slowly, so it barely responds; the survivors grow faster and respond more.'}
            <Cite ids={kill === 'log-kill' ? ['log-kill'] : ['norton-simon']} />
          </p>
        </div>

        <div>
          <h2 className="lab-h">Cells over time (log scale)</h2>
          <LineChart
            series={[
              { name: 'untreated', points: untreated.points.map((q) => [q.t / 365, lg(q.n)]), tone: 'faint', dashed: true },
              ...(treated ? [{ name: 'treated', points: treated.points.map((q) => [q.t / 365, lg(q.n)] as [number, number]), tone: 'accent' as const }] : []),
            ]}
            xLabel="Years from the first cancer cell"
            yLabel="log₁₀ cells"
            hline={{ y: 9, label: 'detectable ≈ 10⁹' }}
            yDomain={[-0.5, 12.5]}
            height={300}
          />
          <Legend
            items={[
              { label: 'untreated', tone: 'faint', dashed: true },
              { label: 'treated', tone: 'accent' },
            ]}
          />
          <div className="readouts">
            <Readout label="Total kill scheduled" value={treat ? `${totalLogs.toFixed(1)} logs` : '—'} />
            <Readout label="Lowest point" value={treated ? sci(treated.nadir) : '—'} />
            <Readout label="Outcome" value={treated ? (treated.cured ? 'below 1 cell' : end > DETECTABLE ? 'relapse' : 'regrowing') : '—'} tone={treated?.cured ? 'good' : treated ? 'red' : undefined} />
          </div>
          {treated && !treated.cured && kill === 'log-kill' && (
            <p className="callout callout-info lab-callout" role="status">
              <Glyph name="info" size={18} />
              <span>
                Detection already means about 10⁹ cells: you need roughly nine logs of <em>net</em> kill, after regrowth between doses. Try more cycles, a shorter interval or a
                stronger dose.
              </span>
            </p>
          )}
          {treated && kill === 'norton-simon' && model === 'gompertz' && (
            <p className="callout callout-warn lab-callout" role="status">
              <Glyph name="info" size={18} />
              <span>
                Under Norton–Simon the first doses do little to a large, slow tumour. This is one argument for “dose-dense” schedules — and a reminder that the model you
                assume decides the schedule you recommend.
              </span>
            </p>
          )}
          <p className="small soft lab-note">
            Teaching model: one homogeneous population, no resistance, no toxicity limit. The 10⁹ cells per gram convention may be ten times too high for epithelial
            tumours<Cite ids={['cells-per-gram']} />, and the 10¹² plateau is about a kilogram at that density.
          </p>
        </div>
      </div>
    </LabFrame>
  )
}
