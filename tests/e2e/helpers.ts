import type { Page } from '@playwright/test'
import { readCourses } from '../../scripts/read-courses'
import { validateCourse } from '../../src/content/validate'

export const COURSE = 'quantum-trading-101'

export function bundle() {
  return validateCourse(readCourses(COURSE)[0], { today: '2026-10-02' }).bundle!
}

/** Learner state with every step of the course completed. */
export function completedState() {
  const b = bundle()
  const steps: Record<string, unknown> = {}
  for (const l of Object.values(b.lessons)) for (const s of l.steps) steps[s.id] = { status: 'done', updatedAt: '2026-10-02T00:00:00Z' }
  return {
    version: 1,
    name: 'Test Learner',
    prefs: { narration: false, captions: true, voiceURI: null, speechRate: 1, theme: 'light' },
    courses: { [COURSE]: { steps, captures: {}, outputs: {} } },
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
