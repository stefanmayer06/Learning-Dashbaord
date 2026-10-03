import { useMemo, useState } from 'react'
import type { WidgetApi } from '../plugins/types'
import { LabFrame } from '../ui/LabFrame'
import { Glyph } from '../ui/Glyph'
import { Rich } from '../ui/Tex'

interface Card {
  text: string
  bucket: string
  why: string
  cite?: string[]
}

function shuffle<T>(xs: T[], seed: number) {
  const a = [...xs]
  let s = seed
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280
    const j = Math.floor((s / 233280) * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Sort statements into buckets; each card explains itself once checked. */
export function CardSort({ props, complete, done, Cite }: WidgetApi) {
  const buckets = (props.buckets as string[]) ?? []
  const cards = useMemo(() => shuffle((props.cards as Card[]) ?? [], 7), [props.cards])
  const [placed, setPlaced] = useState<Record<number, string>>({})
  const [selected, setSelected] = useState<number | null>(null)
  const [checked, setChecked] = useState(false)

  const unplaced = cards.map((_, i) => i).filter((i) => placed[i] === undefined)
  const allPlaced = unplaced.length === 0
  const correct = cards.filter((c, i) => placed[i] === c.bucket).length
  const allRight = checked && correct === cards.length

  const place = (bucket: string) => {
    if (selected === null) return
    setPlaced((p) => ({ ...p, [selected]: bucket }))
    setSelected(unplaced.find((i) => i !== selected) ?? null)
    setChecked(false)
  }

  const check = () => {
    setChecked(true)
    if (correct === cards.length) complete(1)
  }

  const retryWrong = () => {
    setPlaced((p) => {
      const next = { ...p }
      cards.forEach((c, i) => {
        if (next[i] !== c.bucket) delete next[i]
      })
      return next
    })
    setChecked(false)
    setSelected(null)
  }

  return (
    <LabFrame
      goal={`Sort all ${cards.length} cards correctly`}
      met={allRight}
      aside={checked ? <><span className="mono">{correct}/{cards.length}</span> correct</> : done ? 'Completed earlier · sort again to practise' : null}
    >
      <div className="sort">
        <div className="sort-deck" role="group" aria-label="Cards to sort">
          {unplaced.length ? (
            unplaced.map((i) => (
              <button key={i} className={`sort-card ${selected === i ? 'selected' : ''}`} onClick={() => setSelected(i)} aria-pressed={selected === i}>
                <Rich text={cards[i].text} />
              </button>
            ))
          ) : (
            <p className="sort-empty">
              <Glyph name="checkCircle" size={18} /> All cards placed. {checked ? '' : 'Check your sort.'}
            </p>
          )}
        </div>
        <p className={`sort-hint ${selected !== null ? 'armed' : ''}`} aria-live="polite">
          {selected !== null ? (
            <>
              <Glyph name="down" size={16} /> Now choose a bucket
            </>
          ) : unplaced.length ? (
            <>
              <Glyph name="info" size={16} /> Pick a card, then a bucket
            </>
          ) : null}
        </p>
        <div className="sort-buckets" style={{ gridTemplateColumns: `repeat(${buckets.length}, minmax(0, 1fr))` }}>
          {buckets.map((b) => (
            <div key={b} className={`sort-bucket ${selected !== null ? 'armed' : ''}`}>
              <button className="sort-bucket-head" onClick={() => place(b)} disabled={selected === null}>
                <span>{b}</span>
                {selected !== null ? (
                  <span className="sort-bucket-cta">
                    Place here <Glyph name="down" size={14} />
                  </span>
                ) : (
                  <span className="sort-bucket-count" aria-label={`${cards.filter((_, i) => placed[i] === b).length} cards`}>
                    {cards.filter((_, i) => placed[i] === b).length}
                  </span>
                )}
              </button>
              <ul>
                {cards.map((c, i) =>
                  placed[i] === b ? (
                    <li key={i} className={checked ? (c.bucket === b ? 'right' : 'wrong') : ''}>
                      <button
                        className="sort-placed"
                        onClick={() => {
                          if (checked && c.bucket === b) return
                          setPlaced((p) => {
                            const n = { ...p }
                            delete n[i]
                            return n
                          })
                          setChecked(false)
                        }}
                        title={checked && c.bucket === b ? undefined : 'Take back'}
                      >
                        {checked && <Glyph name={c.bucket === b ? 'check' : 'cross'} size={16} />}
                        <Rich text={c.text} />
                      </button>
                      {checked && (
                        <p className="sort-why">
                          {c.bucket !== b && <strong>Belongs in “{c.bucket}”. </strong>}
                          <Rich text={c.why} />
                          {c.cite?.length ? <Cite ids={c.cite} /> : null}
                        </p>
                      )}
                    </li>
                  ) : null,
                )}
              </ul>
            </div>
          ))}
        </div>
        <div className="lab-actions">
          {checked && !allRight ? (
            <button className="btn btn-small" onClick={retryWrong}>
              Retry the wrong ones <Glyph name="restart" size={14} />
            </button>
          ) : (
            <button className="btn btn-small" onClick={check} disabled={!allPlaced || checked}>
              Check sort <Glyph name="check" size={14} />
            </button>
          )}
        </div>
      </div>
    </LabFrame>
  )
}
