import { useEffect, useMemo, useState } from 'react'
import type { WidgetApi } from '../../types'
import { LabFrame, Segmented } from '../../../ui/LabFrame'
import { Glyph } from '../../../ui/Glyph'
import { Rich } from '../../../ui/Tex'
import { pigmentVerdict, terminusPostQuem, type PigmentFinding, type PigmentInfo, type PigmentVerdict } from '../pigments'

interface PigmentItem extends PigmentInfo {
  cite?: string[]
}

interface PigmentCase {
  id: string
  title: string
  /** The year the work claims (its signature or attribution). */
  claimed: number
  claimLabel: string
  synthetic: boolean
  context: string
  found: PigmentFinding[]
  /** The verdict the analysis supports; checked against the maths in the unit tests. */
  expect: PigmentVerdict
  reveal: string
  cite?: string[]
  /** The case whose result feeds the capstone dossier. */
  caseFile?: boolean
}

type Stage = { pick: string | null; pickChecked: boolean; verdict: PigmentVerdict | null }

const AXIS: [number, number] = [1600, 2000]

/**
 * Pigment dating lab: read the analysis table, find the material that sets the
 * earliest possible date (ignoring retouchings), then judge the claimed date.
 */
export function PigmentLab({ props, complete, done, capture, captured, Cite }: WidgetApi) {
  const catalog = useMemo(() => Object.fromEntries(((props.items as PigmentItem[]) ?? []).map((p) => [p.id, p])), [props.items])
  const cases = (props.cases as PigmentCase[]) ?? []
  const [active, setActive] = useState(cases[0]?.id ?? '')
  const [state, setState] = useState<Record<string, Stage>>({})
  const c = cases.find((x) => x.id === active) ?? cases[0]
  const st: Stage = state[c?.id] ?? { pick: null, pickChecked: false, verdict: null }
  const tpq = useMemo(() => (c ? terminusPostQuem(c.found, catalog) : { year: null, pigment: null }), [c, catalog])
  const answer = c ? pigmentVerdict(c.claimed, tpq) : 'consistent'
  const solved = (k: PigmentCase) => {
    const s = state[k.id]
    const t = terminusPostQuem(k.found, catalog)
    return !!s && s.pickChecked && s.pick === (t.pigment ?? 'none') && s.verdict === pigmentVerdict(k.claimed, t)
  }
  const nSolved = cases.filter(solved).length
  const met = cases.length > 0 && nSolved === cases.length
  useEffect(() => {
    if (met && !done) complete()
  }, [met, done, complete])

  if (!c) return null
  const set = (patch: Partial<Stage>) => setState((s) => ({ ...s, [c.id]: { ...st, ...patch } }))
  const correctPick = tpq.pigment ?? 'none'
  const pickRight = st.pickChecked && st.pick === correctPick
  const caseFile = cases.find((k) => k.caseFile)
  const pct = (y: number) => ((Math.min(Math.max(y, AXIS[0]), AXIS[1]) - AXIS[0]) / (AXIS[1] - AXIS[0])) * 100

  return (
    <LabFrame
      goal={`Date the paint in all ${cases.length} cases: find the material that sets the earliest possible date, then judge the claim`}
      met={done || met}
      aside={
        <>
          <span className="mono">{nSolved}</span>/{cases.length} solved
        </>
      }
      onSave={
        capture && caseFile
          ? () => {
              const t = terminusPostQuem(caseFile.found, catalog)
              const v = pigmentVerdict(caseFile.claimed, t)
              const s = state[caseFile.id]
              capture(
                `Pigments (${caseFile.title}): ${t.pigment ? `${catalog[t.pigment].name} sets the earliest possible date at ${catalog[t.pigment].when}` : 'no dating pigment'} → ${v === 'anachronism' ? `anachronism against the claimed ${caseFile.claimed}` : `consistent with ${caseFile.claimed} (not proof)`}${s?.verdict === v ? '' : ' · (case not yet solved in the lab)'}`,
                { case: caseFile.id, tpq: t, verdict: v },
              )
            }
          : undefined
      }
      captured={captured}
    >
      <div className="pig">
        <Segmented label="Case" value={c.id} onChange={setActive} options={cases.map((k, i) => ({ value: k.id, label: <>{solved(k) ? '✓ ' : ''}{i + 1}. {k.title}</> }))} />
        <div className="pig-case lab-panel">
          <div className="pig-case-head">
            <h2 className="lab-h">{c.title}</h2>
            <span className={`chip ${c.synthetic ? '' : 'chip-accent'}`}>{c.synthetic ? 'Synthetic case' : 'Real case'}</span>
          </div>
          <p className="pig-claim">
            Claimed date: <strong className="mono">{c.claimed}</strong> <span className="soft">({c.claimLabel})</span>
          </p>
          <p className="small">
            <Rich text={c.context} />
            {c.cite && <Cite ids={c.cite} />}
          </p>
        </div>

        <h3 className="lab-h lab-h-sub">1 · Which material sets the earliest possible date of the original paint?</h3>
        <div className="lab-table-wrap">
          <table className="lab-table pig-table">
            <thead>
              <tr>
                <th scope="col">Pick</th>
                <th scope="col">Material found</th>
                <th scope="col">Where</th>
                <th scope="col">Available since</th>
              </tr>
            </thead>
            <tbody>
              {c.found.map((f) => {
                const info = catalog[f.pigment]
                const id = `${c.id}-${f.pigment}-${f.where}`
                return (
                  <tr key={id} className={f.retouch ? 'pig-retouch' : ''}>
                    <td>
                      <input type="radio" id={id} name={`pick-${c.id}`} checked={st.pick === f.pigment} onChange={() => set({ pick: f.pigment, pickChecked: false, verdict: null })} />
                    </td>
                    <td>
                      <label htmlFor={id}>
                        <strong>{info?.name}</strong>
                        {info?.elements && <span className="soft small"> · XRF: {info.elements}</span>}
                      </label>
                      {info?.cite && <Cite ids={info.cite} />}
                    </td>
                    <td>
                      {f.where}
                      {f.retouch && <span className="chip chip-warn pig-tag">retouching — dark under UV</span>}
                    </td>
                    <td>{info?.when}</td>
                  </tr>
                )
              })}
              <tr>
                <td>
                  <input type="radio" id={`${c.id}-none`} name={`pick-${c.id}`} checked={st.pick === 'none'} onChange={() => set({ pick: 'none', pickChecked: false, verdict: null })} />
                </td>
                <td colSpan={3}>
                  <label htmlFor={`${c.id}-none`}>None — every material was available long before the claimed date</label>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="lab-actions">
          <button className="btn btn-small" disabled={!st.pick} onClick={() => set({ pickChecked: true })}>
            Check
          </button>
          {st.pickChecked && (
            <span className={`pig-feedback ${pickRight ? 'ok' : 'no'}`} role="status">
              <Glyph name={pickRight ? 'checkCircle' : 'cross'} size={18} />
              {pickRight
                ? tpq.pigment
                  ? `Right: ${catalog[tpq.pigment].name} is the newest material in the original paint.`
                  : 'Right: nothing here constrains the date.'
                : 'Not quite. Look for the newest material, and ignore paint that sits in a later retouching.'}
            </span>
          )}
        </div>

        {pickRight && (
          <>
            <h3 className="lab-h lab-h-sub">2 · Your verdict on the claimed date</h3>
            <div className="pig-verdicts" role="group" aria-label="Verdict">
              <button className={`btn btn-small btn-ghost ${st.verdict === 'anachronism' ? 'on' : ''}`} aria-pressed={st.verdict === 'anachronism'} onClick={() => set({ verdict: 'anachronism' })}>
                Anachronism: cannot date from {c.claimed}
              </button>
              <button className={`btn btn-small btn-ghost ${st.verdict === 'consistent' ? 'on' : ''}`} aria-pressed={st.verdict === 'consistent'} onClick={() => set({ verdict: 'consistent' })}>
                Consistent with {c.claimed} — but not proof
              </button>
            </div>
            {st.verdict && (
              <div className={`callout lab-callout ${st.verdict === answer ? 'callout-good' : 'callout-warn'}`} role="status">
                <Glyph name={st.verdict === answer ? 'checkCircle' : 'info'} size={18} />
                <span>
                  {st.verdict === answer ? <strong>Correct. </strong> : <strong>Think again. </strong>}
                  {st.verdict === answer && <Rich text={c.reveal} />}
                  {st.verdict !== answer && 'Compare the earliest possible date with the claimed date: is the claim earlier?'}
                </span>
              </div>
            )}
            {st.verdict === answer && (
              <div className="pig-axis" aria-hidden>
                <div className="pig-axis-track">
                  {c.found
                    .filter((f) => catalog[f.pigment]?.earliest !== null && catalog[f.pigment]?.earliest !== undefined)
                    .map((f) => (
                      <span key={f.pigment + f.where} className={`pig-dot ${f.pigment === tpq.pigment ? 'tpq' : ''} ${f.retouch ? 'retouch' : ''}`} style={{ left: `${pct(catalog[f.pigment].earliest!)}%` }} title={catalog[f.pigment].name} />
                    ))}
                  <span className="pig-claim-mark" style={{ left: `${pct(c.claimed)}%` }}>
                    <b>claimed {c.claimed}</b>
                  </span>
                </div>
                <div className="pig-axis-labels mono">
                  {[1600, 1700, 1800, 1900, 2000].map((y) => (
                    <span key={y}>{y}</span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </LabFrame>
  )
}
