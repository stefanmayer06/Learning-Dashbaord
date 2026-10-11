import { useEffect, useState } from 'react'
import type { WidgetApi } from '../../types'
import { LabFrame, Segmented } from '../../../ui/LabFrame'
import { Glyph } from '../../../ui/Glyph'
import { Rich } from '../../../ui/Tex'
import { MODE_LABEL, Painting, REGIONS, type ExamMode, type RegionId } from '../Painting'

export interface ExamFinding {
  id: string
  mode: ExamMode
  region: RegionId
  title: string
  /** What the examiner sees. */
  finding: string
  reading: 'suspicious' | 'normal' | 'supports'
  /** A clue shown before the finding is logged; it must not give away the light source. */
  hint: string
  why: string
  cite?: string[]
}

const READING = {
  suspicious: { label: 'Red flag', cls: 'chip-red' },
  normal: { label: 'Normal for an old painting', cls: 'chip' },
  supports: { label: 'Points to an original', cls: 'chip-good' },
} as const

const MODES: ExamMode[] = ['visible', 'raking', 'uv', 'ir', 'xray']
const REGION_ORDER: RegionId[] = ['face', 'hand', 'signature', 'background', 'surface']

/**
 * The examination bench: switch the light source, inspect a region, log what you
 * find. Findings exist only under the right light, as in a real examination.
 */
export function ExamBench({ props, complete, done, capture, captured, Cite }: WidgetApi) {
  const findings = (props.items as ExamFinding[]) ?? []
  const [mode, setMode] = useState<ExamMode>('visible')
  const [region, setRegion] = useState<RegionId | null>(null)
  const [logged, setLogged] = useState<string[]>([])
  const [message, setMessage] = useState<string | null>(null)

  const met = findings.length > 0 && logged.length === findings.length
  useEffect(() => {
    if (met && !done) complete()
  }, [met, done, complete])

  const inspect = (r: RegionId) => {
    setRegion(r)
    const hit = findings.find((f) => f.mode === mode && f.region === r)
    if (hit) {
      setLogged((l) => (l.includes(hit.id) ? l : [...l, hit.id]))
      setMessage(null)
    } else {
      setMessage(`Nothing notable in the ${REGIONS[r].label.toLowerCase()} under ${MODE_LABEL[mode].toLowerCase()}.`)
    }
  }
  const last = region ? findings.find((f) => f.mode === mode && f.region === region) : undefined
  const loggedFindings = findings.filter((f) => logged.includes(f.id))

  return (
    <LabFrame
      goal={`Examine the case-file portrait under every light and log all ${findings.length} findings`}
      met={done || met}
      aside={
        <>
          <span className="mono">{logged.length}</span>/{findings.length} logged
        </>
      }
      onSave={
        capture
          ? () =>
              capture(
                `Examination: ${loggedFindings.map((f) => `${MODE_LABEL[f.mode]} · ${f.title} (${READING[f.reading].label.toLowerCase()})`).join('; ') || 'no findings logged yet'}`,
                { findings: loggedFindings.map(({ id, mode, region, reading }) => ({ id, mode, region, reading })) },
              )
          : undefined
      }
      captured={captured}
    >
      <div className="exam">
        <div className="exam-modes">
          <Segmented label="Light source" value={mode} onChange={(m) => (setMode(m), setMessage(null))} options={MODES.map((m) => ({ value: m, label: MODE_LABEL[m] }))} />
        </div>
        <div className="exam-view">
          <div className={`exam-panel exam-${mode}`}>
            <Painting mode={mode} highlight={region} />
          </div>
          <p className="lab-caption">Synthetic case: a portrait signed “HM · 1631”, offered as a newly discovered Haarlem painting. No real work is depicted.</p>
        </div>
        <div className="exam-side">
          <h2 className="lab-h">Inspect a region</h2>
          <div className="exam-regions" role="group" aria-label="Regions of the painting">
            {REGION_ORDER.map((r) => (
              <button key={r} type="button" className={`btn btn-small btn-ghost ${region === r ? 'on' : ''}`} aria-pressed={region === r} onClick={() => inspect(r)}>
                {REGIONS[r].label}
              </button>
            ))}
          </div>
          <div className="exam-result" aria-live="polite">
            {last ? (
              <div className="exam-finding">
                <span className={`chip ${READING[last.reading].cls}`}>{READING[last.reading].label}</span>
                <strong>{last.title}</strong>
                <p>
                  <Rich text={last.finding} />
                </p>
                <p className="small soft">
                  <Rich text={last.why} />
                  {last.cite && <Cite ids={last.cite} />}
                </p>
              </div>
            ) : message ? (
              <p className="exam-nothing">
                <Glyph name="search" size={16} /> {message}
              </p>
            ) : (
              <p className="exam-nothing">
                <Glyph name="info" size={16} /> Pick a light source, then a region. Some evidence only appears under one kind of light.
              </p>
            )}
          </div>
          <h3 className="lab-h lab-h-sub">Leads</h3>
          <ul className="exam-leads">
            {findings.map((f) => {
              const got = logged.includes(f.id)
              return (
                <li key={f.id} className={got ? 'got' : ''}>
                  <span className="exam-lead-mark" aria-hidden>
                    <Glyph name={got ? 'check' : 'circle'} size={14} />
                  </span>
                  <span>
                    {got ? (
                      <>
                        <strong>{f.title}</strong> <span className="soft">· {MODE_LABEL[f.mode]}</span>
                      </>
                    ) : (
                      <Rich text={f.hint} />
                    )}
                    <span className="visually-hidden">{got ? ' (logged)' : ' (not yet found)'}</span>
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </LabFrame>
  )
}
