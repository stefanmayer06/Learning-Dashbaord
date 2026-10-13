/**
 * Dendrochronology of oak panels (after Peter Klein's method, NGV Art Journal 40).
 * The youngest heartwood ring on a panel is not the felling date: panel makers cut
 * the sapwood away, so the missing rings are added back from regional statistics,
 * then a seasoning time before the panel could be painted.
 */

export type WoodOrigin = 'baltic' | 'west' | 'poplar'

/** Sapwood ring counts for oak (Klein): Baltic (northern Poland) and western (Germany/Netherlands). */
export const SAPWOOD = {
  baltic: { min: 9, median: 15, max: 36 },
  west: { min: 7, median: 17, max: 50 },
} as const

export interface FellingEstimate {
  earliest: number
  median: number
  latest: number
}

/**
 * Felling dates from the youngest ring. If some sapwood survives on the panel
 * (`sapwoodPresent` rings), the youngest ring is itself sapwood, so fewer
 * rings are missing.
 */
export function fellingDates(lastRing: number, origin: 'baltic' | 'west', sapwoodPresent = 0): FellingEstimate {
  const s = SAPWOOD[origin]
  const add = (n: number) => lastRing + Math.max(0, n - sapwoodPresent)
  return { earliest: add(s.min), median: add(s.median), latest: add(s.max) }
}

/** Plausible earliest painting date: median felling plus seasoning. */
export function plausibleFrom(lastRing: number, origin: 'baltic' | 'west', seasoningYears: number, sapwoodPresent = 0) {
  return fellingDates(lastRing, origin, sapwoodPresent).median + seasoningYears
}

export type DendroVerdict = 'impossible' | 'tight' | 'consistent' | 'undatable'

/**
 * - impossible: the claimed date is before the earliest possible felling date
 * - tight: possible only if the tree had little sapwood and the wood was used almost at once
 * - consistent: at or after the plausible date (old wood is not proof of an old painting)
 * - undatable: poplar, the usual Italian panel wood, cannot be dated this way
 */
export function dendroVerdict(
  claimedYear: number,
  lastRing: number,
  origin: WoodOrigin,
  seasoningYears: number,
  sapwoodPresent = 0,
): DendroVerdict {
  if (origin === 'poplar') return 'undatable'
  const f = fellingDates(lastRing, origin, sapwoodPresent)
  if (claimedYear < f.earliest) return 'impossible'
  if (claimedYear < f.median + seasoningYears) return 'tight'
  return 'consistent'
}
