import { Link } from 'react-router-dom'
import { loadCatalogue } from '../content/loader'
import { useLearner } from '../store/LearnerProvider'
import { courseFraction, nextUp, orderedLessons } from '../store/model'
import { Cover } from '../ui/Cover'
import { Glyph } from '../ui/Glyph'
import { SITE } from '../site'
import type { CourseBundle } from '../content/schema'

function stats(b: CourseBundle) {
  const steps = Object.values(b.lessons).flatMap((l) => l.steps)
  return {
    lessons: Object.keys(b.lessons).length,
    reels: steps.filter((s) => s.type === 'reel').length,
    labs: steps.filter((s) => s.type === 'widget' || s.type === 'embed').length,
    outputs: b.course.outputs.length,
    claims: Object.keys(b.claims).length,
    sources: Object.keys(b.sources).length,
  }
}

const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

export function Home() {
  const { courses } = loadCatalogue()
  const { state } = useLearner()
  const totalClaims = courses.reduce((n, c) => n + Object.keys(c.claims).length, 0)
  const lastCheck = courses.map((c) => c.course.lastVerified).sort().pop()
  const inProgress = courses
    .map((b) => ({ b, cp: state.courses[b.course.id], frac: courseFraction(b, state.courses[b.course.id]) }))
    .filter((x) => x.frac > 0 && x.frac < 1)
    .sort((a, b) => (b.cp?.lastVisited?.at ?? '').localeCompare(a.cp?.lastVisited?.at ?? ''))

  return (
    <div className="home">
      <section className="hero page">
        <div className="hang">
          <span className="marginalia label label-faint">Vol. 1</span>
          <p className="label hero-kicker">
            {courses.length} course{courses.length === 1 ? '' : 's'} in print · {totalClaims} claims verified · last check {lastCheck ? fmtDate(lastCheck) : '—'}
          </p>
        </div>
        <h1 className="display display-xl hero-title">
          Learn anything,
          <br />
          <em className="hero-em">checked</em> line&nbsp;by&nbsp;line.
        </h1>
        <div className="hero-foot">
          <p className="lede">{SITE.tagline} Mostly watched and played, rarely read — and every claim traceable to its source.</p>
          <ul className="hero-legend" aria-label="What each lesson is made of">
            <li>
              <Glyph name="reel" /> <span>Reels — narrated motion lessons</span>
            </li>
            <li>
              <Glyph name="lab" /> <span>Labs — simulations you drive</span>
            </li>
            <li>
              <Glyph name="output" /> <span>Work outputs — things you make</span>
            </li>
            <li>
              <Glyph name="ledger" /> <span>Ledger — every claim, sourced</span>
            </li>
          </ul>
        </div>
      </section>

      {inProgress.length > 0 && (
        <section className="page continue">
          <div className="hang">
            <span className="marginalia label">Resume</span>
          </div>
          {inProgress.map(({ b, cp, frac }) => {
            const nu = nextUp(b, cp)
            if (!nu) return null
            return (
              <Link key={b.course.id} to={`/c/${b.course.id}/l/${nu.lesson.id}/${nu.step.id}`} className="continue-row" style={{ ['--accent' as string]: b.course.theme.accent }}>
                <Cover kind={b.course.theme.cover} seed={b.course.id} accent={b.course.theme.accent} className="continue-cover" />
                <div className="continue-meta">
                  <span className="label label-faint">
                    {b.course.title} · Unit {String(nu.unitIndex + 1).padStart(2, '0')}
                  </span>
                  <span className="continue-title">{nu.lesson.title}</span>
                  <span className="soft small">Next: {nu.step.title}</span>
                </div>
                <div className="continue-progress">
                  <span className="mono">{Math.round(frac * 100)}%</span>
                  <span className="bar">
                    <span style={{ width: `${frac * 100}%` }} />
                  </span>
                </div>
                <span className="btn btn-small">
                  Resume <Glyph name="arrow" className="arrow" size={14} />
                </span>
              </Link>
            )
          })}
        </section>
      )}

      <section className="page shelf">
        <div className="shelf-head hang">
          <span className="marginalia label">The shelf</span>
          <h2 className="display display-m">Courses</h2>
        </div>
        {courses.map((b, i) => {
          const s = stats(b)
          const cp = state.courses[b.course.id]
          const frac = courseFraction(b, cp)
          const nu = nextUp(b, cp)
          const first = orderedLessons(b)[0]
          const href = nu ? `/c/${b.course.id}/l/${nu.lesson.id}/${nu.step.id}` : `/c/${b.course.id}/l/${first.lesson.id}`
          return (
            <article key={b.course.id} className="course-row" style={{ ['--accent' as string]: b.course.theme.accent }}>
              <Link to={`/c/${b.course.id}`} className="course-row-cover" aria-label={`${b.course.title} syllabus`}>
                <Cover kind={b.course.theme.cover} seed={b.course.id} accent={b.course.theme.accent} label={`${b.course.title} cover`} />
                <span className="course-row-no mono">No. {String(i + 1).padStart(2, '0')}</span>
              </Link>
              <div className="course-row-body">
                <div className="course-row-meta label">
                  <span>{b.course.level}</span>
                  <span>≈ {b.course.hours} h</span>
                  <span>{b.course.units.length} units</span>
                  <span>v{b.course.version}</span>
                </div>
                <h3 className="display display-l course-row-title">
                  <Link to={`/c/${b.course.id}`}>{b.course.title}</Link>
                </h3>
                <p className="course-row-sub">{b.course.subtitle}</p>
                <ol className="course-row-outcomes">
                  {b.course.outcomes.slice(0, 3).map((o, k) => (
                    <li key={k}>{o}</li>
                  ))}
                </ol>
                <div className="course-row-counts">
                  <span>
                    <b className="mono">{s.reels}</b> reels
                  </span>
                  <span>
                    <b className="mono">{s.labs}</b> labs
                  </span>
                  <span>
                    <b className="mono">{s.outputs}</b> work outputs
                  </span>
                  <Link to={`/c/${b.course.id}/ledger`}>
                    <b className="mono">{s.claims}</b> claims · <b className="mono">{s.sources}</b> sources
                  </Link>
                </div>
                <div className="course-row-actions">
                  <Link to={href} className="btn">
                    {frac > 0 ? (frac >= 1 ? 'Review' : 'Resume') : 'Begin'} <Glyph name="arrow" className="arrow" size={14} />
                  </Link>
                  <Link to={`/c/${b.course.id}`} className="btn btn-ghost">
                    Syllabus
                  </Link>
                  {frac > 0 && (
                    <span className="course-row-progress">
                      <span className="bar">
                        <span style={{ width: `${frac * 100}%` }} />
                      </span>
                      <span className="mono small">{Math.round(frac * 100)}%</span>
                    </span>
                  )}
                </div>
              </div>
            </article>
          )
        })}

        <Link to="/commission" className="commission-row">
          <span className="commission-plus" aria-hidden>
            <Glyph name="plus" size={28} />
          </span>
          <span className="commission-text">
            <span className="display display-s">Commission the next course</span>
            <span className="soft">Describe what you want to learn. You'll get a brief that Claude can turn into a verified course in this repository.</span>
          </span>
          <Glyph name="arrow" size={22} className="arrow" />
        </Link>
      </section>
    </div>
  )
}
