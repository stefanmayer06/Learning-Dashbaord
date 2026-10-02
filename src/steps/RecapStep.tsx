import { useState } from 'react'
import type { Step } from '../content/schema'
import { Glyph } from '../ui/Glyph'
import { Rich } from '../ui/Tex'
import { CiteMarks } from '../ui/Cite'

type RecapT = Extract<Step, { type: 'recap' }>

/** Key points dealt like index cards; flip through, then confirm. */
export function RecapStep({ step, done, onDone }: { step: RecapT; done: boolean; onDone: () => void }) {
  const [shown, setShown] = useState(done ? step.points.length : 1)
  const all = shown >= step.points.length
  return (
    <div className="recap">
      <ol className="recap-cards">
        {step.points.slice(0, shown).map((p, i) => (
          <li key={i} className="recap-card" style={{ ['--i' as string]: i }}>
            <span className="recap-n mono">{String(i + 1).padStart(2, '0')}</span>
            <p>
              <Rich text={p.text} />
              <CiteMarks ids={p.cite} />
            </p>
          </li>
        ))}
      </ol>
      <div className="lab-actions">
        {!all ? (
          <button className="btn btn-ghost" onClick={() => setShown((s) => s + 1)}>
            Next card ({shown}/{step.points.length}) <Glyph name="arrow" className="arrow" size={14} />
          </button>
        ) : (
          !done && (
            <button className="btn" onClick={onDone}>
              Got it <Glyph name="check" size={14} />
            </button>
          )
        )}
      </div>
    </div>
  )
}
