import { useState, type ReactNode } from 'react'
import { Glyph } from './Glyph'
import type { Capture } from '../store/model'

/** A small target mark for an unmet goal (drawn on the same 20×20 grid as the glyph set). */
function GoalMark() {
  return (
    <svg viewBox="0 0 20 20" width={18} height={18} aria-hidden style={{ flex: 'none' }}>
      <circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="10" cy="10" r="2.4" fill="currentColor" />
    </svg>
  )
}

/**
 * Consistent chrome for interactives: a goal callout that turns green when met,
 * the lab body, and (when the step captures) a "Save to notebook" action.
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
      <header className="lab-head">
        <div className={`lab-goal ${met ? 'met' : ''}`}>
          <span className="lab-goal-icon" aria-hidden>
            {met ? <Glyph name="check" size={16} /> : <GoalMark />}
          </span>
          <div className="lab-goal-main">
            <span className="lab-goal-label">{met ? 'Goal complete' : 'Your goal'}</span>
            <span className="lab-goal-text">{goal}</span>
          </div>
          {aside && <span className="lab-goal-aside">{aside}</span>}
        </div>
      </header>
      <div className="lab-body">{children}</div>
      {onSave && (
        <footer className={`lab-foot ${captured ? 'saved' : ''}`}>
          {captured ? (
            <div className="lab-saved callout callout-good" role="status">
              <Glyph name="checkCircle" size={20} />
              <div className="lab-saved-text">
                <strong>Saved to your notebook</strong>
                <span className="lab-captured">{captured.summary}</span>
              </div>
            </div>
          ) : (
            <div className="lab-foot-note">
              <Glyph name="output" size={18} />
              <span>Save your result to add it to your work output.</span>
            </div>
          )}
          <button
            className={`btn btn-small ${captured || !met ? 'btn-ghost' : ''}`}
            onClick={() => {
              onSave()
              setJustSaved(true)
              setTimeout(() => setJustSaved(false), 1600)
            }}
          >
            {justSaved ? 'Saved' : captured ? 'Save again' : saveLabel}
            <Glyph name={justSaved ? 'check' : 'output'} size={16} />
          </button>
        </footer>
      )}
    </section>
  )
}

export function Readout({ label, value, tone }: { label: string; value: ReactNode; tone?: 'accent' | 'red' | 'good' }) {
  return (
    <div className={`readout ${tone ? 'readout-' + tone : ''}`}>
      <span className="readout-label">{label}</span>
      <span className="readout-v mono">{value}</span>
    </div>
  )
}

/** A pill toggle group. Each option is a toggle button (aria-pressed); `.on` marks the chosen one. */
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
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" aria-pressed={o.value === value} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
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
        <span className="slider-label">{label}</span>
        <span className="mono slider-v">{format ? format(value) : value}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}
