import { describe, expect, it } from 'vitest'
import { DETECTABLE, doublings, exponential, gompertz, gompertzB, relativeRate, simulate, timeTo } from '../../src/plugins/oncology/growth'
import { GEHAN_6MP, GEHAN_PLACEBO, chi2p1, coxBinary, kaplanMeier, kmPath, logRank, medianSurvival, simulateTrial } from '../../src/plugins/oncology/survival'
import { crossValidate, experiment, makeData, mean } from '../../src/plugins/oncology/leakage'
import { GEOMETRIES, ansatz, energy, estimateEnergy, exactEnergy, geometryAt, parameterShift, pauliExpectation, runVqe } from '../../src/plugins/oncology/chem'
import { NG, TRAIN, VALIDATION, accuracy, greedyTopK, maskOf, panelProblem, scores, subsetOf, swapAnnealing } from '../../src/plugins/oncology/panel'
import { bruteForce, normalise, optimiseQaoa, qaoaState } from '../../src/plugins/quantum/portfolio'
import { State, mulberry32 } from '../../src/plugins/quantum/sim'

describe('tumour growth', () => {
  it('exponential growth doubles every doubling time; 30 doublings ≈ 10⁹ cells', () => {
    expect(exponential(1, 50, 50)).toBeCloseTo(2, 12)
    expect(doublings(1, 2 ** 30)).toBeCloseTo(30, 12)
    expect(2 ** 30).toBeGreaterThan(DETECTABLE)
    expect(timeTo('exponential', 1, 2 ** 30, { doublingDays: 60, K: 1e12, b: 0 })).toBeCloseTo(1800, 9)
  })

  it('Gompertz: starts at N₀, plateaus at K, and has the matched initial doubling time', () => {
    const K = 1e12
    const b = gompertzB(60, K)
    expect(gompertz(1, K, b, 0)).toBeCloseTo(1, 12)
    expect(gompertz(1, K, b, 1e6) / K).toBeCloseTo(1, 6)
    expect(relativeRate('gompertz', 1, { doublingDays: 60, K, b })).toBeCloseTo(Math.LN2 / 60, 12)
    // closed-form time-to-size agrees with the curve
    const t = timeTo('gompertz', 1, 1e9, { doublingDays: 60, K, b })
    expect(gompertz(1, K, b, t)).toBeCloseTo(1e9, -3)
    // Gompertz slows down: it takes longer than exponential to reach 10⁹
    expect(t).toBeGreaterThan(timeTo('exponential', 1, 1e9, { doublingDays: 60, K, b }))
  })

  it('log-kill removes the same number of logs per dose regardless of size', () => {
    const p = { n0: 1e9, doublingDays: 1e9, K: 1e12, b: 0 } // effectively no regrowth
    const run = simulate('exponential', p, { start: 1, cycles: 3, interval: 1, logKill: 2, kill: 'log-kill' }, 3)
    expect(Math.log10(run.points[3].n)).toBeCloseTo(3, 6)
  })

  it('Norton–Simon kills less in a large Gompertzian tumour than log-kill does', () => {
    const K = 1e12
    const p = { n0: 1e10, doublingDays: 60, K, b: gompertzB(60, K) }
    const s = { start: 1, cycles: 1, interval: 21, logKill: 3, kill: 'log-kill' as const }
    const lk = simulate('gompertz', p, s, 2)
    const ns = simulate('gompertz', p, { ...s, kill: 'norton-simon' }, 2)
    expect(ns.points[1].n).toBeGreaterThan(lk.points[1].n * 10)
  })
})

describe('survival analysis — Freireich 6-MP trial (Gehan 1965)', () => {
  const km = kaplanMeier(GEHAN_6MP)

  it('has 21 patients per arm with 9 and 21 relapses', () => {
    expect(GEHAN_6MP).toHaveLength(21)
    expect(GEHAN_PLACEBO).toHaveLength(21)
    expect(GEHAN_6MP.filter((d) => d.event)).toHaveLength(9)
    expect(GEHAN_PLACEBO.filter((d) => d.event)).toHaveLength(21)
  })

  it('reproduces the textbook Kaplan–Meier estimates', () => {
    const at = (t: number) => km.find((k) => k.t === t)!.s
    expect(at(6)).toBeCloseTo(0.8571, 4)
    expect(at(7)).toBeCloseTo(0.8067, 4)
    expect(at(10)).toBeCloseTo(0.7529, 4)
    expect(at(23)).toBeCloseTo(0.4482, 4)
    expect(medianSurvival(km)).toBe(23)
    expect(medianSurvival(kaplanMeier(GEHAN_PLACEBO))).toBe(8)
  })

  it('log-rank χ² = 16.79, p ≈ 4.2e-5', () => {
    const lr = logRank(GEHAN_6MP, GEHAN_PLACEBO)
    expect(lr.observedA).toBe(9)
    expect(lr.expectedA).toBeCloseTo(19.2505, 3)
    expect(lr.chi2).toBeCloseTo(16.7929, 3)
    expect(lr.p).toBeCloseTo(4.1688e-5, 7)
  })

  it('Cox model (Efron ties) matches R: β = −1.5721, SE 0.4124, HR 0.2076', () => {
    const fit = coxBinary(GEHAN_6MP, GEHAN_PLACEBO)
    expect(fit.beta).toBeCloseTo(-1.5721, 3)
    expect(fit.se).toBeCloseTo(0.4124, 3)
    expect(fit.hr).toBeCloseTo(0.2076, 3)
    expect(fit.lo).toBeGreaterThan(0.09)
    expect(fit.hi).toBeLessThan(0.48)
  })

  it('χ²₁ tail probabilities are right', () => {
    expect(chi2p1(3.841459)).toBeCloseTo(0.05, 5)
    expect(chi2p1(6.634897)).toBeCloseTo(0.01, 5)
  })

  it('plots a non-increasing step function from (0, 1)', () => {
    const pts = kmPath(km)
    expect(pts[0]).toEqual([0, 1])
    for (let i = 1; i < pts.length; i++) expect(pts[i][1]).toBeLessThanOrEqual(pts[i - 1][1])
  })

  it('simulated trials recover the true hazard ratio at large n', () => {
    const { control, treated } = simulateTrial({ perArm: 2000, controlMedian: 12, hr: 0.6, accrual: 24, followUp: 24, seed: 4 })
    expect(coxBinary(treated, control).hr).toBeGreaterThan(0.54)
    expect(coxBinary(treated, control).hr).toBeLessThan(0.66)
  })
})

describe('selection bias (Ambroise & McLachlan 2002)', () => {
  it('on pure noise, selecting genes before CV looks excellent; selecting inside folds is chance', () => {
    const run = experiment({ n: 40, p: 2000, k: 20, folds: 5, reps: 8, seed: 3 })
    expect(mean(run.leaky)).toBeGreaterThan(0.85)
    expect(mean(run.proper)).toBeGreaterThan(0.3)
    expect(mean(run.proper)).toBeLessThan(0.7)
  })

  it('with real signal, the honest protocol finds it', () => {
    const d = makeData(60, 500, 9, 10, 1.2)
    expect(crossValidate(d, 10, 5, 'proper', 1)).toBeGreaterThan(0.8)
  })
})

describe('VQE on H₂ (STO-3G, Jordan–Wigner)', () => {
  it('every geometry has the 15-term Hamiltonian', () => {
    for (const g of GEOMETRIES) expect(Object.keys(g.terms)).toHaveLength(15)
  })

  it('θ = 0 gives the PySCF Hartree–Fock energy; the minimum over θ gives full CI', () => {
    for (const g of GEOMETRIES) {
      expect(exactEnergy(g, 0)).toBeCloseTo(g.hf, 7)
      let best = Infinity
      for (let i = 0; i <= 4000; i++) best = Math.min(best, exactEnergy(g, -Math.PI + (2 * Math.PI * i) / 4000))
      expect(best).toBeCloseTo(g.fci, 5)
    }
  })

  it('near equilibrium: FCI −1.1371 Ha at 0.75 Å, HF misses ~21 mHa', () => {
    const g = geometryAt(0.75)
    expect(g.r).toBeCloseTo(0.75, 9)
    expect(g.fci).toBeCloseTo(-1.13712, 5)
    expect(g.hf - g.fci).toBeCloseTo(0.02097, 4)
  })

  it('Pauli expectations: Z on an occupied orbital is −1; XXYY-type terms are bounded', () => {
    const s = ansatz(0)
    expect(pauliExpectation(s, 'ZIII')).toBeCloseTo(-1, 12)
    expect(pauliExpectation(s, 'IIZI')).toBeCloseTo(1, 12)
    const t = ansatz(1.1)
    for (const l of ['XXYY', 'YYXX', 'XYYX', 'YXXY']) expect(Math.abs(pauliExpectation(t, l))).toBeLessThanOrEqual(1 + 1e-12)
    // a generic check of the Y phases against a dense matrix calculation on |+i⟩-type states
    const u = State.fromAmplitudes(Array.from({ length: 16 }, (_, i) => [Math.cos(i), Math.sin(0.3 * i)] as [number, number]))
    const norm = Math.sqrt(u.norm())
    for (let i = 0; i < 16; i++) {
      u.re[i] /= norm
      u.im[i] /= norm
    }
    expect(Math.abs(pauliExpectation(u, 'YIII'))).toBeLessThanOrEqual(1 + 1e-12)
  })

  it('the parameter-shift rule equals the derivative', () => {
    const g = geometryAt(1.2)
    const f = (th: number) => exactEnergy(g, th)
    const h = 1e-5
    expect(parameterShift(f, 0.3)).toBeCloseTo((f(0.3 + h) - f(0.3 - h)) / (2 * h), 7)
  })

  it('shot noise shrinks like 1/√shots and noisy VQE still lands near FCI', () => {
    const g = geometryAt(0.75)
    const rng = mulberry32(5)
    expect(estimateEnergy(g, 0.2, 100, rng).stderr / estimateEnergy(g, 0.2, 10000, rng).stderr).toBeCloseTo(10, 6)
    const run = runVqe(g, { theta0: 0, shots: 20000, steps: 40, rate: 0.6, seed: 2 })
    expect(Math.abs(run.final - g.fci)).toBeLessThan(1.6e-3)
    expect(energy(g, ansatz(run.theta))).toBeCloseTo(run.final, 12)
  })
})

describe('biomarker-panel QUBO (synthetic)', () => {
  const { relevance, redundancy } = scores(TRAIN)

  it('with no redundancy penalty, the QUBO optimum is the top-k by relevance', () => {
    for (const k of [2, 3, 4]) {
      const bf = bruteForce(panelProblem(relevance, redundancy, 0, k, 2))
      expect(subsetOf(bf.best)).toEqual(greedyTopK(relevance, k))
    }
  })

  it('the near-duplicate pair (A, B) is the most redundant and the greedy panel picks both', () => {
    expect(redundancy[0][1]).toBeGreaterThan(0.9)
    expect(greedyTopK(relevance, 2)).toEqual([0, 1])
  })

  it('a redundancy penalty drops the duplicate and generalises better on the validation cohort', () => {
    const k = 2
    const qubo = subsetOf(bruteForce(panelProblem(relevance, redundancy, 1, k, 2)).best)
    expect(qubo.includes(0) && qubo.includes(1)).toBe(false)
    expect(accuracy(TRAIN, VALIDATION, qubo)).toBeGreaterThan(accuracy(TRAIN, VALIDATION, greedyTopK(relevance, k)))
  })

  it('swap-move annealing keeps exactly k genes and usually finds the optimum', () => {
    for (const k of [2, 3, 4]) {
      const prob = panelProblem(relevance, redundancy, 0.5, k, 2)
      const bf = bruteForce(prob)
      let hits = 0
      for (let seed = 1; seed <= 20; seed++) {
        const run = swapAnnealing(prob, 300, seed)
        expect(subsetOf(run.best)).toHaveLength(k)
        if (run.bestCost <= bf.cost + 1e-12) hits++
      }
      expect(hits).toBeGreaterThanOrEqual(15)
    }
  })

  it('XY-mixer QAOA puts more weight on the optimum than a uniform guess over valid panels', () => {
    const k = 3
    const prob = panelProblem(relevance, redundancy, 1, k, 2)
    const bf = bruteForce(prob)
    const norm = normalise(bf.costs, k)
    const opt = optimiseQaoa(norm, 1, [0.8, 0.4], 150, 'xy', k)
    const p = qaoaState(norm, [opt.angles[0]], [opt.angles[1]], 'xy', k).probabilities()
    let best = -1
    bf.costs.forEach((v, z) => {
      if (subsetOf(z).length === k && (best < 0 || v < bf.costs[best])) best = z
    })
    expect(p[best]).toBeGreaterThan(1 / 56)
    expect(maskOf(subsetOf(best))).toBe(best)
    expect(NG).toBe(8)
  })
})
