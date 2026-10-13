/**
 * Pigment dating. A paint layer cannot be older than the newest material in it:
 * its terminus post quem (TPQ) is the latest "earliest availability" date among
 * the materials found. Pure functions, no React — tested in tests/unit/forgery.test.ts.
 */

export interface PigmentInfo {
  id: string
  name: string
  /**
   * Earliest year the material could be in a painting. Conservative: when a
   * source says "first quarter of the 19th century" we use 1800. `null` means
   * in use since antiquity, so it never constrains the dates we test.
   */
  earliest: number | null
  /** The date as the sources state it, e.g. "since about 1840". */
  when: string
  /** What XRF would see (elements), for the analysis table. */
  elements?: string
}

export interface PigmentFinding {
  pigment: string
  /** Where the sample or reading was taken, e.g. "sky", "signature". */
  where: string
  /** True when the area is a later retouching (it fluoresces dark in UV). */
  retouch?: boolean
}

export interface Tpq {
  /** Earliest possible date of the original paint, or null if nothing constrains it. */
  year: number | null
  /** The pigment that sets the date. */
  pigment: string | null
}

/**
 * The terminus post quem of the original paint. Retouchings are ignored by
 * default: a modern pigment in a restoration dates the restoration, not the picture.
 */
export function terminusPostQuem(
  found: PigmentFinding[],
  catalog: Record<string, PigmentInfo>,
  { ignoreRetouch = true }: { ignoreRetouch?: boolean } = {},
): Tpq {
  let best: Tpq = { year: null, pigment: null }
  for (const f of found) {
    if (ignoreRetouch && f.retouch) continue
    const info = catalog[f.pigment]
    if (!info) throw new Error(`unknown pigment "${f.pigment}"`)
    if (info.earliest === null) continue
    if (best.year === null || info.earliest > best.year) best = { year: info.earliest, pigment: info.id }
  }
  return best
}

export type PigmentVerdict = 'anachronism' | 'consistent'

/**
 * An anachronism disproves the claimed date. The absence of one proves nothing:
 * "consistent" is the strongest thing pigments alone can say.
 */
export function pigmentVerdict(claimedYear: number, tpq: Tpq): PigmentVerdict {
  return tpq.year !== null && tpq.year > claimedYear ? 'anachronism' : 'consistent'
}
