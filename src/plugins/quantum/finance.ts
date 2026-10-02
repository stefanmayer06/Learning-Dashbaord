/**
 * Pricing maths used by the "pricing race" lab.
 *
 *  - Black–Scholes (1973) closed form for a European call: the reference price.
 *  - Classical Monte Carlo under geometric Brownian motion: error ∝ 1/√N.
 *  - Ideal canonical quantum amplitude estimation (Brassard, Høyer, Mosca,
 *    Tapp 2002) on a 2^n-point price grid, the construction used by
 *    Stamatopoulos et al. 2020. We compute the exact outcome distribution of
 *    the algorithm rather than simulating the circuit gate by gate; on a
 *    noiseless, fault-tolerant machine the two are identical.
 */
import { mulberry32 } from './sim'

/** erf via the Numerical Recipes Chebyshev fit to erfc (fractional error < 1.2e-7). */
export function erf(x: number) {
  const z = Math.abs(x)
  const t = 1 / (1 + 0.5 * z)
  const r =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t *
                  (0.09678418 +
                    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    )
  return x >= 0 ? 1 - r : r - 1
}

export const normCdf = (x: number) => 0.5 * (1 + erf(x / Math.SQRT2))

export interface CallParams {
  S0: number // spot
  K: number // strike
  r: number // risk-free rate (continuous, annual)
  sigma: number // volatility (annual)
  T: number // years to expiry
}

export function blackScholesCall({ S0, K, r, sigma, T }: CallParams) {
  const sq = sigma * Math.sqrt(T)
  const d1 = (Math.log(S0 / K) + (r + 0.5 * sigma * sigma) * T) / sq
  const d2 = d1 - sq
  return S0 * normCdf(d1) - K * Math.exp(-r * T) * normCdf(d2)
}

/** Standard normal draws via Box–Muller. */
function gaussian(rng: () => number) {
  let u = 0
  while (u === 0) u = rng()
  const v = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export interface McResult {
  price: number
  stderr: number
  /** Running estimate after each checkpoint (for the convergence chart). */
  path: { n: number; price: number; stderr: number }[]
}

export function monteCarloCall(p: CallParams, samples: number, seed = 1): McResult {
  const rng = mulberry32(seed)
  const drift = (p.r - 0.5 * p.sigma ** 2) * p.T
  const vol = p.sigma * Math.sqrt(p.T)
  const disc = Math.exp(-p.r * p.T)
  let sum = 0
  let sumSq = 0
  const path: McResult['path'] = []
  let next = 10
  for (let i = 1; i <= samples; i++) {
    const ST = p.S0 * Math.exp(drift + vol * gaussian(rng))
    const pay = disc * Math.max(ST - p.K, 0)
    sum += pay
    sumSq += pay * pay
    if (i === next || i === samples) {
      const mean = sum / i
      const variance = Math.max(0, sumSq / i - mean * mean)
      path.push({ n: i, price: mean, stderr: Math.sqrt(variance / i) })
      next = Math.ceil(next * 1.25)
    }
  }
  const last = path[path.length - 1]
  return { price: last.price, stderr: last.stderr, path }
}

/* ───────────── the quantum construction ───────────── */

export interface Grid {
  prices: number[]
  probs: number[]
  payoffs: number[]
  fmax: number
  /** a = E[f]/fmax — the amplitude the quantum algorithm estimates. */
  a: number
  /** Discounted price implied by the grid (before any estimation error). */
  gridPrice: number
}

/**
 * Discretise the terminal price S_T (log-normal) onto 2^nQubits points spanning
 * ±3 standard deviations in log space — the "distribution loading" step.
 */
export function priceGrid(p: CallParams, nQubits: number): Grid {
  const N = 2 ** nQubits
  const mu = Math.log(p.S0) + (p.r - 0.5 * p.sigma ** 2) * p.T
  const sd = p.sigma * Math.sqrt(p.T)
  const lo = mu - 3 * sd
  const hi = mu + 3 * sd
  const step = (hi - lo) / N
  const prices: number[] = []
  const probs: number[] = []
  for (let i = 0; i < N; i++) {
    const a = lo + i * step
    const b = a + step
    prices.push(Math.exp((a + b) / 2))
    probs.push(normCdf((b - mu) / sd) - normCdf((a - mu) / sd))
  }
  const total = probs.reduce((s, x) => s + x, 0)
  for (let i = 0; i < N; i++) probs[i] /= total
  const payoffs = prices.map((s) => Math.max(s - p.K, 0))
  const fmax = Math.max(...payoffs, 1e-12)
  const a = probs.reduce((s, q, i) => s + q * payoffs[i], 0) / fmax
  return { prices, probs, payoffs, fmax, a, gridPrice: Math.exp(-p.r * p.T) * fmax * a }
}

function fejer(delta: number, M: number) {
  const s = Math.sin(Math.PI * delta)
  if (Math.abs(s) < 1e-12) return 1
  return Math.sin(M * Math.PI * delta) ** 2 / (M * M * s * s)
}

/**
 * Exact outcome distribution of canonical QAE with m evaluation qubits.
 * Returns P(y) for y = 0..M-1 and the estimate ã(y) = sin²(πy/M).
 */
export function qaeDistribution(a: number, m: number) {
  const M = 2 ** m
  const omega = Math.asin(Math.sqrt(Math.min(1, Math.max(0, a)))) / Math.PI
  const probs: number[] = []
  const estimates: number[] = []
  for (let y = 0; y < M; y++) {
    probs.push(0.5 * (fejer(y / M - omega, M) + fejer(y / M + omega, M)))
    estimates.push(Math.sin((Math.PI * y) / M) ** 2)
  }
  return { M, probs, estimates }
}

/** Expected |ã − a| for canonical QAE, computed exactly from the distribution. */
export function qaeExpectedError(a: number, m: number) {
  const { probs, estimates } = qaeDistribution(a, m)
  return probs.reduce((s, p, y) => s + p * Math.abs(estimates[y] - a), 0)
}

/** Brassard et al. Theorem 12 bound (holds with probability ≥ 8/π²). */
export function qaeErrorBound(a: number, M: number) {
  return (2 * Math.PI * Math.sqrt(a * (1 - a))) / M + (Math.PI * Math.PI) / (M * M)
}

export function sampleQae(a: number, m: number, rng: () => number) {
  const { probs, estimates } = qaeDistribution(a, m)
  let r = rng()
  for (let y = 0; y < probs.length; y++) {
    r -= probs[y]
    if (r <= 0) return { y, estimate: estimates[y] }
  }
  return { y: probs.length - 1, estimate: estimates[probs.length - 1] }
}
