import { expect, test } from '@playwright/test'
import { COURSE, collectErrors, completedState, seed } from './helpers'

test('header search filters the catalogue and offers to commission a missing topic', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/')
  await page.getByRole('searchbox', { name: 'Search courses' }).fill('bloch sphere')
  await page.keyboard.press('Enter')
  // lesson titles are searchable, so this finds the course
  await expect(page.getByRole('heading', { level: 1, name: /Results for “bloch sphere”/ })).toBeVisible()
  await expect(page.locator('.course-card')).toHaveCount(1)

  await page.getByRole('searchbox', { name: 'Search courses' }).fill('Volatility trading')
  await page.keyboard.press('Enter')
  await page.getByRole('link', { name: /Commission a course on “Volatility trading”/ }).click()
  await expect(page).toHaveURL(/\/commission\?topic=Volatility/)
  await expect(page.getByPlaceholder('e.g. Options market making')).toHaveValue('Volatility trading')
  await expect(page.locator('.commission-prompt')).toContainText('Subject: Volatility trading')
  expect(errors).toEqual([])
})

test('reviewing a finished lesson starts from its first step, and pages have their own titles', async ({ page }) => {
  await seed(page, completedState())
  await page.goto(`/c/${COURSE}`)
  await expect(page).toHaveTitle(/Quantum Trading 101 · Margin/)
  await page.goto(`/c/${COURSE}/l/qt-two-meanings`)
  await expect(page).toHaveURL(new RegExp(`/l/qt-two-meanings/qt1-reel$`))
  await expect(page).toHaveTitle(/One word, two worlds · 1\.1/)
  await page.goto(`/c/${COURSE}/ledger`)
  await expect(page).toHaveTitle(/Sources & claims/)
})

test('keyboard focus follows the learner from step to step', async ({ page }) => {
  await seed(page, completedState())
  await page.goto(`/c/${COURSE}/l/qt-two-meanings/qt1-reel`)
  await page.getByTestId('continue').focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.step-title')).toHaveText('Research or red flag?')
  await expect(page.locator('.step-title')).toBeFocused()
})

test('the outline drawer on a phone keeps focus inside and closes with Escape', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await seed(page, completedState())
  await page.goto(`/c/${COURSE}/l/qt-two-meanings/qt1-sort`)
  const toggle = page.getByRole('button', { name: 'Show course content' })
  await toggle.click()
  await expect(page.getByRole('button', { name: 'Close course content' })).toBeFocused()
  // the page behind is inert while the drawer is open
  await expect(page.locator('.player-main')).toHaveAttribute('inert', '')
  await page.keyboard.press('Escape')
  await expect(toggle).toBeFocused()
})
