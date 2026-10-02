import type { ComponentType, ReactNode } from 'react'
import type { Capture } from '../store/model'

/** What every interactive receives from the lesson player. */
export interface WidgetApi {
  props: Record<string, unknown>
  done: boolean
  /** Marks the step complete (optionally with a 0..1 score). */
  complete: (score?: number) => void
  /** Present when the step declares `props.capture`: saves a result to the dossier. */
  capture?: (summary: string, payload: unknown) => void
  captured?: Capture
  /** Renders citation markers for claim ids (numbered like the margin notes). */
  Cite: ComponentType<{ ids: string[] }>
  accent: string
}

export type Widget = ComponentType<WidgetApi>

export interface PluginShotApi {
  props: Record<string, unknown>
  p: number
  reduced: boolean
}

export type PluginShot = ComponentType<PluginShotApi>

export type Children = { children?: ReactNode }
