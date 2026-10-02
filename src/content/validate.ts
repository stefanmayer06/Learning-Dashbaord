/**
 * Turns raw JSON into a CourseBundle and enforces the fact-checking rules.
 * Shared by the browser loader and `npm run validate` so the two can never
 * disagree about what a valid course is.
 */
import { z } from 'zod'
import {
  Claim,
  Course,
  Lesson,
  Source,
  type CourseBundle,
  type Step,
} from './schema'
import { COVERS, IFRAME_ALLOWLIST, PLUGIN_SHOTS, WIDGETS } from '../plugins/manifest'

export interface Issue {
  level: 'error' | 'warning'
  where: string
  message: string
}

export interface RawCourseFiles {
  folder: string
  course: unknown
  sources: unknown
  claims: unknown
  lessons: Record<string, unknown> // keyed by file name
}

export interface ValidateOptions {
  /** Treat uncited numeric statements and stale claims as errors. */
  strict?: boolean
  /** Used for staleness checks; injectable for tests. */
  today?: string
  /** Claims older than this many days get flagged for re-verification. */
  staleAfterDays?: number
}

const NUMERIC_FACT =
  /\b(1[5-9]\d\d|20\d\d)\b|\d+(\.\d+)?\s?%|\b\d[\d,.]*\s?(thousand|million|billion|trillion|septillion|k\b)|\b\d{2,}[\d,.]*\s?(qubits|years|days|hours|minutes|seconds|gates|times)\b/i

function zodIssues(where: string, err: z.ZodError): Issue[] {
  return err.issues.map((i) => ({
    level: 'error' as const,
    where: `${where}${i.path.length ? ' › ' + i.path.join('.') : ''}`,
    message: i.message,
  }))
}

function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)
}

export function validateCourse(
  raw: RawCourseFiles,
  opts: ValidateOptions = {},
): { bundle?: CourseBundle; issues: Issue[] } {
  const issues: Issue[] = []
  const strict = !!opts.strict
  const today = opts.today ?? new Date().toISOString().slice(0, 10)
  const staleAfter = opts.staleAfterDays ?? 180
  const err = (where: string, message: string) => issues.push({ level: 'error', where, message })
  const warn = (where: string, message: string) =>
    issues.push({ level: strict ? 'error' : 'warning', where, message })
  const note = (where: string, message: string) => issues.push({ level: 'warning', where, message })

  const base = raw.folder

  /* ── parse ── */
  const courseP = Course.safeParse(raw.course)
  if (!courseP.success) issues.push(...zodIssues(`${base}/course.json`, courseP.error))

  const sourcesP = z.array(Source).safeParse(raw.sources)
  if (!sourcesP.success) issues.push(...zodIssues(`${base}/sources.json`, sourcesP.error))

  const claimsP = z.array(Claim).safeParse(raw.claims)
  if (!claimsP.success) issues.push(...zodIssues(`${base}/claims.json`, claimsP.error))

  const lessons: Record<string, z.infer<typeof Lesson>> = {}
  for (const [file, data] of Object.entries(raw.lessons)) {
    const p = Lesson.safeParse(data)
    if (!p.success) {
      issues.push(...zodIssues(`${base}/lessons/${file}`, p.error))
      continue
    }
    if (lessons[p.data.id]) err(`${base}/lessons/${file}`, `duplicate lesson id "${p.data.id}"`)
    lessons[p.data.id] = p.data
  }

  if (!courseP.success || !sourcesP.success || !claimsP.success) return { issues }

  const course = courseP.data
  const sources: Record<string, z.infer<typeof Source>> = {}
  for (const s of sourcesP.data) {
    if (sources[s.id]) err(`${base}/sources.json`, `duplicate source id "${s.id}"`)
    sources[s.id] = s
  }
  const claims: Record<string, z.infer<typeof Claim>> = {}
  for (const c of claimsP.data) {
    if (claims[c.id]) err(`${base}/claims.json`, `duplicate claim id "${c.id}"`)
    claims[c.id] = c
  }

  /* ── course-level ── */
  if (course.id !== base.split('/').pop()) {
    err(`${base}/course.json`, `course id "${course.id}" must match its folder name`)
  }
  if (!(COVERS as readonly string[]).includes(course.theme.cover)) {
    err(`${base}/course.json › theme.cover`, `unknown cover "${course.theme.cover}" (known: ${COVERS.join(', ')})`)
  }

  /* ── sources ── */
  for (const s of Object.values(sources)) {
    if (s.accessed > today) err(`sources › ${s.id}`, `accessed date ${s.accessed} is in the future`)
  }

  /* ── claims ── */
  const usedClaims = new Set<string>()
  let newestCheck = '0000-00-00'
  for (const c of Object.values(claims)) {
    const where = `claims › ${c.id}`
    const kinds = c.sources.map((sid) => sources[sid]?.kind)
    c.sources.forEach((sid) => {
      if (!sources[sid]) err(where, `cites unknown source "${sid}"`)
    })
    if (kinds.length && kinds.every((k) => k === 'news')) {
      err(where, 'is supported only by news coverage — add a primary source')
    }
    if (kinds.length && kinds.every((k) => k === 'preprint') && c.status === 'verified') {
      warn(where, 'rests only on preprints; mark it "contested" or "estimate", or add a peer-reviewed/official source')
    }
    if (c.status === 'contested' && !c.note) err(where, 'contested claims must explain the dispute in `note`')
    if (c.checkedOn > today) err(where, `checkedOn ${c.checkedOn} is in the future`)
    if (daysBetween(c.checkedOn, today) > staleAfter) {
      warn(where, `last checked ${c.checkedOn} — older than ${staleAfter} days, re-verify`)
    }
    if (c.checkedOn > newestCheck) newestCheck = c.checkedOn
  }
  if (newestCheck > course.lastVerified) {
    err(`${base}/course.json › lastVerified`, `lastVerified is ${course.lastVerified} but a claim was checked on ${newestCheck} — update lastVerified`)
  }

  const useCite = (where: string, ids: string[]) => {
    for (const cid of ids) {
      if (!claims[cid]) err(where, `cites unknown claim "${cid}"`)
      else usedClaims.add(cid)
    }
  }
  const checkText = (where: string, text: string, ids: string[]) => {
    if (ids.length === 0 && NUMERIC_FACT.test(text.replace(/\$[^$]*\$/g, ''))) {
      warn(where, `states a number/date without a citation: "${text.slice(0, 90)}${text.length > 90 ? '…' : ''}"`)
    }
  }

  /* ── units & lessons ── */
  const seenLessons = new Map<string, string>()
  const stepIds = new Set<string>()
  const captureKeys = new Map<string, string>()
  const captureRefs: { where: string; key: string }[] = []
  const outputsWithDeliverables = new Set<string>()
  const outputIds = new Set(course.outputs.map((o) => o.id))
  const unitIds = new Set<string>()

  for (const unit of course.units) {
    if (unitIds.has(unit.id)) err(`units › ${unit.id}`, 'duplicate unit id')
    unitIds.add(unit.id)
    for (const lid of unit.lessons) {
      if (!lessons[lid]) {
        err(`units › ${unit.id}`, `lists lesson "${lid}" but no lesson file has that id`)
        continue
      }
      if (seenLessons.has(lid)) err(`units › ${unit.id}`, `lesson "${lid}" is already in unit "${seenLessons.get(lid)}"`)
      seenLessons.set(lid, unit.id)
    }
  }
  for (const lid of Object.keys(lessons)) {
    if (!seenLessons.has(lid)) note(`lessons › ${lid}`, 'is not part of any unit and will not be shown')
  }

  for (const lesson of Object.values(lessons)) {
    for (const step of lesson.steps) {
      const where = `${lesson.id} › ${step.id}`
      if (stepIds.has(step.id)) err(where, 'step ids must be unique across the whole course')
      stepIds.add(step.id)
      checkStep(step, where)
    }
  }

  function checkStep(step: Step, where: string) {
    switch (step.type) {
      case 'reel': {
        step.reel.shots.forEach((shot, i) => {
          const w = `${where} › shot ${i + 1} (${shot.kind})`
          useCite(w, shot.cite)
          checkText(w, shot.narration, shot.cite)
          if (shot.kind === 'plugin' && !PLUGIN_SHOTS[shot.plugin]) {
            err(w, `unknown plugin shot "${shot.plugin}" (known: ${Object.keys(PLUGIN_SHOTS).join(', ')})`)
          }
          if (shot.kind === 'bars') {
            shot.frames.forEach((f, fi) => {
              if (f.values.length !== shot.labels.length) {
                err(w, `frame ${fi + 1} has ${f.values.length} values for ${shot.labels.length} labels`)
              }
            })
          }
          if (shot.kind === 'diagram') {
            const ids = new Set(shot.nodes.map((n) => n.id))
            shot.edges.forEach((e) => {
              if (!ids.has(e.from) || !ids.has(e.to)) err(w, `edge ${e.from}→${e.to} references a missing node`)
            })
          }
          if (shot.kind === 'code') {
            const lines = shot.code.split('\n').length
            shot.focus.flat().forEach((n) => {
              if (n > lines) err(w, `focus line ${n} is beyond the ${lines}-line snippet`)
            })
          }
        })
        if (step.reel.shots[0] && !step.reel.shots[0].chapter) {
          note(where, 'first shot has no chapter label')
        }
        break
      }
      case 'widget': {
        const info = WIDGETS[step.widget]
        if (!info) err(where, `unknown widget "${step.widget}" (known: ${Object.keys(WIDGETS).join(', ')})`)
        useCite(where, step.cite)
        const cap = step.props.capture
        if (cap !== undefined) {
          if (typeof cap !== 'string') err(where, '`props.capture` must be a string key')
          else if (info && !info.captures) err(where, `widget "${step.widget}" cannot capture results`)
          else if (captureKeys.has(cap)) err(where, `capture key "${cap}" is already used by ${captureKeys.get(cap)}`)
          else captureKeys.set(cap, where)
        }
        // Nested citations inside generic widget props
        const props = step.props as Record<string, unknown>
        const nested = [
          ...(Array.isArray(props.cards) ? props.cards : []),
          ...(Array.isArray(props.items) ? props.items : []),
        ] as { cite?: unknown }[]
        nested.forEach((c, i) => {
          if (Array.isArray(c?.cite)) useCite(`${where} › item ${i + 1}`, c.cite as string[])
        })
        if (Array.isArray(props.cite)) useCite(where, props.cite as string[])
        break
      }
      case 'quiz': {
        step.questions.forEach((q, i) => {
          const w = `${where} › question ${i + 1}`
          useCite(w, q.cite)
          checkText(w, q.explain, q.cite)
          if (q.type === 'single' && q.answer >= q.options.length) err(w, 'answer index is out of range')
          if (q.type === 'multi' && q.answers.some((a) => a >= q.options.length)) err(w, 'an answer index is out of range')
        })
        break
      }
      case 'embed': {
        useCite(where, step.cite)
        if (step.provider === 'youtube' && !/^[A-Za-z0-9_-]{11}$/.test(step.src)) {
          err(where, 'youtube embeds take the 11-character video id as `src`')
        }
        if (step.provider === 'quirk') {
          try {
            const c = JSON.parse(step.src)
            if (!Array.isArray(c.cols)) throw new Error()
          } catch {
            err(where, 'quirk embeds take a circuit JSON string like {"cols":[["H"]]}')
          }
        }
        if (step.provider === 'iframe') {
          try {
            const u = new URL(step.src)
            if (u.protocol !== 'https:') err(where, 'iframe embeds must use https')
            if (!IFRAME_ALLOWLIST.includes(u.hostname)) err(where, `iframe host ${u.hostname} is not in the allowlist`)
          } catch {
            err(where, 'iframe src is not a valid URL')
          }
        }
        break
      }
      case 'deliverable': {
        if (!outputIds.has(step.output)) err(where, `refers to unknown output "${step.output}"`)
        outputsWithDeliverables.add(step.output)
        const fids = new Set<string>()
        step.fields.forEach((f) => {
          if (fids.has(f.id)) err(where, `duplicate field id "${f.id}"`)
          fids.add(f.id)
          if (f.type === 'capture') captureRefs.push({ where: `${where} › ${f.id}`, key: f.from })
        })
        break
      }
      case 'recap': {
        step.points.forEach((p, i) => {
          const w = `${where} › point ${i + 1}`
          useCite(w, p.cite)
          checkText(w, p.text, p.cite)
        })
        break
      }
    }
  }

  for (const ref of captureRefs) {
    if (!captureKeys.has(ref.key)) err(ref.where, `captures "${ref.key}" but no widget emits that key`)
  }
  for (const o of course.outputs) {
    if (!outputsWithDeliverables.has(o.id)) err(`outputs › ${o.id}`, 'has no deliverable step that produces it')
  }
  if (!course.outputs.some((o) => o.capstone)) note(`${base}/course.json`, 'no capstone output defined')
  for (const cid of Object.keys(claims)) {
    if (!usedClaims.has(cid)) note(`claims › ${cid}`, 'is never cited by the course')
  }

  const hasErrors = issues.some((i) => i.level === 'error')
  return {
    bundle: hasErrors ? undefined : { course, lessons, sources, claims },
    issues,
  }
}
