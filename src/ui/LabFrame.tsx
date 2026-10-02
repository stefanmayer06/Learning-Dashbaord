import { useState, type ReactNode } from 'react'
import { Glyph } from './Glyph'
import type { Capture } from '../store/model'

/**
 * Consistent chrome for interactives: a goal line that ticks when met, the
 * lab body, and (when the step captures) a "Save to notebook" action.
 */
export function LabFrame({
  goal,
  met,
  children,
  onSave,
  captured,
  saveLabel = 'Save to notebook',
  aside,
}: {
  goal: ReactNode
  met: boolean
  children: ReactNode
  onSave?: () => void
  captured?: Capture
  saveLabel?: string
  aside?: ReactNode
}) {
  const [justSaved, setJustSaved] = useState(false)
  return (
    <section className="lab">
      <header className={`lab-goal ${met ? 'met' : ''}`}>
        <span className="lab-goal-box" aria-hidden>
          {met ? <Glyph name="check" size={14} /> : null}
        </span>
        <span className="label">{met ? 'Goal met' : 'Goal'}</span>
        <span className="lab-goal-text">{goal}</span>
        {aside && <span className="lab-goal-aside">{aside}</span>}
      </header>
      <div className="lab-body">{children}</div>
      {onSave && (
        <footer className="lab-foot">
          <div className="lab-foot-note">
            {captured ? (
              <>
                <span className="label label-faint">In your notebook</span>
                <span className="lab-captured">{captured.summary}</span>
              </>
            ) : (
              <span className="label label-faint">Your saved result becomes part of your work output</span>
            )}
          </div>
          <button
            className="btn btn-small"
            onClick={() => {
              onSave()
              setJustSaved(true)
              setTimeout(() => setJustSaved(false), 1600)
            }}
          >
            {justSaved ? 'Saved' : captured ? 'Save again' : saveLabel}
            <Glyph name={justSaved ? 'check' : 'output'} size={14} />
          </button>
        </footer>
      )}
    </section>
  )
}

export function Readout({ label, value, tone }: { label: string; value: ReactNode; tone?: 'accent' | 'red' | 'good' }) {
  return (
    <div className={`readout ${tone ? 'readout-' + tone : ''}`}>
      <span className="label label-faint">{label}</span>
      <span className="readout-v mono">{value}</span>
    </div>
  )
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: ReactNode }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} role="radio" aria-checked={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  format?: (v: number) => string
}) {
  return (
    <label className="slider">
      <span className="slider-top">
        <span className="label">{label}</span>
        <span className="mono slider-v">{format ? format(value) : value}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}
