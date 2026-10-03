import { useEffect, useMemo, useState, type ReactNode, type SyntheticEvent } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { findCourse } from '../content/loader'
import type { CourseBundle, Lesson } from '../content/schema'
import { courseStats, fmtDate, fmtMinutes, LEVEL_LABEL } from '../content/stats'
import { useLearner } from '../store/LearnerProvider'
import type { CourseProgress } from '../store/model'
import { courseComplete, courseFraction, lessonDone, lessonFraction, lessonUnlocked, nextUp, unitDone, unitUnlocked } from '../store/model'
import { StatusTiles } from '../ui/Cite'
import { Cover } from '../ui/Cover'
import { Glyph, STEP_GLYPH, STEP_LABEL, type GlyphName } from '../ui/Glyph'
import { ProgressRing } from '../ui/Progress'
import { Breadcrumbs } from '../ui/Shell'
import { NotFound } from './NotFound'
import { useDocumentTitle } from '../ui/useDocumentTitle'
import { scrollBehavior } from '../ui/motion'

/** In-page sections, in order — the sticky tab bar links to these. */
const SECTIONS = [
  { id: 'about', label: 'About' },
  { id: 'outcomes', label: 'Outcomes' },
  { id: 'modules', label: 'Modules' },
  { id: 'outputs', label: 'Work outputs' },
  { id: 'sources', label: 'Sources' },
] as const
const SECTION_IDS = SECTIONS.map((s) => s.id)

const PLURAL: Record<string, string> = { Quiz: 'Quizzes' }
const plural = (n: number, word: string) => (n === 1 ? `${n} ${word.toLowerCase()}` : `${n} ${(PLURAL[word] ?? word + 's').toLowerCase()}`)

export function CoursePage() {
  const { courseId } = useParams()
  const bundle = findCourse(courseId)
  useDocumentTitle(bundle?.course.title)
  if (!bundle) return <NotFound />
  return <CourseLanding key={bundle.course.id} bundle={bundle} />
}

function CourseLanding({ bundle }: { bundle: CourseBundle }) {
  const { course, lessons } = bundle
  const { course: getCp } = useLearner()
  const cp = getCp(course.id)
  const { hash } = useLocation()
  const stats = useMemo(() => courseStats(bundle), [bundle])

  const frac = courseFraction(bundle, cp)
  const nu = nextUp(bundle, cp)
  const complete = courseComplete(bundle, cp)
  const lessonIds = course.units.flatMap((u) => u.lessons)
  const lessonsDone = lessonIds.filter((lid) => lessonDone(lessons[lid], cp)).length
  const started = frac > 0
  const totalMinutes = lessonIds.reduce((m, lid) => m + lessons[lid].minutes, 0)

  /** "2.1" numbering for every lesson. */
  const numbering = useMemo(() => {
    const m: Record<string, string> = {}
    course.units.forEach((u, ui) => u.lessons.forEach((lid, li) => (m[lid] = `${ui + 1}.${li + 1}`)))
    return m
  }, [course.units])

  const base = `/c/${course.id}`
  const cta = nu
    ? { to: `${base}/l/${nu.lesson.id}/${nu.step.id}`, label: started ? 'Resume' : 'Begin the course', glyph: 'arrow' as GlyphName }
    : { to: `${base}/certificate`, label: 'View certificate', glyph: 'cert' as GlyphName }

  // Accordion: the module holding the next lesson starts open; a #unit-… link opens its module.
  const [openUnits, setOpenUnits] = useState<Set<string>>(() => {
    const s = new Set<string>()
    if (nu) s.add(nu.unit.id)
    if (hash.startsWith('#unit-')) s.add(hash.slice(6))
    return s
  })
  useEffect(() => {
    if (!hash.startsWith('#unit-')) return
    const id = hash.slice(6)
    setOpenUnits((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))
    // open first, then scroll once the module has expanded
    requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById(`unit-${id}`)?.scrollIntoView({ block: 'start', behavior: scrollBehavior() })))
  }, [hash])
  const allOpen = course.units.every((u) => openUnits.has(u.id))
  const onToggle = (id: string) => (e: SyntheticEvent<HTMLDetailsElement>) => {
    const isOpen = e.currentTarget.open
    setOpenUnits((prev) => {
      if (prev.has(id) === isOpen) return prev
      const n = new Set(prev)
      if (isOpen) n.add(id)
      else n.delete(id)
      return n
    })
  }

  const active = useScrollSpy(SECTION_IDS)

  return (
    <div className="course" style={{ ['--accent' as string]: course.theme.accent }}>
      <div className="page course-grid">
        {/* ── hero (tint band drawn full-bleed behind this cell) ── */}
        <header className="course-hero">
          <Breadcrumbs
            items={[
              { label: 'Home', to: '/' },
              { label: 'Courses', to: '/#catalog' },
              { label: course.title },
            ]}
          />
          <div className="course-partner">
            <span className="partner-mark partner-mark-lg" aria-hidden>
              M<span />
            </span>
            <span className="course-partner-name">Margin Originals</span>
            <Link to={`${base}/ledger`} className="badge badge-good course-badge" title="Every claim in this course is sourced — open the ledger">
              <Glyph name="shield" size={15} /> Fact-checked
            </Link>
          </div>
          <h1 className="display-l course-title">{course.title}</h1>
          <p className="lede course-subtitle">{course.subtitle}</p>
          <div className="course-cta">
            <Link to={cta.to} className="btn btn-large">
              {cta.label} <Glyph name={cta.glyph} className={cta.glyph === 'arrow' ? 'arrow' : undefined} size={16} />
            </Link>
            <Link to={`${base}/work`} className="btn btn-secondary btn-large">
              Your work
            </Link>
            <Link to={`${base}/ledger`} className="btn btn-quiet btn-large">
              Sources &amp; claims
            </Link>
          </div>
          {nu && started && (
            <p className="course-next small">
              Next up: <Link to={cta.to}>{`${numbering[nu.lesson.id]} ${nu.lesson.title}`}</Link>
            </p>
          )}
          {complete && (
            <p className="course-next small">
              <Glyph name="checkCircle" size={16} className="course-next-done" /> You've completed every lesson.
            </p>
          )}
          <p className="course-verified meta">
            <Glyph name="checkCircle" size={15} />
            <span>
              Last verified {fmtDate(course.lastVerified)} · {stats.claims} sourced claims
            </span>
          </p>
        </header>

        {/* ── side card (sticky on wide screens; a normal card after the hero otherwise) ── */}
        <aside className="course-side" aria-label="Course summary">
          <div className="card side-card">
            <div className="side-cover">
              <Cover kind={course.theme.cover} seed={course.id} accent={course.theme.accent} label={`${course.title} cover`} />
            </div>
            <div className="side-body">
              {started ? (
                <div className="side-progress">
                  <ProgressRing value={frac} size={60} stroke={5} label="Course progress" />
                  <div>
                    <p className="side-progress-head">
                      {lessonsDone} of {lessonIds.length} lessons complete
                    </p>
                    <p className="meta">{complete ? (cp.certificate ? 'Certificate issued' : 'Certificate ready to issue') : `${Math.round(frac * 100)}% of required steps done`}</p>
                  </div>
                </div>
              ) : (
                <div className="side-progress">
                  <span className="glyph-tile" aria-hidden>
                    <Glyph name="pace" size={24} />
                  </span>
                  <div>
                    <p className="side-progress-head">Self-paced · ≈ {course.hours} hours</p>
                    <p className="meta">Start any time. Your progress is saved as you go.</p>
                  </div>
                </div>
              )}
              {nu ? (
                <p className="side-next">
                  <span className="label">{started ? 'Next up' : 'First lesson'}</span>
                  <Link to={cta.to} className="side-next-link">
                    <span className="side-next-no">{numbering[nu.lesson.id]}</span> {nu.lesson.title}
                  </Link>
                </p>
              ) : null}
              <Link to={cta.to} className="btn btn-block side-cta">
                {cta.label} <Glyph name={cta.glyph} className={cta.glyph === 'arrow' ? 'arrow' : undefined} size={16} />
              </Link>
              <div className="side-includes">
                <h2 className="side-includes-head">This course includes</h2>
                <ul className="includes">
                  <Include glyph="reel">≈ {stats.videoMinutes} min of narrated video</Include>
                  <Include glyph="lab">{plural(stats.labs, 'Lab')} in your browser</Include>
                  <Include glyph="quiz">{plural(stats.quizzes, 'Quiz')}</Include>
                  <Include glyph="output">{plural(stats.outputs, 'Work output')}</Include>
                  <Include glyph="cert">Certificate of completion</Include>
                  <Include glyph="ledger">Every claim sourced ({stats.sources} sources)</Include>
                </ul>
              </div>
            </div>
          </div>
        </aside>

        <div className="course-main">
          {/* ── facts card ── */}
          <dl className="card course-facts">
            <Fact glyph="recap" value={plural(stats.modules, 'Module')} sub={`${stats.lessons} lessons`} />
            <Fact glyph="level" value={`${LEVEL_LABEL[course.level] ?? course.level} level`} sub={course.prerequisites.length ? <a href="#about">Recommended background</a> : 'No prior experience needed'} />
            <Fact glyph="clock" value={`≈ ${course.hours} hours`} sub="Self-paced, at your own speed" />
            <Fact glyph="shield" value={`${stats.claims} claims`} sub={`Checked against ${stats.sources} sources`} />
            <Fact glyph="cert" value="Certificate" sub="Verifiable credential ID" />
          </dl>

          {/* ── sticky in-page tabs ── */}
          <nav className="course-tabs" aria-label="Course sections">
            <div className="tabs">
              {SECTIONS.map((s) => (
                <a key={s.id} href={`#${s.id}`} className={`tab${active === s.id ? ' active' : ''}`} aria-current={active === s.id ? 'location' : undefined}>
                  {s.label}
                </a>
              ))}
            </div>
          </nav>

          {/* ── about ── */}
          <section id="about" className="course-section" aria-labelledby="about-h">
            <h2 id="about-h" className="t-h2">
              About this course
            </h2>
            <p className="course-summary">{course.summary}</p>
            {course.prerequisites.length > 0 && (
              <div className="course-prereq">
                <h3 className="t-h3">Before you start</h3>
                <ul>
                  {course.prerequisites.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* ── outcomes + skills ── */}
          <section id="outcomes" className="course-section" aria-labelledby="outcomes-h">
            <div className="learn-box">
              <h2 id="outcomes-h" className="t-h2">
                What you'll learn
              </h2>
              <ul className="learn-list">
                {course.outcomes.map((o, i) => (
                  <li key={i}>
                    <Glyph name="check" size={18} className="learn-tick" />
                    <span>{o}</span>
                  </li>
                ))}
              </ul>
            </div>
            {course.skills && course.skills.length > 0 && (
              <div className="skills">
                <h3 className="t-h3">Skills you'll gain</h3>
                <ul className="skill-list">
                  {course.skills.map((s) => (
                    <li key={s} className="skill">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {/* ── course content ── */}
          <section id="modules" className="course-section" aria-labelledby="modules-h">
            <div className="content-head">
              <div>
                <h2 id="modules-h" className="t-h2">
                  Course content
                </h2>
                <p className="meta content-meta">
                  {plural(stats.modules, 'Module')} • {stats.lessons} lessons • ≈ {fmtMinutes(totalMinutes)} total
                </p>
              </div>
              <button type="button" className="btn btn-quiet btn-small" onClick={() => setOpenUnits(allOpen ? new Set() : new Set(course.units.map((u) => u.id)))} aria-expanded={allOpen}>
                {allOpen ? 'Collapse all' : 'Expand all'}
              </button>
            </div>

            <div className="acc modules">
              {course.units.map((unit, ui) => {
                const unlockedU = unitUnlocked(bundle, ui, cp)
                const doneU = unitDone(bundle, ui, cp)
                const doneCount = unit.lessons.filter((lid) => lessonDone(lessons[lid], cp)).length
                const minutes = unit.lessons.reduce((m, lid) => m + lessons[lid].minutes, 0)
                const isNext = nu?.unitIndex === ui
                return (
                  <details key={unit.id} id={`unit-${unit.id}`} className={`acc-item module${doneU ? ' done' : ''}${unlockedU ? '' : ' locked'}${isNext ? ' next' : ''}`} open={openUnits.has(unit.id)} onToggle={onToggle(unit.id)}>
                    <summary className="acc-head module-head">
                      <span className="module-text">
                        <span className="module-eyebrow">Module {ui + 1}</span>
                        <span className="module-title">{unit.title}</span>
                        <span className="meta">
                          {unit.strand} • {plural(unit.lessons.length, 'Lesson')} • {fmtMinutes(minutes)}
                        </span>
                      </span>
                      <span className="module-status">
                        {doneU ? (
                          <span className="chip chip-good">
                            <Glyph name="check" size={14} /> Completed
                          </span>
                        ) : !unlockedU ? (
                          <span className="chip">
                            <Glyph name="lock" size={13} /> Locked
                          </span>
                        ) : (
                          <span className={`chip${isNext ? ' chip-accent' : ''}`}>
                            {doneCount} of {unit.lessons.length} done
                          </span>
                        )}
                      </span>
                      <Glyph name="chevron" size={20} className="acc-chevron" />
                    </summary>
                    <div className="module-body">
                      <p className="module-summary">{unit.summary}</p>
                      {!unlockedU && ui > 0 && <p className="module-lock-note meta">Finish module {ui} to unlock.</p>}
                      <ol className="lessons">
                        {unit.lessons.map((lid) => (
                          <LessonRow key={lid} lesson={lessons[lid]} no={numbering[lid]} to={`${base}/l/${lid}`} unlocked={lessonUnlocked(bundle, lid, cp)} isNext={nu?.lesson.id === lid} cp={cp} />
                        ))}
                      </ol>
                    </div>
                  </details>
                )
              })}
              <div className={`acc-item cert-row${complete ? ' ready' : ''}`}>
                <span className={`glyph-tile${complete ? ' glyph-tile-good' : ''}`} aria-hidden>
                  <Glyph name="cert" size={24} />
                </span>
                <span className="cert-row-text">
                  <span className="module-title">{complete ? 'Your certificate is ready' : 'Earn a certificate'}</span>
                  <span className="meta">
                    {complete
                      ? 'Every lesson is complete. Issue it with your name and a credential ID anyone can verify.'
                      : `Finish all ${stats.lessons} lessons to issue a certificate with a credential ID anyone can verify.`}
                  </span>
                </span>
                <Link to={`${base}/certificate`} className={`btn btn-small${complete ? '' : ' btn-secondary'}`}>
                  {complete ? 'View certificate' : 'Preview'}
                </Link>
              </div>
            </div>
          </section>

          {/* ── work outputs ── */}
          <section id="outputs" className="course-section" aria-labelledby="outputs-h">
            <div className="section-intro">
              <h2 id="outputs-h" className="t-h2">
                Work outputs
              </h2>
              <p className="soft">Things you make as you go. They collect on one page you can print or export.</p>
            </div>
            <div className="outputs-grid">
              {course.outputs.map((o) => {
                const status = outputStatus(bundle, cp, o.id)
                return (
                  <Link key={o.id} to={`${base}/work#${o.id}`} className={`card card-link output-card${o.capstone ? ' capstone' : ''}`}>
                    <span className="output-top">
                      <span className="glyph-tile output-tile" aria-hidden>
                        <Glyph name="output" size={22} />
                      </span>
                      {o.capstone && <span className="badge">Capstone</span>}
                    </span>
                    <span className="t-h3 output-title">{o.title}</span>
                    <span className="small soft output-desc">{o.description}</span>
                    <span className="output-foot">
                      <span className={`chip${status.done ? ' chip-good' : status.started ? ' chip-accent' : ''}`}>
                        {status.done && <Glyph name="check" size={13} />}
                        {status.label}
                      </span>
                      <span className="output-open">
                        Open <Glyph name="chevronRight" size={16} />
                      </span>
                    </span>
                  </Link>
                )
              })}
            </div>
          </section>

          {/* ── sources ── */}
          <section id="sources" className="course-section" aria-labelledby="sources-h">
            <div className="section-intro">
              <h2 id="sources-h" className="t-h2">
                How this course is fact-checked
              </h2>
              <p className="soft">
                Every factual claim in the videos, labs and quizzes is in the course ledger with its sources and the date it was checked. {stats.claims} claims, {stats.sources} sources, last verified {fmtDate(course.lastVerified)}.
              </p>
            </div>
            <StatusTiles counts={stats.byStatus} className="course-status-tiles" />
            <div className="sources-actions">
              <Link to={`${base}/ledger`} className="btn btn-secondary">
                <Glyph name="ledger" size={17} /> Browse the ledger
              </Link>
              <Link to="/method" className="btn btn-quiet">
                How we fact-check
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function Include({ glyph, children }: { glyph: GlyphName; children: ReactNode }) {
  return (
    <li>
      <Glyph name={glyph} size={18} />
      <span>{children}</span>
    </li>
  )
}

function Fact({ glyph, value, sub }: { glyph: GlyphName; value: string; sub: ReactNode }) {
  return (
    <div className="fact">
      <dt className="fact-value">
        <Glyph name={glyph} size={22} className="fact-glyph" />
        {value}
      </dt>
      <dd className="fact-sub">{sub}</dd>
    </div>
  )
}

function LessonRow({ lesson, no, to, unlocked, isNext, cp }: { lesson: Lesson; no: string; to: string; unlocked: boolean; isNext: boolean; cp: CourseProgress }) {
  const done = lessonDone(lesson, cp)
  const f = lessonFraction(lesson, cp)
  const kinds: Record<string, number> = {}
  for (const s of lesson.steps) kinds[s.type] = (kinds[s.type] ?? 0) + 1
  const state = done ? 'Review' : !unlocked ? 'Locked' : f > 0 ? 'Resume' : 'Start'
  const statusIcon = done ? (
    <Glyph name="checkCircle" size={22} title="Completed" />
  ) : !unlocked ? (
    <Glyph name="lock" size={18} title="Locked" />
  ) : isNext ? (
    <span className="lesson-play" title={f > 0 ? 'In progress' : 'Up next'}>
      <Glyph name="play" size={12} />
    </span>
  ) : (
    <Glyph name="circle" size={22} title="Not started" />
  )
  const inner = (
    <>
      <span className="lesson-status">{statusIcon}</span>
      <span className="lesson-body">
        <span className="lesson-title">
          <span className="lesson-no">{no}</span> {lesson.title}
        </span>
        <span className="lesson-sum">{lesson.summary}</span>
        <span className="lesson-types">
          {Object.entries(kinds).map(([k, n]) => (
            <span key={k} className="lesson-type">
              <Glyph name={STEP_GLYPH[k]} size={14} />
              {n > 1 ? `${n} ${STEP_LABEL[k]}${STEP_LABEL[k] === 'Quiz' ? 'zes' : 's'}` : STEP_LABEL[k]}
            </span>
          ))}
          <span className="lesson-min">
            <Glyph name="clock" size={14} />
            {lesson.minutes} min
          </span>
        </span>
      </span>
      <span className={`lesson-action${isNext ? ' is-next' : ''}`}>
        {state}
        {unlocked && <Glyph name="chevronRight" size={16} />}
      </span>
    </>
  )
  return (
    <li className={`lesson${done ? ' done' : ''}${unlocked ? '' : ' locked'}${isNext ? ' next' : ''}`}>
      {unlocked ? (
        <Link to={to} className="lesson-row" aria-label={`${no} ${lesson.title} — ${state}`}>
          {inner}
        </Link>
      ) : (
        <div className="lesson-row" aria-disabled="true">
          {inner}
        </div>
      )}
    </li>
  )
}

/** Status of a work output from its deliverable steps and drafted fields. */
function outputStatus(bundle: CourseBundle, cp: CourseProgress, outputId: string) {
  const parts = Object.values(bundle.lessons).flatMap((l) => l.steps.filter((s) => s.type === 'deliverable' && s.output === outputId))
  const done = parts.length > 0 && parts.every((s) => cp.steps[s.id])
  const drafted = Object.values(cp.outputs[outputId]?.fields ?? {}).filter((v) => (typeof v === 'string' ? v.trim() !== '' : v != null)).length
  if (done) return { done: true, started: true, label: 'Done' }
  if (drafted > 0) return { done: false, started: true, label: `${drafted} ${drafted === 1 ? 'part' : 'parts'} drafted` }
  return { done: false, started: false, label: 'Not started' }
}

/** Which in-page section is under the sticky tab bar. */
function useScrollSpy(ids: readonly string[]) {
  const [active, setActive] = useState<string>(ids[0])
  useEffect(() => {
    let raf = 0
    const run = () => {
      raf = 0
      const offset = (document.querySelector('.course-tabs')?.getBoundingClientRect().bottom ?? 120) + 24
      let cur = ids[0]
      for (const id of ids) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= offset) cur = id
      }
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4
      if (atBottom) cur = ids[ids.length - 1]
      setActive(cur)
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(run)
    }
    run()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [ids])
  return active
}
