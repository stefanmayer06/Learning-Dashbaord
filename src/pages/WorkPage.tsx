import { Link, useParams } from 'react-router-dom'
import { findCourse } from '../content/loader'
import type { CourseBundle, Field } from '../content/schema'
import { useLearner } from '../store/LearnerProvider'
import type { CourseProgress } from '../store/model'
import { courseFraction } from '../store/model'
import { Glyph } from '../ui/Glyph'
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

export function WorkPage() {
  const { courseId } = useParams()
  const bundle = findCourse(courseId)
  const { course: getCp, state } = useLearner()
  if (!bundle) return <NotFound />
  const cp = getCp(bundle.course.id)
  const { course } = bundle
  const captures = Object.values(cp.captures)

  return (
    <div className="work page" style={{ ['--accent' as string]: course.theme.accent }}>
      <div className="work-head">
        <p className="label no-print">
          <Link to={`/c/${course.id}`}>{course.title}</Link> / Your work
        </p>
        <h1 className="display display-l">Your work</h1>
        <p className="lede">
          {state.name || 'Learner'} · {course.title} · {Math.round(courseFraction(bundle, cp) * 100)}% complete
        </p>
        <div className="course-hero-actions no-print">
          <button className="btn" onClick={() => window.print()}>
            Print / save as PDF <Glyph name="print" size={14} />
          </button>
          <button className="btn btn-ghost" onClick={() => download(`${course.id}-work.md`, toMarkdown(bundle, cp, state.name), 'text/markdown')}>
            Markdown <Glyph name="download" size={14} />
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => download(`${course.id}-work.json`, JSON.stringify({ course: course.id, version: course.version, learner: state.name, progress: cp }, null, 2), 'application/json')}
          >
            JSON <Glyph name="download" size={14} />
          </button>
        </div>
      </div>

      {course.outputs.map((o) => {
        const vals = cp.outputs[o.id]?.fields ?? {}
        const parts = partsFor(bundle, o.id)
        const total = parts.reduce((n, p) => n + p.fields.length, 0)
        const filled = parts.reduce((n, p) => n + p.fields.filter((f) => fieldComplete(f, vals[f.id], cp)).length, 0)
        return (
          <article key={o.id} id={o.id} className={`dossier ${o.capstone ? 'capstone' : ''}`}>
            <header className="dossier-head">
              <span className="label">{o.capstone ? 'Capstone' : o.kind.replace('-', ' ')}</span>
              <h2 className="display display-m">{o.title}</h2>
              <p className="soft">{o.description}</p>
              <span className="mono small">
                {filled}/{total} parts complete
              </span>
            </header>
            {parts.map((part) => (
              <section key={part.stepId} className="dossier-part">
                <h3 className="dossier-part-title">
                  {part.title}
                  <Link className="no-print small" to={`/c/${course.id}/l/${part.lessonId}/${part.stepId}`}>
                    edit
                  </Link>
                </h3>
                {part.fields.map((f) => {
                  const t = valueText(f, vals[f.id], cp)
                  return (
                    <div key={f.id} className="dossier-field">
                      <div className="label label-faint">{f.label.replace(/\*\*/g, '')}</div>
                      {t ? <p className={f.type === 'capture' ? 'mono small dossier-capture' : 'dossier-text'}>{t}</p> : <p className="faint">Not yet written.</p>}
                    </div>
                  )
                })}
              </section>
            ))}
          </article>
        )
      })}

      {captures.length > 0 && (
        <article className="dossier">
          <header className="dossier-head">
            <span className="label">Lab notebook</span>
            <h2 className="display display-s">Saved lab results</h2>
          </header>
          <ul className="notebook">
            {captures.map((c) => (
              <li key={c.key}>
                <span className="label label-faint">
                  {c.key} · {new Date(c.savedAt).toLocaleString()}
                </span>
                <p className="mono small">{c.summary}</p>
              </li>
            ))}
          </ul>
        </article>
      )}
      <p className="small soft print-foot">
        Every factual claim in this course is listed with its sources in the course ledger ({Object.keys(bundle.claims).length} claims, last verified {course.lastVerified}).
      </p>
    </div>
  )
}
