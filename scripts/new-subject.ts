/**
 * npm run new:subject -- <course-id> "Course Title"
 * Copies content/courses/_template into a new course folder with ids filled in.
 * Then: research, replace the placeholders, and run `npm run validate:strict`.
 */
import { cpSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { COURSES_DIR } from './read-courses'

const [id, ...titleParts] = process.argv.slice(2)
const title = titleParts.join(' ').trim()
if (!id || !/^[a-z0-9][a-z0-9-]*$/.test(id) || !title) {
  console.error('Usage: npm run new:subject -- <course-id> "Course Title"   (id: lowercase-kebab-case)')
  process.exit(1)
}
const dest = join(COURSES_DIR, id)
if (existsSync(dest)) {
  console.error(`content/courses/${id} already exists.`)
  process.exit(1)
}
cpSync(join(COURSES_DIR, '_template'), dest, { recursive: true })
const today = new Date().toISOString().slice(0, 10)
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]))
for (const file of walk(dest)) {
  const text = readFileSync(file, 'utf8').replaceAll('__ID__', id).replaceAll('__TITLE__', title).replaceAll('__TODAY__', today)
  writeFileSync(file, text)
}
console.log(`Created content/courses/${id}. Next:
  1. Research the subject; fill sources.json and claims.json first.
  2. Plan units (theory → practice → landscape → capstone) in course.json.
  3. Write lessons in lessons/*.json — reels and labs first, short text.
  4. npm run validate:strict && npm run check-sources ${id} && npm test
See .claude/skills/add-subject/SKILL.md for the full protocol.`)
