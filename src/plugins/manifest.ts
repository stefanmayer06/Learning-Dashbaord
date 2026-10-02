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
}

/** Plugin shots usable inside reels with { kind: "plugin", plugin: "<name>" }. */
export const PLUGIN_SHOTS: Record<string, string> = {
  circuit: 'Draws a quantum circuit gate by gate. props: { qubits, gates: [{gate, targets[], controls?[], col}] , showState? }',
  bloch: 'Animates a Bloch vector through states. props: { path: [{theta, phi, label}] } — angles in degrees',
  growth: 'Shows 2^n amplitudes and the memory they need. props: { from, to }',
}

/** Generative covers in src/ui/covers.tsx */
export const COVERS = ['interference', 'contours', 'lattice', 'tide'] as const

/** Domains allowed in `embed` steps with provider "iframe". */
export const IFRAME_ALLOWLIST = [
  'algassert.com',
  'www.youtube-nocookie.com',
  'phet.colorado.edu',
  'www.desmos.com',
  'observablehq.com',
]
