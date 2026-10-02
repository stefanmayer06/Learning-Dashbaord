import { Link } from 'react-router-dom'
import type { CourseBundle, Field, Step } from '../content/schema'
import type { CourseProgress } from '../store/model'
import { Glyph } from '../ui/Glyph'
import { ProgressBar } from '../ui/Progress'
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
  const total = step.fields.length

  return (
    <div className="deliverable">
      <header className="deliverable-head">
        <div className="deliverable-heading">
          <span className={`badge${output?.capstone ? '' : ' badge-neutral'}`}>
            <Glyph name="output" size={14} />
            {output?.capstone ? 'Capstone assignment' : 'Assignment'}
          </span>
          <h2 className="deliverable-title">{output?.title}</h2>
        </div>
        <div className="deliverable-progress">
          <span className="deliverable-count">
            {doneCount} of {total} parts done
          </span>
          <ProgressBar value={doneCount / Math.max(1, total)} label="Parts completed" thin />
        </div>
      </header>
      <p className="deliverable-brief">
        <Rich text={step.brief} />
      </p>
      <ol className="dv-fields">
        {step.fields.map((f, i) => {
          const v = values[f.id]
          const ok = fieldComplete(f, v, cp)
          const labelId = `f-${f.id}-label`
          return (
            <li key={f.id} className={`dv-field${ok ? ' ok' : ''}`}>
              <div className="dv-field-top">
                <span className="dv-n" aria-hidden>
                  {ok ? <Glyph name="check" size={14} /> : String.fromCharCode(65 + i)}
                </span>
                <label className="dv-label" id={labelId} htmlFor={f.type === 'text' ? `f-${f.id}` : undefined}>
                  <Rich text={f.label} />
                </label>
                {ok && <span className="dv-ok">Done</span>}
              </div>
              <div className="dv-body">
                {f.type === 'text' && (
                  <>
                    {f.hint && <p className="field-help dv-hint">{f.hint}</p>}
                    <textarea
                      id={`f-${f.id}`}
                      className="textarea"
                      value={typeof v === 'string' ? v : ''}
                      onChange={(e) => onField(f.id, e.target.value)}
                      rows={Math.max(4, Math.ceil((f.minWords || 40) / 14))}
                    />
                    <p className={`word-count${words(v) >= f.minWords ? ' ok' : ''}${f.maxWords && words(v) > f.maxWords ? ' over' : ''}`}>
                      {words(v) >= f.minWords && f.minWords ? <Glyph name="check" size={13} /> : null}
                      {words(v)} {f.minWords ? `of ${f.minWords} words minimum` : 'words'}
                      {f.maxWords && words(v) > f.maxWords ? ` · over the ${f.maxWords}-word limit` : ''}
                    </p>
                  </>
                )}
                {f.type === 'choice' && (
                  <div className="choice-row" role="radiogroup" aria-labelledby={labelId}>
                    {f.options.map((o) => (
                      <button key={o} role="radio" aria-checked={v === o} className={`choice${v === o ? ' on' : ''}`} onClick={() => onField(f.id, o)}>
                        <span className="choice-dot" aria-hidden />
                        {o}
                      </button>
                    ))}
                  </div>
                )}
                {f.type === 'scale' && (
                  <div className="scale-field">
                    <span className="scale-end">{f.minLabel}</span>
                    <div className="scale-dots" role="radiogroup" aria-labelledby={labelId}>
                      {Array.from({ length: f.max - f.min + 1 }, (_, k) => f.min + k).map((n) => (
                        <button key={n} role="radio" aria-checked={v === n} className={v === n ? 'on' : ''} onClick={() => onField(f.id, n)}>
                          {n}
                        </button>
                      ))}
                    </div>
                    <span className="scale-end">{f.maxLabel}</span>
                  </div>
                )}
                {f.type === 'capture' && <CaptureField bundle={bundle} cp={cp} from={f.from} hint={f.hint} />}
              </div>
            </li>
          )
        })}
      </ol>
      <p className="deliverable-foot">
        <Glyph name="checkCircle" size={16} />
        <span>
          Saved automatically as you type. Everything here is collected in{' '}
          <Link to={`/c/${bundle.course.id}/work`}>Your work</Link>, ready to print or export.
        </span>
      </p>
    </div>
  )
}

function CaptureField({ bundle, cp, from, hint }: { bundle: CourseBundle; cp: CourseProgress; from: string; hint?: string }) {
  const c = cp.captures[from]
  const src = captureSource(bundle, from)
  if (c) {
    return (
      <div className="capture-card">
        <span className="capture-meta">
          <Glyph name="lab" size={14} /> From your lab notebook · saved {new Date(c.savedAt).toLocaleString()}
        </span>
        <p className="capture-summary">{c.summary}</p>
        {src && (
          <Link to={`/c/${bundle.course.id}/l/${src.lesson.id}/${src.step.id}`} className="capture-link">
            Re-run “{src.step.title}” to update it
          </Link>
        )}
      </div>
    )
  }
  return (
    <div className="capture-card empty">
      <p className="capture-empty">{hint ?? 'Nothing saved yet.'}</p>
      {src && (
        <Link to={`/c/${bundle.course.id}/l/${src.lesson.id}/${src.step.id}`} className="btn btn-small btn-ghost">
          Open “{src.step.title}” and press “Save to notebook” <Glyph name="arrow" className="arrow" size={14} />
        </Link>
      )}
    </div>
  )
}
