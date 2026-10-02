/**
 * The content model. Every course on the platform is plain JSON validated
 * against these schemas, so a new subject never needs new app code unless it
 * wants a new kind of interactive (see src/plugins).
 *
 * Fact-checking is part of the model, not an afterthought:
 *   - `sources.json` is the bibliography (papers, official releases, docs).
 *   - `claims.json` is the ledger: every factual statement the course makes,
 *     the sources that back it and the date it was checked.
 *   - Content cites claims by id (`cite: ["hsbc-bond-trial"]`). The validator
 *     refuses to build if a citation, claim or source is missing.
 */
import { z } from 'zod'

const id = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'ids are lowercase-kebab-case')
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dates are YYYY-MM-DD')
const cite = z.array(id).default([])

/* ───────────────────────── Sources & claims ───────────────────────── */

export const SourceKind = z.enum([
  'paper', // peer-reviewed
  'preprint', // not (yet) peer-reviewed — flagged in the UI
  'official', // company / lab primary announcement
  'regulator',
  'standard',
  'docs',
  'book',
  'news', // secondary reporting; never the only support for a claim
  'dataset',
])

export const Source = z.object({
  id,
  kind: SourceKind,
  title: z.string(),
  authors: z.string().optional(),
  publisher: z.string().optional(),
  year: z.number().int(),
  url: z.string().url(),
  doi: z.string().optional(),
  arxiv: z.string().optional(),
  accessed: isoDate,
  note: z.string().optional(),
})

export const ClaimStatus = z.enum([
  'verified', // matches the primary source
  'contested', // primary source says it, credible parties dispute it
  'estimate', // a projection / resource estimate, not a measured fact
  'derived', // follows mathematically; sources show the derivation
])

export const Claim = z.object({
  id,
  text: z.string().min(10),
  status: ClaimStatus,
  sources: z.array(id).min(1),
  checkedOn: isoDate,
  note: z.string().optional(),
})

/* ───────────────────────── Reels (video) ───────────────────────── */

const shotBase = {
  /** Spoken by the narrator and shown as captions. */
  narration: z.string().min(1),
  /** Seconds. Defaults to a reading-speed estimate of the narration. */
  duration: z.number().positive().optional(),
  /** Starts a new chapter on the scrub bar. */
  chapter: z.string().optional(),
  cite,
}

const Emphasis = z.string() // **word** marks emphasis inside statements

export const Shot = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('title'),
    kicker: z.string().optional(),
    title: z.string(),
    subtitle: z.string().optional(),
    ...shotBase,
  }),
  z.object({
    kind: z.literal('statement'),
    text: Emphasis,
    footnote: z.string().optional(),
    ...shotBase,
  }),
  z.object({
    kind: z.literal('equation'),
    tex: z.array(z.string()).min(1),
    notes: z.array(z.string()).default([]),
    ...shotBase,
  }),
  z.object({
    kind: z.literal('bars'),
    labels: z.array(z.string()).min(1),
    frames: z
      .array(
        z.object({
          values: z.array(z.number()),
          caption: z.string().optional(),
          highlight: z.array(z.number().int()).default([]),
        }),
      )
      .min(1),
    signed: z.boolean().default(false),
    max: z.number().positive().optional(),
    unit: z.string().optional(),
    ...shotBase,
  }),
  z.object({
    kind: z.literal('chart'),
    xLabel: z.string(),
    yLabel: z.string(),
    logX: z.boolean().default(false),
    logY: z.boolean().default(false),
    series: z
      .array(
        z.object({
          name: z.string(),
          points: z.array(z.tuple([z.number(), z.number()])).min(2),
          tone: z.enum(['ink', 'accent', 'signal', 'muted']).default('ink'),
        }),
      )
      .min(1),
    annotations: z
      .array(z.object({ x: z.number(), y: z.number(), text: z.string() }))
      .default([]),
    ...shotBase,
  }),
  z.object({
    kind: z.literal('list'),
    heading: z.string().optional(),
    items: z.array(z.string()).min(1),
    ...shotBase,
  }),
  z.object({
    kind: z.literal('compare'),
    left: z.object({ heading: z.string(), items: z.array(z.string()) }),
    right: z.object({ heading: z.string(), items: z.array(z.string()) }),
    ...shotBase,
  }),
  z.object({
    kind: z.literal('timeline'),
    events: z
      .array(z.object({ year: z.string(), label: z.string(), detail: z.string().optional() }))
      .min(2),
    ...shotBase,
  }),
  z.object({
    kind: z.literal('stat'),
    value: z.number(),
    prefix: z.string().optional(),
    suffix: z.string().optional(),
    decimals: z.number().int().min(0).max(4).default(0),
    label: z.string(),
    context: z.string().optional(),
    ...shotBase,
  }),
  z.object({
    kind: z.literal('code'),
    language: z.string(),
    code: z.string(),
    /** 1-based line numbers highlighted one after another. */
    focus: z.array(z.array(z.number().int().positive())).default([]),
    ...shotBase,
  }),
  z.object({
    kind: z.literal('diagram'),
    nodes: z
      .array(
        z.object({
          id,
          label: z.string(),
          x: z.number().min(0).max(100),
          y: z.number().min(0).max(100),
          tone: z.enum(['ink', 'accent', 'signal', 'muted']).default('ink'),
        }),
      )
      .min(1),
    edges: z
      .array(z.object({ from: id, to: id, label: z.string().optional() }))
      .default([]),
    ...shotBase,
  }),
  z.object({
    kind: z.literal('quote'),
    text: z.string(),
    by: z.string(),
    ...shotBase,
  }),
  /**
   * Plugin shots: rendered by a component registered under `plugin`.
   * `props` is validated by the plugin itself (see src/plugins/registry.ts).
   */
  z.object({
    kind: z.literal('plugin'),
    plugin: z.string(),
    props: z.record(z.string(), z.unknown()).default({}),
    ...shotBase,
  }),
])

export const Reel = z.object({
  title: z.string(),
  shots: z.array(Shot).min(1),
})

/* ───────────────────────── Questions ───────────────────────── */

export const Question = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('single'),
    prompt: z.string(),
    options: z.array(z.string()).min(2),
    answer: z.number().int().min(0),
    explain: z.string(),
    cite,
  }),
  z.object({
    type: z.literal('multi'),
    prompt: z.string(),
    options: z.array(z.string()).min(2),
    answers: z.array(z.number().int().min(0)).min(1),
    explain: z.string(),
    cite,
  }),
  z.object({
    type: z.literal('numeric'),
    prompt: z.string(),
    answer: z.number(),
    tolerance: z.number().nonnegative(),
    unit: z.string().optional(),
    explain: z.string(),
    cite,
  }),
  z.object({
    type: z.literal('order'),
    prompt: z.string(),
    /** Listed in the correct order; shuffled for the learner. */
    items: z.array(z.string()).min(2),
    explain: z.string(),
    cite,
  }),
])

/* ───────────────────────── Work outputs ───────────────────────── */

export const Field = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('text'),
    id,
    label: z.string(),
    hint: z.string().optional(),
    minWords: z.number().int().nonnegative().default(0),
    maxWords: z.number().int().positive().optional(),
  }),
  z.object({
    type: z.literal('choice'),
    id,
    label: z.string(),
    options: z.array(z.string()).min(2),
  }),
  z.object({
    type: z.literal('scale'),
    id,
    label: z.string(),
    min: z.number().int(),
    max: z.number().int(),
    minLabel: z.string(),
    maxLabel: z.string(),
  }),
  /** Pulls in a result the learner saved from an interactive lab. */
  z.object({
    type: z.literal('capture'),
    id,
    label: z.string(),
    from: z.string(), // capture key emitted by a widget
    hint: z.string().optional(),
  }),
])

export const Output = z.object({
  id,
  title: z.string(),
  kind: z.enum(['lab-notebook', 'brief', 'memo', 'model', 'portfolio', 'other']),
  description: z.string(),
  capstone: z.boolean().default(false),
})

/* ───────────────────────── Steps & lessons ───────────────────────── */

const stepBase = {
  id,
  title: z.string(),
  optional: z.boolean().default(false),
}

export const Step = z.discriminatedUnion('type', [
  z.object({ type: z.literal('reel'), reel: Reel, ...stepBase }),
  z.object({
    type: z.literal('widget'),
    widget: z.string(),
    brief: z.string(),
    props: z.record(z.string(), z.unknown()).default({}),
    cite,
    ...stepBase,
  }),
  z.object({
    type: z.literal('quiz'),
    passMark: z.number().min(0).max(1).default(0.7),
    questions: z.array(Question).min(1),
    ...stepBase,
  }),
  z.object({
    type: z.literal('embed'),
    provider: z.enum(['quirk', 'youtube', 'iframe']),
    src: z.string(),
    caption: z.string(),
    /** Who made it — external material is labelled as such. */
    credit: z.string(),
    cite,
    ...stepBase,
  }),
  z.object({
    type: z.literal('deliverable'),
    output: id,
    brief: z.string(),
    fields: z.array(Field).min(1),
    ...stepBase,
  }),
  z.object({
    type: z.literal('recap'),
    points: z.array(z.object({ text: z.string(), cite })).min(1),
    ...stepBase,
  }),
])

export const Lesson = z.object({
  $schema: z.string().optional(),
  id,
  title: z.string(),
  summary: z.string(),
  minutes: z.number().int().positive(),
  steps: z.array(Step).min(1),
})

export const Unit = z.object({
  id,
  title: z.string(),
  strand: z.string(), // e.g. "Theory", "Practice", "Landscape", "Capstone"
  summary: z.string(),
  lessons: z.array(id).min(1),
})

export const Course = z.object({
  $schema: z.string().optional(),
  id,
  title: z.string(),
  subtitle: z.string(),
  version: z.string(),
  lastVerified: isoDate,
  level: z.enum(['intro', 'intermediate', 'advanced']),
  hours: z.number().positive(),
  theme: z.object({
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    /** Name of a generative cover in src/ui/covers. */
    cover: z.string(),
  }),
  summary: z.string(),
  outcomes: z.array(z.string()).min(1),
  prerequisites: z.array(z.string()).default([]),
  /** Short skill names for "Skills you'll gain" (not factual claims). */
  skills: z.array(z.string()).optional(),
  progression: z.enum(['linear', 'open']).default('linear'),
  outputs: z.array(Output).min(1),
  units: z.array(Unit).min(1),
})

export type Source = z.infer<typeof Source>
export type Claim = z.infer<typeof Claim>
export type Shot = z.infer<typeof Shot>
export type Reel = z.infer<typeof Reel>
export type Question = z.infer<typeof Question>
export type Field = z.infer<typeof Field>
export type Output = z.infer<typeof Output>
export type Step = z.infer<typeof Step>
export type Lesson = z.infer<typeof Lesson>
export type Unit = z.infer<typeof Unit>
export type Course = z.infer<typeof Course>

/** A fully loaded, validated course with its ledger. */
export interface CourseBundle {
  course: Course
  lessons: Record<string, Lesson>
  sources: Record<string, Source>
  claims: Record<string, Claim>
}
