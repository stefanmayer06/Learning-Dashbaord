import { useState } from 'react'
import type { WidgetApi } from '../plugins/types'
import { LabFrame } from '../ui/LabFrame'
import { Glyph } from '../ui/Glyph'
import { Rich } from '../ui/Tex'

/** Commit to a guess before seeing the real (sourced) number. Calibrates intuition. */
export function Estimator({ props, complete, done, Cite }: WidgetApi) {
  const min = Number(props.min ?? 1)
  const max = Number(props.max ?? 1000)
  const log = Boolean(props.log)
  const answer = Number(props.answer)
  const unit = (props.unit as string) ?? ''
  const toPos = (v: number) => (log ? (Math.log10(v) - Math.log10(min)) / (Math.log10(max) - Math.log10(min)) : (v - min) / (max - min))
  const fromPos = (p: number) => (log ? 10 ** (Math.log10(min) + p * (Math.log10(max) - Math.log10(min))) : min + p * (max - min))
  // start the slider well away from the answer, so the default is never a lucky guess
  const [pos, setPos] = useState(() => (toPos(answer) > 0.5 ? 0.12 : 0.88))
  const [locked, setLocked] = useState(false)
  // revisiting a finished step: show the answer, but don't pretend we know the old guess
  const revisit = done && !locked
  const guess = fromPos(pos)
  const nice = (v: number) => (v >= 100 ? Math.round(v).toLocaleString('en-US') : v.toPrecision(2))
  const ratio = guess > answer ? guess / answer : answer / guess

  return (
    <LabFrame goal="Lock in a guess, then see the sourced answer" met={done || locked}>
      {revisit && (
        <p className="small soft est-revisit">
          You've done this one. The answer: <strong className="mono">{nice(answer)} {unit}</strong>. Guess again below if you like.
        </p>
      )}
      <p className="est-q">
        <Rich text={String(props.question)} />
      </p>
      <div className="est-scale">
        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={pos}
          disabled={locked}
          onChange={(e) => setPos(Number(e.target.value))}
          aria-label="Your estimate"
          aria-valuetext={`${nice(guess)} ${unit}`}
        />
        <div className="est-track-labels mono">
          <span>{nice(min)}</span>
          <span>{nice(max)}</span>
        </div>
        {locked && <span className="est-answer-mark" style={{ left: `${toPos(answer) * 100}%` }} aria-hidden />}
      </div>
      <div className="est-readouts">
        <div>
          <span className="label label-faint">Your guess</span>
          <div className="est-big">
            {nice(guess)} <small>{unit}</small>
          </div>
        </div>
        {locked && (
          <div className="est-reveal">
            <span className="label" style={{ color: 'var(--margin-red)' }}>
              Sourced answer
            </span>
            <div className="est-big est-red">
              {nice(answer)} <small>{unit}</small>
            </div>
          </div>
        )}
      </div>
      {locked ? (
        <div className="est-explain">
          <p className="mono est-off">{ratio < 1.25 ? 'Within 25% — sharp.' : `Off by a factor of ${ratio < 10 ? ratio.toFixed(1) : Math.round(ratio)}.`}</p>
          <p>
            <Rich text={String(props.reveal)} />
            {Array.isArray(props.cite) && <Cite ids={props.cite as string[]} />}
          </p>
        </div>
      ) : (
        <div className="lab-actions">
          <button
            className="btn btn-small"
            onClick={() => {
              setLocked(true)
              complete()
            }}
          >
            Lock in guess <Glyph name="lock" size={14} />
          </button>
        </div>
      )}
    </LabFrame>
  )
}
