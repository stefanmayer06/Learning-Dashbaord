/**
 * Browser-side loader. Every folder in /content/courses becomes a course; the
 * files are bundled at build time, so the app works fully offline.
 */
import type { CourseBundle } from './schema'
import { validateCourse, type Issue, type RawCourseFiles } from './validate'

const files = import.meta.glob('/content/courses/*/**/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>

function group(): RawCourseFiles[] {
  const byFolder = new Map<string, RawCourseFiles>()
  for (const [path, data] of Object.entries(files)) {
    const m = path.match(/^\/content\/courses\/([^/]+)\/(.+)$/)
    if (!m) continue
    const [, folder, rest] = m
    if (folder.startsWith('_')) continue // templates
    const entry =
      byFolder.get(folder) ??
      ({ folder, course: undefined, sources: [], claims: [], lessons: {} } as RawCourseFiles)
    if (rest === 'course.json') entry.course = data
    else if (rest === 'sources.json') entry.sources = data
    else if (rest === 'claims.json') entry.claims = data
    else if (rest.startsWith('lessons/')) entry.lessons[rest.slice('lessons/'.length)] = data
    byFolder.set(folder, entry)
  }
  return [...byFolder.values()]
}

export interface Catalogue {
  courses: CourseBundle[]
  problems: { folder: string; issues: Issue[] }[]
}

let cache: Catalogue | null = null

export function loadCatalogue(): Catalogue {
  if (cache) return cache
  const courses: CourseBundle[] = []
  const problems: Catalogue['problems'] = []
  for (const raw of group()) {
    // Staleness is an authoring concern; the app never hides a course for it.
    const { bundle, issues } = validateCourse(raw, { staleAfterDays: 100_000 })
    const errors = issues.filter((i) => i.level === 'error')
    if (bundle) courses.push(bundle)
    if (errors.length) problems.push({ folder: raw.folder, issues: errors })
  }
  courses.sort((a, b) => a.course.title.localeCompare(b.course.title))
  cache = { courses, problems }
  return cache
}

export function findCourse(id: string | undefined): CourseBundle | undefined {
  return loadCatalogue().courses.find((c) => c.course.id === id)
}
