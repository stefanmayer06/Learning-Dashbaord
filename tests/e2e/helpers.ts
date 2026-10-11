import type { Page } from '@playwright/test'
import { readCourses } from '../../scripts/read-courses'
import { validateCourse } from '../../src/content/validate'

export const COURSE = 'quantum-trading-101'
/** Every shipped course, so page and step smoke tests cover new subjects automatically. */
export const COURSES = readCourses().map((c) => c.folder.split('/').pop()!)

export function bundle(course = COURSE) {
  const raw = readCourses(course)[0]
  return validateCourse(raw, { today: (raw.course as { lastVerified: string }).lastVerified }).bundle!
}

/** Learner state with every step of every course completed. */
export function completedState() {
  const courses: Record<string, unknown> = {}
  for (const id of COURSES) {
    const steps: Record<string, unknown> = {}
    for (const l of Object.values(bundle(id).lessons)) for (const s of l.steps) steps[s.id] = { status: 'done', updatedAt: '2026-10-02T00:00:00Z' }
    courses[id] = { steps, captures: {}, outputs: {} }
  }
  return {
    version: 1,
    name: 'Test Learner',
    prefs: { narration: false, captions: true, voiceURI: null, speechRate: 1, theme: 'light' },
    courses,
  }
}

export async function seed(page: Page, state: unknown) {
  await page.goto('/')
  await page.evaluate((s) => localStorage.setItem('margin:learner:v1', JSON.stringify(s)), state)
}

export function collectErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|algassert|youtube/i.test(m.text())) errors.push(m.text())
  })
  return errors
}
