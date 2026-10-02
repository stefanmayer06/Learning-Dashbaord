/**
 * A small, exact statevector simulator (no noise). Good to ~16 qubits; the
 * labs use at most 10.
 *
 * Convention: basis labels read left-to-right as q0 q1 … q(n-1)
 * (textbook / Nielsen & Chuang order — NOT Qiskit's little-endian order).
 */

export type C = [re: number, im: number]
export type Mat2 = [C, C, C, C] // row-major: [a b; c d]

export const c = (re: number, im = 0): C => [re, im]
const add = (a: C, b: C): C => [a[0] + b[0], a[1] + b[1]]
const mul = (a: C, b: C): C => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]]
export const abs2 = (a: C) => a[0] * a[0] + a[1] * a[1]
export const phaseOf = (a: C) => Math.atan2(a[1], a[0])

const S2 = Math.SQRT1_2

export const GATES = {
  I: [c(1), c(0), c(0), c(1)],
  X: [c(0), c(1), c(1), c(0)],
  Y: [c(0), c(0, -1), c(0, 1), c(0)],
  Z: [c(1), c(0), c(0), c(-1)],
  H: [c(S2), c(S2), c(S2), c(-S2)],
  S: [c(1), c(0), c(0), c(0, 1)],
  Sdg: [c(1), c(0), c(0), c(0, -1)],
  T: [c(1), c(0), c(0), c(S2, S2)],
  Tdg: [c(1), c(0), c(0), c(S2, -S2)],
} satisfies Record<string, Mat2>

export type GateName = keyof typeof GATES

export const rx = (t: number): Mat2 => [c(Math.cos(t / 2)), c(0, -Math.sin(t / 2)), c(0, -Math.sin(t / 2)), c(Math.cos(t / 2))]
export const ry = (t: number): Mat2 => [c(Math.cos(t / 2)), c(-Math.sin(t / 2)), c(Math.sin(t / 2)), c(Math.cos(t / 2))]
export const rz = (t: number): Mat2 => [c(Math.cos(-t / 2), Math.sin(-t / 2)), c(0), c(0), c(Math.cos(t / 2), Math.sin(t / 2))]

export class State {
  readonly n: number
  re: Float64Array
  im: Float64Array

  constructor(n: number) {
    if (n < 1 || n > 16) throw new Error('1–16 qubits supported')
    this.n = n
    this.re = new Float64Array(1 << n)
    this.im = new Float64Array(1 << n)
    this.re[0] = 1
  }

  static fromAmplitudes(amps: C[]): State {
    const n = Math.log2(amps.length)
    if (!Number.isInteger(n)) throw new Error('length must be a power of two')
    const s = new State(n)
    amps.forEach((a, i) => {
      s.re[i] = a[0]
      s.im[i] = a[1]
    })
    return s
  }

  clone(): State {
    const s = new State(this.n)
    s.re.set(this.re)
    s.im.set(this.im)
    return s
  }

  get size() {
    return this.re.length
  }

  amp(i: number): C {
    return [this.re[i], this.im[i]]
  }

  /** Bit mask for qubit q under the q0-is-leftmost convention. */
  mask(q: number) {
    return 1 << (this.n - 1 - q)
  }

  /** Apply a 2×2 unitary to `target`, optionally conditioned on `controls` all being 1. */
  apply(m: Mat2, target: number, controls: number[] = []): this {
    const tm = this.mask(target)
    const cm = controls.reduce((acc, q) => acc | this.mask(q), 0)
    for (let i = 0; i < this.size; i++) {
      if (i & tm) continue
      if ((i & cm) !== cm) continue
      const j = i | tm
      const a0: C = [this.re[i], this.im[i]]
      const a1: C = [this.re[j], this.im[j]]
      const b0 = add(mul(m[0], a0), mul(m[1], a1))
      const b1 = add(mul(m[2], a0), mul(m[3], a1))
      this.re[i] = b0[0]
      this.im[i] = b0[1]
      this.re[j] = b1[0]
      this.im[j] = b1[1]
    }
    return this
  }

  gate(name: GateName, target: number, controls: number[] = []) {
    return this.apply(GATES[name], target, controls)
  }

  swap(a: number, b: number) {
    this.gate('X', b, [a]).gate('X', a, [b]).gate('X', b, [a])
    return this
  }

  /** Multiply amplitude i by e^{-i·angle(i)} — a diagonal unitary. */
  phase(angle: (i: number) => number) {
    for (let i = 0; i < this.size; i++) {
      const t = -angle(i)
      const cs = Math.cos(t)
      const sn = Math.sin(t)
      const r = this.re[i]
      const m = this.im[i]
      this.re[i] = r * cs - m * sn
      this.im[i] = r * sn + m * cs
    }
    return this
  }

  probabilities(): number[] {
    const p = new Array<number>(this.size)
    for (let i = 0; i < this.size; i++) p[i] = this.re[i] ** 2 + this.im[i] ** 2
    return p
  }

  norm() {
    return this.probabilities().reduce((a, b) => a + b, 0)
  }

  /** Probability that qubit q reads 1. */
  probOne(q: number) {
    const m = this.mask(q)
    let s = 0
    for (let i = 0; i < this.size; i++) if (i & m) s += this.re[i] ** 2 + this.im[i] ** 2
    return s
  }

  /** Bloch vector of qubit q's reduced state. Length < 1 means it is entangled. */
  bloch(q: number): { x: number; y: number; z: number } {
    const m = this.mask(q)
    let p0 = 0
    let p1 = 0
    let r01re = 0
    let r01im = 0
    for (let i = 0; i < this.size; i++) {
      if (i & m) continue
      const j = i | m
      p0 += this.re[i] ** 2 + this.im[i] ** 2
      p1 += this.re[j] ** 2 + this.im[j] ** 2
      // ρ01 += a_i · conj(a_j)
      r01re += this.re[i] * this.re[j] + this.im[i] * this.im[j]
      r01im += this.im[i] * this.re[j] - this.re[i] * this.im[j]
    }
    return { x: 2 * r01re, y: -2 * r01im, z: p0 - p1 }
  }

  label(i: number) {
    return i.toString(2).padStart(this.n, '0')
  }

  /** Draw `shots` measurement outcomes in the computational basis. */
  sample(shots: number, rng: () => number = Math.random): number[] {
    const p = this.probabilities()
    const cdf = new Float64Array(p.length)
    let acc = 0
    p.forEach((v, i) => (cdf[i] = acc += v))
    const counts = new Array<number>(p.length).fill(0)
    for (let s = 0; s < shots; s++) {
      const r = rng() * acc
      let lo = 0
      let hi = cdf.length - 1
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (cdf[mid] < r) lo = mid + 1
        else hi = mid
      }
      counts[lo]++
    }
    return counts
  }

  /** |⟨other|this⟩|² */
  fidelity(other: State) {
    let re = 0
    let im = 0
    for (let i = 0; i < this.size; i++) {
      re += other.re[i] * this.re[i] + other.im[i] * this.im[i]
      im += other.re[i] * this.im[i] - other.im[i] * this.re[i]
    }
    return re * re + im * im
  }
}

/* ───────────── single-qubit helpers for the Bloch sphere ───────────── */

/** Amplitudes (α, β) → polar/azimuth angles on the Bloch sphere. */
export function toAngles(alpha: C, beta: C) {
  const theta = 2 * Math.acos(Math.min(1, Math.sqrt(abs2(alpha))))
  const phi = abs2(beta) < 1e-12 || abs2(alpha) < 1e-12 ? 0 : phaseOf(beta) - phaseOf(alpha)
  return { theta, phi: ((phi % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) }
}

export function fromAngles(theta: number, phi: number): State {
  return State.fromAmplitudes([c(Math.cos(theta / 2)), c(Math.cos(phi) * Math.sin(theta / 2), Math.sin(phi) * Math.sin(theta / 2))])
}

/* ───────────── deterministic randomness for reproducible labs ───────────── */

export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ───────────── Grover ───────────── */

/** One Grover iteration (oracle + diffusion) on real amplitudes, in place. */
export function groverStep(amps: number[], marked: number): { afterOracle: number[]; after: number[]; mean: number } {
  const afterOracle = amps.map((a, i) => (i === marked ? -a : a))
  const mean = afterOracle.reduce((s, a) => s + a, 0) / afterOracle.length
  const after = afterOracle.map((a) => 2 * mean - a)
  return { afterOracle, after, mean }
}

/** Closed form: P(success) after k iterations with N items and one marked item. */
export function groverSuccess(N: number, k: number) {
  const th = Math.asin(1 / Math.sqrt(N))
  return Math.sin((2 * k + 1) * th) ** 2
}

/** Iteration count that maximises success; ≈ (π/4)·√N for large N. */
export function groverOptimalIterations(N: number) {
  const th = Math.asin(1 / Math.sqrt(N))
  return Math.max(0, Math.round(Math.PI / (4 * th) - 0.5))
}
