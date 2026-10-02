import { useState } from 'react'
import type { Step } from '../content/schema'
import { Glyph } from '../ui/Glyph'
import { Rich } from '../ui/Tex'
import { CiteMarks } from '../ui/Cite'

type RecapT = Extract<Step, { type: 'recap' }>

/** Key points as flashcards: reveal them one by one, then confirm. */
export function RecapStep({ step, done, onDone }: { step: RecapT; done: boolean; onDone: () => void }) {
  const total = step.points.length
  const [shown, setShown] = useState(done ? total : 1)
  const all = shown >= total
  return (
    <div className="recap">
      <div className="recap-top">
        <span className="recap-count">
          {all ? `All ${total} key points` : `Key point ${shown} of ${total}`}
        </span>
        <span className="recap-dots" aria-hidden>
          {step.points.map((_, i) => (
            <span key={i} className={i < shown ? 'on' : ''} />
          ))}
        </span>
      </div>
      <ol className="recap-cards">
        {step.points.slice(0, shown).map((p, i) => (
          <li key={i} className={`recap-card${i === shown - 1 && !all ? ' newest' : ''}`}>
            <span className="recap-n" aria-hidden>
              {i + 1}
            </span>
            <p>
              <Rich text={p.text} />
              <CiteMarks ids={p.cite} />
            </p>
          </li>
        ))}
      </ol>
      <div className="recap-actions" hidden={all && done}>
        {!all ? (
          <button className="btn btn-ghost" onClick={() => setShown((s) => s + 1)}>
            Next card <Glyph name="arrow" className="arrow" size={16} />
          </button>
        ) : (
          !done && (
            <button className="btn" onClick={onDone}>
              <Glyph name="check" size={16} /> Got it
            </button>
          )
        )}
      </div>
    </div>
  )
}
