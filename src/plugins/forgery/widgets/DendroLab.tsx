import { useEffect, useState } from 'react'
import type { WidgetApi } from '../../types'
import { LabFrame, Readout, Segmented, Slider } from '../../../ui/LabFrame'
import { Glyph } from '../../../ui/Glyph'
import { Rich } from '../../../ui/Tex'
import { SAPWOOD, dendroVerdict, fellingDates, type DendroVerdict, type WoodOrigin } from '../dendro'

interface DendroCase {
  id: string
  title: string
  synthetic: boolean
  context: string
  /** Wood as identified by the dendrochronologist. */
  origin: WoodOrigin
  /** Year of the youngest heartwood ring (ignored for poplar). */
  lastRing: number
  claimed: number
  claimLabel: string
  /** Seasoning assumption to use, in years. */
  seasoning: number
  expect: DendroVerdict
  reveal: string
  cite?: string[]
  caseFile?: boolean
}

const VERDICTS: { value: DendroVerdict; label: string }[] = [
  { value: 'impossible', label: 'Impossible: the tree was still growing' },
  { value: 'tight', label: 'Possible only if everything was quick' },
  { value: 'consistent', label: 'Consistent with the claimed date' },
  { value: 'undatable', label: 'Cannot be dated by tree rings' },
]

const ORIGINS: { value: WoodOrigin; label: string }[] = [
  { value: 'baltic', label: 'Baltic oak' },
  { value: 'west', label: 'Western oak' },
  { value: 'poplar', label: 'Poplar' },
]

/**
 * Tree-ring dating of a panel: add back the cut-away sapwood rings and a seasoning
 * time, then compare the earliest plausible painting date with the claim.
 */
export function DendroLab({ props, complete, done, capture, captured, Cite }: WidgetApi) {
  const cases = (props.cases as DendroCase[]) ?? []
  const [active, setActive] = useState(cases[0]?.id ?? '')
  const c = cases.find((x) => x.id === active) ?? cases[0]
  const [origin, setOrigin] = useState<WoodOrigin>('baltic')
  const [seasoning, setSeasoning] = useState(2)
  const [answers, setAnswers] = useState<Record<string, DendroVerdict>>({})
  useEffect(() => {
    if (!c) return
    setOrigin('baltic')
    setSeasoning(2)
  }, [c?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // the verdict comes from the maths; `expect` in the content is checked against it in the unit tests
  const truth = (k: DendroCase) => dendroVerdict(k.claimed, k.lastRing, k.origin, k.seasoning)
  const solved = (k: DendroCase) => answers[k.id] === truth(k)
  const nSolved = cases.filter(solved).length
  const met = cases.length > 0 && nSolved === cases.length
  useEffect(() => {
    if (met && !done) complete()
  }, [met, done, complete])
  if (!c) return null

  const oak = origin !== 'poplar'
  const f = oak ? fellingDates(c.lastRing, origin) : null
  const plausible = f ? f.median + seasoning : null
  const setupRight = origin === c.origin && seasoning === c.seasoning
  const answer = answers[c.id]
  const caseFile = cases.find((k) => k.caseFile)

  // timeline scale for the bar
  const lo = c.origin === 'poplar' ? c.claimed - 40 : Math.min(c.lastRing, c.claimed) - 8
  const hi = c.origin === 'poplar' ? c.claimed + 40 : Math.max(plausible ?? c.claimed, c.claimed, f?.median ?? c.claimed) + 8
  const pct = (y: number) => ((y - lo) / (hi - lo)) * 100

  return (
    <LabFrame
      goal={`Date the panel in all ${cases.length} cases and judge each claimed date`}
      met={done || met}
      aside={
        <>
          <span className="mono">{nSolved}</span>/{cases.length} solved
        </>
      }
      onSave={
        capture && caseFile
          ? () => {
              const cf = caseFile.origin === 'poplar' ? null : fellingDates(caseFile.lastRing, caseFile.origin)
              capture(
                cf
                  ? `Dendro (${caseFile.title}): youngest ring ${caseFile.lastRing}, ${caseFile.origin === 'baltic' ? 'Baltic' : 'western'} oak → earliest felling ${cf.earliest}, median ${cf.median}, plausible use from ${cf.median + caseFile.seasoning} → ${truth(caseFile)} with the claimed ${caseFile.claimed}${solved(caseFile) ? '' : ' · (case not yet solved in the lab)'}`
                  : `Dendro (${caseFile.title}): poplar — not datable by tree rings`,
                { case: caseFile.id, felling: cf, verdict: truth(caseFile) },
              )
            }
          : undefined
      }
      captured={captured}
    >
      <div className="dendro">
        <Segmented label="Case" value={c.id} onChange={setActive} options={cases.map((k, i) => ({ value: k.id, label: <>{solved(k) ? '✓ ' : ''}{i + 1}. {k.title}</> }))} />
        <div className="lab-panel dendro-case">
          <div className="pig-case-head">
            <h2 className="lab-h">{c.title}</h2>
            <span className={`chip ${c.synthetic ? '' : 'chip-accent'}`}>{c.synthetic ? 'Synthetic case' : 'Real measurements'}</span>
          </div>
          <p className="small">
            <Rich text={c.context} />
            {c.cite && <Cite ids={c.cite} />}
          </p>
          <p className="pig-claim">
            {c.origin !== 'poplar' && (
              <>
                Youngest heartwood ring: <strong className="mono">{c.lastRing}</strong> ·{' '}
              </>
            )}
            Claimed date: <strong className="mono">{c.claimed}</strong> <span className="soft">({c.claimLabel})</span>
          </p>
        </div>

        <div className="dendro-controls">
          <div>
            <span className="readout-label">Wood (from the case notes)</span>
            <Segmented label="Wood" value={origin} onChange={setOrigin} options={ORIGINS} />
          </div>
          {oak && <Slider label="Seasoning before painting" value={seasoning} min={0} max={15} step={1} onChange={setSeasoning} format={(v) => `${v} y`} />}
        </div>

        {oak && f ? (
          <>
            <div className="readouts">
              <Readout label={`Earliest felling (+${SAPWOOD[origin].min} sapwood rings)`} value={f.earliest} />
              <Readout label={`Median felling (+${SAPWOOD[origin].median})`} value={f.median} />
              <Readout label="Plausible painting from" value={plausible} tone="accent" />
              <Readout label="Claimed" value={c.claimed} tone={c.claimed < f.earliest ? 'red' : undefined} />
            </div>
            <div className="dendro-bar" aria-hidden>
              <span className="dendro-seg dendro-heart" style={{ left: 0, width: `${pct(c.lastRing)}%` }} />
              <span className="dendro-seg dendro-sap" style={{ left: `${pct(c.lastRing)}%`, width: `${pct(f.median) - pct(c.lastRing)}%` }} />
              <span className="dendro-seg dendro-season" style={{ left: `${pct(f.median)}%`, width: `${Math.max(0, pct(plausible!) - pct(f.median))}%` }} />
              <span className="dendro-mark dendro-claim" style={{ left: `${pct(c.claimed)}%` }}>
                <b>claimed {c.claimed}</b>
              </span>
            </div>
            <ul className="dendro-legend small">
              <li>
                <i className="dendro-heart" /> heartwood on the panel
              </li>
              <li>
                <i className="dendro-sap" /> missing sapwood (median)
              </li>
              <li>
                <i className="dendro-season" /> seasoning
              </li>
            </ul>
          </>
        ) : (
          <p className="callout callout-info lab-callout">
            <Glyph name="info" size={18} />
            <span>Poplar grew too erratically to match a master chronology, so this calculator cannot date it.</span>
          </p>
        )}

        {!setupRight && (
          <p className="small soft">
            <Glyph name="info" size={14} /> Set the wood and the seasoning time given in the case notes to see the reading the dendrochronologist would give.
          </p>
        )}

        <h3 className="lab-h lab-h-sub">Your verdict</h3>
        <div className="pig-verdicts" role="group" aria-label="Verdict">
          {VERDICTS.map((v) => (
            <button key={v.value} className={`btn btn-small btn-ghost ${answer === v.value ? 'on' : ''}`} aria-pressed={answer === v.value} onClick={() => setAnswers((a) => ({ ...a, [c.id]: v.value }))}>
              {v.label}
            </button>
          ))}
        </div>
        {answer && (
          <div className={`callout lab-callout ${answer === truth(c) ? 'callout-good' : 'callout-warn'}`} role="status">
            <Glyph name={answer === truth(c) ? 'checkCircle' : 'info'} size={18} />
            <span>
              {answer === truth(c) ? (
                <>
                  <strong>Correct. </strong>
                  <Rich text={c.reveal} />
                </>
              ) : (
                <>
                  <strong>Not quite. </strong>Compare the claimed date with the earliest felling date and with the plausible date once seasoning is added.
                </>
              )}
            </span>
          </div>
        )}
      </div>
    </LabFrame>
  )
}
