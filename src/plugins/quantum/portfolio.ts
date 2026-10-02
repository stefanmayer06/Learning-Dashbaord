/**
 * Portfolio selection as a QUBO, solved three ways:
 *   1. brute force (the ground truth for ≤ ~20 assets),
 *   2. simulated annealing (a classical heuristic),
 *   3. QAOA depth p, simulated exactly on a statevector.
 *
 * Objective (Markowitz 1952, binary selection with a budget, the textbook QUBO
 * form — see Lucas 2014, Brandhofer et al. 2023):
 *   minimise  q · xᵀΣx  −  μᵀx  +  λ (Σx − B)²      x ∈ {0,1}ⁿ
 */
import { State, mulberry32, rx } from './sim'

export interface Asset {
  ticker: string
  name: string
  mu: number // expected annual return
  vol: number // annual volatility
}

/**
 * ILLUSTRATIVE, SYNTHETIC data — round numbers chosen to make the trade-offs
 * visible. Not real market estimates and not investment advice.
 */
export const DEMO_ASSETS: Asset[] = [
  { ticker: 'GOVT', name: 'Gov. bond fund', mu: 0.03, vol: 0.05 },
  { ticker: 'CORP', name: 'Corp. bond fund', mu: 0.045, vol: 0.08 },
  { ticker: 'VALU', name: 'Value equities', mu: 0.07, vol: 0.16 },
  { ticker: 'GROW', name: 'Growth equities', mu: 0.09, vol: 0.22 },
  { ticker: 'EMKT', name: 'Emerging mkts', mu: 0.1, vol: 0.26 },
  { ticker: 'GOLD', name: 'Gold', mu: 0.04, vol: 0.15 },
]

/** Correlation matrix matching DEMO_ASSETS (synthetic, positive definite). */
export const DEMO_CORR: number[][] = [
  [1.0, 0.6, -0.1, -0.2, -0.1, 0.2],
  [0.6, 1.0, 0.2, 0.1, 0.2, 0.1],
  [-0.1, 0.2, 1.0, 0.7, 0.6, 0.0],
  [-0.2, 0.1, 0.7, 1.0, 0.7, -0.1],
  [-0.1, 0.2, 0.6, 0.7, 1.0, 0.1],
  [0.2, 0.1, 0.0, -0.1, 0.1, 1.0],
]

export function covariance(assets: Asset[], corr: number[][]) {
  return assets.map((a, i) => assets.map((b, j) => corr[i][j] * a.vol * b.vol))
}

export interface Problem {
  mu: number[]
  cov: number[][]
  q: number // risk aversion
  budget: number // number of assets to hold
  lambda: number // budget penalty
}

export function bitsOf(z: number, n: number): number[] {
  // q0 is the leftmost / most significant bit (matches State)
  return Array.from({ length: n }, (_, k) => (z >> (n - 1 - k)) & 1)
}

export function risk(x: number[], cov: number[][]) {
  let s = 0
  for (let i = 0; i < x.length; i++) {
    if (!x[i]) continue
    for (let j = 0; j < x.length; j++) if (x[j]) s += cov[i][j]
  }
  return s
}

export function ret(x: number[], mu: number[]) {
  return x.reduce((s, xi, i) => s + xi * mu[i], 0)
}

export function cost(x: number[], p: Problem) {
  const k = x.reduce((a, b) => a + b, 0)
  return p.q * risk(x, p.cov) - ret(x, p.mu) + p.lambda * (k - p.budget) ** 2
}

/** The QUBO matrix Q (upper-triangular) and offset with xᵀQx + offset = cost(x). */
export function quboMatrix(p: Problem) {
  const n = p.mu.length
  const Q = Array.from({ length: n }, () => new Array<number>(n).fill(0))
  for (let i = 0; i < n; i++) {
    // x_i² = x_i, so diagonal terms absorb linear terms
    Q[i][i] = p.q * p.cov[i][i] - p.mu[i] + p.lambda * (1 - 2 * p.budget)
    for (let j = i + 1; j < n; j++) Q[i][j] = 2 * p.q * p.cov[i][j] + 2 * p.lambda
  }
  return { Q, offset: p.lambda * p.budget * p.budget }
}

export function allCosts(p: Problem) {
  const n = p.mu.length
  const out = new Float64Array(1 << n)
  for (let z = 0; z < out.length; z++) out[z] = cost(bitsOf(z, n), p)
  return out
}

export function bruteForce(p: Problem) {
  const costs = allCosts(p)
  let best = 0
  for (let z = 1; z < costs.length; z++) if (costs[z] < costs[best]) best = z
  return { best, cost: costs[best], costs }
}

export interface AnnealTrace {
  best: number
  bestCost: number
  trace: { step: number; cost: number; best: number; temp: number }[]
}

export function simulatedAnnealing(p: Problem, steps = 600, seed = 7): AnnealTrace {
  const n = p.mu.length
  const rng = mulberry32(seed)
  const x: number[] = Array.from({ length: n }, () => (rng() < 0.5 ? 1 : 0))
  let cur = cost(x, p)
  let bestX = [...x]
  let bestCost = cur
  const t0 = 0.5
  const t1 = 0.001
  const trace: AnnealTrace['trace'] = []
  for (let s = 0; s < steps; s++) {
    const temp = t0 * (t1 / t0) ** (s / (steps - 1))
    const i = Math.floor(rng() * n)
    x[i] ^= 1
    const next = cost(x, p)
    if (next <= cur || rng() < Math.exp(-(next - cur) / temp)) {
      cur = next
      if (cur < bestCost) {
        bestCost = cur
        bestX = [...x]
      }
    } else {
      x[i] ^= 1
    }
    if (s % 6 === 0 || s === steps - 1) trace.push({ step: s, cost: cur, best: bestCost, temp })
  }
  const best = bestX.reduce((z, b) => (z << 1) | b, 0)
  return { best, bestCost, trace }
}

/* ───────────── QAOA (Farhi, Goldstone, Gutmann 2014) ───────────── */

/**
 * Two flavours:
 *  - 'penalty': standard QAOA — start in |+⟩ⁿ, X mixer, budget enforced by
 *    the QUBO penalty. Usually spends its effort learning to be feasible.
 *  - 'xy': the Quantum Alternating Operator Ansatz (Hadfield et al. 2019) —
 *    start in an equal superposition of valid portfolios (a Dicke state) and
 *    mix with hops that swap one held asset for another (ring XY mixer), so
 *    the state never leaves the "exactly B assets" subspace.
 */
export type QaoaMode = 'penalty' | 'xy'

const popcount = (z: number) => {
  let c = 0
  while (z) {
    c += z & 1
    z >>= 1
  }
  return c
}

/** Costs rescaled to [0, 1] (over valid portfolios only, if `budget` given). */
export function normalise(costs: Float64Array, budget?: number) {
  let lo = Infinity
  let hi = -Infinity
  costs.forEach((v, z) => {
    if (budget !== undefined && popcount(z) !== budget) return
    if (v < lo) lo = v
    if (v > hi) hi = v
  })
  const span = hi - lo || 1
  return Float64Array.from(costs, (v) => (v - lo) / span)
}

function applyXyMixer(s: State, beta: number) {
  const n = s.n
  const c = Math.cos(beta)
  const si = Math.sin(beta)
  for (let q = 0; q < n; q++) {
    const a = s.mask(q)
    const b = s.mask((q + 1) % n)
    for (let z = 0; z < s.size; z++) {
      if (!(z & a) || z & b) continue
      const w = (z & ~a) | b // move the "held" bit from q to q+1
      const r1 = s.re[z]
      const i1 = s.im[z]
      const r2 = s.re[w]
      const i2 = s.im[w]
      // exp(−iβ(XX+YY)/2) on the {|10⟩, |01⟩} pair: [cos β, −i sin β; −i sin β, cos β]
      s.re[z] = c * r1 + si * i2
      s.im[z] = c * i1 - si * r2
      s.re[w] = c * r2 + si * i1
      s.im[w] = c * i2 - si * r1
    }
  }
}

/** |γ,β⟩ = Π_k U_mix(β_k) e^{−iγ_k C} |start⟩, simulated exactly. */
export function qaoaState(norm: Float64Array, gammas: number[], betas: number[], mode: QaoaMode = 'penalty', budget = 0) {
  const n = Math.log2(norm.length)
  const s = new State(n)
  if (mode === 'xy') {
    s.re.fill(0)
    const valid = [...Array(s.size).keys()].filter((z) => popcount(z) === budget)
    for (const z of valid) s.re[z] = 1 / Math.sqrt(valid.length)
  } else {
    for (let q = 0; q < n; q++) s.gate('H', q)
  }
  for (let k = 0; k < gammas.length; k++) {
    const g = gammas[k]
    s.phase((z) => g * norm[z])
    if (mode === 'xy') applyXyMixer(s, betas[k])
    else {
      const mix = rx(2 * betas[k])
      for (let q = 0; q < n; q++) s.apply(mix, q)
    }
  }
  return s
}

export function qaoaExpectation(norm: Float64Array, gammas: number[], betas: number[], mode: QaoaMode = 'penalty', budget = 0) {
  const p = qaoaState(norm, gammas, betas, mode, budget).probabilities()
  return p.reduce((acc, pz, z) => acc + pz * norm[z], 0)
}

export const betaRange = (mode: QaoaMode) => (mode === 'xy' ? Math.PI : Math.PI / 2)

export function qaoaLandscape(norm: Float64Array, res = 36, mode: QaoaMode = 'penalty', budget = 0) {
  const grid: number[][] = []
  let best = { gamma: 0, beta: 0, value: Infinity }
  for (let i = 0; i < res; i++) {
    const row: number[] = []
    const beta = betaRange(mode) * (i / (res - 1))
    for (let j = 0; j < res; j++) {
      const gamma = 2 * Math.PI * (j / (res - 1))
      const v = qaoaExpectation(norm, [gamma], [beta], mode, budget)
      row.push(v)
      if (v < best.value) best = { gamma, beta, value: v }
    }
    grid.push(row)
  }
  return { grid, best }
}

/** Nelder–Mead on the 2p QAOA angles. Small, dependency-free, good enough here. */
export function optimiseQaoa(norm: Float64Array, p: number, start: number[], iters = 250, mode: QaoaMode = 'penalty', budget = 0) {
  const f = (v: number[]) => qaoaExpectation(norm, v.slice(0, p), v.slice(p), mode, budget)
  const dim = 2 * p
  let simplex = [start, ...Array.from({ length: dim }, (_, i) => start.map((x, j) => (i === j ? x + 0.3 : x)))]
  let values = simplex.map(f)
  for (let it = 0; it < iters; it++) {
    const order = values.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0])
    simplex = order.map(([, i]) => simplex[i])
    values = order.map(([v]) => v)
    const centroid = new Array(dim).fill(0)
    for (let i = 0; i < dim; i++) for (let d = 0; d < dim; d++) centroid[d] += simplex[i][d] / dim
    const worst = simplex[dim]
    const refl = centroid.map((c, d) => c + (c - worst[d]))
    const fr = f(refl)
    if (fr < values[0]) {
      const exp = centroid.map((c, d) => c + 2 * (c - worst[d]))
      const fe = f(exp)
      ;[simplex[dim], values[dim]] = fe < fr ? [exp, fe] : [refl, fr]
    } else if (fr < values[dim - 1]) {
      simplex[dim] = refl
      values[dim] = fr
    } else {
      const con = centroid.map((c, d) => c + 0.5 * (worst[d] - c))
      const fc = f(con)
      if (fc < values[dim]) {
        simplex[dim] = con
        values[dim] = fc
      } else {
        simplex = simplex.map((v) => v.map((x, d) => simplex[0][d] + 0.5 * (x - simplex[0][d])))
        values = simplex.map(f)
      }
    }
  }
  const i = values.indexOf(Math.min(...values))
  return { angles: simplex[i], value: values[i] }
}
