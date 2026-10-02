import { useEffect, useState } from 'react'
import type { WidgetApi } from '../../types'
import { LabFrame, Readout } from '../../../ui/LabFrame'
import { bytesLabel } from '../shots'

/** Reference machines are plain unit thresholds, so every number here is arithmetic. */
const REFS = [
  { label: 'a 16 GB laptop', bytes: 16e9 },
  { label: 'a 1 TB server', bytes: 1e12 },
  { label: '1 PB of memory', bytes: 1e15 },
  { label: '1 EB (a million TB)', bytes: 1e18 },
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
        <div className="scale-dial">
          <label className="label" htmlFor="scale-n">
            qubits
          </label>
          <div className="scale-n display">{n}</div>
          <input id="scale-n" type="range" min={1} max={64} step={1} value={n} onChange={(e) => setN(Number(e.target.value))} />
        </div>
        <div className="scale-out">
          <Readout label="complex amplitudes = 2ⁿ" value={amps.toLocaleString('en-US')} />
          <Readout label="memory at 16 bytes each (complex128)" value={bytesLabel(bytes)} tone="red" />
          <ul className="scale-refs">
            {REFS.map((r) => {
              const fits = bytes <= r.bytes
              const maxN = Math.floor(Math.log2(r.bytes / 16))
              return (
                <li key={r.label} className={fits ? 'fits' : 'no'}>
                  <span className="scale-ref-mark">{fits ? '✓' : '✗'}</span>
                  <span>
                    {fits ? 'fits in' : 'too big for'} {r.label}
                  </span>
                  <span className="mono faint">max ≈ {maxN} qubits</span>
                </li>
              )
            })}
          </ul>
          <div className="scale-bar" aria-hidden>
            <span style={{ width: `${(n / 64) * 100}%` }} />
            {REFS.map((r) => (
              <i key={r.label} style={{ left: `${(Math.log2(r.bytes / 16) / 64) * 100}%` }} title={r.label} />
            ))}
          </div>
          <p className="small soft">
            Each extra qubit doubles the memory. Caveat: this is the brute-force method. Clever classical techniques (tensor networks, for one) can simulate
            some circuits on far more qubits, which is why “quantum advantage” claims get challenged.
            {Array.isArray(props.cite) && <Cite ids={props.cite as string[]} />}
          </p>
        </div>
      </div>
    </LabFrame>
  )
}
