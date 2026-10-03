import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { findCourse } from '../content/loader'
import type { CourseBundle } from '../content/schema'
import { fmtDate } from '../content/stats'
import { useLearner } from '../store/LearnerProvider'
import type { Certificate } from '../store/model'
import { courseComplete, courseFraction, lessonDone, nextUp, orderedLessons } from '../store/model'
import { supabaseConfigured, verifyCertificate } from '../store/supabase'
import { Cover } from '../ui/Cover'
import { Glyph } from '../ui/Glyph'
import { ProgressBar } from '../ui/Progress'
import { Breadcrumbs } from '../ui/Shell'
import { SITE } from '../site'
import { NotFound } from './NotFound'
import { useDocumentTitle } from '../ui/useDocumentTitle'

const longDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

export function CertificatePage() {
  const { courseId } = useParams()
  const bundle = findCourse(courseId)
  useDocumentTitle(bundle ? `Certificate · ${bundle.course.title}` : undefined)
  const learner = useLearner()
  const [name, setName] = useState(learner.state.name)
  if (!bundle) return <NotFound />
  const { course } = bundle
  const cp = learner.course(course.id)
  const complete = courseComplete(bundle, cp)
  const cert = cp.certificate
  const state: 'locked' | 'ready' | 'issued' = cert ? 'issued' : complete ? 'ready' : 'locked'

  return (
    <div className={`pg cert-page cert-is-${state}`} style={{ ['--accent' as string]: course.theme.accent }}>
      <header className="pg-head no-print">
        <div className="page">
          <Breadcrumbs
            items={[
              { label: 'Home', to: '/' },
              { label: 'Courses', to: '/#catalog' },
              { label: course.title, to: `/c/${course.id}` },
              { label: 'Certificate' },
            ]}
          />
          <div className="pg-head-row">
            <div className="pg-head-text">
              <h1 className="display-m pg-title">{state === 'issued' ? 'Your certificate' : state === 'ready' ? 'Issue your certificate' : 'Certificate of completion'}</h1>
              <p className="pg-desc">
                {state === 'issued'
                  ? `Awarded for completing every lesson, lab and work output of ${course.title}.`
                  : state === 'ready'
                    ? 'You have completed every required step. Add the name to print, then issue it.'
                    : `Earn it by completing every lesson, lab and work output of ${course.title}.`}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="page pg-body cert-layout">
        <div className="cert-stage">
          <CertificateArt
            bundle={bundle}
            cert={cert}
            previewName={state === 'ready' ? name.trim() : ''}
            preview={state !== 'issued'}
          />
          {state !== 'issued' && <p className="cert-stage-note meta no-print">Preview. Your certificate is issued with its own credential ID.</p>}
        </div>

        <aside className="cert-side no-print">
          {state === 'locked' && <LockedCard bundle={bundle} />}

          {state === 'ready' && (
            <div className="card card-pad cert-card">
              <span className="badge badge-good">
                <Glyph name="checkCircle" size={14} /> Course complete
              </span>
              <h2 className="t-h3 cert-card-title">Your name on the certificate</h2>
              <form
                className="cert-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!name.trim()) return
                  learner.setName(name.trim())
                  learner.issueCertificate(course.id, course.title, course.version, name.trim())
                }}
              >
                <div className="field">
                  <label className="field-label" htmlFor="cert-name">
                    Name on certificate
                  </label>
                  <input id="cert-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" autoComplete="name" />
                  <p className="field-help">Printed exactly as typed. It can't be changed once the certificate is issued.</p>
                </div>
                <button className="btn btn-block" type="submit" disabled={!name.trim()}>
                  <Glyph name="seal" size={17} /> Issue certificate
                </button>
              </form>
              <Link className="btn btn-quiet btn-block" to={`/c/${course.id}/work`}>
                Review your work first
              </Link>
            </div>
          )}

          {state === 'issued' && cert && <IssuedCard bundle={bundle} cert={cert} />}

          <VerifyBox />
        </aside>
      </div>
    </div>
  )
}

/** The certificate itself. Sized in container units so it scales like a document. */
function CertificateArt({ bundle, cert, previewName, preview }: { bundle: CourseBundle; cert?: Certificate; previewName: string; preview: boolean }) {
  const { course } = bundle
  const learnerName = cert?.learnerName ?? previewName
  const outputs = course.outputs.map((o) => o.title)
  return (
    <article className={`certificate${preview ? ' is-preview' : ''}`} aria-label={preview ? 'Certificate preview' : 'Certificate of completion'}>
      <div className="cert-top">
        <span className="cert-school">
          {SITE.name}
          <span className="cert-school-dot" aria-hidden />
        </span>
        <span className="cert-kind">Certificate of completion</span>
      </div>

      <div className="cert-body">
        <p className="cert-line">This certifies that</p>
        <p className={`cert-name${learnerName ? '' : ' is-empty'}`}>{learnerName || 'Your name'}</p>
        <p className="cert-line">has completed every lesson, lab and work output of</p>
        <h3 className="cert-course">{cert?.courseTitle ?? course.title}</h3>
        <p className="cert-sub">{course.subtitle}</p>
        <p className="cert-work">
          <span>Work produced:</span> {outputs.join(' · ')}
        </p>
      </div>

      <div className="cert-foot">
        <div className="cert-sig">
          <span className="cert-sig-value">{cert ? longDate(cert.issuedAt) : 'On completion'}</span>
          <span className="cert-sig-label">Date issued</span>
        </div>
        <div className="cert-seal" aria-hidden>
          <Cover kind={course.theme.cover} seed={course.id} accent={course.theme.accent} />
        </div>
        <div className="cert-sig">
          <span className="cert-sig-value cert-id">{cert?.id ?? 'MRG-····-····-····'}</span>
          <span className="cert-sig-label">Credential ID</span>
        </div>
      </div>
      <p className="cert-fine">
        Course v{cert?.courseVersion ?? course.version} · last verified {fmtDate(course.lastVerified)} · {Object.keys(bundle.claims).length} factual claims checked against{' '}
        {Object.keys(bundle.sources).length} sources
      </p>
    </article>
  )
}

function LockedCard({ bundle }: { bundle: CourseBundle }) {
  const { course } = bundle
  const learner = useLearner()
  const cp = learner.course(course.id)
  const frac = courseFraction(bundle, cp)
  const all = orderedLessons(bundle)
  const left = all.filter(({ lesson }) => !lessonDone(lesson, cp)).length
  const nu = nextUp(bundle, cp)
  const to = nu ? `/c/${course.id}/l/${nu.lesson.id}/${nu.step.id}` : `/c/${course.id}`
  return (
    <div className="card card-pad cert-card">
      <span className="glyph-tile glyph-tile-muted" aria-hidden>
        <Glyph name="lock" size={22} />
      </span>
      <h2 className="t-h3 cert-card-title">Finish the course to earn it</h2>
      <p className="small soft">
        {left === all.length
          ? `Complete all ${all.length} lessons, including the labs and assignments.`
          : `${left} of ${all.length} lessons to go. Labs and assignments count too.`}
      </p>
      <div className="cert-progress">
        <div className="cert-progress-line">
          <span>Your progress</span>
          <strong>{Math.round(frac * 100)}%</strong>
        </div>
        <ProgressBar value={frac} label="Course progress" />
      </div>
      <Link to={to} className="btn btn-block">
        {frac > 0 ? 'Resume course' : 'Begin the course'} <Glyph name="arrow" className="arrow" size={16} />
      </Link>
      <ul className="cert-includes">
        <li>
          <Glyph name="check" size={16} /> Your name and the course title
        </li>
        <li>
          <Glyph name="check" size={16} /> The work outputs you produced
        </li>
        <li>
          <Glyph name="check" size={16} /> A unique credential ID
        </li>
      </ul>
    </div>
  )
}

function IssuedCard({ bundle, cert }: { bundle: CourseBundle; cert: Certificate }) {
  const { course } = bundle
  const [copied, setCopied] = useState(false)
  return (
    <div className="card card-pad cert-card">
      <span className="badge badge-good">
        <Glyph name="checkCircle" size={14} /> Issued
      </span>
      <h2 className="t-h3 cert-card-title">Certificate of completion</h2>
      <dl className="cert-facts">
        <div>
          <dt>Awarded to</dt>
          <dd>{cert.learnerName}</dd>
        </div>
        <div>
          <dt>Issued</dt>
          <dd>{longDate(cert.issuedAt)}</dd>
        </div>
        <div>
          <dt>Course version</dt>
          <dd>v{cert.courseVersion}</dd>
        </div>
        <div>
          <dt>Credential ID</dt>
          <dd className="cert-facts-id">
            <span className="mono">{cert.id}</span>
            <button
              className="icon-btn"
              aria-label={copied ? 'Copied' : 'Copy credential ID'}
              title={copied ? 'Copied' : 'Copy credential ID'}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(cert.id)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1600)
                } catch {
                  /* clipboard blocked: the ID is selectable */
                }
              }}
            >
              <Glyph name={copied ? 'check' : 'copy'} size={17} />
            </button>
          </dd>
        </div>
      </dl>
      <div className="cert-actions">
        <button className="btn btn-block" onClick={() => window.print()}>
          <Glyph name="print" size={17} /> Print / Save as PDF
        </button>
        <Link className="btn btn-secondary btn-block" to={`/c/${course.id}/work`}>
          Your work
        </Link>
      </div>
      <p className="cert-verify-note small soft">
        <Glyph name="info" size={16} />
        <span>
          {supabaseConfigured
            ? 'Anyone can check this credential ID with the verify box below.'
            : 'Issued in this browser. Checking credential IDs online needs the optional Supabase sync (see Settings).'}
        </span>
      </p>
    </div>
  )
}

function VerifyBox() {
  const [id, setId] = useState('')
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)
  if (!supabaseConfigured) return null
  return (
    <form
      className="card card-pad cert-verify no-print"
      onSubmit={async (e) => {
        e.preventDefault()
        try {
          const r = await verifyCertificate(id.trim())
          setResult(
            r
              ? { ok: true, text: `Valid: ${r.learner_name} completed ${r.course_title} (v${r.course_version}) on ${r.issued_at.slice(0, 10)}.` }
              : { ok: false, text: 'No certificate with that ID.' },
          )
        } catch (err) {
          setResult({ ok: false, text: `Could not check: ${(err as Error).message}` })
        }
      }}
    >
      <label className="field-label" htmlFor="verify-id">
        Verify a credential
      </label>
      <div className="cert-verify-row">
        <input id="verify-id" className="input mono" placeholder="MRG-XXXX-XXXX-XXXX" value={id} onChange={(e) => setId(e.target.value.toUpperCase())} />
        <button className="btn btn-secondary" type="submit" disabled={!id.trim()}>
          Check
        </button>
      </div>
      {result && <p className={`small cert-verify-result${result.ok ? ' ok' : ''}`}>{result.text}</p>}
    </form>
  )
}
