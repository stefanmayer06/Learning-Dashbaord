import { useEffect } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { findCourse } from '../content/loader'
import type { CourseBundle, Field, Output } from '../content/schema'
import { fmtDate } from '../content/stats'
import { useLearner } from '../store/LearnerProvider'
import type { CourseProgress } from '../store/model'
import { courseFraction } from '../store/model'
import { Glyph } from '../ui/Glyph'
import { ProgressBar } from '../ui/Progress'
import { Breadcrumbs } from '../ui/Shell'
import { NotFound } from './NotFound'
import { fieldComplete } from '../steps/DeliverableStep'

/** Every deliverable step for an output, in course order. */
function partsFor(bundle: CourseBundle, outputId: string) {
  const parts: { lessonId: string; stepId: string; title: string; brief: string; fields: Field[] }[] = []
  for (const u of bundle.course.units)
    for (const lid of u.lessons)
      for (const s of bundle.lessons[lid].steps)
        if (s.type === 'deliverable' && s.output === outputId) parts.push({ lessonId: lid, stepId: s.id, title: s.title, brief: s.brief, fields: s.fields })
  return parts
}

function valueText(f: Field, v: unknown, cp: CourseProgress): string {
  if (f.type === 'capture') return cp.captures[f.from]?.summary ?? ''
  if (f.type === 'scale') return typeof v === 'number' ? `${v} / ${f.max} (${f.minLabel} → ${f.maxLabel})` : ''
  return typeof v === 'string' ? v : ''
}

export function toMarkdown(bundle: CourseBundle, cp: CourseProgress, name: string) {
  const lines = [`# ${bundle.course.title} — work outputs`, '', `${name || 'Learner'} · exported ${new Date().toISOString().slice(0, 10)} · course v${bundle.course.version}`, '']
  for (const o of bundle.course.outputs) {
    lines.push(`## ${o.title}${o.capstone ? ' (capstone)' : ''}`, '', `_${o.description}_`, '')
    const vals = cp.outputs[o.id]?.fields ?? {}
    for (const part of partsFor(bundle, o.id)) {
      lines.push(`### ${part.title}`, '')
      for (const f of part.fields) {
        const t = valueText(f, vals[f.id], cp)
        lines.push(`**${f.label.replace(/\*\*/g, '')}**`, '', t || '_(not yet written)_', '')
      }
    }
  }
  lines.push('---', `Sources for every factual claim in this course: see the course ledger (${Object.keys(bundle.claims).length} claims, last verified ${bundle.course.lastVerified}).`)
  return lines.join('\n')
}

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const KIND_LABEL: Record<Output['kind'], string> = {
  'lab-notebook': 'Lab notebook',
  brief: 'Brief',
  memo: 'Memo',
  model: 'Model',
  portfolio: 'Portfolio',
  other: 'Assignment',
}

const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`

export function WorkPage() {
  const { courseId } = useParams()
  const bundle = findCourse(courseId)
  const { course: getCp, state } = useLearner()
  const { hash } = useLocation()

  // The page is lazy-loaded, so the browser's own jump to #output-id happens before it exists.
  useEffect(() => {
    if (hash.length > 1) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView()
  }, [hash])

  if (!bundle) return <NotFound />
  const cp = getCp(bundle.course.id)
  const { course } = bundle
  const captures = Object.values(cp.captures)
  const pct = Math.round(courseFraction(bundle, cp) * 100)

  const outputs = course.outputs.map((o) => {
    const vals = cp.outputs[o.id]?.fields ?? {}
    const parts = partsFor(bundle, o.id)
    const total = parts.reduce((n, p) => n + p.fields.length, 0)
    const filled = parts.reduce((n, p) => n + p.fields.filter((f) => fieldComplete(f, vals[f.id], cp)).length, 0)
    return { o, vals, parts, total, filled }
  })
  const allFields = outputs.reduce((n, x) => n + x.total, 0)
  const allFilled = outputs.reduce((n, x) => n + x.filled, 0)
  const claimCount = Object.keys(bundle.claims).length

  return (
    <div className="pg work" style={{ ['--accent' as string]: course.theme.accent }}>
      <header className="pg-head">
        <div className="page">
          <Breadcrumbs
            items={[
              { label: 'Home', to: '/' },
              { label: 'Courses', to: '/#catalog' },
              { label: course.title, to: `/c/${course.id}` },
              { label: 'Your work' },
            ]}
          />
          <div className="pg-head-row">
            <div className="pg-head-text">
              <h1 className="display-m pg-title">Your work</h1>
              <p className="pg-desc">
                Everything you have written and saved in {course.title}, gathered in one place to print or export.
              </p>
            </div>
            <div className="btn-row pg-actions no-print">
              <button className="btn" onClick={() => window.print()}>
                <Glyph name="print" size={17} /> Print / Save as PDF
              </button>
              <button className="btn btn-secondary" onClick={() => download(`${course.id}-work.md`, toMarkdown(bundle, cp, state.name), 'text/markdown')}>
                <Glyph name="download" size={17} /> Download Markdown
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => download(`${course.id}-work.json`, JSON.stringify({ course: course.id, version: course.version, learner: state.name, progress: cp }, null, 2), 'application/json')}
              >
                <Glyph name="download" size={17} /> Download JSON
              </button>
            </div>
          </div>
          <div className="work-summary">
            <div className="work-summary-progress">
              <div className="work-summary-line">
                <span className="work-summary-pct">{pct}%</span>
                <span className="soft">of the course complete</span>
              </div>
              <ProgressBar value={pct / 100} label="Course progress" />
            </div>
            <dl className="work-summary-facts">
              <div>
                <dt>Learner</dt>
                <dd>{state.name || 'Learner'}</dd>
              </div>
              <div>
                <dt>Answers written</dt>
                <dd>
                  {allFilled} of {allFields}
                </dd>
              </div>
              <div>
                <dt>Lab results saved</dt>
                <dd>{captures.length}</dd>
              </div>
            </dl>
          </div>
        </div>
      </header>

      <div className="page pg-body work-layout">
        <div className="work-main">
          {outputs.map(({ o, vals, parts, total, filled }) => (
            <article key={o.id} id={o.id} className={`card work-output${o.capstone ? ' capstone' : ''}`}>
              <header className="work-output-head">
                <div className="work-output-tags">
                  {o.capstone && (
                    <span className="badge">
                      <Glyph name="cert" size={14} /> Capstone
                    </span>
                  )}
                  {KIND_LABEL[o.kind].toLowerCase() !== o.title.toLowerCase() && <span className="chip">{KIND_LABEL[o.kind]}</span>}
                </div>
                <h2 className="t-h2">{o.title}</h2>
                <p className="work-output-desc">{o.description}</p>
                <div className="work-output-progress">
                  <ProgressBar value={total ? filled / total : 0} thin label={`${o.title} progress`} />
                  <span className="meta">
                    {filled} of {plural(total, 'answer')} complete
                  </span>
                </div>
              </header>
              {parts.map((part) => {
                const done = part.fields.every((f) => fieldComplete(f, vals[f.id], cp))
                return (
                  <section key={part.stepId} className="work-part">
                    <div className="work-part-head">
                      <h3 className="work-part-title">
                        <Glyph name={done ? 'checkCircle' : 'circle'} size={18} className={done ? 'work-done' : 'work-todo'} />
                        {part.title}
                      </h3>
                      <Link className="btn btn-quiet btn-small no-print" to={`/c/${course.id}/l/${part.lessonId}/${part.stepId}`}>
                        {done ? 'Edit' : 'Continue'} <Glyph name="chevronRight" size={15} />
                      </Link>
                    </div>
                    <dl className="work-fields">
                      {part.fields.map((f) => {
                        const t = valueText(f, vals[f.id], cp)
                        return (
                          <div key={f.id} className="work-field">
                            <dt>{f.label.replace(/\*\*/g, '')}</dt>
                            <dd>
                              {t ? <p className={f.type === 'capture' ? 'work-capture mono' : 'work-text'}>{t}</p> : <p className="work-empty">Not yet written.</p>}
                            </dd>
                          </div>
                        )
                      })}
                    </dl>
                  </section>
                )
              })}
            </article>
          ))}

          {captures.length > 0 && (
            <article id="lab-results" className="card work-output">
              <header className="work-output-head">
                <div className="work-output-tags">
                  <span className="chip">From the labs</span>
                </div>
                <h2 className="t-h2">Saved lab results</h2>
                <p className="work-output-desc">Runs you saved from the labs with “Save to notebook”. Assignments quote them as evidence.</p>
              </header>
              <ul className="work-notebook">
                {captures.map((c) => (
                  <li key={c.key}>
                    <span className="glyph-tile work-notebook-tile" aria-hidden>
                      <Glyph name="lab" size={18} />
                    </span>
                    <div>
                      <div className="work-notebook-head">
                        <strong>{c.key}</strong>
                        <span className="meta">Saved {new Date(c.savedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="work-capture mono">{c.summary}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </article>
          )}

          <p className="work-foot small soft">
            Every factual claim in this course is listed with its sources in the{' '}
            <Link to={`/c/${course.id}/ledger`}>course ledger</Link> ({claimCount} claims, last verified {fmtDate(course.lastVerified)}).
          </p>
        </div>

        <aside className="work-aside no-print" aria-label="Work outputs">
          <div className="card work-toc">
            <h2 className="work-toc-head">On this page</h2>
            <ol>
              {outputs.map(({ o, total, filled }) => (
                <li key={o.id}>
                  <a href={`#${o.id}`} className="work-toc-link">
                    <span className="work-toc-title">{o.title}</span>
                    <span className="work-toc-count">
                      {filled}/{total}
                    </span>
                  </a>
                  <ProgressBar value={total ? filled / total : 0} thin label={`${o.title} progress`} />
                </li>
              ))}
              {captures.length > 0 && (
                <li>
                  <a href="#lab-results" className="work-toc-link">
                    <span className="work-toc-title">Saved lab results</span>
                    <span className="work-toc-count">{captures.length}</span>
                  </a>
                </li>
              )}
            </ol>
          </div>
          <div className="callout callout-info work-aside-note">
            <Glyph name="shield" size={18} />
            <p className="small">
              Exports include your answers and saved runs. Sources stay in the <Link to={`/c/${course.id}/ledger`}>ledger</Link>.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
