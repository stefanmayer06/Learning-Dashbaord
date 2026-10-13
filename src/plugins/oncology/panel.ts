/**
 * Biomarker-panel selection as a QUBO (mRMR-style: Peng et al. 2005; Mücke et
 * al. 2023): choose exactly k genes that are individually relevant to the
 * outcome but not redundant with each other.
 *
 *   minimise  α · Σ_{i<j} x_i x_j R_ij  −  Σ_i x_i r_i  +  λ (Σ x − k)²
 *
 * r_i = |correlation of gene i with response| and R_ij = |correlation between
 * genes i and j|, both measured on a training cohort. The same QUBO machinery as
 * the portfolio lab solves it (brute force, simulated annealing, QAOA).
 *
 * ALL DATA HERE ARE SYNTHETIC — generated below with a fixed seed so that the
 * lab is reproducible. They mimic a common situation (a strong marker with a
 * near-duplicate, weaker independent markers, noise) and are not real genes.
 */
import { mulberry32 } from '../quantum/sim'
import { gaussian } from './leakage'
import { cost, type Problem } from '../quantum/portfolio'

export const GENES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((l) => `Gene ${l}`)
export const NG = GENES.length

export interface Cohort {
  x: number[][] // patients × genes
  y: number[] // 1 = responder
}

/** Hidden structure (revealed in the lab): A strong; B ≈ copy of A; C, D moderate; E correlated with C; F, H noise; G correlated with A. */
export function cohort(n: number, seed: number): Cohort {
  const rng = mulberry32(seed)
  const x: number[][] = []
  const y: number[] = []
  for (let i = 0; i < n; i++) {
    const yi = i % 2
    const s = yi ? 1 : -1
    const z = Array.from({ length: NG }, () => gaussian(rng))
    const g = new Array<number>(NG)
    g[0] = 0.6 * s + z[0]
    g[1] = 0.95 * g[0] + 0.3 * z[1]
    g[2] = 0.45 * s + z[2]
    g[3] = 0.35 * s + z[3]
    g[4] = 0.7 * g[2] + 0.7 * z[4]
    g[5] = z[5]
    g[6] = 0.6 * g[0] + 0.8 * z[6]
    g[7] = z[7]
    x.push(g)
    y.push(yi)
  }
  return { x, y }
}

function corr(a: number[], b: number[]) {
  const n = a.length
  const ma = a.reduce((s, v) => s + v, 0) / n
  const mb = b.reduce((s, v) => s + v, 0) / n
  let sab = 0,
    saa = 0,
    sbb = 0
  for (let i = 0; i < n; i++) {
    sab += (a[i] - ma) * (b[i] - mb)
    saa += (a[i] - ma) ** 2
    sbb += (b[i] - mb) ** 2
  }
  return sab / Math.sqrt(saa * sbb)
}

export function scores(c: Cohort) {
  const col = (j: number) => c.x.map((r) => r[j])
  const relevance = GENES.map((_, j) => Math.abs(corr(col(j), c.y)))
  const redundancy = GENES.map((_, i) => GENES.map((__, j) => (i === j ? 0 : Math.abs(corr(col(i), col(j))))))
  return { relevance, redundancy }
}

/**
 * The QUBO in the portfolio module's form  q·xᵀΣx − μᵀx + λ(Σx − B)²  with
 * Σ = R/2 (so xᵀΣx counts each pair once), μ = r, q = α, B = k.
 */
export function panelProblem(relevance: number[], redundancy: number[][], alpha: number, k: number, lambda: number): Problem {
  return { mu: relevance, cov: redundancy.map((row) => row.map((v) => v / 2)), q: alpha, budget: k, lambda }
}

export const subsetOf = (z: number) => GENES.map((_, i) => i).filter((i) => (z >> (NG - 1 - i)) & 1)
export const maskOf = (genes: number[]) => genes.reduce((z, i) => z | (1 << (NG - 1 - i)), 0)
export const label = (genes: number[]) => genes.map((i) => GENES[i].replace('Gene ', '')).join(' + ') || '—'

export function greedyTopK(relevance: number[], k: number) {
  return relevance
    .map((r, i) => [r, i] as const)
    .sort((a, b) => b[0] - a[0])
    .slice(0, k)
    .map(([, i]) => i)
    .sort((a, b) => a - b)
}

/** Accuracy of a standardised nearest-centroid classifier on `genes`, fitted on `train`, scored on `test`. */
export function accuracy(train: Cohort, test: Cohort, genes: number[]) {
  if (!genes.length) return 0.5
  const stats = genes.map((j) => {
    const v = train.x.map((r) => r[j])
    const m = v.reduce((a, b) => a + b, 0) / v.length
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length) || 1
    const m1 = train.x.filter((_, i) => train.y[i] === 1).reduce((a, r) => a + r[j], 0) / train.y.filter((y) => y === 1).length
    const m0 = train.x.filter((_, i) => train.y[i] === 0).reduce((a, r) => a + r[j], 0) / train.y.filter((y) => y === 0).length
    return { j, sd, m1, m0 }
  })
  let right = 0
  test.x.forEach((r, i) => {
    let d1 = 0,
      d0 = 0
    for (const s of stats) {
      d1 += ((r[s.j] - s.m1) / s.sd) ** 2
      d0 += ((r[s.j] - s.m0) / s.sd) ** 2
    }
    if ((d1 < d0 ? 1 : 0) === test.y[i]) right++
  })
  return right / test.x.length
}

export const TRAIN = cohort(100, 11)
export const VALIDATION = cohort(4000, 12)

/**
 * Simulated annealing with swap moves: start from a random k-gene panel and
 * propose swapping one chosen gene for one unchosen gene, so every state has
 * exactly k genes — the classical twin of QAOA's XY mixer, and a fair baseline.
 */
export function swapAnnealing(p: Problem, steps = 300, seed = 7) {
  const n = p.mu.length
  const k = p.budget
  const rng = mulberry32(seed)
  const order = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  const x = new Array<number>(n).fill(0)
  order.slice(0, k).forEach((i) => (x[i] = 1))
  let cur = cost(x, p)
  let bestX = [...x]
  let bestCost = cur
  const t0 = 0.2
  const t1 = 0.002
  for (let s = 0; s < steps; s++) {
    const temp = t0 * (t1 / t0) ** (s / (steps - 1))
    const ins = x.map((v, i) => (v ? i : -1)).filter((i) => i >= 0)
    const outs = x.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0)
    const a = ins[Math.floor(rng() * ins.length)]
    const b = outs[Math.floor(rng() * outs.length)]
    x[a] = 0
    x[b] = 1
    const next = cost(x, p)
    if (next <= cur || rng() < Math.exp(-(next - cur) / temp)) {
      cur = next
      if (cur < bestCost) {
        bestCost = cur
        bestX = [...x]
      }
    } else {
      x[a] = 1
      x[b] = 0
    }
  }
  return { best: bestX.reduce((z, bit) => (z << 1) | bit, 0), bestCost }
}
