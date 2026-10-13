/**
 * Names of everything content may reference by string. Kept free of React so
 * the Node validator can import it. When you add a widget, plugin shot or
 * cover, register the component in src/plugins/registry.tsx AND list it here.
 */

export interface WidgetInfo {
  /** One line for authors: what it does and which props it takes. */
  about: string
  /** Capture keys this widget can emit into the learner's dossier. */
  captures?: boolean
}

export const WIDGETS: Record<string, WidgetInfo> = {
  // Generic — usable by any subject
  'card-sort': {
    about:
      'Sort cards into buckets. props: { buckets: string[], cards: {text, bucket, why, cite?}[] }',
  },
  sequence: {
    about: 'Put events in order. props: { items: {label, detail?, cite?}[] } (listed in correct order)',
  },
  estimator: {
    about:
      'Guess a number on a (log) slider, then reveal. props: { question, answer, min, max, log?, unit?, reveal, cite? }',
  },
  // Quantum computing plugin
  'bloch-explorer': {
    about: 'Single-qubit Bloch sphere with gates. props: { goal?: "plus"|"minus"|"one"|"i"|"minus-i", capture? }',
    captures: true,
  },
  'measurement-sampler': {
    about: 'Measure a qubit many times; watch frequencies converge. props: { theta? }',
  },
  'circuit-lab': {
    about:
      'Up-to-4-qubit circuit builder with exact statevector. props: { qubits, columns, challenge?: "bell"|"ghz"|"ones"|"free", capture? }',
    captures: true,
  },
  'scale-explorer': {
    about: 'Slider showing how classical memory for a statevector explodes with qubit count.',
  },
  'grover-lab': {
    about: 'Step through Grover iterations on 3–6 qubits. props: { qubits? }',
  },
  'pricing-race': {
    about:
      'European call: Black–Scholes vs classical Monte Carlo vs ideal amplitude estimation. props: { capture? }',
    captures: true,
  },
  'portfolio-lab': {
    about:
      'Markowitz → QUBO → brute force / annealing / QAOA, standard and constraint-preserving (exact simulation). props: { capture? }',
    captures: true,
  },
  // Oncology plugin (quantum-oncology course)
  'tumour-growth': {
    about: 'Exponential/Gompertz tumour growth from one cell, then chemotherapy under log-kill or Norton–Simon. props: { capture? }',
    captures: true,
  },
  'survival-lab': {
    about: 'Kaplan–Meier, log-rank and Cox on the 1963 6-MP leukaemia trial, then simulated trials and power. props: { capture? }',
    captures: true,
  },
  'leakage-lab': {
    about: 'Selection bias on pure-noise omics data: gene selection before v. inside cross-validation. props: { capture? }',
    captures: true,
  },
  'vqe-lab': {
    about: 'VQE on H₂ (PySCF Hamiltonians, 4 qubits) with shot noise, parameter-shift gradients and a dissociation curve. props: { capture? }',
    captures: true,
  },
  'panel-qubo': {
    about: 'Biomarker-panel selection as an mRMR-style QUBO: greedy v. brute force, annealing and XY-mixer QAOA; validation accuracy. Synthetic data. props: { capture? }',
    captures: true,
  },
  // Art-forgery plugin
  'exam-bench': {
    about:
      'Examine a synthetic portrait under visible, raking, UV, infrared and X-ray light; log findings. props: { items: {id, mode, region, title, finding, reading, hint, why, cite?}[], capture? }',
    captures: true,
  },
  'pigment-lab': {
    about:
      'Pigment dating (terminus post quem). props: { items: {id, name, earliest|null, when, elements?, cite?}[], cases: {id, title, claimed, claimLabel, synthetic, context, found[], expect, reveal, cite?, caseFile?}[], capture? }',
    captures: true,
  },
  'dendro-lab': {
    about:
      'Tree-ring dating of oak panels (sapwood statistics + seasoning). props: { cases: {id, title, synthetic, context, origin, lastRing, claimed, claimLabel, seasoning, expect, reveal, cite?, caseFile?}[], capture? }',
    captures: true,
  },
  'carbon-lab': {
    about:
      'Bomb-peak radiocarbon: find every year matching a measured F14C on the real 1950–2019 curve. props: { cases: {id, title, synthetic, sample, context, F, sigma, reveal, cite?, caseFile?}[], capture? }',
    captures: true,
  },
  'provenance-lab': {
    about:
      'Grade each link of a chain of ownership; coverage, gaps and 1933–45 computed. props: { title, start, end, items: {id, from, to, owner, record, answer, why, cite?}[], capture? }',
    captures: true,
  },
}

/** Plugin shots usable inside reels with { kind: "plugin", plugin: "<name>" }. */
export const PLUGIN_SHOTS: Record<string, string> = {
  circuit: 'Draws a quantum circuit gate by gate. props: { qubits, gates: [{gate, targets[], controls?[], col}] , showState? }',
  bloch: 'Animates a Bloch vector through states. props: { path: [{theta, phi, label}] } — angles in degrees',
  growth: 'Shows 2^n amplitudes and the memory they need. props: { from, to }',
  layers: 'Builds a paint cross-section from the bottom up. props: { layers: {kind: support|canvas|ground|underdrawing|paint|glaze|varnish|dirt, label}[], highlight? }',
  scan: 'Wipes the synthetic case-file portrait from visible light to another mode. props: { mode: raking|uv|ir|xray, notes?: string[] }',
}

/** Generative covers in src/ui/covers.tsx */
export const COVERS = ['interference', 'contours', 'lattice', 'tide', 'craquelure'] as const

/** Domains allowed in `embed` steps with provider "iframe". */
export const IFRAME_ALLOWLIST = [
  'algassert.com',
  'www.youtube-nocookie.com',
  'phet.colorado.edu',
  'www.desmos.com',
  'observablehq.com',
]
