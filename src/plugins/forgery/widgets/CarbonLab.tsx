import { useEffect, useMemo, useState } from 'react'
import type { WidgetApi } from '../../types'
import { LabFrame, Readout, Segmented, Slider } from '../../../ui/LabFrame'
import { Glyph } from '../../../ui/Glyph'
import { Rich } from '../../../ui/Tex'
import { LineChart } from '../../../ui/charts'
import { BOMB_NH1, f14cAt, isPreBomb, matchWindows } from '../carbon'

interface CarbonCase {
  id: string
  title: string
  synthetic: boolean
  sample: string
  context: string
  /** Measured fraction modern carbon, and its 1σ uncertainty. */
  F: number
  sigma: number
  reveal: string
  cite?: string[]
  caseFile?: boolean
}

const K = 2 // ±2σ, about 95%
const PAD = 0.3 // a mark within 0.3 y of a window counts (the slider moves in tenths)

/**
 * Bomb-peak radiocarbon: move through the years and mark every year whose air
 * matches the sample. A modern binder usually matches twice — on the 1950s rise
 * and on the long decline.
 */
export function CarbonLab({ props, complete, done, capture, captured, Cite }: WidgetApi) {
  const cases = (props.cases as CarbonCase[]) ?? []
  const [active, setActive] = useState(cases[0]?.id ?? '')
  const c = cases.find((x) => x.id === active) ?? cases[0]
  const [year, setYear] = useState(1990)
  const [marks, setMarks] = useState<Record<string, number[]>>({})
  const windows = useMemo(() => (c ? matchWindows(c.F, c.sigma, K) : []), [c])

  const found = (k: CarbonCase) => {
    const w = matchWindows(k.F, k.sigma, K)
    const m = marks[k.id] ?? []
    return w.filter(([a, b]) => m.some((y) => y >= a - PAD && y <= b + PAD)).length
  }
  const complete1 = (k: CarbonCase) => found(k) === matchWindows(k.F, k.sigma, K).length
  const nSolved = cases.filter(complete1).length
  const met = cases.length > 0 && nSolved === cases.length
  useEffect(() => {
    if (met && !done) complete()
  }, [met, done, complete])
  if (!c) return null

  const here = f14cAt(year)
  const inBand = Math.abs(here - c.F) <= K * c.sigma
  const myMarks = marks[c.id] ?? []
  const nFound = found(c)
  const allFound = nFound === windows.length
  const pre = isPreBomb(c.F, c.sigma, K)
  const mark = () => setMarks((m) => ({ ...m, [c.id]: [...(m[c.id] ?? []), Math.round(year * 10) / 10] }))
  const caseFile = cases.find((k) => k.caseFile)
  const fmtW = ([a, b]: [number, number]) => (Math.floor(a) === Math.floor(b) ? `${Math.floor(a)}` : `${Math.floor(a)}–${Math.floor(b)}`)

  const curve: [number, number][] = BOMB_NH1.map(([x, y]) => [x, y])
  const bandEnds: [number, number, number][] = [
    [BOMB_NH1[0][0], c.F - K * c.sigma, c.F + K * c.sigma],
    [BOMB_NH1[BOMB_NH1.length - 1][0], c.F - K * c.sigma, c.F + K * c.sigma],
  ]

  return (
    <LabFrame
      goal={`Find every calendar window that matches the measurement in all ${cases.length} samples`}
      met={done || met}
      aside={
        <>
          <span className="mono">{nSolved}</span>/{cases.length} samples
        </>
      }
      onSave={
        capture && caseFile
          ? () => {
              const w = matchWindows(caseFile.F, caseFile.sigma, K)
              capture(
                `Radiocarbon (${caseFile.title}): F14C ${caseFile.F.toFixed(3)} ± ${caseFile.sigma.toFixed(3)} matches ${isPreBomb(caseFile.F, caseFile.sigma, K) ? 'the pre-bomb plateau (before about 1955)' : w.map(fmtW).join(' or ')} at 95%${complete1(caseFile) ? '' : ' · (not all windows marked yet)'}`,
                { case: caseFile.id, F: caseFile.F, sigma: caseFile.sigma, windows: w },
              )
            }
          : undefined
      }
      captured={captured}
    >
      <div className="carbon">
        <Segmented label="Sample" value={c.id} onChange={setActive} options={cases.map((k, i) => ({ value: k.id, label: <>{complete1(k) ? '✓ ' : ''}{i + 1}. {k.title}</> }))} />
        <div className="lab-panel">
          <div className="pig-case-head">
            <h2 className="lab-h">{c.sample}</h2>
            <span className="chip">{c.synthetic ? 'Synthetic measurement' : 'Real measurement'}</span>
          </div>
          <p className="small">
            <Rich text={c.context} />
            {c.cite && <Cite ids={c.cite} />}
          </p>
          <p className="pig-claim">
            Measured: <strong className="mono">F¹⁴C = {c.F.toFixed(3)} ± {c.sigma.toFixed(3)}</strong> <span className="soft">(the band shows ±2σ)</span>
          </p>
        </div>

        <div className="carbon-chart">
          <LineChart
            series={[
              { name: 'measurement ±2σ', points: [[bandEnds[0][0], c.F], [bandEnds[1][0], c.F]], tone: 'red', dashed: true, band: bandEnds },
              { name: 'air, northern hemisphere', points: curve, tone: 'ink' },
            ]}
            xLabel="Year the plant grew"
            yLabel="F¹⁴C of the air"
            marker={{ x: year, y: here, label: `${year.toFixed(1)}` }}
            yDomain={[0.94, 1.95]}
            xTickFormat={(v) => String(Math.round(v))}
            width={620}
            height={300}
          />
          <p className="lab-caption">Curve: annual mean atmospheric ¹⁴C, northern hemisphere zone 1, 1950–2019 (Hua et al. 2022). The sample values are synthetic.</p>
        </div>

        <Slider label="Year the oil seeds (or flax) grew" value={year} min={1950.5} max={2019.5} step={0.1} onChange={setYear} format={(v) => v.toFixed(1)} />
        <div className="readouts">
          <Readout label="Air that year" value={here.toFixed(3)} />
          <Readout label="Sample" value={`${c.F.toFixed(3)} ± ${(K * c.sigma).toFixed(3)}`} />
          <Readout label="Match?" value={inBand ? 'Yes — within ±2σ' : 'No'} tone={inBand ? 'good' : undefined} />
        </div>
        <div className="lab-actions">
          <button className="btn btn-small" onClick={mark} disabled={!inBand}>
            <Glyph name="plus" size={16} /> Mark this year as a match
          </button>
          <span className="small soft" aria-live="polite">
            Windows found: <span className="mono">{nFound}</span> of {allFound ? windows.length : '?'}
            {myMarks.length > 0 && <> · your marks: {myMarks.map((m) => m.toFixed(1)).join(', ')}</>}
          </span>
        </div>
        {allFound && (
          <div className="callout callout-good lab-callout" role="status">
            <Glyph name="checkCircle" size={18} />
            <span>
              <strong>{pre ? 'Pre-bomb.' : windows.length > 1 ? `${windows.length} windows: ${windows.map(fmtW).join(' or ')}.` : `One window: ${fmtW(windows[0])}.`} </strong>
              <Rich text={c.reveal} />
            </span>
          </div>
        )}
      </div>
    </LabFrame>
  )
}
