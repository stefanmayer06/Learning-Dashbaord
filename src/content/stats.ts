/** Derived numbers about a course, shared by the catalogue and landing pages. */
import type { CourseBundle } from './schema'
import { buildTimeline } from '../engine/reel/timeline'

export function courseStats(b: CourseBundle) {
  const steps = Object.values(b.lessons).flatMap((l) => l.steps)
  const claims = Object.values(b.claims)
  return {
    modules: b.course.units.length,
    lessons: Object.keys(b.lessons).length,
    videos: steps.filter((s) => s.type === 'reel').length,
    videoMinutes: Math.round(steps.reduce((sec, s) => sec + (s.type === 'reel' ? buildTimeline(s.reel).total : 0), 0) / 60),
    labs: steps.filter((s) => s.type === 'widget' || s.type === 'embed').length,
    quizzes: steps.filter((s) => s.type === 'quiz').length,
    assignments: steps.filter((s) => s.type === 'deliverable').length,
    outputs: b.course.outputs.length,
    claims: claims.length,
    sources: Object.keys(b.sources).length,
    byStatus: {
      verified: claims.filter((c) => c.status === 'verified').length,
      derived: claims.filter((c) => c.status === 'derived').length,
      estimate: claims.filter((c) => c.status === 'estimate').length,
      contested: claims.filter((c) => c.status === 'contested').length,
    },
  }
}

export const LEVEL_LABEL: Record<string, string> = {
  intro: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

/** "2 Oct 2026" */
export const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

/** "18 min", "1 h 20 min", "6 h" */
export function fmtMinutes(min: number) {
  if (min < 60) return `${Math.round(min)} min`
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return m ? `${h} h ${m} min` : `${h} h`
}
