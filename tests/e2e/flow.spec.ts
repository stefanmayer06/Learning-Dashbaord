import { expect, test } from '@playwright/test'
import { COURSE, collectErrors, completedState, seed } from './helpers'

test('a new learner finishes lesson 1 and unlocks unit 2', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.goto('/')

  await page.getByRole('link', { name: /Begin/ }).first().click()
  await expect(page).toHaveURL(new RegExp(`/c/${COURSE}/l/qt-two-meanings/qt1-reel`))

  // Continue is locked until the reel is watched
  await expect(page.getByTestId('continue')).toBeDisabled()
  await page.getByTestId('dev-complete').click()
  await page.getByTestId('continue').click()

  // Card sort: solve it for real
  await expect(page.locator('.step-title')).toHaveText('Research or red flag?')
  const answers: Record<string, string> = {
    'A bank reports': 'Documented research',
    'Our quantum AI bot': 'Red flag',
    'Researchers ran a certified': 'Documented research',
    'A famous billionaire': 'Red flag',
    'Your dashboard shows': 'Red flag',
    'A study estimates': 'Documented research',
  }
  for (const [start, bucket] of Object.entries(answers)) {
    await page.locator('.sort-card', { hasText: start }).click()
    await page.locator('.sort-bucket-head', { hasText: bucket }).click()
  }
  await page.getByRole('button', { name: /Check sort/ }).click()
  await expect(page.locator('.lab-goal.met')).toBeVisible()
  await page.getByTestId('continue').click()

  // Quiz: answer correctly
  await page.getByRole('radio', { name: /published trial/ }).click()
  await page.getByRole('button', { name: /Check answer/ }).click()
  await page.getByRole('button', { name: /Next question/ }).click()
  for (const opt of [/Celebrity endorsement/, /Pressure to deposit/, /Withdrawals blocked/]) await page.getByRole('checkbox', { name: opt }).click()
  await page.getByRole('button', { name: /Check answer/ }).click()
  await page.getByRole('button', { name: /Next question/ }).click()
  await page.getByRole('radio', { name: /red flag/ }).click()
  await page.getByRole('button', { name: /Check answer/ }).click()
  await page.getByRole('button', { name: /See result/ }).click()
  await expect(page.locator('.quiz-result.pass')).toBeVisible()

  await page.getByTestId('continue').click()
  await expect(page.locator('.stamp')).toContainText(/complete/i)

  // Unit 2 is now open on the syllabus; unit 3 is still locked
  await page.goto(`/c/${COURSE}`)
  await expect(page.locator('#unit-qubits .lesson').first()).not.toHaveClass(/locked/)
  await expect(page.locator('#unit-many-qubits .lesson').first()).toHaveClass(/locked/)

  // Progress survives a reload (local mode)
  await page.reload()
  await expect(page.locator('#unit-orientation .lesson.done')).toHaveCount(1)
  expect(errors).toEqual([])
})

test('locked lessons cannot be opened by URL', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.goto(`/c/${COURSE}/l/qt-banks`)
  await expect(page.getByText('Locked', { exact: true })).toBeVisible()
})

test('commission page turns answers into a Claude brief', async ({ page }) => {
  await page.goto('/commission')
  await page.getByPlaceholder('e.g. Options market making').fill('Volatility trading')
  await expect(page.locator('.commission-prompt')).toContainText('Subject: Volatility trading')
  await expect(page.locator('.commission-prompt')).toContainText('add-subject')
})

test('a lab result flows into the capstone work output', async ({ page }) => {
  // finish everything up to the pricing lab, then save a run
  await seed(page, completedState())
  await page.goto(`/c/${COURSE}/l/qt-pricing/qt8-race`)
  await page.getByRole('button', { name: /Simulate/ }).click()
  await page.getByRole('button', { name: /Sample one run/ }).click()
  await page.getByRole('button', { name: /Save to notebook/ }).click()
  await page.goto(`/c/${COURSE}/l/qt-brief/qt14-brief`)
  await expect(page.locator('.capture-card').first()).toContainText('BS $')
  await page.goto(`/c/${COURSE}/work`)
  await expect(page.locator('#readiness-brief')).toContainText('BS $')
})
