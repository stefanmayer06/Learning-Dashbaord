import { useMemo, useState } from 'react'
import type { WidgetApi } from '../plugins/types'
import { LabFrame } from '../ui/LabFrame'
import { Glyph } from '../ui/Glyph'
import { Rich } from '../ui/Tex'

interface Item {
  label: string
  detail?: string
  cite?: string[]
}

/** Put events in order. Items are authored in the correct order. */
export function Sequence({ props, complete, done, Cite }: WidgetApi) {
  const items = (props.items as Item[]) ?? []
  const initial = useMemo(() => {
    // deterministic derangement-ish shuffle so it never starts solved
    const idx = items.map((_, i) => i)
    for (let i = idx.length - 1; i > 0; i--) {
      const j = (i * 7 + 3) % (i + 1)
      ;[idx[i], idx[j]] = [idx[j], idx[i]]
    }
    if (idx.every((v, i) => v === i) && idx.length > 1) idx.reverse()
    return idx
  }, [items])
  const [order, setOrder] = useState(initial)
  const [checked, setChecked] = useState(false)
  const right = order.filter((v, i) => v === i).length
  const solved = checked && right === items.length

  const move = (pos: number, dir: -1 | 1) => {
    const to = pos + dir
    if (to < 0 || to >= order.length) return
    const next = [...order]
    ;[next[pos], next[to]] = [next[to], next[pos]]
    setOrder(next)
    setChecked(false)
  }

  return (
    <LabFrame goal="Put every event in the right order" met={done || solved} aside={checked ? <span className="mono">{right}/{items.length} in place</span> : null}>
      <ol className="seq">
        {order.map((item, pos) => {
          const it = items[item]
          const ok = checked && item === pos
          return (
            <li key={item} className={checked ? (ok ? 'right' : 'wrong') : ''}>
              <span className="seq-pos mono">{String(pos + 1).padStart(2, '0')}</span>
              <div className="seq-body">
                <div className="seq-label">
                  <Rich text={it.label} />
                </div>
                {solved && it.detail && (
                  <div className="seq-detail">
                    <Rich text={it.detail} />
                    {it.cite?.length ? <Cite ids={it.cite} /> : null}
                  </div>
                )}
              </div>
              <div className="seq-moves">
                <button onClick={() => move(pos, -1)} disabled={pos === 0 || solved} aria-label={`Move “${it.label}” earlier`}>
                  <Glyph name="up" size={14} />
                </button>
                <button onClick={() => move(pos, 1)} disabled={pos === order.length - 1 || solved} aria-label={`Move “${it.label}” later`}>
                  <Glyph name="down" size={14} />
                </button>
              </div>
            </li>
          )
        })}
      </ol>
      <div className="lab-actions">
        <button
          className="btn btn-small"
          disabled={solved}
          onClick={() => {
            setChecked(true)
            if (right === items.length) complete(1)
          }}
        >
          Check order <Glyph name="check" size={14} />
        </button>
      </div>
    </LabFrame>
  )
}
