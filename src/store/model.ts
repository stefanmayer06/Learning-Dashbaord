/**
 * Learner state and the pure rules over it (what is unlocked, what is done).
 * Kept free of React and storage so it can be unit-tested and shared by the
 * local and Supabase adapters.
 */
import type { CourseBundle, Lesson, Step } from '../content/schema'

export interface StepRecord {
  status: 'done'
  score?: number
  updatedAt: string
}

export interface Capture {
  key: string
  summary: string
  payload: unknown
  savedAt: string
}

export interface OutputRecord {
  fields: Record<string, unknown>
  updatedAt: string
}

export interface Certificate {
  id: string
  learnerName: string
  courseTitle: string
  courseVersion: string
  issuedAt: string
}

export interface CourseProgress {
  steps: Record<string, StepRecord>
  captures: Record<string, Capture>
  outputs: Record<string, OutputRecord>
  lastVisited?: { lessonId: string; stepId: string; at: string }
  certificate?: Certificate
}

export interface Prefs {
  narration: boolean
  captions: boolean
  voiceURI: string | null
  speechRate: number
  theme: 'system' | 'light' | 'dark'
}

export interface LearnerState {
  version: 1
  name: string
  prefs: Prefs
  courses: Record<string, CourseProgress>
}

export const DEFAULT_PREFS: Prefs = {
  narration: true,
  captions: true,
  voiceURI: null,
  speechRate: 1,
  theme: 'system',
}

export const emptyState = (): LearnerState => ({
  version: 1,
  name: '',
  prefs: { ...DEFAULT_PREFS },
  courses: {},
})

export const emptyCourse = (): CourseProgress => ({ steps: {}, captures: {}, outputs: {} })

/** Fill in anything missing from a stored/imported state without overriding what's there. */
export function normaliseState(s: Partial<LearnerState>): LearnerState {
  const courses: Record<string, CourseProgress> = {}
  for (const [id, cp] of Object.entries(s.courses ?? {})) courses[id] = { ...emptyCourse(), ...cp }
  return {
    version: 1,
    name: typeof s.name === 'string' ? s.name : '',
    prefs: { ...DEFAULT_PREFS, ...(s.prefs ?? {}) },
    courses,
  }
}

/* ───────────── derived progress ───────────── */

export function requiredSteps(lesson: Lesson): Step[] {
  return lesson.steps.filter((s) => !s.optional)
}

export function lessonDone(lesson: Lesson, cp: CourseProgress | undefined) {
  return requiredSteps(lesson).every((s) => cp?.steps[s.id])
}

export function lessonFraction(lesson: Lesson, cp: CourseProgress | undefined) {
  const req = requiredSteps(lesson)
  if (!req.length) return 1
  return req.filter((s) => cp?.steps[s.id]).length / req.length
}

export function unitDone(bundle: CourseBundle, unitIndex: number, cp: CourseProgress | undefined) {
  return bundle.course.units[unitIndex].lessons.every((lid) => lessonDone(bundle.lessons[lid], cp))
}

/** Linear progression: a unit opens when the previous one is complete. */
export function unitUnlocked(bundle: CourseBundle, unitIndex: number, cp: CourseProgress | undefined) {
  if (bundle.course.progression === 'open' || unitIndex === 0) return true
  return unitDone(bundle, unitIndex - 1, cp)
}

/** Within a unit, lessons open in order. */
export function lessonUnlocked(bundle: CourseBundle, lessonId: string, cp: CourseProgress | undefined) {
  const ui = bundle.course.units.findIndex((u) => u.lessons.includes(lessonId))
  if (ui < 0) return false
  if (!unitUnlocked(bundle, ui, cp)) return false
  if (bundle.course.progression === 'open') return true
  const lessons = bundle.course.units[ui].lessons
  const li = lessons.indexOf(lessonId)
  return lessons.slice(0, li).every((lid) => lessonDone(bundle.lessons[lid], cp))
}

export function orderedLessons(bundle: CourseBundle) {
  return bundle.course.units.flatMap((u, ui) => u.lessons.map((lid) => ({ unit: u, unitIndex: ui, lesson: bundle.lessons[lid] })))
}

export function courseFraction(bundle: CourseBundle, cp: CourseProgress | undefined) {
  const steps = orderedLessons(bundle).flatMap(({ lesson }) => requiredSteps(lesson))
  if (!steps.length) return 0
  return steps.filter((s) => cp?.steps[s.id]).length / steps.length
}

export function courseComplete(bundle: CourseBundle, cp: CourseProgress | undefined) {
  return orderedLessons(bundle).every(({ lesson }) => lessonDone(lesson, cp))
}

/** Where "Resume" should go: last visited if still sensible, else first unfinished step. */
export function nextUp(bundle: CourseBundle, cp: CourseProgress | undefined) {
  for (const { lesson, unit, unitIndex } of orderedLessons(bundle)) {
    const step = requiredSteps(lesson).find((s) => !cp?.steps[s.id])
    if (step) return { lesson, unit, unitIndex, step }
  }
  return null
}

/* ───────────── merging (for sync) ───────────── */

const newer = (a?: string, b?: string) => (a ?? '') >= (b ?? '')

function mergeRecord<T>(a: Record<string, T>, b: Record<string, T>, stamp: (v: T) => string): Record<string, T> {
  const out: Record<string, T> = { ...a }
  for (const [k, v] of Object.entries(b)) {
    if (!out[k] || !newer(stamp(out[k]), stamp(v))) out[k] = v
  }
  return out
}

/** Last-writer-wins per step / capture / output; never loses a completion. */
export function mergeCourse(a: CourseProgress, b: CourseProgress): CourseProgress {
  return {
    steps: mergeRecord(a.steps, b.steps, (v) => v.updatedAt),
    captures: mergeRecord(a.captures, b.captures, (v) => v.savedAt),
    outputs: mergeRecord(a.outputs, b.outputs, (v) => v.updatedAt),
    lastVisited: newer(a.lastVisited?.at, b.lastVisited?.at) ? a.lastVisited : b.lastVisited,
    certificate: a.certificate ?? b.certificate,
  }
}

export function mergeState(local: LearnerState, remote: Partial<LearnerState>): LearnerState {
  const courses: Record<string, CourseProgress> = { ...local.courses }
  for (const [id, cp] of Object.entries(remote.courses ?? {})) {
    courses[id] = courses[id] ? mergeCourse(courses[id], cp) : cp
  }
  return {
    ...local,
    name: local.name || remote.name || '',
    prefs: { ...DEFAULT_PREFS, ...remote.prefs, ...local.prefs },
    courses,
  }
}

/* ───────────── certificates ───────────── */

/** Short, human-checkable credential id, e.g. MRG-QT101-7F3K-29QD */
export function credentialId(courseId: string, name: string, issuedAt: string, salt = '') {
  const src = `${courseId}|${name}|${issuedAt}|${salt}`
  let h1 = 0x811c9dc5
  let h2 = 0x9e3779b9
  for (let i = 0; i < src.length; i++) {
    h1 = Math.imul(h1 ^ src.charCodeAt(i), 16777619)
    h2 = Math.imul(h2 ^ src.charCodeAt(i), 2246822519)
  }
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
  const enc = (n: number) =>
    Array.from({ length: 4 }, (_, i) => alphabet[(n >>> (i * 5)) & 31]).join('')
  const tag = courseId
    .split('-')
    .map((w) => (/^\d+$/.test(w) ? w : w[0]))
    .join('')
    .toUpperCase()
    .slice(0, 6)
  return `MRG-${tag}-${enc(h1 >>> 0)}-${enc(h2 >>> 0)}`
}
