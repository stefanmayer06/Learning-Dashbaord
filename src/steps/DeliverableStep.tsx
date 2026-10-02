import { Link } from 'react-router-dom'
import type { CourseBundle, Field, Step } from '../content/schema'
import type { CourseProgress } from '../store/model'
import { Glyph } from '../ui/Glyph'
import { Rich } from '../ui/Tex'

type DeliverableT = Extract<Step, { type: 'deliverable' }>

export const words = (v: unknown) => (typeof v === 'string' ? v.trim().split(/\s+/).filter(Boolean).length : 0)

export function fieldComplete(f: Field, value: unknown, cp: CourseProgress) {
  switch (f.type) {
    case 'text':
      return words(value) >= Math.max(1, f.minWords)
    case 'choice':
      return typeof value === 'string' && f.options.includes(value)
    case 'scale':
      return typeof value === 'number'
    case 'capture':
      return Boolean(cp.captures[f.from])
  }
}

/** Where in the course a capture key is produced, for "go back and save it" links. */
function captureSource(bundle: CourseBundle, key: string) {
  for (const l of Object.values(bundle.lessons)) {
    for (const s of l.steps) if (s.type === 'widget' && s.props.capture === key) return { lesson: l, step: s }
  }
  return null
}

export function DeliverableStep({
  step,
  bundle,
  cp,
  onField,
}: {
  step: DeliverableT
  bundle: CourseBundle
  cp: CourseProgress
  onField: (fieldId: string, value: unknown) => void
}) {
  const output = bundle.course.outputs.find((o) => o.id === step.output)
  const values = cp.outputs[step.output]?.fields ?? {}
  const doneCount = step.fields.filter((f) => fieldComplete(f, values[f.id], cp)).length

  return (
    <div className="deliverable">
      <div className="deliverable-head">
        <span className="chip chip-red">{output?.capstone ? 'Capstone output' : 'Work output'}</span>
        <span className="deliverable-title">{output?.title}</span>
        <span className="mono small">
          {doneCount}/{step.fields.length} parts
        </span>
      </div>
      <p className="deliverable-brief">
        <Rich text={step.brief} />
      </p>
      <div className="fields">
        {step.fields.map((f, i) => {
          const v = values[f.id]
          const ok = fieldComplete(f, v, cp)
          return (
            <div key={f.id} className={`field ${ok ? 'ok' : ''}`}>
              <div className="field-top">
                <span className="field-n mono">{String.fromCharCode(65 + i)}</span>
                <label className="field-label-text" htmlFor={`f-${f.id}`}>
                  <Rich text={f.label} />
                </label>
                {ok && <Glyph name="check" size={14} className="field-tick" />}
              </div>
              {f.type === 'text' && (
                <>
                  {f.hint && <p className="field-hint soft small">{f.hint}</p>}
                  <textarea
                    id={`f-${f.id}`}
                    className="textarea ruled"
                    value={typeof v === 'string' ? v : ''}
                    onChange={(e) => onField(f.id, e.target.value)}
                    rows={Math.max(4, Math.ceil((f.minWords || 40) / 14))}
                  />
                  <p className={`word-count mono ${words(v) >= f.minWords ? 'ok' : ''}`}>
                    {words(v)} {f.minWords ? `/ ${f.minWords} words minimum` : 'words'}
                    {f.maxWords && words(v) > f.maxWords ? ` · over the ${f.maxWords}-word limit` : ''}
                  </p>
                </>
              )}
              {f.type === 'choice' && (
                <div className="choice-row" role="radiogroup">
                  {f.options.map((o) => (
                    <button key={o} role="radio" aria-checked={v === o} className={`choice ${v === o ? 'on' : ''}`} onClick={() => onField(f.id, o)}>
                      {o}
                    </button>
                  ))}
                </div>
              )}
              {f.type === 'scale' && (
                <div className="scale-field">
                  <span className="small soft">{f.minLabel}</span>
                  <div className="scale-dots" role="radiogroup">
                    {Array.from({ length: f.max - f.min + 1 }, (_, k) => f.min + k).map((n) => (
                      <button key={n} role="radio" aria-checked={v === n} className={v === n ? 'on' : ''} onClick={() => onField(f.id, n)}>
                        {n}
                      </button>
                    ))}
                  </div>
                  <span className="small soft">{f.maxLabel}</span>
                </div>
              )}
              {f.type === 'capture' && <CaptureField bundle={bundle} cp={cp} from={f.from} hint={f.hint} />}
            </div>
          )
        })}
      </div>
      <p className="small soft">Saved automatically as you type. Everything here is assembled in “Your work”, ready to print or export.</p>
    </div>
  )
}

function CaptureField({ bundle, cp, from, hint }: { bundle: CourseBundle; cp: CourseProgress; from: string; hint?: string }) {
  const c = cp.captures[from]
  const src = captureSource(bundle, from)
  if (c) {
    return (
      <div className="capture-card">
        <span className="label label-faint">From your lab notebook · saved {new Date(c.savedAt).toLocaleString()}</span>
        <p className="capture-summary">{c.summary}</p>
        {src && (
          <Link to={`/c/${bundle.course.id}/l/${src.lesson.id}/${src.step.id}`} className="small">
            Re-run in “{src.step.title}” to update
          </Link>
        )}
      </div>
    )
  }
  return (
    <div className="capture-card empty">
      <p className="soft">{hint ?? 'Nothing saved yet.'}</p>
      {src && (
        <Link to={`/c/${bundle.course.id}/l/${src.lesson.id}/${src.step.id}`} className="btn btn-small btn-ghost">
          Open “{src.step.title}” and press “Save to notebook” <Glyph name="arrow" size={14} />
        </Link>
      )}
    </div>
  )
}
