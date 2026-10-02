import { describe, expect, it } from 'vitest'
import {
  courseComplete,
  courseFraction,
  credentialId,
  emptyCourse,
  emptyState,
  lessonUnlocked,
  mergeCourse,
  mergeState,
  nextUp,
  normaliseState,
  unitUnlocked,
  type CourseProgress,
} from '../../src/store/model'
import { validateCourse } from '../../src/content/validate'
import { readCourses } from '../../scripts/read-courses'

const raw = readCourses('quantum-trading-101')[0]
const bundle = validateCourse(raw, { today: '2026-10-02' }).bundle!
const allSteps = Object.values(bundle.lessons).flatMap((l) => l.steps)

function doneThrough(lessonIds: string[]): CourseProgress {
  const cp = emptyCourse()
  for (const lid of lessonIds) for (const s of bundle.lessons[lid].steps) cp.steps[s.id] = { status: 'done', updatedAt: '2026-10-02T00:00:00Z' }
  return cp
}

describe('progression', () => {
  it('starts with only the first lesson open', () => {
    const cp = emptyCourse()
    expect(lessonUnlocked(bundle, 'qt-two-meanings', cp)).toBe(true)
    expect(lessonUnlocked(bundle, 'qt-qubit', cp)).toBe(false)
    expect(unitUnlocked(bundle, 1, cp)).toBe(false)
    expect(nextUp(bundle, cp)?.step.id).toBe('qt1-reel')
  })

  it('opens the next unit when a unit is finished, lesson by lesson inside it', () => {
    const cp = doneThrough(['qt-two-meanings'])
    expect(unitUnlocked(bundle, 1, cp)).toBe(true)
    expect(lessonUnlocked(bundle, 'qt-qubit', cp)).toBe(true)
    expect(lessonUnlocked(bundle, 'qt-measurement', cp)).toBe(false)
  })

  it('optional steps are not required', () => {
    const optional = allSteps.filter((s) => s.optional).map((s) => s.id)
    expect(optional.length).toBeGreaterThan(0)
    const cp = doneThrough(Object.keys(bundle.lessons))
    for (const id of optional) delete cp.steps[id]
    expect(courseComplete(bundle, cp)).toBe(true)
    expect(courseFraction(bundle, cp)).toBe(1)
  })
})

describe('sync merging', () => {
  it('never loses a completion and keeps the newest output', () => {
    const a = emptyCourse()
    const b = emptyCourse()
    a.steps.x = { status: 'done', updatedAt: '2026-01-01T00:00:00Z' }
    b.steps.y = { status: 'done', updatedAt: '2026-01-02T00:00:00Z' }
    a.outputs.memo = { fields: { t: 'old' }, updatedAt: '2026-01-01T00:00:00Z' }
    b.outputs.memo = { fields: { t: 'new' }, updatedAt: '2026-02-01T00:00:00Z' }
    const m = mergeCourse(a, b)
    expect(Object.keys(m.steps).sort()).toEqual(['x', 'y'])
    expect(m.outputs.memo.fields.t).toBe('new')
  })

  it('local preferences win, remote name fills a blank', () => {
    const local = emptyState()
    local.prefs.narration = false
    const merged = mergeState(local, { name: 'Ada', prefs: { ...local.prefs, narration: true } })
    expect(merged.prefs.narration).toBe(false)
    expect(merged.name).toBe('Ada')
  })
})

describe('stored state', () => {
  it('keeps saved preferences and fills in missing fields', () => {
    const s = normaliseState({ version: 1, name: 'Ada', prefs: { theme: 'dark', narration: false } as never, courses: { x: { steps: {} } as never } })
    expect(s.prefs.theme).toBe('dark')
    expect(s.prefs.narration).toBe(false)
    expect(s.prefs.captions).toBe(true)
    expect(s.courses.x.captures).toEqual({})
  })
})

describe('credential ids', () => {
  it('match the database check constraint and are stable', () => {
    const id = credentialId('quantum-trading-101', 'Ada', '2026-10-02T10:00:00Z')
    expect(id).toMatch(/^MRG-[A-Z0-9]{1,6}-[A-Z0-9]{4}-[A-Z0-9]{4}$/)
    expect(id).toBe(credentialId('quantum-trading-101', 'Ada', '2026-10-02T10:00:00Z'))
    expect(id).not.toBe(credentialId('quantum-trading-101', 'Bob', '2026-10-02T10:00:00Z'))
    expect(id.startsWith('MRG-QT101-')).toBe(true)
  })
})
