/** True when the learner asked the OS for less motion. JS-driven animation must check this; CSS can't cover it. */
export function prefersReducedMotion() {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

export const scrollBehavior = (): ScrollBehavior => (prefersReducedMotion() ? 'auto' : 'smooth')
