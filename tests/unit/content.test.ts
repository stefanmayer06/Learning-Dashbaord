import { describe, expect, it } from 'vitest'
import { validateCourse, type RawCourseFiles } from '../../src/content/validate'
import { readCourses } from '../../scripts/read-courses'
import { buildTimeline, captionChunks } from '../../src/engine/reel/timeline'
import { speakable } from '../../src/ui/text'

describe('shipped courses', () => {
  const courses = readCourses()

  it('there is at least one course', () => {
    expect(courses.length).toBeGreaterThan(0)
  })

  for (const raw of courses) {
    it(`${raw.folder} passes strict validation (citations, ledger, numbers)`, () => {
      const { issues } = validateCourse(raw, { strict: true, today: '2026-10-02' })
      expect(issues.filter((i) => i.level === 'error')).toEqual([])
    })

    it(`${raw.folder}: every reel caption chunk fits on two lines`, () => {
      const { bundle } = validateCourse(raw, { today: '2026-10-02' })
      for (const lesson of Object.values(bundle!.lessons))
        for (const step of lesson.steps)
          if (step.type === 'reel')
            for (const shot of buildTimeline(step.reel).shots) {
              const text = speakable(shot.shot.narration)
              const chunks = captionChunks(text)
              expect(chunks.join('')).toBe(text)
              for (const c of chunks) expect(c.trim().length).toBeLessThanOrEqual(80)
            }
    })
  }
})

/** A minimal valid course we can break in specific ways. */
function fixture(): RawCourseFiles {
  return {
    folder: 'demo-course',
    course: {
      id: 'demo-course',
      title: 'Demo',
      subtitle: 'Demo',
      version: '1.0.0',
      lastVerified: '2026-01-01',
      level: 'intro',
      hours: 1,
      theme: { accent: '#123456', cover: 'tide' },
      summary: 'Demo',
      outcomes: ['Learn'],
      outputs: [{ id: 'memo', title: 'Memo', kind: 'memo', description: 'A memo', capstone: true }],
      units: [{ id: 'u1', title: 'Unit', strand: 'Theory', summary: 'S', lessons: ['l1'] }],
    },
    sources: [{ id: 's1', kind: 'paper', title: 'Paper', year: 2020, url: 'https://example.org/p', accessed: '2026-01-01' }],
    claims: [{ id: 'c1', text: 'A factual statement here.', status: 'verified', sources: ['s1'], checkedOn: '2026-01-01' }],
    lessons: {
      'l1.json': {
        id: 'l1',
        title: 'Lesson',
        summary: 'S',
        minutes: 5,
        steps: [
          { type: 'reel', id: 'r1', title: 'Reel', reel: { title: 'R', shots: [{ kind: 'statement', chapter: 'Intro', text: 'Hi', narration: 'In 2020 this happened.', cite: ['c1'] }] } },
          { type: 'widget', id: 'w1', title: 'Lab', widget: 'pricing-race', brief: 'B', props: { capture: 'run' } },
          { type: 'deliverable', id: 'd1', title: 'Memo', output: 'memo', brief: 'B', fields: [{ type: 'capture', id: 'f1', label: 'Run', from: 'run' }] },
        ],
      },
    },
  }
}

const errors = (raw: RawCourseFiles, strict = false) =>
  validateCourse(raw, { strict, today: '2026-02-01' }).issues.filter((i) => i.level === 'error').map((i) => i.message)

describe('validator rules', () => {
  it('accepts the fixture', () => {
    expect(errors(fixture(), true)).toEqual([])
  })

  it('rejects a citation to a claim that does not exist', () => {
    const raw = fixture()
    ;(raw.lessons['l1.json'] as any).steps[0].reel.shots[0].cite = ['nope']
    expect(errors(raw).join()).toMatch(/unknown claim "nope"/)
  })

  it('rejects a claim backed only by news coverage', () => {
    const raw = fixture()
    ;(raw.sources as any)[0].kind = 'news'
    expect(errors(raw).join()).toMatch(/only by news/)
  })

  it('requires contested claims to explain the dispute', () => {
    const raw = fixture()
    ;(raw.claims as any)[0].status = 'contested'
    expect(errors(raw).join()).toMatch(/explain the dispute/)
  })

  it('flags an uncited number in strict mode', () => {
    const raw = fixture()
    ;(raw.lessons['l1.json'] as any).steps[0].reel.shots[0].cite = []
    expect(errors(raw, false)).toEqual([])
    expect(errors(raw, true).join()).toMatch(/without a citation/)
  })

  it('flags stale claims in strict mode', () => {
    const raw = fixture()
    const { issues } = validateCourse(raw, { strict: true, today: '2027-06-01' })
    expect(issues.map((i) => i.message).join()).toMatch(/re-verify/)
  })

  it('rejects a capture field nobody produces', () => {
    const raw = fixture()
    ;(raw.lessons['l1.json'] as any).steps[2].fields[0].from = 'other'
    expect(errors(raw).join()).toMatch(/no widget emits/)
  })

  it('rejects duplicate step ids and unknown widgets', () => {
    const raw = fixture()
    const steps = (raw.lessons['l1.json'] as any).steps
    steps[1].id = 'r1'
    steps[1].widget = 'mystery'
    const msg = errors(raw).join()
    expect(msg).toMatch(/unique/)
    expect(msg).toMatch(/unknown widget/)
  })

  it('rejects a lastVerified date older than a claim check', () => {
    const raw = fixture()
    ;(raw.claims as any)[0].checkedOn = '2026-01-20'
    expect(errors(raw).join()).toMatch(/lastVerified/)
  })

  it('rejects bars frames whose values do not match the labels', () => {
    const raw = fixture()
    ;(raw.lessons['l1.json'] as any).steps[0].reel.shots.push({
      kind: 'bars',
      labels: ['a', 'b'],
      frames: [{ values: [1] }],
      narration: 'Bars.',
    })
    expect(errors(raw).join()).toMatch(/values for 2 labels/)
  })
})

describe('caption chunking', () => {
  it('splits long narration into subtitle-sized phrases without losing text', () => {
    const text =
      'A 2021 study by Goldman Sachs and IBM estimated that beating classical pricing on their benchmark derivatives would need about eight thousand logical qubits, a T-depth of fifty-four million, and the whole run done in about a second.'
    const chunks = captionChunks(text)
    expect(chunks.length).toBeGreaterThan(2)
    expect(chunks.join('')).toBe(text)
    chunks.forEach((c) => expect(c.trim().length).toBeLessThanOrEqual(70))
  })
})
