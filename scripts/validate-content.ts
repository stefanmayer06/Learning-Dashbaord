/**
 * npm run validate            — schema + cross-reference + citation checks
 * npm run validate:strict     — also fails on uncited numbers and stale claims
 * npm run validate -- <id>    — one course only
 */
import { validateCourse } from '../src/content/validate'
import { readCourses } from './read-courses'

const args = process.argv.slice(2)
const strict = args.includes('--strict')
const only = args.find((a) => !a.startsWith('--'))

const courses = readCourses(only)
if (courses.length === 0) {
  console.error(only ? `No course folder named "${only}".` : 'No courses found in content/courses.')
  process.exit(1)
}

let failed = false
for (const raw of courses) {
  const { bundle, issues } = validateCourse(raw, { strict })
  const errors = issues.filter((i) => i.level === 'error')
  const warnings = issues.filter((i) => i.level === 'warning')
  const status = errors.length ? '✗' : '✓'
  console.log(`\n${status} ${raw.folder}`)
  if (bundle) {
    const steps = Object.values(bundle.lessons).flatMap((l) => l.steps)
    const shots = steps.flatMap((s) => (s.type === 'reel' ? s.reel.shots : []))
    console.log(
      `  ${bundle.course.units.length} units · ${Object.keys(bundle.lessons).length} lessons · ${steps.length} steps · ` +
        `${shots.length} reel shots · ${Object.keys(bundle.claims).length} claims · ${Object.keys(bundle.sources).length} sources`,
    )
  }
  for (const i of errors) console.log(`  error   ${i.where}\n          ${i.message}`)
  for (const i of warnings) console.log(`  warning ${i.where}\n          ${i.message}`)
  if (errors.length) failed = true
}
process.exit(failed ? 1 : 0)
