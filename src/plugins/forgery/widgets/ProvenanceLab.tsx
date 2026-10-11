import { useEffect, useMemo, useState } from 'react'
import type { WidgetApi } from '../../types'
import { LabFrame, Readout, Segmented } from '../../../ui/LabFrame'
import { Glyph } from '../../../ui/Glyph'
import { Rich } from '../../../ui/Tex'
import { NAZI_ERA, chainStats, type LinkGrade, type ProvenanceLink } from '../provenance'

const GRADES: { value: LinkGrade; label: string }[] = [
  { value: 'documented', label: 'Documented' },
  { value: 'weak', label: 'Weak' },
  { value: 'red', label: 'Red flag' },
]

/**
 * Provenance audit: grade each link in a chain of ownership. Coverage and gaps
 * are computed from the links you accept as documented.
 */
export function ProvenanceLab({ props, complete, done, capture, captured, Cite }: WidgetApi) {
  const links = (props.items as ProvenanceLink[]) ?? []
  const start = Number(props.start ?? links[0]?.from ?? 0)
  const end = Number(props.end ?? links[links.length - 1]?.to ?? 0)
  const title = String(props.title ?? 'Provenance')
  const [grades, setGrades] = useState<(LinkGrade | null)[]>(() => links.map(() => null))
  const [checked, setChecked] = useState(false)

  const allSet = grades.every(Boolean)
  const right = links.filter((l, i) => grades[i] === l.answer).length
  const met = checked && right === links.length
  useEffect(() => {
    if (met && !done) complete()
  }, [met, done, complete])

  const stats = useMemo(() => chainStats(links, grades.map((g) => g ?? 'red'), start, end), [links, grades, start, end])
  const truth = useMemo(() => chainStats(links, links.map((l) => l.answer), start, end), [links, start, end])
  const pct = (y: number) => ((y - start) / (end - start)) * 100

  return (
    <LabFrame
      goal={`Grade all ${links.length} links in the chain of ownership correctly`}
      met={done || met}
      aside={checked ? <><span className="mono">{right}</span>/{links.length} right</> : null}
      onSave={
        capture
          ? () =>
              capture(
                `Provenance (${title}): ${Math.round(truth.coverage * 100)}% of ${truth.totalYears} years documented; gaps ${truth.gaps.map(([a, b]) => `${a}–${b}`).join(', ') || 'none'}${truth.naziEraGap ? '; undocumented during 1933–45' : ''}; red flags: ${links.filter((l) => l.answer === 'red').map((l) => l.owner).join('; ') || 'none'}${met ? '' : ' · (audit not yet completed in the lab)'}`,
                { coverage: truth.coverage, gaps: truth.gaps, naziEraGap: truth.naziEraGap, red: links.filter((l) => l.answer === 'red').map((l) => l.id) },
              )
          : undefined
      }
      captured={captured}
    >
      <div className="prov">
        <p className="lab-caption">Synthetic case: {title}. Owners and documents are invented for the exercise.</p>
        <ol className="prov-chain">
          {links.map((l, i) => {
            const g = grades[i]
            const ok = checked && g === l.answer
            const wrong = checked && g !== l.answer
            return (
              <li key={l.id} className={`prov-link ${ok ? 'ok' : ''} ${wrong ? 'wrong' : ''}`}>
                <div className="prov-years mono">
                  {l.from}–{l.to}
                </div>
                <div className="prov-body">
                  <strong>{l.owner}</strong>
                  <p className="small">
                    <Rich text={l.record} />
                  </p>
                  <Segmented
                    label={`Grade the link ${l.from}–${l.to}`}
                    value={(g ?? '') as LinkGrade}
                    onChange={(v) => {
                      setGrades((gs) => gs.map((x, j) => (j === i ? v : x)))
                      setChecked(false)
                    }}
                    options={GRADES}
                  />
                  {checked && (
                    <p className={`small prov-why ${ok ? 'ok' : 'no'}`}>
                      <Glyph name={ok ? 'checkCircle' : 'cross'} size={16} /> {ok ? '' : `It's ${GRADES.find((x) => x.value === l.answer)!.label.toLowerCase()}. `}
                      <Rich text={l.why} />
                      {l.cite && <Cite ids={l.cite} />}
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
        <div className="lab-actions">
          <button className="btn btn-small" disabled={!allSet} onClick={() => setChecked(true)}>
            Check my audit
          </button>
          {!allSet && <span className="small soft">Grade every link first.</span>}
        </div>

        <h3 className="lab-h lab-h-sub">What your grading implies</h3>
        <div className="prov-bar" aria-hidden>
          <span className="prov-nazi" style={{ left: `${pct(NAZI_ERA[0])}%`, width: `${pct(NAZI_ERA[1] + 1) - pct(NAZI_ERA[0])}%` }} />
          {links.map((l, i) => (
            <span key={l.id} className={`prov-seg prov-${grades[i] ?? 'none'}`} style={{ left: `${pct(l.from)}%`, width: `${pct(l.to) - pct(l.from)}%` }} />
          ))}
        </div>
        <div className="pig-axis-labels mono prov-axis">
          <span>{start}</span>
          <span>1933–45</span>
          <span>{end}</span>
        </div>
        <div className="readouts">
          <Readout label="Years backed by documents" value={`${stats.documentedYears} of ${stats.totalYears}`} />
          <Readout label="Longest undocumented stretch" value={`${stats.longestGap} y`} tone={stats.longestGap > 50 ? 'red' : undefined} />
          <Readout label="Undocumented during 1933–45?" value={stats.naziEraGap ? 'Yes' : 'No'} tone={stats.naziEraGap ? 'red' : 'good'} />
        </div>
      </div>
    </LabFrame>
  )
}
