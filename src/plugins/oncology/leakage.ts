/**
 * Selection bias in omics classifiers (Ambroise & McLachlan 2002).
 *
 * The data are pure noise unless `signalGenes > 0`: n patients × p "genes", each
 * value standard normal, labels split 50/50. A nearest-centroid classifier on the
 * top-k genes by |t| is scored by k-fold cross-validation two ways:
 *   leaky   — genes chosen once, on ALL patients, then cross-validated
 *   proper  — genes re-chosen inside every training fold
 * On noise the honest answer is ~50%. The leaky protocol reports far more.
 */
import { mulberry32 } from '../quantum/sim'

export interface Dataset {
  n: number
  p: number
  x: Float64Array // row-major n × p
  y: Uint8Array
}

export function gaussian(rng: () => number) {
  // Box–Muller
  let u = 0
  while (u === 0) u = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng())
}

export function makeData(n: number, p: number, seed: number, signalGenes = 0, effect = 0): Dataset {
  const rng = mulberry32(seed)
  const y = new Uint8Array(n)
  const order = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  order.forEach((idx, r) => (y[idx] = r < n / 2 ? 1 : 0))
  const x = new Float64Array(n * p)
  for (let i = 0; i < n; i++)
    for (let g = 0; g < p; g++) x[i * p + g] = gaussian(rng) + (g < signalGenes && y[i] ? effect : 0)
  return { n, p, x, y }
}

/** |Welch t| for every gene, using only the listed rows. */
export function tStats(d: Dataset, rows: number[]) {
  const out = new Float64Array(d.p)
  for (let g = 0; g < d.p; g++) {
    let s1 = 0,
      s0 = 0,
      q1 = 0,
      q0 = 0,
      n1 = 0,
      n0 = 0
    for (const i of rows) {
      const v = d.x[i * d.p + g]
      if (d.y[i]) {
        s1 += v
        q1 += v * v
        n1++
      } else {
        s0 += v
        q0 += v * v
        n0++
      }
    }
    const m1 = s1 / n1
    const m0 = s0 / n0
    const v1 = (q1 - n1 * m1 * m1) / (n1 - 1)
    const v0 = (q0 - n0 * m0 * m0) / (n0 - 1)
    out[g] = Math.abs(m1 - m0) / Math.sqrt(v1 / n1 + v0 / n0 || 1e-12)
  }
  return out
}

export function topK(scores: Float64Array, k: number) {
  return Array.from(scores, (s, g) => [s, g] as const)
    .sort((a, b) => b[0] - a[0])
    .slice(0, k)
    .map(([, g]) => g)
}

/** Fraction of `test` rows classified correctly by a nearest-centroid rule on `genes`, fitted on `train`. */
export function nearestCentroid(d: Dataset, train: number[], test: number[], genes: number[]) {
  const c1 = new Float64Array(genes.length)
  const c0 = new Float64Array(genes.length)
  let n1 = 0,
    n0 = 0
  for (const i of train) {
    const c = d.y[i] ? c1 : c0
    d.y[i] ? n1++ : n0++
    genes.forEach((g, j) => (c[j] += d.x[i * d.p + g]))
  }
  for (let j = 0; j < genes.length; j++) {
    c1[j] /= n1 || 1
    c0[j] /= n0 || 1
  }
  let right = 0
  for (const i of test) {
    let a = 0,
      b = 0
    genes.forEach((g, j) => {
      const v = d.x[i * d.p + g]
      a += (v - c1[j]) ** 2
      b += (v - c0[j]) ** 2
    })
    if ((a < b ? 1 : 0) === d.y[i]) right++
  }
  return right
}

/** Stratified fold assignment (each fold gets a share of both classes). */
export function folds(d: Dataset, k: number, seed: number) {
  const rng = mulberry32(seed)
  const byClass = [0, 1].map((c) => {
    const rows = Array.from({ length: d.n }, (_, i) => i).filter((i) => d.y[i] === c)
    for (let i = rows.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[rows[i], rows[j]] = [rows[j], rows[i]]
    }
    return rows
  })
  const out: number[][] = Array.from({ length: k }, () => [])
  byClass.flat().forEach((row, r) => out[r % k].push(row))
  return out
}

export function crossValidate(d: Dataset, k: number, nFolds: number, mode: 'leaky' | 'proper', seed: number) {
  const all = Array.from({ length: d.n }, (_, i) => i)
  const fixed = mode === 'leaky' ? topK(tStats(d, all), k) : null
  let right = 0
  for (const test of folds(d, nFolds, seed)) {
    const train = all.filter((i) => !test.includes(i))
    const genes = fixed ?? topK(tStats(d, train), k)
    right += nearestCentroid(d, train, test, genes)
  }
  return right / d.n
}

export interface LeakageRun {
  leaky: number[]
  proper: number[]
}

/** Repeat the experiment on `reps` fresh datasets. */
export function experiment(o: { n: number; p: number; k: number; folds: number; reps: number; seed: number; signalGenes?: number; effect?: number }): LeakageRun {
  const leaky: number[] = []
  const proper: number[] = []
  for (let r = 0; r < o.reps; r++) {
    const d = makeData(o.n, o.p, o.seed * 1009 + r, o.signalGenes ?? 0, o.effect ?? 0)
    leaky.push(crossValidate(d, Math.min(o.k, o.p), o.folds, 'leaky', o.seed + r))
    proper.push(crossValidate(d, Math.min(o.k, o.p), o.folds, 'proper', o.seed + r))
  }
  return { leaky, proper }
}

export const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1)
