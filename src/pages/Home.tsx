import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { loadCatalogue } from '../content/loader'
import { courseStats, fmtDate, LEVEL_LABEL } from '../content/stats'
import type { CourseBundle } from '../content/schema'
import { useLearner } from '../store/LearnerProvider'
import { courseFraction, lessonDone, nextUp, orderedLessons, type CourseProgress } from '../store/model'
import { Cover } from '../ui/Cover'
import { Glyph, STEP_GLYPH, STEP_LABEL } from '../ui/Glyph'
import { ProgressBar, ProgressRing } from '../ui/Progress'

/* ───────────── derived data ───────────── */

type Status = 'new' | 'progress' | 'done'
type Filter = 'all' | Status

interface Entry {
  b: CourseBundle
  cp: CourseProgress | undefined
  frac: number
  status: Status
}

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'progress', label: 'In progress' },
  { id: 'done', label: 'Completed' },
  { id: 'new', label: 'Not started' },
]

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** The course's optional `skills` list, else its module titles. */
function skillsOf(b: CourseBundle): string[] {
  const skills = b.course.skills
  return skills?.length ? skills : b.course.units.map((u) => u.title)
}

const fold = (s: string) =>
  s
    .toLocaleLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')

/** Every word of the query must appear somewhere in the course's searchable text ("options" also finds "option"). */
function matches(b: CourseBundle, q: string) {
  const c = b.course
  const hay = fold([c.title, c.subtitle, c.summary, ...c.outcomes, ...c.units.map((u) => u.title), ...skillsOf(b)].join('\n'))
  return fold(q)
    .split(/[\s,.;:!?"“”'‘’()]+/)
    .filter(Boolean)
    .every((w) => hay.includes(w) || (w.length > 3 && w.endsWith('s') && hay.includes(w.slice(0, -1))))
}

/** "2.1" — module number, then the lesson's place inside that module. */
function lessonNo(b: CourseBundle, lessonId: string) {
  const ui = b.course.units.findIndex((u) => u.lessons.includes(lessonId))
  return ui < 0 ? '' : `${ui + 1}.${b.course.units[ui].lessons.indexOf(lessonId) + 1}`
}

function resumeHref(b: CourseBundle, cp: CourseProgress | undefined) {
  const nu = nextUp(b, cp)
  if (nu) return `/c/${b.course.id}/l/${nu.lesson.id}/${nu.step.id}`
  const first = orderedLessons(b)[0]
  return `/c/${b.course.id}/l/${first.lesson.id}`
}

function lessonsDone(b: CourseBundle, cp: CourseProgress | undefined) {
  return orderedLessons(b).filter(({ lesson }) => lessonDone(lesson, cp)).length
}

/* ───────────── page ───────────── */

export function Home() {
  const { courses } = loadCatalogue()
  const { state } = useLearner()
  const [params] = useSearchParams()
  const location = useLocation()
  const q = (params.get('q') ?? '').trim()
  const [filter, setFilter] = useState<Filter>('all')

  const entries: Entry[] = useMemo(
    () =>
      courses.map((b) => {
        const cp = state.courses[b.course.id]
        const frac = courseFraction(b, cp)
        return { b, cp, frac, status: frac <= 0 ? 'new' : frac >= 1 ? 'done' : 'progress' }
      }),
    [courses, state.courses],
  )

  // Most recently visited first; in-progress courses before finished ones.
  const started = entries
    .filter((e) => e.status !== 'new')
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'progress' ? -1 : 1
      return (b.cp?.lastVisited?.at ?? '').localeCompare(a.cp?.lastVisited?.at ?? '')
    })

  // The header search lands on /?q=…#catalog — bring the results into view.
  useEffect(() => {
    if (location.hash === '#catalog') document.getElementById('catalog')?.scrollIntoView({ block: 'start' })
  }, [location.key, location.hash])

  return (
    <div className="home">
      {!q && (started.length ? <WelcomeBack entry={started[0]} name={state.name} /> : entries.length > 0 && <Hero entries={entries} />)}
      {!q && started.length > 0 && <MyLearning entries={started} />}
      <Catalog entries={entries} q={q} filter={filter} setFilter={setFilter} />
      <HowItWorks />
    </div>
  )
}

/* ───────────── hero: new learner ───────────── */

function Hero({ entries }: { entries: Entry[] }) {
  const first = entries[0].b
  const nu = nextUp(first, undefined)
  const firstLesson = nu?.lesson ?? orderedLessons(first)[0].lesson
  const claims = entries.reduce((n, e) => n + Object.keys(e.b.claims).length, 0)
  const lastCheck = entries
    .map((e) => e.b.course.lastVerified)
    .sort()
    .pop()

  return (
    <section className="home-hero band-tint" aria-labelledby="home-title">
      <div className="container-wide home-hero-grid">
        <div className="home-hero-copy">
          <p className="home-kicker">
            <Glyph name="shield" size={16} /> Every claim traceable to a dated source
          </p>
          <h1 id="home-title" className="display-xl home-hero-title">
            Learn anything&nbsp;— <span className="home-hero-title-tail">with every fact checked</span>
          </h1>
          <p className="lede home-hero-lede">
            Narrated videos, live labs and real assignments, built to order. Each lesson shows the sources behind what you're watching, so you can check it
            yourself.
          </p>
          <div className="home-hero-actions">
            <Link to={resumeHref(first, undefined)} className="btn btn-large">
              Begin learning <Glyph name="arrow" className="arrow" size={16} />
            </Link>
            <Link to="/commission" className="btn btn-large btn-secondary">
              Commission a course
            </Link>
          </div>
          <p className="home-hero-note meta">
            Starts with <b>{first.course.title}</b>, lesson {lessonNo(first, firstLesson.id)} ({firstLesson.minutes} min). No account needed: progress stays in
            your browser.
          </p>
        </div>
        <FeaturedArt b={first} claims={claims} lastCheck={lastCheck} />
      </div>
      <div className="container-wide">
        <ValueProps entries={entries} />
      </div>
    </section>
  )
}

function FeaturedArt({ b, claims, lastCheck }: { b: CourseBundle; claims: number; lastCheck?: string }) {
  const s = courseStats(b)
  const c = b.course
  return (
    <Link to={`/c/${c.id}`} className="home-art" aria-label={`${c.title}: course overview`}>
      <Cover kind={c.theme.cover} seed={c.id} accent={c.theme.accent} className="home-art-cover" label={`${c.title} cover`} />
      <span className="home-art-chip">
        <Glyph name="checkCircle" size={16} /> {claims} claims checked{lastCheck ? ` · ${fmtDate(lastCheck)}` : ''}
      </span>
      <span className="home-art-card">
        <span className="catalog-partner">
          <PartnerMark /> Featured course
        </span>
        <span className="home-art-title">{c.title}</span>
        <span className="meta">
          {LEVEL_LABEL[c.level] ?? c.level} · {plural(s.lessons, 'lesson')} · ≈ {c.hours} h
        </span>
      </span>
    </Link>
  )
}

function ValueProps({ entries }: { entries: Entry[] }) {
  const t = entries.reduce(
    (acc, e) => {
      const s = courseStats(e.b)
      return { videos: acc.videos + s.videos, minutes: acc.minutes + s.videoMinutes, labs: acc.labs + s.labs, claims: acc.claims + s.claims, sources: acc.sources + s.sources, outputs: acc.outputs + s.outputs }
    },
    { videos: 0, minutes: 0, labs: 0, claims: 0, sources: 0, outputs: 0 },
  )
  const props = [
    { glyph: 'reel', title: 'Watch narrated videos', line: `${plural(t.videos, 'video')}, captioned` },
    { glyph: 'lab', title: 'Practise in live labs', line: `${plural(t.labs, 'interactive lab')}` },
    { glyph: 'ledger', title: 'Every claim sourced', line: `${plural(t.claims, 'claim')}, ${plural(t.sources, 'source')}` },
    { glyph: 'output', title: 'Finish with real work', line: `${plural(t.outputs, 'work output')} to keep` },
  ]
  return (
    <ul className="home-props" aria-label="What you get">
      {props.map((p) => (
        <li key={p.title}>
          <span className="glyph-tile">
            <Glyph name={p.glyph} size={22} />
          </span>
          <span className="home-prop-text">
            <b>{p.title}</b>
            <span className="meta">{p.line}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

/* ───────────── hero: returning learner ───────────── */

function WelcomeBack({ entry, name }: { entry: Entry; name: string }) {
  const { b, cp, frac, status } = entry
  const c = b.course
  const nu = nextUp(b, cp)
  const done = lessonsDone(b, cp)
  const total = orderedLessons(b).length
  const pct = Math.round(frac * 100)
  const first = name.trim().split(/\s+/)[0]

  return (
    <section className="home-hero home-back band-tint" aria-labelledby="home-title">
      <div className="container-wide">
        <div className="home-back-head">
          <h1 id="home-title" className="display-m">
            Welcome back{first ? `, ${first}` : ''}
          </h1>
          <p className="soft">
            {status === 'done'
              ? `You've finished ${c.title}. Your certificate and work outputs are ready.`
              : `Pick up where you left off: ${done} of ${plural(total, 'lesson')} done in ${c.title}.`}
          </p>
        </div>

        <article className="home-continue-card card">
          <Link to={`/c/${c.id}`} className="home-continue-thumb" tabIndex={-1} aria-hidden>
            <Cover kind={c.theme.cover} seed={c.id} accent={c.theme.accent} />
          </Link>
          <div className="home-continue-body">
            <p className="home-continue-course">
              <PartnerMark />
              <Link to={`/c/${c.id}`}>{c.title}</Link>
              {nu && <span className="faint">· Module {nu.unitIndex + 1} of {c.units.length}</span>}
            </p>
            {nu ? (
              <>
                <h2 className="t-h3 home-continue-title">
                  Next: {lessonNo(b, nu.lesson.id)} {nu.lesson.title}
                </h2>
                <p className="home-continue-step">
                  <Glyph name={STEP_GLYPH[nu.step.type] ?? 'dot'} size={16} />
                  <span>
                    {STEP_LABEL[nu.step.type] ?? nu.step.type} · {nu.step.title}
                  </span>
                  <span className="faint">· {nu.lesson.minutes} min lesson</span>
                </p>
              </>
            ) : (
              <>
                <h2 className="t-h3 home-continue-title">Course complete</h2>
                <p className="home-continue-step">
                  <Glyph name="checkCircle" size={16} className="home-continue-ok" />
                  <span>
                    All {plural(total, 'lesson')} done{cp?.certificate ? ` · certificate issued ${fmtDate(cp.certificate.issuedAt.slice(0, 10))}` : ''}
                  </span>
                </p>
              </>
            )}
            <div className="home-continue-progress">
              <ProgressBar value={frac} label={`${c.title} progress`} />
              <span className="small">{pct}% complete</span>
            </div>
          </div>
          <div className="home-continue-action">
            {nu ? (
              <Link to={resumeHref(b, cp)} className="btn btn-large">
                Resume <Glyph name="arrow" className="arrow" size={16} />
              </Link>
            ) : (
              <>
                <Link to={`/c/${c.id}/certificate`} className="btn btn-large">
                  {cp?.certificate ? 'View certificate' : 'Get your certificate'} <Glyph name="arrow" className="arrow" size={16} />
                </Link>
                <Link to={`/c/${c.id}/work`} className="btn btn-secondary">
                  Your work
                </Link>
              </>
            )}
          </div>
        </article>
      </div>
    </section>
  )
}

/* ───────────── my learning ───────────── */

function MyLearning({ entries }: { entries: Entry[] }) {
  const inProgress = entries.filter((e) => e.status === 'progress').length
  const completed = entries.length - inProgress
  return (
    <section className="home-section" aria-labelledby="my-learning">
      <div className="container-wide">
        <div className="section-head">
          <div>
            <h2 id="my-learning" className="t-h2">
              My learning
            </h2>
            <p className="meta home-section-sub">
              {[inProgress && `${inProgress} in progress`, completed && `${completed} completed`].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
        <div className="home-my-grid">
          {entries.map((e) => (
            <MyCourse key={e.b.course.id} entry={e} />
          ))}
        </div>
      </div>
    </section>
  )
}

function MyCourse({ entry }: { entry: Entry }) {
  const { b, cp, frac, status } = entry
  const c = b.course
  const nu = nextUp(b, cp)
  const deliverables = Object.values(b.lessons).flatMap((l) => l.steps.filter((s) => s.type === 'deliverable'))
  const assignmentsDone = deliverables.filter((s) => cp?.steps[s.id]).length
  const done = lessonsDone(b, cp)
  const total = orderedLessons(b).length
  return (
    <article className="home-my-card card">
      <ProgressRing value={frac} size={60} stroke={5} label={`${c.title} progress`} />
      <div className="home-my-card-titles">
        <p className="catalog-partner">
          <PartnerMark /> Margin Originals
        </p>
        <h3 className="t-h3">
          <Link to={`/c/${c.id}`}>{c.title}</Link>
        </h3>
        <p className="meta">{status === 'done' ? 'Completed' : nu ? `Module ${nu.unitIndex + 1} of ${c.units.length}: ${nu.unit.title}` : ''}</p>
      </div>
      <ul className="home-my-card-facts">
        <li>
          <Glyph name="checkCircle" size={16} />
          {done} of {plural(total, 'lesson')} done
        </li>
        <li>
          <Glyph name="output" size={16} />
          {assignmentsDone} of {plural(deliverables.length, 'assignment')} submitted
        </li>
        <li>
          <Glyph name="cert" size={16} />
          {cp?.certificate ? `Certificate issued ${fmtDate(cp.certificate.issuedAt.slice(0, 10))}` : status === 'done' ? 'Certificate ready to issue' : 'Certificate on completion'}
        </li>
      </ul>
      <div className="home-my-card-actions">
        {status === 'done' ? (
          <Link to={`/c/${c.id}/certificate`} className="btn btn-secondary btn-small">
            Certificate
          </Link>
        ) : (
          <Link to={resumeHref(b, cp)} className="btn btn-secondary btn-small">
            Continue <Glyph name="arrow" className="arrow" size={14} />
          </Link>
        )}
        <Link to={`/c/${c.id}/work`}>Your work</Link>
      </div>
    </article>
  )
}

/* ───────────── catalogue ───────────── */

function Catalog({ entries, q, filter, setFilter }: { entries: Entry[]; q: string; filter: Filter; setFilter: (f: Filter) => void }) {
  const found = q ? entries.filter((e) => matches(e.b, q)) : entries
  const count = (f: Filter) => (f === 'all' ? found.length : found.filter((e) => e.status === f).length)
  const shown = filter === 'all' ? found : found.filter((e) => e.status === filter)
  const commissionTo = q ? `/commission?topic=${encodeURIComponent(q)}` : '/commission'

  return (
    <section id="catalog" className="home-section home-catalog" aria-labelledby="catalog-title">
      <div className="container-wide">
        <div className="section-head">
          <div>
            <h2 id="catalog-title" className="t-h2">
              {q ? <>Results for “{q}”</> : 'All courses'}
            </h2>
            <p className="meta home-section-sub">
              {q ? (
                <>
                  {plural(found.length, 'course')} found ·{' '}
                  <Link to="/#catalog" className="catalog-clear">
                    Clear search
                  </Link>
                </>
              ) : (
                <>{plural(entries.length, 'course')}, each researched, sourced and fact-checked</>
              )}
            </p>
          </div>
        </div>
        {found.length > 0 && (
          <div className="catalog-filters" role="group" aria-label="Filter courses">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" className="catalog-filter" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                {f.label}
                <span className="catalog-filter-count">{count(f.id)}</span>
              </button>
            ))}
          </div>
        )}

        {q && found.length === 0 ? (
          <div className="catalog-empty card">
            <span className="glyph-tile">
              <Glyph name="search" size={24} />
            </span>
            <h3 className="t-h2">No course on “{q}” yet</h3>
            <p className="soft">Margin builds courses to order. Describe what you want to learn and you'll get a brief Claude can turn into a fully sourced course.</p>
            <div className="catalog-empty-actions">
              <Link to={commissionTo} className="btn">
                Commission a course on “{q}” <Glyph name="arrow" className="arrow" size={16} />
              </Link>
              <Link to="/#catalog" className="btn btn-quiet">
                Browse all courses
              </Link>
            </div>
          </div>
        ) : (
          <div className="catalog-grid">
            {shown.map((e) => (
              <CourseCard key={e.b.course.id} entry={e} />
            ))}
            {shown.length === 0 && (
              <div className="catalog-grid-empty">
                <p className="soft">{filter === 'progress' ? 'No courses in progress yet.' : filter === 'done' ? 'No completed courses yet.' : 'You have started every course.'}</p>
                <button type="button" className="link-btn" onClick={() => setFilter('all')}>
                  Show all courses
                </button>
              </div>
            )}
            <Link to={commissionTo} className="commission-tile">
              <span className="glyph-tile">
                <Glyph name="plus" size={24} />
              </span>
              <span className="commission-tile-title">{q ? <>Commission a course on “{q}”</> : 'Commission a course'}</span>
              <span className="commission-tile-text">Tell Margin what you want to learn. Claude researches it, cites every claim and builds the lessons.</span>
              <span className="commission-tile-cta">
                Start a brief <Glyph name="arrow" className="arrow" size={15} />
              </span>
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}

function CourseCard({ entry }: { entry: Entry }) {
  const { b, frac, status } = entry
  const c = b.course
  const s = courseStats(b)
  const pct = Math.round(frac * 100)
  return (
    <article className="course-card">
      <div className="course-card-thumb">
        <Cover kind={c.theme.cover} seed={c.id} accent={c.theme.accent} label={`${c.title} cover`} />
        {status !== 'new' && <span className={`course-card-status${status === 'done' ? ' is-done' : ''}`}>{status === 'done' ? 'Completed' : 'In progress'}</span>}
      </div>
      <div className="course-card-body">
        <p className="catalog-partner">
          <PartnerMark /> Margin Originals
        </p>
        <h3 className="course-card-title">
          <Link to={`/c/${c.id}`}>{c.title}</Link>
        </h3>
        <p className="course-card-skills">
          <b>Skills you'll gain:</b> {skillsOf(b).join(', ')}
        </p>
        <p className="course-card-meta">
          {LEVEL_LABEL[c.level] ?? c.level} · {plural(s.lessons, 'lesson')} · ≈ {c.hours} h
        </p>
        <div className="course-card-badges">
          <span className="badge badge-good">
            <Glyph name="checkCircle" size={14} /> Fact-checked
          </span>
          <span className="badge badge-neutral">
            <Glyph name="cert" size={14} /> Certificate
          </span>
        </div>
        {status !== 'new' && (
          <div className="course-card-progress">
            <ProgressBar value={frac} thin label={`${c.title} progress`} />
            <span className="meta">{pct}% complete</span>
          </div>
        )}
      </div>
    </article>
  )
}

function PartnerMark() {
  return (
    <span className="catalog-mark" aria-hidden>
      M<span />
    </span>
  )
}

/* ───────────── how it works ───────────── */

const HOW = [
  { glyph: 'reel', title: 'Watch', line: 'Short narrated videos explain each idea, with captions and chapters.' },
  { glyph: 'lab', title: 'Practise', line: 'Live labs let you steer the simulation and see the maths respond.' },
  { glyph: 'quiz', title: 'Check', line: 'Quick quizzes confirm you have it before the next lesson unlocks.' },
  { glyph: 'output', title: 'Make', line: 'Assignments build real work you can print or export, then earn a certificate.' },
]

function HowItWorks() {
  return (
    <section className="band home-how" aria-labelledby="how-title">
      <div className="container-wide">
        <div className="section-head">
          <div>
            <h2 id="how-title" className="t-h2">
              How Margin works
            </h2>
            <p className="meta home-section-sub">Every course follows the same four-part rhythm, lesson by lesson.</p>
          </div>
          <Link to="/method" className="home-how-link">
            How we fact-check <Glyph name="arrow" className="arrow" size={15} />
          </Link>
        </div>
        <ol className="home-how-steps">
          {HOW.map((h, i) => (
            <li key={h.title} className="home-how-step">
              <span className="glyph-tile">
                <Glyph name={h.glyph} size={22} />
              </span>
              <span className="home-how-step-no">Step {i + 1}</span>
              <h3 className="t-h3">{h.title}</h3>
              <p className="soft small">{h.line}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
