import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { findCourse } from '../content/loader'
import { useLearner } from '../store/LearnerProvider'
import { courseComplete, courseFraction } from '../store/model'
import { supabaseConfigured, verifyCertificate } from '../store/supabase'
import { Cover } from '../ui/Cover'
import { Glyph } from '../ui/Glyph'
import { SITE } from '../site'
import { NotFound } from './NotFound'

export function CertificatePage() {
  const { courseId } = useParams()
  const bundle = findCourse(courseId)
  const learner = useLearner()
  const [name, setName] = useState(learner.state.name)
  if (!bundle) return <NotFound />
  const { course } = bundle
  const cp = learner.course(course.id)
  const complete = courseComplete(bundle, cp)
  const cert = cp.certificate

  if (!complete && !cert) {
    return (
      <div className="page cert-locked">
        <p className="label">
          <Link to={`/c/${course.id}`}>{course.title}</Link> / Certificate
        </p>
        <h1 className="display display-l">Not yet.</h1>
        <p className="lede">The certificate is issued when every required step is complete. You're {Math.round(courseFraction(bundle, cp) * 100)}% of the way there.</p>
        <Link to={`/c/${course.id}`} className="btn">
          Back to the syllabus <Glyph name="arrow" className="arrow" size={14} />
        </Link>
        <VerifyBox />
      </div>
    )
  }

  if (!cert) {
    return (
      <div className="page cert-issue" style={{ ['--accent' as string]: course.theme.accent }}>
        <p className="label">Final step</p>
        <h1 className="display display-l">Issue your certificate</h1>
        <p className="lede">The name below is printed on the certificate and can't be changed once it's issued.</p>
        <label className="field-label label" htmlFor="cert-name">
          Name on certificate
        </label>
        <input id="cert-name" className="input cert-name-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        <div className="course-hero-actions">
          <button
            className="btn btn-accent"
            disabled={!name.trim()}
            onClick={() => {
              learner.setName(name.trim())
              learner.issueCertificate(course.id, course.title, course.version, name.trim())
            }}
          >
            Issue certificate <Glyph name="seal" size={14} />
          </button>
        </div>
      </div>
    )
  }

  const outputs = course.outputs.map((o) => o.title)
  const issued = new Date(cert.issuedAt)
  return (
    <div className="cert-page page" style={{ ['--accent' as string]: course.theme.accent }}>
      <div className="no-print course-hero-actions">
        <button className="btn" onClick={() => window.print()}>
          Print / save as PDF <Glyph name="print" size={14} />
        </button>
        <Link className="btn btn-ghost" to={`/c/${course.id}/work`}>
          Your work
        </Link>
      </div>
      <article className="certificate" aria-label="Certificate of completion">
        <div className="cert-rule" aria-hidden />
        <div className="cert-top">
          <span className="cert-school">{SITE.name}</span>
          <span className="label">Certificate of completion</span>
        </div>
        <p className="cert-this label label-faint">This certifies that</p>
        <h1 className="cert-name display">{cert.learnerName}</h1>
        <p className="cert-this label label-faint">completed every lesson, lab and work output of</p>
        <h2 className="cert-course display">{cert.courseTitle}</h2>
        <p className="cert-sub">{course.subtitle}</p>
        <div className="cert-grid">
          <div>
            <span className="label label-faint">Work produced</span>
            <ul>
              {outputs.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </div>
          <div>
            <span className="label label-faint">Issued</span>
            <p className="mono">{issued.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
            <span className="label label-faint">Course version · last verified</span>
            <p className="mono">
              v{cert.courseVersion} · {course.lastVerified}
            </p>
            <span className="label label-faint">Credential ID</span>
            <p className="mono cert-id">{cert.id}</p>
          </div>
          <div className="cert-seal">
            <Cover kind={course.theme.cover} seed={course.id} accent={course.theme.accent} />
          </div>
        </div>
        <p className="cert-foot small soft">
          {Object.keys(bundle.claims).length} factual claims in this course were checked against {Object.keys(bundle.sources).length} sources.
          {supabaseConfigured ? ' Verify this credential ID on the certificate page of this site.' : ''}
        </p>
      </article>
      <VerifyBox />
    </div>
  )
}

function VerifyBox() {
  const [id, setId] = useState('')
  const [result, setResult] = useState<string | null>(null)
  if (!supabaseConfigured) return null
  return (
    <div className="verify no-print">
      <span className="label">Verify a credential</span>
      <div className="verify-row">
        <input className="input mono" placeholder="MRG-XXXX-XXXX-XXXX" value={id} onChange={(e) => setId(e.target.value.toUpperCase())} />
        <button
          className="btn btn-small"
          onClick={async () => {
            try {
              const r = await verifyCertificate(id.trim())
              setResult(r ? `Valid: ${r.learner_name} completed ${r.course_title} (v${r.course_version}) on ${r.issued_at.slice(0, 10)}.` : 'No certificate with that ID.')
            } catch (e) {
              setResult(`Could not check: ${(e as Error).message}`)
            }
          }}
        >
          Check
        </button>
      </div>
      {result && <p className="small">{result}</p>}
    </div>
  )
}
