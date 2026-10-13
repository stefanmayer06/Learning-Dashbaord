import { expect, test } from '@playwright/test'
import { COURSES, bundle, collectErrors, completedState, seed } from './helpers'

test('every page of the site renders without errors', async ({ page }) => {
  const errors = collectErrors(page)
  await seed(page, completedState(COURSES))
  const coursePages = COURSES.flatMap((c) => [`/c/${c}`, `/c/${c}/ledger`, `/c/${c}/work`, `/c/${c}/certificate`])
  for (const path of ['/', ...coursePages, '/commission', '/settings', '/method', '/nope']) {
    await page.goto(path)
    await expect(page.locator('main')).toBeVisible()
  }
  expect(errors).toEqual([])
})

for (const course of COURSES) {
  test(`${course}: every step of every lesson renders without errors`, async ({ page }) => {
    test.setTimeout(480_000)
    const errors = collectErrors(page)
    await seed(page, completedState([course]))
    const b = bundle(course)
    for (const lesson of Object.values(b.lessons)) {
      for (const step of lesson.steps) {
        await page.goto(`/c/${course}/l/${lesson.id}/${step.id}`)
        await expect(page.locator('.step-title')).toHaveText(step.title)
        if (step.type === 'reel') {
          // play a few seconds of the reel, jumping through it
          await page.click('.reel-poster')
          for (let k = 0; k < 4; k++) {
            await page.keyboard.press('ArrowRight')
            await page.keyboard.press('ArrowRight')
            await page.keyboard.press('ArrowRight')
            await page.waitForTimeout(150)
          }
          await expect(page.locator('.reel-caption')).toBeVisible()
        }
        expect(errors, `${lesson.id}/${step.id}`).toEqual([])
      }
    }
  })
}
