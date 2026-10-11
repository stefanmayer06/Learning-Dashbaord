/**
 * VQE for H₂ in the STO-3G basis (4 spin orbitals → 4 qubits, Jordan–Wigner).
 *
 * The Pauli decompositions in h2-data.json were computed with PySCF by
 * scripts/oncology/h2_hamiltonians.py, which also checks that each Hamiltonian's
 * ground state matches PySCF's full-CI energy. Qubit k is spin orbital k
 * (0α, 0β, 1α, 1β), written left to right: Hartree–Fock is |1100⟩.
 *
 * Ansatz: one double-excitation (Givens) rotation,
 *   |ψ(θ)⟩ = cos(θ/2)|1100⟩ − sin(θ/2)|0011⟩,
 * which is exact for H₂ in this basis. Its energy is a + b·cos θ + c·sin θ, so
 * the parameter-shift rule gives the exact gradient from two energy estimates.
 */
import data from './h2-data.json'
import { State, c, mulberry32 } from '../quantum/sim'

export interface Geometry {
  r: number // bond length, Å
  hf: number // Hartree–Fock energy, hartree
  fci: number // exact (full-CI) energy in this basis, hartree
  terms: Record<string, number> // Pauli string (q0…q3) → coefficient
}

export const GEOMETRIES: Geometry[] = (data as { geometries: Geometry[] }).geometries
export const CHEMICAL_ACCURACY = 1.6e-3 // hartree (≈ 1 kcal/mol)
export const HARTREE_TO_KCAL = 627.5095

export function geometryAt(r: number): Geometry {
  return GEOMETRIES.reduce((best, g) => (Math.abs(g.r - r) < Math.abs(best.r - r) ? g : best), GEOMETRIES[0])
}

const HF = 0b1100
const DOUBLE = 0b0011

export function ansatz(theta: number): State {
  const amps = Array.from({ length: 16 }, () => c(0))
  amps[HF] = c(Math.cos(theta / 2))
  amps[DOUBLE] = c(-Math.sin(theta / 2))
  return State.fromAmplitudes(amps)
}

/** ⟨ψ|P|ψ⟩ for a Pauli string P (q0 leftmost), computed exactly. */
export function pauliExpectation(s: State, label: string): number {
  const n = s.n
  let re = 0
  for (let i = 0; i < s.size; i++) {
    // P|i⟩ = phase · |j⟩ ; accumulate conj(ψ_j) · phase · ψ_i
    let j = i
    let pr = 1 // phase as a complex number (pr, pi)
    let pi = 0
    for (let q = 0; q < n; q++) {
      const ch = label[q]
      if (ch === 'I') continue
      const m = 1 << (n - 1 - q)
      const bit = i & m ? 1 : 0
      if (ch === 'X') j ^= m
      else if (ch === 'Y') {
        j ^= m
        // Y|0⟩ = i|1⟩, Y|1⟩ = −i|0⟩
        const [a, b] = bit ? [pi, -pr] : [-pi, pr]
        pr = a
        pi = b
      } else if (ch === 'Z' && bit) {
        pr = -pr
        pi = -pi
      }
    }
    const ar = s.re[i]
    const ai = s.im[i]
    // phase · ψ_i
    const vr = pr * ar - pi * ai
    const vi = pr * ai + pi * ar
    // conj(ψ_j) · v  (real part only — the expectation of a Hermitian operator is real)
    re += s.re[j] * vr + s.im[j] * vi
  }
  return re
}

export function energy(g: Geometry, s: State) {
  let e = 0
  for (const [label, coef] of Object.entries(g.terms)) e += coef * (label === 'IIII' ? 1 : pauliExpectation(s, label))
  return e
}

export const exactEnergy = (g: Geometry, theta: number) => energy(g, ansatz(theta))

/** Energy landscape E(θ) on a grid over [−π, π]. */
export function landscape(g: Geometry, res = 121): [number, number][] {
  return Array.from({ length: res }, (_, i) => {
    const th = -Math.PI + (2 * Math.PI * i) / (res - 1)
    return [th, exactEnergy(g, th)] as [number, number]
  })
}

/**
 * Estimate ⟨H⟩ from `shots` measurements of each non-identity Pauli term
 * (no grouping — the simplest, most expensive scheme). Each shot of term P
 * returns ±1 with P(+1) = (1 + ⟨P⟩)/2. Above 2,000 shots the binomial count is
 * drawn from its normal approximation (same mean and variance) to stay fast.
 */
export function estimateEnergy(g: Geometry, theta: number, shots: number, rng: () => number) {
  const s = ansatz(theta)
  let e = 0
  let variance = 0
  for (const [label, coef] of Object.entries(g.terms)) {
    if (label === 'IIII') {
      e += coef
      continue
    }
    const exp = pauliExpectation(s, label)
    const pPlus = Math.min(1, Math.max(0, (1 + exp) / 2))
    let plus = 0
    if (shots <= 2000) {
      for (let k = 0; k < shots; k++) if (rng() < pPlus) plus++
    } else {
      plus = Math.min(shots, Math.max(0, shots * pPlus + Math.sqrt(shots * pPlus * (1 - pPlus)) * gaussian(rng)))
    }
    const est = (2 * plus) / shots - 1
    e += coef * est
    variance += (coef * coef * Math.max(0, 1 - exp * exp)) / shots
  }
  return { energy: e, stderr: Math.sqrt(variance), measurements: shots * (Object.keys(g.terms).length - 1) }
}

/** dE/dθ by the parameter-shift rule (exact for this one-parameter ansatz). */
export const parameterShift = (f: (th: number) => number, theta: number) => (f(theta + Math.PI / 2) - f(theta - Math.PI / 2)) / 2

export interface VqeStep {
  iter: number
  theta: number
  energy: number // estimated (noisy) energy at this θ
}

/** Gradient descent with parameter-shift gradients, every energy estimated from shots. */
export function runVqe(g: Geometry, opts: { theta0: number; shots: number; steps: number; rate: number; seed: number }) {
  const rng = mulberry32(opts.seed)
  const est = (th: number) => (opts.shots > 0 ? estimateEnergy(g, th, opts.shots, rng).energy : exactEnergy(g, th))
  let theta = opts.theta0
  const trace: VqeStep[] = []
  let measurements = 0
  const perEstimate = opts.shots * (Object.keys(g.terms).length - 1)
  for (let i = 0; i <= opts.steps; i++) {
    trace.push({ iter: i, theta, energy: est(theta) })
    measurements += perEstimate
    if (i === opts.steps) break
    theta -= opts.rate * parameterShift(est, theta)
    measurements += 2 * perEstimate
  }
  // the energy you would report is itself measured: one more estimate at the final θ
  const reported = opts.shots > 0 ? estimateEnergy(g, theta, opts.shots, rng) : { energy: exactEnergy(g, theta), stderr: 0 }
  measurements += perEstimate
  return { trace, theta, final: exactEnergy(g, theta), reported: reported.energy, stderr: reported.stderr, measurements }
}

function gaussian(rng: () => number) {
  let u = 0
  while (u === 0) u = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng())
}
