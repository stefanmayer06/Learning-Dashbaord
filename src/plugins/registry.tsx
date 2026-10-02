/**
 * Maps the string names used in content to React components. Add new
 * interactives here AND in ./manifest.ts (which the validator reads).
 */
import type { PluginShot, Widget } from './types'
import { CardSort } from '../widgets/CardSort'
import { Sequence } from '../widgets/Sequence'
import { Estimator } from '../widgets/Estimator'
import { BlochExplorer } from './quantum/widgets/BlochExplorer'
import { MeasurementSampler } from './quantum/widgets/MeasurementSampler'
import { CircuitLab } from './quantum/widgets/CircuitLab'
import { ScaleExplorer } from './quantum/widgets/ScaleExplorer'
import { GroverLab } from './quantum/widgets/GroverLab'
import { PricingRace } from './quantum/widgets/PricingRace'
import { PortfolioLab } from './quantum/widgets/PortfolioLab'
import { BlochShot, CircuitShot, GrowthShot } from './quantum/shots'

export const WIDGET_COMPONENTS: Record<string, Widget> = {
  'card-sort': CardSort,
  sequence: Sequence,
  estimator: Estimator,
  'bloch-explorer': BlochExplorer,
  'measurement-sampler': MeasurementSampler,
  'circuit-lab': CircuitLab,
  'scale-explorer': ScaleExplorer,
  'grover-lab': GroverLab,
  'pricing-race': PricingRace,
  'portfolio-lab': PortfolioLab,
}

export const PLUGIN_SHOT_COMPONENTS: Record<string, PluginShot> = {
  circuit: CircuitShot,
  bloch: BlochShot,
  growth: GrowthShot,
}
