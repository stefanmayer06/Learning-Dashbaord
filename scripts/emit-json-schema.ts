/**
 * npm run schema — writes JSON Schemas for content files to content/schema/,
 * generated from the zod model, so editors can autocomplete and lint courses.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { Claim, Course, Lesson, Source } from '../src/content/schema'

const out = join(import.meta.dirname, '..', 'content', 'schema')
mkdirSync(out, { recursive: true })

const schemas = {
  'course.schema.json': Course,
  'lesson.schema.json': Lesson,
  'sources.schema.json': z.array(Source),
  'claims.schema.json': z.array(Claim),
}

for (const [file, schema] of Object.entries(schemas)) {
  const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' })
  writeFileSync(join(out, file), JSON.stringify(json, null, 2) + '\n')
  console.log(`wrote content/schema/${file}`)
}
