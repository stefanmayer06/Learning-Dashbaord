import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { RawCourseFiles } from '../src/content/validate'

export const COURSES_DIR = join(import.meta.dirname, '..', 'content', 'courses')

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (e) {
    throw new Error(`${path}: ${(e as Error).message}`)
  }
}

export function readCourses(only?: string): RawCourseFiles[] {
  const out: RawCourseFiles[] = []
  for (const folder of readdirSync(COURSES_DIR)) {
    if (folder.startsWith('_') || folder.startsWith('.')) continue
    if (only && folder !== only) continue
    const dir = join(COURSES_DIR, folder)
    if (!statSync(dir).isDirectory()) continue
    const lessonsDir = join(dir, 'lessons')
    const lessons: Record<string, unknown> = {}
    if (existsSync(lessonsDir)) {
      for (const f of readdirSync(lessonsDir).filter((f) => f.endsWith('.json')).sort()) {
        lessons[f] = readJson(join(lessonsDir, f))
      }
    }
    out.push({
      folder,
      course: readJson(join(dir, 'course.json')),
      sources: existsSync(join(dir, 'sources.json')) ? readJson(join(dir, 'sources.json')) : [],
      claims: existsSync(join(dir, 'claims.json')) ? readJson(join(dir, 'claims.json')) : [],
      lessons,
    })
  }
  return out
}
