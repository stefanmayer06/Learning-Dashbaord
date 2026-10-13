/**
 * Provenance arithmetic: how much of a work's life is backed by documents, where
 * the gaps are, and whether a gap falls in the Nazi era (1933–1945), when
 * museums pay particular attention to where works were.
 */

export type LinkGrade = 'documented' | 'weak' | 'red'

export interface ProvenanceLink {
  id: string
  from: number
  to: number
  owner: string
  /** The evidence offered for this link, in plain words. */
  record: string
  /** The correct grade, used to check the learner's answer. */
  answer: LinkGrade
  why: string
  cite?: string[]
}

export const NAZI_ERA: [number, number] = [1933, 1945]

export interface ChainStats {
  /** Years covered by at least one documented link. */
  documentedYears: number
  totalYears: number
  /** Share of the period backed by documents, 0..1. */
  coverage: number
  /** Maximal runs of years with no documented link, as [from, to]. */
  gaps: [number, number][]
  longestGap: number
  /** True if any undocumented year falls in 1933–1945. */
  naziEraGap: boolean
}

/**
 * Coverage of [start, end) by links graded "documented". Years are counted as
 * whole calendar years: a link from 1850 to 1938 covers 1850…1937.
 */
export function chainStats(links: Pick<ProvenanceLink, 'from' | 'to'>[], grades: LinkGrade[], start: number, end: number): ChainStats {
  const totalYears = Math.max(0, end - start)
  const covered = new Array<boolean>(totalYears).fill(false)
  links.forEach((l, i) => {
    if (grades[i] !== 'documented') return
    for (let y = Math.max(l.from, start); y < Math.min(l.to, end); y++) covered[y - start] = true
  })
  const gaps: [number, number][] = []
  let run: number | null = null
  covered.forEach((c, i) => {
    if (!c && run === null) run = start + i
    if (c && run !== null) {
      gaps.push([run, start + i])
      run = null
    }
  })
  if (run !== null) gaps.push([run, end])
  const documentedYears = covered.filter(Boolean).length
  const naziEraGap = gaps.some(([a, b]) => a < NAZI_ERA[1] + 1 && b > NAZI_ERA[0])
  return {
    documentedYears,
    totalYears,
    coverage: totalYears ? documentedYears / totalYears : 0,
    gaps,
    longestGap: gaps.reduce((m, [a, b]) => Math.max(m, b - a), 0),
    naziEraGap,
  }
}
