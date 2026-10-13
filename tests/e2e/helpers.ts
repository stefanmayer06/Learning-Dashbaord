import type { Page } from '@playwright/test'
import { readCourses } from '../../scripts/read-courses'
import { validateCourse } from '../../src/content/validate'

export const COURSE = 'quantum-trading-101'
/** Every shipped course, for tests that should cover them all. */
export const COURSES = readCourses().map((r) => r.folder)

export function bundle(course = COURSE) {
  const raw = readCourses(course)[0]
  return validateCourse(raw, { today: (raw.course as { lastVerified: string }).lastVerified }).bundle!
}

/** Learner state with every step of the given courses completed. */
export function completedState(courses: string[] = [COURSE]) {
  const progress: Record<string, unknown> = {}
  for (const course of courses) {
    const steps: Record<string, unknown> = {}
    for (const l of Object.values(bundle(course).lessons)) for (const s of l.steps) steps[s.id] = { status: 'done', updatedAt: '2026-10-02T00:00:00Z' }
    progress[course] = { steps, captures: {}, outputs: {} }
  }
  return {
    version: 1,
    name: 'Test Learner',
    prefs: { narration: false, captions: true, voiceURI: null, speechRate: 1, theme: 'light' },
    courses: progress,
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
