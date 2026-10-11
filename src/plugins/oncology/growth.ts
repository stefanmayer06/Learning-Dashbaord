/**
 * Tumour growth and treatment kinetics — the classical laws a mathematical
 * oncologist starts from (Gerlee 2013; Benzekry et al. 2014).
 *
 *   exponential   N(t) = N₀ · 2^(t/T_d)
 *   Gompertz      N(t) = K · exp( ln(N₀/K) · e^(−b t) )     (Gompertz 1825)
 *
 * Treatment is a dose every `interval` days:
 *   log-kill      each dose removes the same number of logs (Skipper)
 *   Norton–Simon  each dose's kill scales with the current relative growth rate
 *
 * Cells per gram (~10⁹) is a convention Del Monte (2009) argues may be 10× too
 * high for epithelial tumours; the lab labels it as such.
 */

export type GrowthModel = 'exponential' | 'gompertz'
export type KillModel = 'log-kill' | 'norton-simon'

export const DETECTABLE = 1e9 // ≈ 1 g at the conventional 10⁹ cells/g
export const LETHAL_SCALE = 1e12 // ≈ 1 kg at the same density

export function exponential(n0: number, doublingDays: number, t: number) {
  return n0 * 2 ** (t / doublingDays)
}

export function gompertz(n0: number, K: number, b: number, t: number) {
  return K * Math.exp(Math.log(n0 / K) * Math.exp(-b * t))
}

/** Relative growth rate (1/N)(dN/dt) per day. */
export function relativeRate(model: GrowthModel, n: number, p: { doublingDays: number; K: number; b: number }) {
  return model === 'exponential' ? Math.LN2 / p.doublingDays : p.b * Math.log(p.K / Math.max(n, 1e-300))
}

/** Doublings needed to grow from n0 to n (log₂ of the ratio). */
export const doublings = (n0: number, n: number) => Math.log2(n / n0)

/**
 * Gompertz rate b chosen so that the curve has the same initial doubling time as
 * an exponential with `doublingDays` at a single cell: b · ln(K) = ln 2 / T_d.
 */
export const gompertzB = (doublingDays: number, K: number) => Math.LN2 / doublingDays / Math.log(K)

/** Days for the untreated tumour to grow from n0 to n (closed forms). */
export function timeTo(model: GrowthModel, n0: number, n: number, p: { doublingDays: number; K: number; b: number }) {
  if (model === 'exponential') return p.doublingDays * doublings(n0, n)
  if (n >= p.K) return Infinity
  return -Math.log(Math.log(n / p.K) / Math.log(n0 / p.K)) / p.b
}

export interface Schedule {
  start: number // day of the first dose
  cycles: number
  interval: number // days between doses
  logKill: number // logs (base 10) removed per dose at full strength
  kill: KillModel
}

export interface Point {
  t: number
  n: number
}

/**
 * Simulate growth plus treatment. Between doses the closed-form growth law is
 * applied (exactly); each dose multiplies N by 10^(−kill). Under Norton–Simon
 * the kill is scaled by the relative growth rate now, divided by the rate at a
 * single cell (the fastest the tumour ever grows).
 */
export function simulate(
  model: GrowthModel,
  p: { n0: number; doublingDays: number; K: number; b: number },
  schedule: Schedule | null,
  days: number,
  step = 1,
): { points: Point[]; nadir: number; nadirDay: number; cured: boolean } {
  const grow = (n: number, dt: number) => (model === 'exponential' ? exponential(n, p.doublingDays, dt) : gompertz(n, p.K, p.b, dt))
  const doses = new Set<number>()
  if (schedule) for (let c = 0; c < schedule.cycles; c++) doses.add(schedule.start + c * schedule.interval)
  const rMax = relativeRate(model, 1, p)
  let n = p.n0
  let nadir = Infinity
  let nadirDay = 0
  let cured = false
  const points: Point[] = [{ t: 0, n }]
  for (let t = step; t <= days + 1e-9; t += step) {
    if (!cured) n = grow(n, step)
    const day = Math.round(t)
    if (schedule && doses.has(day) && Math.abs(t - day) < step / 2 && !cured) {
      const scale = schedule.kill === 'norton-simon' ? relativeRate(model, n, p) / rMax : 1
      n = n * 10 ** -(schedule.logKill * scale)
      if (schedule && day >= schedule.start && n < nadir) {
        nadir = n
        nadirDay = day
      }
      if (n < 1) {
        // fewer than one cell left: the model's continuous N stops meaning anything
        cured = true
        n = 0
      }
    }
    points.push({ t, n })
  }
  return { points, nadir: nadir === Infinity ? n : nadir, nadirDay, cured }
}
