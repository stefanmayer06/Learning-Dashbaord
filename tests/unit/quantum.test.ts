import { describe, expect, it } from 'vitest'
import {
  State,
  fromAngles,
  groverOptimalIterations,
  groverStep,
  groverSuccess,
  mulberry32,
  toAngles,
} from '../../src/plugins/quantum/sim'
import {
  blackScholesCall,
  monteCarloCall,
  priceGrid,
  qaeDistribution,
  qaeErrorBound,
  qaeExpectedError,
} from '../../src/plugins/quantum/finance'
import {
  DEMO_ASSETS,
  DEMO_CORR,
  bitsOf,
  bruteForce,
  cost,
  covariance,
  normalise,
  optimiseQaoa,
  qaoaExpectation,
  qaoaLandscape,
  qaoaState,
  quboMatrix,
  simulatedAnnealing,
  type Problem,
} from '../../src/plugins/quantum/portfolio'

const close = (a: number, b: number, eps = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(eps)

describe('statevector simulator', () => {
  it('H|0> gives equal superposition', () => {
    const s = new State(1).gate('H', 0)
    const [p0, p1] = s.probabilities()
    close(p0, 0.5)
    close(p1, 0.5)
  })

  it('H then CNOT makes the Bell state (|00> + |11>)/√2', () => {
    const s = new State(2).gate('H', 0).gate('X', 1, [0])
    const p = s.probabilities()
    close(p[0b00], 0.5)
    close(p[0b11], 0.5)
    close(p[0b01] + p[0b10], 0)
    // each qubit alone is maximally mixed → Bloch vector of length 0
    const b = s.bloch(0)
    close(Math.hypot(b.x, b.y, b.z), 0)
  })

  it('labels read q0 first', () => {
    const s = new State(3).gate('X', 0) // flip leftmost qubit
    expect(s.label(s.probabilities().indexOf(1))).toBe('100')
  })

  it('keeps the state normalised through a random circuit', () => {
    const rng = mulberry32(3)
    const s = new State(4)
    const names = ['H', 'X', 'Y', 'Z', 'S', 'T'] as const
    for (let k = 0; k < 60; k++) {
      const t = Math.floor(rng() * 4)
      const ctrl = rng() < 0.4 ? [(t + 1) % 4] : []
      s.gate(names[Math.floor(rng() * names.length)], t, ctrl)
    }
    close(s.norm(), 1, 1e-12)
  })

  it('Bloch angles round-trip', () => {
    const s = fromAngles(1.1, 2.3)
    const { theta, phi } = toAngles(s.amp(0), s.amp(1))
    close(theta, 1.1, 1e-12)
    close(phi, 2.3, 1e-12)
    const b = s.bloch(0)
    close(b.z, Math.cos(1.1), 1e-12)
    close(b.x, Math.sin(1.1) * Math.cos(2.3), 1e-12)
    close(b.y, Math.sin(1.1) * Math.sin(2.3), 1e-12)
  })

  it('sampling converges to Born-rule probabilities', () => {
    const s = fromAngles(Math.PI / 3, 0) // P(1) = sin²(π/6) = 0.25
    const counts = s.sample(40000, mulberry32(11))
    expect(Math.abs(counts[1] / 40000 - 0.25)).toBeLessThan(0.01)
  })
})

describe('Grover', () => {
  it('iterating matches the closed form', () => {
    const N = 16
    let amps = new Array(N).fill(1 / Math.sqrt(N))
    for (let k = 1; k <= 5; k++) {
      amps = groverStep(amps, 5).after
      close(amps[5] ** 2, groverSuccess(N, k), 1e-12)
    }
  })

  it('optimal iterations ≈ π/4 √N', () => {
    expect(groverOptimalIterations(4)).toBe(1)
    expect(groverOptimalIterations(8)).toBe(2)
    expect(groverOptimalIterations(16)).toBe(3)
    expect(groverOptimalIterations(64)).toBe(6)
    expect(groverSuccess(4, 1)).toBeCloseTo(1, 12)
  })
})

describe('pricing', () => {
  const p = { S0: 100, K: 100, r: 0.05, sigma: 0.2, T: 1 }

  it('Black–Scholes reference value (textbook: 10.4506)', () => {
    expect(blackScholesCall(p)).toBeCloseTo(10.4506, 3)
  })

  it('Monte Carlo lands within ~3 standard errors and error shrinks like 1/√N', () => {
    const r1 = monteCarloCall(p, 4_000, 2)
    const r2 = monteCarloCall(p, 64_000, 2)
    const bs = blackScholesCall(p)
    expect(Math.abs(r2.price - bs)).toBeLessThan(3 * r2.stderr)
    // 16× the samples → ~4× smaller standard error
    expect(r1.stderr / r2.stderr).toBeGreaterThan(3.3)
    expect(r1.stderr / r2.stderr).toBeLessThan(4.8)
  })

  it('grid price approaches Black–Scholes as the grid gets finer', () => {
    const bs = blackScholesCall(p)
    const e3 = Math.abs(priceGrid(p, 3).gridPrice - bs)
    const e7 = Math.abs(priceGrid(p, 7).gridPrice - bs)
    expect(e7).toBeLessThan(e3)
    expect(e7 / bs).toBeLessThan(0.02) // truncation at ±3σ leaves a small bias
  })

  it('QAE outcome distribution is a probability distribution peaked at the truth', () => {
    const a = 0.3
    for (const m of [3, 5, 8]) {
      const d = qaeDistribution(a, m)
      close(d.probs.reduce((s, x) => s + x, 0), 1, 1e-9)
      const y = d.probs.indexOf(Math.max(...d.probs))
      expect(Math.abs(d.estimates[y] - a)).toBeLessThan(qaeErrorBound(a, d.M))
    }
  })

  it('QAE error shrinks ~1/M (quadratically faster than Monte Carlo)', () => {
    const a = 0.27
    const e6 = qaeExpectedError(a, 6)
    const e10 = qaeExpectedError(a, 10)
    // 16× more Grover applications → error down by roughly 16×
    expect(e6 / e10).toBeGreaterThan(8)
  })

  it('exact amplitudes give perfect QAE', () => {
    const a = Math.sin(Math.PI / 8) ** 2 // = sin²(π·2/16)
    const d = qaeDistribution(a, 4)
    close(d.probs[2] + d.probs[14], 1, 1e-9)
  })
})

describe('portfolio QUBO', () => {
  const cov = covariance(DEMO_ASSETS, DEMO_CORR)
  const prob: Problem = { mu: DEMO_ASSETS.map((a) => a.mu), cov, q: 0.5, budget: 3, lambda: 0.2 }

  it('synthetic correlation matrix is positive definite (Cholesky succeeds)', () => {
    const n = DEMO_CORR.length
    const L = Array.from({ length: n }, () => new Array(n).fill(0))
    for (let i = 0; i < n; i++)
      for (let j = 0; j <= i; j++) {
        let s = DEMO_CORR[i][j]
        for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k]
        if (i === j) {
          expect(s).toBeGreaterThan(0)
          L[i][i] = Math.sqrt(s)
        } else L[i][j] = s / L[j][j]
      }
  })

  it('QUBO matrix reproduces the objective for every bitstring', () => {
    const { Q, offset } = quboMatrix(prob)
    for (let z = 0; z < 64; z++) {
      const x = bitsOf(z, 6)
      let v = offset
      for (let i = 0; i < 6; i++) for (let j = i; j < 6; j++) v += Q[i][j] * x[i] * x[j]
      close(v, cost(x, prob), 1e-12)
    }
  })

  it('brute force respects the budget and annealing finds the optimum', () => {
    const bf = bruteForce(prob)
    expect(bitsOf(bf.best, 6).reduce((a, b) => a + b, 0)).toBe(3)
    const sa = simulatedAnnealing(prob, 800, 5)
    close(sa.bestCost, bf.cost, 1e-12)
  })

  it('constraint-preserving QAOA never leaves the valid subspace and beats a random valid pick', () => {
    const costs = bruteForce(prob).costs
    const norm = normalise(costs, 3)
    const s = qaoaState(norm, [1.1, 0.7], [0.4, 0.9], 'xy', 3)
    close(s.norm(), 1, 1e-12)
    const p = s.probabilities()
    p.forEach((pz, z) => {
      if (bitsOf(z, 6).reduce((a, b) => a + b, 0) !== 3) close(pz, 0, 1e-12)
    })
    const land = qaoaLandscape(norm, 24, 'xy', 3)
    const r = optimiseQaoa(norm, 2, [land.best.gamma, land.best.gamma * 0.9, land.best.beta, land.best.beta * 0.9], 300, 'xy', 3)
    const best = bruteForce(prob).best
    const pOpt = qaoaState(norm, r.angles.slice(0, 2), r.angles.slice(2), 'xy', 3).probabilities()[best]
    expect(pOpt).toBeGreaterThan(1 / 20) // random valid pick among C(6,3) = 20
  })

  it('QAOA: γ=0 gives the uniform average; optimised angles beat random guessing', () => {
    const norm = normalise(bruteForce(prob).costs)
    const avg = norm.reduce((s, v) => s + v, 0) / norm.length
    close(qaoaExpectation(norm, [0], [0.4]), avg, 1e-12)
    close(qaoaState(norm, [1.2, 0.4], [0.3, 0.2]).norm(), 1, 1e-12)
    const land = qaoaLandscape(norm, 24)
    expect(land.best.value).toBeLessThan(avg)
    const p2 = optimiseQaoa(norm, 2, [land.best.gamma, land.best.gamma, land.best.beta, land.best.beta])
    expect(p2.value).toBeLessThanOrEqual(land.best.value + 1e-9)
  })
})
