import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { findCourse } from '../content/loader'
import type { CourseBundle, Lesson, Step } from '../content/schema'
import { fmtMinutes } from '../content/stats'
import { useLearner } from '../store/LearnerProvider'
import { courseComplete, courseFraction, lessonDone, lessonUnlocked, orderedLessons, unitDone, unitUnlocked, type CourseProgress } from '../store/model'
import { ReelPlayer } from '../engine/reel/ReelPlayer'
import { buildTimeline, fmtTime } from '../engine/reel/timeline'
import { WIDGET_COMPONENTS } from '../plugins/registry'
import { CiteMarks, CiteProvider, ClaimNote, lessonClaimIds, stepClaimIds, useCite } from '../ui/Cite'
import { Glyph, STEP_GLYPH, STEP_LABEL } from '../ui/Glyph'
import { ProgressRing } from '../ui/Progress'
import { ThemeToggle, Wordmark } from '../ui/Shell'
import { Rich } from '../ui/Tex'
import { QuizStep } from '../steps/QuizStep'
import { DeliverableStep, fieldComplete } from '../steps/DeliverableStep'
import { RecapStep } from '../steps/RecapStep'
import { EmbedStep } from '../steps/EmbedStep'
import { NotFound } from './NotFound'

const NARROW = '(max-width: 959px)'
const COLLAPSE_KEY = 'margin:outline-collapsed'

export function LessonPage() {
  const { courseId, lessonId, stepId } = useParams()
  const bundle = findCourse(courseId)
  const lesson = bundle?.lessons[lessonId ?? '']
  if (!bundle || !lesson) return <NotFound />
  return (
    <CiteProvider bundle={bundle} order={lessonClaimIds(lesson)} key={lesson.id}>
      <LessonInner bundle={bundle} lesson={lesson} stepId={stepId} />
    </CiteProvider>
  )
}

function useMedia(query: string) {
  const get = () => typeof matchMedia !== 'undefined' && matchMedia(query).matches
  const [match, setMatch] = useState(get)
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return
    const mq = matchMedia(query)
    const on = () => setMatch(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return match
}

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

/** Lesson number as learners see it: module.lesson, e.g. "2.1". */
function lessonNo(bundle: CourseBundle, lessonId: string) {
  const ui = bundle.course.units.findIndex((u) => u.lessons.includes(lessonId))
  return `${ui + 1}.${bundle.course.units[ui].lessons.indexOf(lessonId) + 1}`
}

function LessonInner({ bundle, lesson, stepId }: { bundle: CourseBundle; lesson: Lesson; stepId?: string }) {
  const nav = useNavigate()
  const learner = useLearner()
  const { course } = bundle
  const cp = learner.course(course.id)
  const unlocked = lessonUnlocked(bundle, lesson.id, cp)

  // furthest step the learner may open: everything up to the first unfinished required step
  const reachable = useMemo(() => {
    let k = 0
    for (; k < lesson.steps.length; k++) {
      const s = lesson.steps[k]
      if (!s.optional && !cp.steps[s.id]) break
    }
    return Math.min(k, lesson.steps.length - 1)
  }, [lesson, cp.steps])

  const requested = lesson.steps.findIndex((s) => s.id === stepId)
  const index = requested >= 0 && requested <= reachable ? requested : stepId ? reachable : Math.min(reachable, lesson.steps.length - 1)
  const step = lesson.steps[index]
  const [finished, setFinished] = useState(false)

  useEffect(() => {
    if (stepId !== step.id) nav(`/c/${course.id}/l/${lesson.id}/${step.id}`, { replace: true })
  }, [stepId, step.id, course.id, lesson.id, nav])

  useEffect(() => {
    if (unlocked) learner.visit(course.id, lesson.id, step.id)
    setFinished(false)
    window.scrollTo({ top: 0 })
  }, [step.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const complete = useCallback((score?: number) => learner.completeStep(course.id, step.id, score), [learner, course.id, step.id])
  const isDone = Boolean(cp.steps[step.id])
  const canContinue = isDone || step.optional

  const go = (k: number) => nav(`/c/${course.id}/l/${lesson.id}/${lesson.steps[k].id}`)
  const onContinue = () => {
    if (index < lesson.steps.length - 1) go(index + 1)
    else {
      setFinished(true)
      window.scrollTo({ top: 0 })
    }
  }

  let main: ReactNode
  if (!unlocked) {
    main = (
      <section className="player-empty">
        <span className="glyph-tile glyph-tile-muted" aria-hidden>
          <Glyph name="lock" size={24} />
        </span>
        <span className="badge badge-neutral">Locked</span>
        <h1 className="t-h1">{lesson.title}</h1>
        <p className="lede">Finish the earlier lessons first. This course builds step by step, and each lesson opens when the one before it is done.</p>
        <Link className="btn" to={`/c/${course.id}`}>
          Back to the course <Glyph name="arrow" className="arrow" size={16} />
        </Link>
      </section>
    )
  } else if (finished) {
    main = <LessonComplete bundle={bundle} lesson={lesson} cp={cp} />
  } else {
    main = (
      <>
        <header className="step-head">
          <p className="step-kicker">
            <Glyph name={STEP_GLYPH[step.type]} size={16} />
            <span>
              Step {index + 1} of {lesson.steps.length} · {STEP_LABEL[step.type]}
              {step.optional ? ' · Optional' : ''}
            </span>
          </p>
          <h1 className="t-h1 step-title">{step.title}</h1>
        </header>
        <StepView key={step.id} step={step} bundle={bundle} cp={cp} done={isDone} complete={complete} />
        <footer className="step-foot">
          <p className={`step-hint${isDone ? ' is-done' : ''}`}>
            <Glyph name={isDone ? 'checkCircle' : 'info'} size={18} />
            <span>{isDone ? 'Completed' : step.optional ? 'Optional. Continue whenever you like.' : hintFor(step)}</span>
            {import.meta.env.DEV && !isDone && (
              <button className="link-btn dev-complete" onClick={() => complete()} data-testid="dev-complete">
                Mark done (dev)
              </button>
            )}
          </p>
          <div className="step-actions">
            {index > 0 && (
              <button className="btn btn-ghost" onClick={() => go(index - 1)}>
                <Glyph name="chevronLeft" size={16} /> Previous
              </button>
            )}
            <button className="btn" onClick={onContinue} disabled={!canContinue} data-testid="continue">
              {index < lesson.steps.length - 1 ? 'Continue' : 'Finish lesson'} <Glyph name="arrow" className="arrow" size={16} />
            </button>
          </div>
        </footer>
        <LessonTabs bundle={bundle} lesson={lesson} step={step} />
      </>
    )
  }

  return (
    <PlayerLayout bundle={bundle} lesson={lesson} cp={cp} index={index} reachable={reachable} showSteps={unlocked} onStep={go}>
      {main}
    </PlayerLayout>
  )
}

/* ───────────── chrome: player bar + course outline ───────────── */

function PlayerLayout({
  bundle,
  lesson,
  cp,
  index,
  reachable,
  showSteps,
  onStep,
  children,
}: {
  bundle: CourseBundle
  lesson: Lesson
  cp: CourseProgress
  index: number
  reachable: number
  showSteps: boolean
  onStep: (k: number) => void
  children: ReactNode
}) {
  const { course } = bundle
  const narrow = useMedia(NARROW)
  const [drawer, setDrawer] = useState(false)
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const pct = courseFraction(bundle, cp)
  const step = lesson.steps[index]

  const closeDrawer = useCallback((restoreFocus = true) => {
    setDrawer(false)
    if (restoreFocus) requestAnimationFrame(() => toggleRef.current?.focus())
  }, [])

  const toggle = () => {
    if (narrow) {
      setDrawer((d) => !d)
      return
    }
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1')
      } catch {
        /* per-viewer convenience only */
      }
      return !c
    })
  }

  // the drawer closes when the learner moves on, or the screen grows past the breakpoint
  useEffect(() => setDrawer(false), [step.id, narrow])

  // drawer: focus moves in, Escape closes, the page behind does not scroll
  useEffect(() => {
    if (!drawer) return
    closeRef.current?.focus()
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && closeDrawer()
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [drawer, closeDrawer])

  const expanded = narrow ? drawer : !collapsed
  const cls = ['player', collapsed ? 'outline-collapsed' : '', drawer ? 'drawer-open' : ''].filter(Boolean).join(' ')

  return (
    <div className={cls} style={{ ['--accent' as string]: course.theme.accent }}>
      <header className="player-bar">
        <button
          ref={toggleRef}
          className="icon-btn player-toggle"
          onClick={toggle}
          aria-expanded={expanded}
          aria-controls="course-outline"
          aria-label={expanded ? 'Hide course content' : 'Show course content'}
          title={expanded ? 'Hide course content' : 'Show course content'}
        >
          <Glyph name="menu" size={20} />
        </button>
        <span className="player-brand">
          <Wordmark small />
        </span>
        <nav className="player-crumbs" aria-label="Breadcrumb">
          <Link to={`/c/${course.id}`} className="player-course">
            {course.title}
          </Link>
          <Glyph name="chevronRight" size={14} className="player-crumb-sep" />
          <span className="player-lesson" aria-current="page">
            {lessonNo(bundle, lesson.id)} {lesson.title}
          </span>
        </nav>
        <div className="player-tools">
          <span className="player-progress" title={`Your progress: ${Math.round(pct * 100)}% of the course`}>
            <ProgressRing value={pct} size={36} stroke={3.5} label="Your progress in this course" />
            <span className="player-progress-label">Your progress</span>
          </span>
          <Link to={`/c/${course.id}/work`} className="btn btn-quiet btn-small player-work">
            Your work
          </Link>
          <ThemeToggle />
          <Link to={`/c/${course.id}`} className="icon-btn" aria-label="Close the lesson and go back to the course" title="Back to the course">
            <Glyph name="cross" size={18} />
          </Link>
        </div>
      </header>

      <div className="player-body">
        <aside id="course-outline" className="outline" aria-label="Course content" aria-modal={narrow && drawer ? true : undefined} role={narrow ? 'dialog' : undefined}>
          <div className="outline-head">
            <h2 className="outline-title">Course content</h2>
            <button ref={closeRef} className="icon-btn outline-close" onClick={() => closeDrawer()} aria-label="Close course content">
              <Glyph name="cross" size={18} />
            </button>
          </div>
          <CourseOutline bundle={bundle} lesson={lesson} cp={cp} index={index} reachable={reachable} showSteps={showSteps} onStep={onStep} />
        </aside>
        {drawer && <div className="outline-backdrop" onClick={() => closeDrawer()} aria-hidden />}
        <div className="player-main">
          <div className="player-content">{children}</div>
        </div>
      </div>
    </div>
  )
}

function CourseOutline({
  bundle,
  lesson,
  cp,
  index,
  reachable,
  showSteps,
  onStep,
}: {
  bundle: CourseBundle
  lesson: Lesson
  cp: CourseProgress
  index: number
  reachable: number
  showSteps: boolean
  onStep: (k: number) => void
}) {
  const { course } = bundle
  const unitIndex = course.units.findIndex((u) => u.lessons.includes(lesson.id))
  const [open, setOpen] = useState(() => new Set([unitIndex]))
  const scrollRef = useRef<HTMLDivElement>(null)

  // bring the current lesson into view inside the outline (without scrolling the page)
  useEffect(() => {
    const box = scrollRef.current
    const cur = box?.querySelector<HTMLElement>('.ol-lesson.current')
    if (!box || !cur) return
    const top = cur.offsetTop - box.offsetTop
    if (top < box.scrollTop || top + 80 > box.scrollTop + box.clientHeight) box.scrollTop = Math.max(0, top - box.clientHeight / 4)
  }, [lesson.id])

  const reelLength = useMemo(() => {
    const out: Record<string, string> = {}
    for (const s of lesson.steps) if (s.type === 'reel') out[s.id] = fmtTime(buildTimeline(s.reel).total)
    return out
  }, [lesson])

  return (
    <div className="outline-scroll" ref={scrollRef}>
      {course.units.map((u, ui) => {
        const done = u.lessons.filter((lid) => lessonDone(bundle.lessons[lid], cp)).length
        const unitOpen = unitUnlocked(bundle, ui, cp)
        const complete = done === u.lessons.length
        return (
          <details
            key={u.id}
            className={`ol-module${ui === unitIndex ? ' current' : ''}`}
            open={open.has(ui)}
            onToggle={(e) => {
              const isOpen = e.currentTarget.open
              setOpen((s) => {
                if (s.has(ui) === isOpen) return s
                const n = new Set(s)
                if (isOpen) n.add(ui)
                else n.delete(ui)
                return n
              })
            }}
          >
            <summary className="ol-module-head">
              <span className="ol-module-text">
                <span className="ol-module-title">
                  Module {ui + 1} · {u.title}
                </span>
                <span className="ol-module-meta">
                  {complete ? <Glyph name="checkCircle" size={14} className="ol-ok" /> : !unitOpen ? <Glyph name="lock" size={13} /> : null}
                  {done}/{u.lessons.length} lessons
                  {!unitOpen && <span className="visually-hidden"> (locked)</span>}
                </span>
              </span>
              <Glyph name="chevron" size={18} className="acc-chevron" />
            </summary>
            <ol className="ol-lessons">
              {u.lessons.map((lid) => {
                const L = bundle.lessons[lid]
                const isCur = lid === lesson.id
                const isDone = lessonDone(L, cp)
                const isOpen = lessonUnlocked(bundle, lid, cp)
                const icon = isDone ? 'checkCircle' : isOpen ? 'circle' : 'lock'
                const body = (
                  <>
                    <span className="ol-status" aria-hidden>
                      <Glyph name={icon} size={18} />
                    </span>
                    <span className="ol-lesson-text">
                      <span className="ol-lesson-title">
                        {lessonNo(bundle, lid)} {L.title}
                        <span className="visually-hidden">{isDone ? ' (completed)' : !isOpen ? ' (locked)' : isCur ? ' (current lesson)' : ''}</span>
                      </span>
                      <span className="ol-lesson-meta">
                        {fmtMinutes(L.minutes)} · {L.steps.length} steps
                      </span>
                    </span>
                  </>
                )
                return (
                  <li key={lid}>
                    {isCur ? (
                      <div className={`ol-lesson current${isDone ? ' done' : ''}${isOpen ? '' : ' locked'}`} aria-current="page">
                        {body}
                      </div>
                    ) : isOpen ? (
                      <Link className={`ol-lesson${isDone ? ' done' : ''}`} to={`/c/${course.id}/l/${lid}`}>
                        {body}
                      </Link>
                    ) : (
                      <div className="ol-lesson locked" aria-disabled="true">
                        {body}
                      </div>
                    )}
                    {isCur && showSteps && (
                      <ol className="ol-steps" aria-label="Steps in this lesson">
                        {lesson.steps.map((s, k) => {
                          const d = Boolean(cp.steps[s.id])
                          const reach = k <= reachable
                          const now = k === index
                          return (
                            <li key={s.id}>
                              <button
                                className={`ol-step${now ? ' current' : ''}${d ? ' done' : ''}`}
                                disabled={!reach}
                                onClick={() => onStep(k)}
                                aria-current={now ? 'step' : undefined}
                              >
                                <Glyph name={STEP_GLYPH[s.type]} size={16} className="ol-step-type" />
                                <span className="ol-step-text">
                                  <span className="ol-step-kind">
                                    {STEP_LABEL[s.type]}
                                    {reelLength[s.id] ? ` · ${reelLength[s.id]}` : ''}
                                    {s.optional ? ' · Optional' : ''}
                                  </span>
                                  <span className="ol-step-title">{s.title}</span>
                                </span>
                                <span className="ol-step-status" aria-hidden>
                                  {d ? <Glyph name="check" size={15} /> : !reach ? <Glyph name="lock" size={14} /> : null}
                                </span>
                                <span className="visually-hidden">{d ? ' (completed)' : !reach ? ' (locked)' : ''}</span>
                              </button>
                            </li>
                          )
                        })}
                      </ol>
                    )}
                  </li>
                )
              })}
            </ol>
          </details>
        )
      })}
    </div>
  )
}

function hintFor(step: Step) {
  switch (step.type) {
    case 'reel':
      return 'Watch at least 85% of the video to continue.'
    case 'widget':
      return 'Meet the lab goal to continue.'
    case 'quiz':
      return `Pass the quiz (${Math.round(step.passMark * 100)}%) to continue.`
    case 'deliverable':
      return 'Complete every part of the assignment to continue.'
    case 'embed':
      return 'Explore the tool, then confirm to continue.'
    case 'recap':
      return 'Go through the cards to continue.'
  }
}

/* ───────────── tabs under the content ───────────── */

type TabId = 'sources' | 'about'

function LessonTabs({ bundle, lesson, step }: { bundle: CourseBundle; lesson: Lesson; step: Step }) {
  const [tab, setTab] = useState<TabId>('sources')
  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'sources', label: 'Sources', count: stepClaimIds(step).length },
    { id: 'about', label: 'About this lesson' },
  ]

  // a citation mark anywhere in the step opens the Sources tab and scrolls to its note
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!(e.target as Element | null)?.closest?.('.cite-mark')) return
      setTab('sources')
      requestAnimationFrame(() => requestAnimationFrame(() => document.querySelector('.lesson-notes .note.focused')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })))
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const k = tabs.findIndex((t) => t.id === tab)
    let n = -1
    if (e.key === 'ArrowRight') n = (k + 1) % tabs.length
    else if (e.key === 'ArrowLeft') n = (k - 1 + tabs.length) % tabs.length
    else if (e.key === 'Home') n = 0
    else if (e.key === 'End') n = tabs.length - 1
    if (n < 0) return
    e.preventDefault()
    setTab(tabs[n].id)
    document.getElementById(`lesson-tab-${tabs[n].id}`)?.focus()
  }

  return (
    <section className="lesson-tabs" aria-label="About this step">
      <div className="tabs" role="tablist" aria-label="Lesson details" onKeyDown={onKey}>
        {tabs.map((t) => (
          <button
            key={t.id}
            id={`lesson-tab-${t.id}`}
            className="tab"
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`lesson-panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.count !== undefined && <span className="tab-count">{t.count}</span>}
          </button>
        ))}
      </div>
      {/* both panels stay mounted so the live notes keep listening while the other tab is open */}
      <div className="tab-panel" role="tabpanel" id="lesson-panel-sources" aria-labelledby="lesson-tab-sources" hidden={tab !== 'sources'}>
        <MarginNotes step={step} courseId={bundle.course.id} />
      </div>
      <div className="tab-panel" role="tabpanel" id="lesson-panel-about" aria-labelledby="lesson-tab-about" hidden={tab !== 'about'}>
        <AboutLesson bundle={bundle} lesson={lesson} />
      </div>
    </section>
  )
}

/** Live notes: what's on screen right now first, then the rest of the step. */
function MarginNotes({ step, courseId }: { step: Step; courseId: string }) {
  const ctx = useCite()
  const [live, setLive] = useState<string[]>([])
  useEffect(() => {
    const handler = (e: Event) => setLive((e as CustomEvent<string[]>).detail)
    window.addEventListener('margin:cite', handler)
    return () => window.removeEventListener('margin:cite', handler)
  }, [])
  useEffect(() => setLive([]), [step.id])
  if (!ctx) return null
  const ids = stepClaimIds(step)
  const onScreen = live.filter((id) => ids.includes(id) && ctx.claims[id])
  const rest = ids.filter((i) => !onScreen.includes(i) && ctx.claims[i])
  return (
    <div className="lesson-notes">
      <div className="notes-intro">
        <Glyph name="shield" size={18} />
        <p>
          {ids.length
            ? `Every fact in this step is backed by the course ledger. ${step.type === 'reel' ? 'Notes for what is on screen move to the top as the video plays.' : 'The small numbers in the text point to these notes.'}`
            : 'This step is practice, so nothing here needs a citation.'}{' '}
          <Link to={`/c/${courseId}/ledger`}>Browse the full ledger</Link>
        </p>
      </div>
      {onScreen.length > 0 && (
        <div className="notes-group notes-live">
          <h3 className="notes-group-head">
            <span className="live-dot" aria-hidden /> On screen now
          </h3>
          <div className="notes-list">
            {onScreen.map((id) => (
              <ClaimNote key={id} claim={ctx.claims[id]} n={ctx.number(id)} sources={ctx.sources} live />
            ))}
          </div>
        </div>
      )}
      {rest.length > 0 && (
        <div className="notes-group">
          {onScreen.length > 0 && <h3 className="notes-group-head">Elsewhere in this step</h3>}
          <div className="notes-list">
            {rest.map((id) => (
              <ClaimNote key={id} claim={ctx.claims[id]} n={ctx.number(id)} sources={ctx.sources} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const SHORTCUTS: [string[], string][] = [
  [['Space', 'K'], 'Play or pause'],
  [['←', '→'], 'Back or forward 5 seconds'],
  [['C'], 'Captions on or off'],
  [['N'], 'Narration on or off'],
  [['F'], 'Full screen'],
  [['T'], 'Show the transcript'],
]

function AboutLesson({ bundle, lesson }: { bundle: CourseBundle; lesson: Lesson }) {
  const ui = bundle.course.units.findIndex((u) => u.lessons.includes(lesson.id))
  const unit = bundle.course.units[ui]
  const hasVideo = lesson.steps.some((s) => s.type === 'reel')
  return (
    <div className="about-lesson">
      <div className="about-main">
        <p className="meta">
          Module {ui + 1} · {unit.title}
        </p>
        <h3 className="t-h3">
          {lessonNo(bundle, lesson.id)} {lesson.title}
        </h3>
        <p className="about-summary">{lesson.summary}</p>
        <ul className="about-facts">
          <li>
            <Glyph name="clock" size={16} /> About {fmtMinutes(lesson.minutes)}
          </li>
          <li>
            <Glyph name="recap" size={16} /> {lesson.steps.length} steps
          </li>
          <li>
            <Glyph name="level" size={16} /> {unit.strand}
          </li>
        </ul>
        <h4 className="about-sub">What's in this lesson</h4>
        <ol className="about-steps">
          {lesson.steps.map((s) => (
            <li key={s.id}>
              <span className="about-step-icon" aria-hidden>
                <Glyph name={STEP_GLYPH[s.type]} size={16} />
              </span>
              <span>
                <span className="about-step-kind">{STEP_LABEL[s.type]}</span> {s.title}
                {s.optional && <span className="meta"> · Optional</span>}
              </span>
            </li>
          ))}
        </ol>
      </div>
      {hasVideo && (
        <aside className="about-keys" aria-label="Video keyboard shortcuts">
          <h4 className="about-sub">Video keyboard shortcuts</h4>
          <dl>
            {SHORTCUTS.map(([keys, what]) => (
              <div key={what} className="about-key">
                <dt>
                  {keys.map((k, i) => (
                    <span key={k}>
                      {i > 0 && <span className="about-key-or"> or </span>}
                      <kbd className="kbd">{k}</kbd>
                    </span>
                  ))}
                </dt>
                <dd>{what}</dd>
              </div>
            ))}
          </dl>
          <p className="meta">Click the video first so it has keyboard focus.</p>
        </aside>
      )}
    </div>
  )
}

/* ───────────── step renderers ───────────── */

function StepView({ step, bundle, cp, done, complete }: { step: Step; bundle: CourseBundle; cp: CourseProgress; done: boolean; complete: (score?: number) => void }) {
  const learner = useLearner()
  const ctx = useCite()
  const courseId = bundle.course.id
  const onCite = useCallback((ids: string[]) => window.dispatchEvent(new CustomEvent('margin:cite', { detail: ids })), [])
  const onProgress = useCallback((w: number) => w >= 0.85 && complete(), [complete])

  // deliverables complete themselves when every field is filled
  useEffect(() => {
    if (step.type !== 'deliverable' || done) return
    const vals = cp.outputs[step.output]?.fields ?? {}
    if (step.fields.every((f) => fieldComplete(f, vals[f.id], cp))) complete()
  }, [step, cp, done, complete])

  switch (step.type) {
    case 'reel':
      return <ReelPlayer reel={step.reel} accent={bundle.course.theme.accent} onCite={onCite} onProgress={onProgress} citeNumber={ctx?.number} />
    case 'widget': {
      const W = WIDGET_COMPONENTS[step.widget]
      if (!W) return <p>Unknown widget “{step.widget}”.</p>
      const key = typeof step.props.capture === 'string' ? step.props.capture : undefined
      return (
        <div className="widget-step">
          <p className="step-brief">
            <Rich text={step.brief} />
            <CiteMarks ids={step.cite} />
          </p>
          <W
            props={step.props}
            done={done}
            complete={complete}
            capture={key ? (summary, payload) => learner.saveCapture(courseId, key, summary, payload) : undefined}
            captured={key ? cp.captures[key] : undefined}
            Cite={CiteMarks}
            accent={bundle.course.theme.accent}
          />
        </div>
      )
    }
    case 'quiz':
      return <QuizStep step={step} done={done} onPass={complete} />
    case 'deliverable':
      return <DeliverableStep step={step} bundle={bundle} cp={cp} onField={(fid, v) => learner.saveOutputField(courseId, step.output, fid, v)} />
    case 'recap':
      return <RecapStep step={step} done={done} onDone={() => complete()} />
    case 'embed':
      return <EmbedStep step={step} done={done} onDone={() => complete()} />
  }
}

/* ───────────── lesson complete ───────────── */

function LessonComplete({ bundle, lesson, cp }: { bundle: CourseBundle; lesson: Lesson; cp: CourseProgress }) {
  const ordered = orderedLessons(bundle)
  const pos = ordered.findIndex((x) => x.lesson.id === lesson.id)
  const next = ordered[pos + 1]
  const { unitIndex } = ordered[pos]
  const unitFinished = unitDone(bundle, unitIndex, cp) && (!next || next.unitIndex !== unitIndex)
  const all = courseComplete(bundle, cp)
  const id = bundle.course.id
  const pct = Math.round(courseFraction(bundle, cp) * 100)
  return (
    <section className="lesson-done">
      <div className="lesson-done-card">
        <div className="stamp">
          <Glyph name="checkCircle" size={20} />
          <span>{all ? 'Course complete' : unitFinished ? 'Module complete' : 'Lesson complete'}</span>
        </div>
        <h1 className="t-h1">{lesson.title}</h1>
        <p className="lede">
          {all
            ? 'Every step is done. Your certificate is ready to issue.'
            : unitFinished
              ? `That's Module ${unitIndex + 1} done. You're ${pct}% of the way through the course.`
              : `Nice work. You're ${pct}% of the way through the course.`}
        </p>

        {all ? (
          <div className="next-card">
            <span className="glyph-tile glyph-tile-good" aria-hidden>
              <Glyph name="seal" size={24} />
            </span>
            <div className="next-card-text">
              <span className="meta">Up next</span>
              <span className="t-h3">Your certificate</span>
              <span className="meta">Issue it with your name, then print it or save it as a PDF.</span>
            </div>
          </div>
        ) : next ? (
          <Link className="next-card card-link" to={`/c/${id}/l/${next.lesson.id}`}>
            <span className="glyph-tile" aria-hidden>
              <Glyph name={STEP_GLYPH[next.lesson.steps[0].type]} size={24} />
            </span>
            <span className="next-card-text">
              <span className="meta">
                Next up{next.unitIndex !== unitIndex ? ` · Module ${next.unitIndex + 1}: ${next.unit.title}` : ''}
              </span>
              <span className="t-h3">
                {lessonNo(bundle, next.lesson.id)} {next.lesson.title}
              </span>
              <span className="meta">
                {fmtMinutes(next.lesson.minutes)} · {[...new Set(next.lesson.steps.map((s) => STEP_LABEL[s.type]))].join(' · ')}
              </span>
            </span>
            <Glyph name="chevronRight" size={20} className="next-card-go" />
          </Link>
        ) : null}

        <div className="btn-row lesson-done-actions">
          {all ? (
            <Link className="btn" to={`/c/${id}/certificate`}>
              Issue certificate <Glyph name="arrow" className="arrow" size={16} />
            </Link>
          ) : next ? (
            <Link className="btn" to={`/c/${id}/l/${next.lesson.id}`}>
              Next lesson <Glyph name="arrow" className="arrow" size={16} />
            </Link>
          ) : null}
          <Link className="btn btn-ghost" to={`/c/${id}/work`}>
            Your work
          </Link>
          <Link className="btn btn-quiet" to={`/c/${id}`}>
            Back to course
          </Link>
        </div>
      </div>
    </section>
  )
}
