/**
 * Survival analysis from first principles: Kaplan–Meier (1958), the log-rank
 * test (Peto & Peto 1972) and a one-covariate Cox model (Cox 1972, Efron ties).
 *
 * The worked data are the 6-mercaptopurine remission trial of Freireich et al.
 * (1963), as tabulated by Gehan (1965) and distributed as MASS::gehan — real,
 * historical, and small enough to compute by hand.
 */
import { mulberry32 } from '../quantum/sim'

export interface Obs {
  t: number // time (weeks, months …)
  event: boolean // true = event observed; false = censored
}

const obs = (times: number[], censored: number[] = []): Obs[] => {
  const c = [...censored]
  return times.map((t) => {
    const i = c.indexOf(t)
    if (i >= 0) {
      c.splice(i, 1)
      return { t, event: false }
    }
    return { t, event: true }
  })
}

/** Weeks in remission on 6-MP; censored values are listed a second time. */
export const GEHAN_6MP = obs([6, 6, 6, 6, 7, 9, 10, 10, 11, 13, 16, 17, 19, 20, 22, 23, 25, 32, 32, 34, 35], [6, 9, 10, 11, 17, 19, 20, 25, 32, 32, 34, 35])
/** Weeks in remission on placebo (no censoring). */
export const GEHAN_PLACEBO = obs([1, 1, 2, 2, 3, 4, 4, 5, 5, 8, 8, 8, 8, 11, 11, 12, 12, 15, 17, 22, 23])

export interface KmStep {
  t: number
  atRisk: number
  events: number
  censored: number
  s: number // survival just after t
  se: number // Greenwood standard error
}

export function kaplanMeier(data: Obs[]): KmStep[] {
  const times = [...new Set(data.map((d) => d.t))].sort((a, b) => a - b)
  let s = 1
  let gw = 0 // Greenwood sum
  const out: KmStep[] = []
  for (const t of times) {
    const atRisk = data.filter((d) => d.t >= t).length
    const events = data.filter((d) => d.t === t && d.event).length
    const censored = data.filter((d) => d.t === t && !d.event).length
    if (events > 0) {
      s *= 1 - events / atRisk
      if (atRisk > events) gw += events / (atRisk * (atRisk - events))
    }
    out.push({ t, atRisk, events, censored, s, se: s * Math.sqrt(gw) })
  }
  return out
}

/** Smallest time at which the KM curve drops to 0.5 or below (null if never). */
export function medianSurvival(km: KmStep[]): number | null {
  const hit = km.find((k) => k.events > 0 && k.s <= 0.5 + 1e-12)
  return hit ? hit.t : null
}

/** Step-function points for plotting, starting at (0, 1). */
export function kmPath(km: KmStep[], until?: number): [number, number][] {
  const pts: [number, number][] = [[0, 1]]
  let s = 1
  for (const k of km) {
    if (k.events > 0) {
      pts.push([k.t, s])
      s = k.s
      pts.push([k.t, s])
    }
  }
  const end = until ?? (km.length ? km[km.length - 1].t : 0)
  pts.push([end, s])
  return pts
}

/** Upper tail of χ² with 1 degree of freedom: P(X ≥ x) = erfc(√(x/2)). */
export function chi2p1(x: number) {
  return erfc(Math.sqrt(Math.max(0, x) / 2))
}

/** Complementary error function (Numerical Recipes erfcc, |error| < 1.2e-7). */
export function erfc(x: number) {
  const z = Math.abs(x)
  const t = 1 / (1 + 0.5 * z)
  const r =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    )
  return x >= 0 ? r : 2 - r
}

export interface LogRank {
  observedA: number
  expectedA: number
  observedB: number
  expectedB: number
  variance: number
  chi2: number
  p: number
}

export function logRank(a: Obs[], b: Obs[]): LogRank {
  const all = [...a.map((d) => ({ ...d, g: 0 })), ...b.map((d) => ({ ...d, g: 1 }))]
  const times = [...new Set(all.filter((d) => d.event).map((d) => d.t))].sort((x, y) => x - y)
  let O = 0
  let E = 0
  let V = 0
  for (const t of times) {
    const risk = all.filter((d) => d.t >= t)
    const n = risk.length
    const nA = risk.filter((d) => d.g === 0).length
    const dAll = all.filter((d) => d.t === t && d.event).length
    const dA = all.filter((d) => d.t === t && d.event && d.g === 0).length
    O += dA
    E += (dAll * nA) / n
    if (n > 1) V += (dAll * (nA / n) * (1 - nA / n) * (n - dAll)) / (n - 1)
  }
  const totalEvents = all.filter((d) => d.event).length
  const chi2 = V > 0 ? (O - E) ** 2 / V : 0
  return { observedA: O, expectedA: E, observedB: totalEvents - O, expectedB: totalEvents - E, variance: V, chi2, p: chi2p1(chi2) }
}

export interface CoxFit {
  beta: number // log hazard ratio of group A relative to group B
  se: number
  hr: number
  lo: number // 95% CI
  hi: number
}

/** Cox proportional hazards with one binary covariate (1 = group A), Efron's method for ties. */
export function coxBinary(a: Obs[], b: Obs[]): CoxFit {
  const all = [...a.map((d) => ({ ...d, x: 1 })), ...b.map((d) => ({ ...d, x: 0 }))]
  const times = [...new Set(all.filter((d) => d.event).map((d) => d.t))].sort((p, q) => p - q)
  const derivs = (beta: number) => {
    let g = 0
    let h = 0
    for (const t of times) {
      const risk = all.filter((d) => d.t >= t)
      const dead = risk.filter((d) => d.t === t && d.event)
      const m = dead.length
      let s0 = 0,
        s1 = 0,
        d0 = 0,
        d1 = 0
      for (const r of risk) {
        const w = Math.exp(beta * r.x)
        s0 += w
        s1 += r.x * w
      }
      for (const r of dead) {
        const w = Math.exp(beta * r.x)
        d0 += w
        d1 += r.x * w
        g += r.x
      }
      for (let l = 0; l < m; l++) {
        const f = l / m
        const a0 = s0 - f * d0
        const a1 = s1 - f * d1 // x ∈ {0,1} so Σx²w = Σxw
        g -= a1 / a0
        h -= a1 / a0 - (a1 / a0) ** 2
      }
    }
    return { g, h }
  }
  let beta = 0
  for (let it = 0; it < 50; it++) {
    const { g, h } = derivs(beta)
    if (h === 0) break
    const next = beta - g / h
    if (Math.abs(next - beta) < 1e-12) {
      beta = next
      break
    }
    beta = next
  }
  const se = Math.sqrt(-1 / derivs(beta).h)
  return { beta, se, hr: Math.exp(beta), lo: Math.exp(beta - 1.96 * se), hi: Math.exp(beta + 1.96 * se) }
}

/**
 * A synthetic two-arm trial: exponential survival with the given control median
 * and true hazard ratio, uniform accrual over `accrual`, analysed at `accrual + followUp`.
 */
export function simulateTrial(opts: { perArm: number; controlMedian: number; hr: number; accrual: number; followUp: number; seed: number }) {
  const rng = mulberry32(opts.seed)
  const lambdaC = Math.LN2 / opts.controlMedian
  const end = opts.accrual + opts.followUp
  const arm = (lambda: number): Obs[] =>
    Array.from({ length: opts.perArm }, () => {
      const enrol = rng() * opts.accrual
      const t = -Math.log(1 - rng()) / lambda
      const window = end - enrol
      return t <= window ? { t: +t.toFixed(3), event: true } : { t: +window.toFixed(3), event: false }
    })
  return { control: arm(lambdaC), treated: arm(lambdaC * opts.hr) }
}
