import { useEffect, useState } from 'react'
import type { WidgetApi } from '../../types'
import { LabFrame, Readout } from '../../../ui/LabFrame'
import { Glyph } from '../../../ui/Glyph'
import { bytesLabel } from '../shots'

/** Reference machines are plain unit thresholds, so every number here is arithmetic. */
const REFS = [
  { label: 'a 16 GB laptop', short: '16 GB', bytes: 16e9 },
  { label: 'a 1 TB server', short: '1 TB', bytes: 1e12 },
  { label: '1 PB of memory', short: '1 PB', bytes: 1e15 },
  { label: '1 EB (a million TB)', short: '1 EB', bytes: 1e18 },
]

export function ScaleExplorer({ complete, done, Cite, props }: WidgetApi) {
  const [n, setN] = useState(10)
  const amps = 2n ** BigInt(n)
  const bytes = 16 * 2 ** n
  const met = n >= 46
  useEffect(() => {
    if (met && !done) complete()
  }, [met, done, complete])

  return (
    <LabFrame goal="Find the qubit count where the full state no longer fits in a petabyte of memory" met={done || met}>
      <div className="scale">
        <div className="scale-dial lab-panel">
          <label className="scale-dial-label" htmlFor="scale-n">
            Qubits
          </label>
          <div className="scale-n mono" aria-live="polite">
            {n}
          </div>
          <input id="scale-n" type="range" min={1} max={64} step={1} value={n} onChange={(e) => setN(Number(e.target.value))} />
          <div className="scale-dial-ends mono" aria-hidden>
            <span>1</span>
            <span>64</span>
          </div>
        </div>
        <div className="scale-out">
          <div className="readouts readouts-2">
            <Readout label="Complex amplitudes = 2ⁿ" value={amps.toLocaleString('en-US')} />
            <Readout label="Memory at 16 bytes each (complex128)" value={bytesLabel(bytes)} tone="red" />
          </div>
          <div className="scale-bar" aria-hidden>
            <span style={{ width: `${(n / 64) * 100}%` }} />
            {REFS.map((r) => (
              <i key={r.label} style={{ left: `${(Math.log2(r.bytes / 16) / 64) * 100}%` }} title={r.label}>
                <b>{r.short}</b>
              </i>
            ))}
          </div>
          <ul className="scale-refs">
            {REFS.map((r) => {
              const fits = bytes <= r.bytes
              const maxN = Math.floor(Math.log2(r.bytes / 16))
              return (
                <li key={r.label} className={fits ? 'fits' : 'no'}>
                  <span className="scale-ref-mark">
                    <Glyph name={fits ? 'check' : 'cross'} size={14} />
                  </span>
                  <span>
                    <span className="visually-hidden">{fits ? 'Yes: ' : 'No: '}</span>
                    {fits ? 'Fits in' : 'Too big for'} {r.label}
                  </span>
                  <span className="scale-ref-max">
                    max ≈ <span className="mono">{maxN}</span> qubits
                  </span>
                </li>
              )
            })}
          </ul>
          <p className="small soft lab-note">
            Each extra qubit doubles the memory. Caveat: this is the brute-force method. Clever classical techniques (tensor networks, for one) can simulate
            some circuits on far more qubits, which is why “quantum advantage” claims get challenged.
            {Array.isArray(props.cite) && <Cite ids={props.cite as string[]} />}
          </p>
        </div>
      </div>
    </LabFrame>
  )
}
