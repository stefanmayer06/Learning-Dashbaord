import { Link, useParams } from 'react-router-dom'
import { findCourse } from '../content/loader'
import { useLearner } from '../store/LearnerProvider'
import { courseComplete, courseFraction, lessonDone, lessonFraction, lessonUnlocked, nextUp, unitDone, unitUnlocked } from '../store/model'
import { Cover } from '../ui/Cover'
import { Glyph, STEP_GLYPH } from '../ui/Glyph'
import { NotFound } from './NotFound'
import { buildTimeline } from '../engine/reel/timeline'
import type { CourseBundle } from '../content/schema'

export function CoursePage() {
  const { courseId } = useParams()
  const bundle = findCourse(courseId)
  const { course: getCp } = useLearner()
  if (!bundle) return <NotFound />
  const { course, lessons } = bundle
  const cp = getCp(course.id)
  const frac = courseFraction(bundle, cp)
  const nu = nextUp(bundle, cp)
  const complete = courseComplete(bundle, cp)
  const steps = Object.values(lessons).flatMap((l) => l.steps)
  const reelMinutes = Math.round(steps.reduce((sec, s) => sec + (s.type === 'reel' ? buildTimeline(s.reel).total : 0), 0) / 60)

  return (
    <div className="course" style={{ ['--accent' as string]: course.theme.accent }}>
      <section className="course-hero page">
        <div className="course-hero-cover">
          <Cover kind={course.theme.cover} seed={course.id} accent={course.theme.accent} label={`${course.title} cover`} />
        </div>
        <div className="course-hero-body">
          <p className="label">
            <Link to="/">Shelf</Link> / Course · {course.level} · ≈ {course.hours} hours · version {course.version}
          </p>
          <h1 className="display display-l">{course.title}</h1>
          <p className="lede">{course.subtitle}</p>
          <p className="course-summary">{course.summary}</p>
          <div className="course-hero-actions">
            {nu ? (
              <Link to={`/c/${course.id}/l/${nu.lesson.id}/${nu.step.id}`} className="btn btn-accent">
                {frac > 0 ? 'Resume' : 'Begin the course'} <Glyph name="arrow" className="arrow" size={14} />
              </Link>
            ) : (
              <Link to={`/c/${course.id}/certificate`} className="btn btn-accent">
                View certificate <Glyph name="seal" size={14} />
              </Link>
            )}
            <Link to={`/c/${course.id}/work`} className="btn btn-ghost">
              Your work
            </Link>
            <Link to={`/c/${course.id}/ledger`} className="btn btn-ghost">
              Sources & claims
            </Link>
          </div>
          <dl className="course-facts">
            <div>
              <dt className="label label-faint">Progress</dt>
              <dd className="mono">{Math.round(frac * 100)}%</dd>
            </div>
            <div>
              <dt className="label label-faint">Lessons</dt>
              <dd className="mono">{Object.keys(lessons).length}</dd>
            </div>
            <div>
              <dt className="label label-faint">Reels</dt>
              <dd className="mono">≈ {reelMinutes} min</dd>
            </div>
            <div>
              <dt className="label label-faint">Claims checked</dt>
              <dd className="mono">{Object.keys(bundle.claims).length}</dd>
            </div>
            <div>
              <dt className="label label-faint">Last verified</dt>
              <dd className="mono">{course.lastVerified}</dd>
            </div>
          </dl>
        </div>
      </section>

      <RouteMap bundle={bundle} />

      <section className="page outcomes-block">
        <div className="hang">
          <span className="marginalia label">You'll be able to</span>
        </div>
        <ol className="outcomes">
          {course.outcomes.map((o, i) => (
            <li key={i}>
              <span className="mono outcome-n">{String(i + 1).padStart(2, '0')}</span>
              {o}
            </li>
          ))}
        </ol>
        {course.prerequisites.length > 0 && <p className="soft small">Before you start: {course.prerequisites.join(' · ')}</p>}
      </section>

      <section className="page syllabus">
        {course.units.map((unit, ui) => {
          const open = unitUnlocked(bundle, ui, cp)
          const doneU = unitDone(bundle, ui, cp)
          return (
            <div key={unit.id} className={`unit ${open ? '' : 'locked'}`} id={`unit-${unit.id}`}>
              <div className="unit-head hang">
                <span className="marginalia">
                  <span className="unit-no display">{String(ui + 1).padStart(2, '0')}</span>
                </span>
                <span className={`chip strand strand-${unit.strand.toLowerCase()}`}>{unit.strand}</span>
                <h2 className="display display-s unit-title">{unit.title}</h2>
                <span className="unit-state label">{doneU ? 'Complete' : open ? '' : `Locked · finish unit ${String(ui).padStart(2, '0')} first`}</span>
              </div>
              <p className="unit-summary soft">{unit.summary}</p>
              <ol className="lessons">
                {unit.lessons.map((lid, li) => {
                  const l = lessons[lid]
                  const unlocked = lessonUnlocked(bundle, lid, cp)
                  const d = lessonDone(l, cp)
                  const f = lessonFraction(l, cp)
                  const kinds = [...new Set(l.steps.map((s) => s.type))]
                  const inner = (
                    <>
                      <span className="lesson-no mono">
                        {ui + 1}.{li + 1}
                      </span>
                      <span className="lesson-main">
                        <span className="lesson-title">{l.title}</span>
                        <span className="lesson-sum soft">{l.summary}</span>
                      </span>
                      <span className="lesson-kinds" aria-label={`Contains: ${kinds.join(', ')}`}>
                        {kinds.map((k) => (
                          <Glyph key={k} name={STEP_GLYPH[k]} size={15} title={k} />
                        ))}
                      </span>
                      <span className="lesson-min mono">{l.minutes} min</span>
                      <span className="lesson-state">
                        {d ? (
                          <span className="tick">
                            <Glyph name="check" size={14} />
                          </span>
                        ) : unlocked ? (
                          f > 0 ? (
                            <span className="mono small">{Math.round(f * 100)}%</span>
                          ) : (
                            <Glyph name="arrow" size={14} />
                          )
                        ) : (
                          <Glyph name="lock" size={14} />
                        )}
                      </span>
                    </>
                  )
                  return (
                    <li key={lid} className={`lesson ${d ? 'done' : ''} ${unlocked ? '' : 'locked'}`}>
                      {unlocked ? (
                        <Link to={`/c/${course.id}/l/${lid}`} className="lesson-link">
                          {inner}
                        </Link>
                      ) : (
                        <div className="lesson-link" aria-disabled>
                          {inner}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ol>
            </div>
          )
        })}
      </section>

      <section className="page outputs-block">
        <div className="hang">
          <span className="marginalia label">What you'll make</span>
          <h2 className="display display-m">Work outputs</h2>
        </div>
        <div className="outputs-grid">
          {course.outputs.map((o) => {
            const rec = cp.outputs[o.id]
            return (
              <Link key={o.id} to={`/c/${course.id}/work#${o.id}`} className={`output-card ${o.capstone ? 'capstone' : ''}`}>
                <span className="label">{o.capstone ? 'Capstone' : o.kind.replace('-', ' ')}</span>
                <span className="output-title">{o.title}</span>
                <span className="soft small">{o.description}</span>
                <span className="label label-faint">{rec ? `${Object.keys(rec.fields).length} part(s) drafted` : 'Not started'}</span>
              </Link>
            )
          })}
          <Link to={`/c/${course.id}/certificate`} className={`output-card cert-card ${complete ? 'ready' : ''}`}>
            <span className="label">Credential</span>
            <span className="output-title">Certificate of completion</span>
            <span className="soft small">Issued when every required step is done. Carries a credential ID that can be verified.</span>
            <span className="label label-faint">{complete ? 'Ready to issue' : `${Math.round(frac * 100)}% of the way`}</span>
          </Link>
        </div>
      </section>
    </div>
  )
}

function RouteMap({ bundle }: { bundle: CourseBundle }) {
  const { course: getCp } = useLearner()
  const cp = getCp(bundle.course.id)
  const units = bundle.course.units
  const nu = nextUp(bundle, cp)
  return (
    <section className="page route" aria-label="Course route">
      <div className="route-line">
        {units.map((u, i) => {
          const d = unitDone(bundle, i, cp)
          const open = unitUnlocked(bundle, i, cp)
          const current = nu?.unitIndex === i
          const frac = u.lessons.reduce((s, lid) => s + lessonFraction(bundle.lessons[lid], cp), 0) / u.lessons.length
          return (
            <a key={u.id} href={`#unit-${u.id}`} className={`station ${d ? 'done' : ''} ${current ? 'current' : ''} ${open ? '' : 'locked'}`}>
              <span className="station-track" aria-hidden>
                <span className="station-fill" style={{ width: `${(d ? 1 : frac) * 100}%` }} />
              </span>
              <span className="station-dot" aria-hidden>
                {d ? <Glyph name="check" size={12} /> : open ? null : <Glyph name="lock" size={11} />}
              </span>
              <span className="station-no mono">{String(i + 1).padStart(2, '0')}</span>
              <span className={`station-strand strand-${u.strand.toLowerCase()}`}>{u.strand}</span>
              <span className="station-title">{u.title}</span>
            </a>
          )
        })}
      </div>
    </section>
  )
}
