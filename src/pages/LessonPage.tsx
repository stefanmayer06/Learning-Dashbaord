import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { findCourse } from '../content/loader'
import type { CourseBundle, Lesson, Step } from '../content/schema'
import { useLearner } from '../store/LearnerProvider'
import { courseComplete, lessonUnlocked, orderedLessons, unitDone, type CourseProgress } from '../store/model'
import { ReelPlayer } from '../engine/reel/ReelPlayer'
import { WIDGET_COMPONENTS } from '../plugins/registry'
import { CiteMarks, CiteProvider, ClaimNote, lessonClaimIds, stepClaimIds, useCite } from '../ui/Cite'
import { Glyph, STEP_GLYPH, STEP_LABEL } from '../ui/Glyph'
import { Rich } from '../ui/Tex'
import { QuizStep } from '../steps/QuizStep'
import { DeliverableStep, fieldComplete } from '../steps/DeliverableStep'
import { RecapStep } from '../steps/RecapStep'
import { EmbedStep } from '../steps/EmbedStep'
import { NotFound } from './NotFound'

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

function LessonInner({ bundle, lesson, stepId }: { bundle: CourseBundle; lesson: Lesson; stepId?: string }) {
  const nav = useNavigate()
  const learner = useLearner()
  const { course } = bundle
  const cp = learner.course(course.id)
  const ordered = orderedLessons(bundle)
  const pos = ordered.findIndex((x) => x.lesson.id === lesson.id)
  const { unit, unitIndex } = ordered[pos]
  const lessonIndex = unit.lessons.indexOf(lesson.id)
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
    else setFinished(true)
  }

  if (!unlocked) {
    return (
      <div className="page locked-page">
        <p className="label">Locked</p>
        <h1 className="display display-m">{lesson.title}</h1>
        <p className="lede">Finish the earlier lessons first — this course builds step by step.</p>
        <Link className="btn" to={`/c/${course.id}`}>
          Back to the syllabus <Glyph name="arrow" className="arrow" size={14} />
        </Link>
      </div>
    )
  }

  return (
    <div className="lesson-shell" style={{ ['--accent' as string]: course.theme.accent }}>
      <header className="lesson-bar">
        <Link to={`/c/${course.id}`} className="lesson-back" aria-label="Back to syllabus">
          <Glyph name="back" size={16} />
        </Link>
        <div className="lesson-crumbs">
          <span className="label label-faint">
            {course.title} · Unit {String(unitIndex + 1).padStart(2, '0')} · {unit.strand}
          </span>
          <span className="lesson-bar-title">
            {unitIndex + 1}.{lessonIndex + 1} {lesson.title}
          </span>
        </div>
        <ol className="lesson-ticks" aria-label="Steps in this lesson">
          {lesson.steps.map((s, k) => (
            <li key={s.id} className={`${cp.steps[s.id] ? 'done' : ''} ${k === index ? 'now' : ''}`}>
              <span className="visually-hidden">
                Step {k + 1} {cp.steps[s.id] ? 'done' : ''}
              </span>
            </li>
          ))}
        </ol>
        <Link to="/" className="lesson-close label">
          Shelf
        </Link>
      </header>

      {finished ? (
        <LessonComplete bundle={bundle} lesson={lesson} cp={cp} />
      ) : (
        <div className="lesson-grid">
          <aside className="lesson-rail" aria-label="Lesson steps">
            <ol>
              {lesson.steps.map((s, k) => {
                const d = Boolean(cp.steps[s.id])
                const open = k <= reachable
                return (
                  <li key={s.id}>
                    <button className={`rail-step ${k === index ? 'now' : ''} ${d ? 'done' : ''}`} disabled={!open} onClick={() => go(k)}>
                      <span className="rail-n mono">{String(k + 1).padStart(2, '0')}</span>
                      <span className="rail-text">
                        <span className="label label-faint">
                          {STEP_LABEL[s.type]}
                          {s.optional ? ' · optional' : ''}
                        </span>
                        <span className="rail-title">{s.title}</span>
                      </span>
                      <span className="rail-mark">{d ? <Glyph name="check" size={13} /> : open ? <Glyph name={STEP_GLYPH[s.type]} size={14} /> : <Glyph name="lock" size={12} />}</span>
                    </button>
                  </li>
                )
              })}
            </ol>
            <p className="rail-meta label label-faint">≈ {lesson.minutes} min · {lesson.summary}</p>
          </aside>

          <section className="lesson-stage">
            <div className="step-head">
              <span className="label">
                Step {index + 1} of {lesson.steps.length} · {STEP_LABEL[step.type]}
              </span>
              <h1 className="display display-m step-title">{step.title}</h1>
            </div>
            <StepView key={step.id} step={step} bundle={bundle} cp={cp} done={isDone} complete={complete} />
            <footer className="step-foot">
              <span className="step-hint">{canContinue ? (isDone ? 'Done.' : 'Optional — continue whenever you like.') : hintFor(step)}</span>
              {import.meta.env.DEV && !isDone && (
                <button className="link-btn small faint" onClick={() => complete()} data-testid="dev-complete">
                  mark done (dev)
                </button>
              )}
              <button className="btn" onClick={onContinue} disabled={!canContinue} data-testid="continue">
                {index < lesson.steps.length - 1 ? 'Continue' : 'Finish lesson'} <Glyph name="arrow" className="arrow" size={14} />
              </button>
            </footer>
          </section>

          <MarginNotes step={step} />
        </div>
      )}
    </div>
  )
}

function hintFor(step: Step) {
  switch (step.type) {
    case 'reel':
      return 'Watch at least 85% of the reel to continue.'
    case 'widget':
      return 'Meet the lab goal to continue.'
    case 'quiz':
      return `Pass the check (${Math.round(step.passMark * 100)}%) to continue.`
    case 'deliverable':
      return 'Complete every part of the work output to continue.'
    case 'embed':
      return 'Explore the tool, then confirm.'
    case 'recap':
      return 'Go through the cards to continue.'
  }
}

/** The live margin: notes for what's on screen right now, then the rest of the step. */
function MarginNotes({ step }: { step: Step }) {
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
  const rest = ids.filter((i) => !live.includes(i))
  return (
    <aside className="lesson-notes" aria-label="Sources for this step">
      <div className="notes-head">
        <Glyph name="ledger" size={15} />
        <span className="label">Margin notes</span>
        <span className="label label-faint">{ids.length ? `${ids.length} sourced claim${ids.length === 1 ? '' : 's'}` : 'no factual claims'}</span>
      </div>
      {live.length > 0 && <div className="label notes-live-label">On screen now</div>}
      {live.map((id) => ctx.claims[id] && <ClaimNote key={id} claim={ctx.claims[id]} n={ctx.number(id)} sources={ctx.sources} live />)}
      {rest.length > 0 && live.length > 0 && <div className="label label-faint notes-live-label">Elsewhere in this step</div>}
      {rest.map((id) => ctx.claims[id] && <ClaimNote key={id} claim={ctx.claims[id]} n={ctx.number(id)} sources={ctx.sources} />)}
      {ids.length === 0 && <p className="small soft">This step is practice — nothing here needs a citation.</p>}
    </aside>
  )
}

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

function LessonComplete({ bundle, lesson, cp }: { bundle: CourseBundle; lesson: Lesson; cp: CourseProgress }) {
  const ordered = orderedLessons(bundle)
  const pos = ordered.findIndex((x) => x.lesson.id === lesson.id)
  const next = ordered[pos + 1]
  const { unitIndex } = ordered[pos]
  const unitFinished = unitDone(bundle, unitIndex, cp) && (!next || next.unitIndex !== unitIndex)
  const all = courseComplete(bundle, cp)
  const id = bundle.course.id
  return (
    <section className="lesson-done page">
      <div className="stamp" aria-hidden>
        <span>{all ? 'Course complete' : unitFinished ? 'Unit complete' : 'Lesson complete'}</span>
      </div>
      <h1 className="display display-l">{lesson.title}</h1>
      <p className="lede">{all ? 'Every step done. Your certificate is ready to issue.' : unitFinished ? `That's Unit ${unitIndex + 1} done.` : 'Logged. Keep the momentum.'}</p>
      <div className="course-hero-actions">
        {all ? (
          <Link className="btn btn-accent" to={`/c/${id}/certificate`}>
            Issue certificate <Glyph name="seal" size={14} />
          </Link>
        ) : next ? (
          <Link className="btn btn-accent" to={`/c/${id}/l/${next.lesson.id}`}>
            Next: {next.lesson.title} <Glyph name="arrow" className="arrow" size={14} />
          </Link>
        ) : null}
        <Link className="btn btn-ghost" to={`/c/${id}/work`}>
          Your work
        </Link>
        <Link className="btn btn-ghost" to={`/c/${id}`}>
          Syllabus
        </Link>
      </div>
    </section>
  )
}
