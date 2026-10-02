/**
 * node scripts/screenshot.mjs <url> <out.png> [width] [height] [fullPage 1|0] [actions]
 * Visual QA helper for authors (and Claude) — prints page errors, if any.
 * `actions` is an optional JSON list of {click: selector} / {wait: ms} / {press: key} steps.
 * MARGIN_SEED=path/to/state.json seeds learner progress (localStorage) before loading.
 */
import { chromium } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'

const [, , url, out, w = '1440', h = '900', full = '1', actions = '[]'] = process.argv
const executablePath = process.env.CHROMIUM_PATH ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined)
const browser = await chromium.launch({ executablePath })
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()))
if (process.env.MARGIN_SEED) {
  await page.goto(new URL(url).origin + '/')
  await page.evaluate((v) => localStorage.setItem('margin:learner:v1', v), readFileSync(process.env.MARGIN_SEED, 'utf8'))
}
await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
for (const a of JSON.parse(actions)) {
  if (a.click) await page.click(a.click)
  if (a.wait) await page.waitForTimeout(a.wait)
  if (a.press) await page.keyboard.press(a.press)
  if (a.eval) await page.evaluate(a.eval)
}
await page.screenshot({ path: out, fullPage: full === '1' })
console.log(errors.length ? errors.join('\n') : 'no errors')
await browser.close()
