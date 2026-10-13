import { useEffect, useMemo, useState } from 'react'
import type { WidgetApi } from '../../types'
import { LabFrame, Readout, Slider } from '../../../ui/LabFrame'
import { Glyph } from '../../../ui/Glyph'
import { LineChart, Legend } from '../../../ui/charts'
import { CHEMICAL_ACCURACY, GEOMETRIES, exactEnergy, geometryAt, landscape, runVqe } from '../chem'

const mha = (e: number) => `${(e * 1000).toFixed(2)} mHa`

interface Result {
  r: number
  energy: number // the reported, measured energy
  error: number
  stderr: number
  shots: number
  measurements: number
}

/** VQE on H₂: real PySCF Hamiltonians, a one-parameter ansatz, shot noise and parameter-shift gradients. */
export function VqeLab({ complete, done, capture, captured, Cite }: WidgetApi) {
  const [r, setR] = useState(0.75)
  const g = geometryAt(r)
  const [theta, setTheta] = useState(0)
  const [logShots, setLogShots] = useState(3)
  const [steps, setSteps] = useState(25)
  const shots = Math.round(10 ** logShots)
  const [trace, setTrace] = useState<ReturnType<typeof runVqe> | null>(null)
  const [seed, setSeed] = useState(1)
  const [results, setResults] = useState<Result[]>([])

  useEffect(() => setTrace(null), [r, logShots, steps])
  const land = useMemo(() => landscape(g), [g])
  const eNow = exactEnergy(g, theta)

  const optimise = () => {
    const s = seed + 1
    setSeed(s)
    const run = runVqe(g, { theta0: theta, shots, steps, rate: 0.6, seed: s })
    setTrace(run)
    setTheta(run.theta)
    const res = { r: g.r, energy: run.reported, error: run.reported - g.fci, stderr: run.stderr, shots, measurements: run.measurements }
    setResults((prev) => [...prev.filter((x) => x.r !== g.r), res].sort((a, b) => a.r - b.r))
  }
  // precise as well as close: a lucky low-shot estimate doesn't count
  const accurate = results.filter((x) => Math.abs(x.error) < CHEMICAL_ACCURACY && x.stderr < CHEMICAL_ACCURACY)
  const met = accurate.length >= 2
  useEffect(() => {
    if (met && !done) complete()
  }, [met, done, complete])

  const curveHF = GEOMETRIES.map((x) => [x.r, x.hf] as [number, number])
  const curveFCI = GEOMETRIES.map((x) => [x.r, x.fci] as [number, number])
  const terms = Object.entries(g.terms).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))

  return (
    <LabFrame
      goal="Reach chemical accuracy at two bond lengths: reported error and its ± both under 1.6 mHa, with shot noise on"
      met={done || met}
      aside={<span className="mono">{accurate.length}/2</span>}
      onSave={
        capture && results.length
          ? () =>
              capture(
                `H₂ / STO-3G VQE: ${results.map((x) => `${x.r.toFixed(2)} Å error ${mha(x.error)} (${x.shots.toLocaleString('en-US')} shots/term, ${x.measurements.toLocaleString('en-US')} measurements)`).join('; ')} · chemical accuracy = 1.6 mHa`,
                { results },
              )
          : undefined
      }
      captured={captured}
    >
      <div className="onc-grid">
        <div>
          <h2 className="lab-h">The molecule and its qubit Hamiltonian</h2>
          <Slider label="H–H bond length" value={r} min={0.3} max={2.5} step={0.05} onChange={setR} format={(v) => `${v.toFixed(2)} Å`} />
          <p className="small soft lab-sub">
            4 spin orbitals → 4 qubits (Jordan–Wigner). {terms.length} Pauli terms, computed with PySCF.
            <Cite ids={['h2-sto3g', 'jw-qubits']} />
          </p>
          <div className="lab-table-wrap onc-terms">
            <table className="lab-table">
              <thead>
                <tr>
                  <th scope="col">Pauli string</th>
                  <th scope="col" className="num-col">Coefficient (Ha)</th>
                </tr>
              </thead>
              <tbody>
                {terms.map(([label, c]) => (
                  <tr key={label}>
                    <td className="mono">{label === 'IIII' ? 'IIII (constant)' : label}</td>
                    <td className="mono num-col">{c.toFixed(5)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small soft lab-note">
            Ansatz: |ψ(θ)⟩ = cos(θ/2)|1100⟩ − sin(θ/2)|0011⟩ — Hartree–Fock plus one double excitation. θ = 0 is Hartree–Fock.
          </p>
        </div>

        <div>
          <h2 className="lab-h">Energy landscape E(θ)</h2>
          <Slider label="Angle θ" value={theta} min={-Math.PI} max={Math.PI} step={0.01} onChange={setTheta} format={(v) => v.toFixed(2)} />
          <LineChart
            series={[{ name: 'E(θ)', points: land, tone: 'ink' }, ...(trace ? [{ name: 'VQE path', points: trace.trace.map((t) => [t.theta, t.energy] as [number, number]), tone: 'accent' as const }] : [])]}
            xLabel="θ (radians)"
            yLabel="Energy (hartree)"
            hline={{ y: g.fci, label: `exact ${g.fci.toFixed(4)}` }}
            marker={{ x: theta, y: eNow }}
            height={230}
          />
          <Slider label="Shots per Pauli term" value={logShots} min={1} max={6} step={0.25} onChange={setLogShots} format={() => shots.toLocaleString('en-US')} />
          <Slider label="Optimisation steps" value={steps} min={5} max={60} step={5} onChange={setSteps} />
          <div className="lab-actions">
            <button className="btn btn-small" onClick={optimise}>
              Run VQE from this θ <Glyph name="play" size={12} />
            </button>
            <button className="btn btn-small btn-ghost" onClick={() => setTheta(0)}>
              Reset to Hartree–Fock
            </button>
          </div>
          <div className="readouts">
            <Readout label="E(θ) now, exact" value={eNow.toFixed(5)} />
            <Readout label="Error vs exact" value={mha(eNow - g.fci)} tone={Math.abs(eNow - g.fci) < CHEMICAL_ACCURACY ? 'good' : 'red'} />
            <Readout label="Hartree–Fock misses" value={mha(g.hf - g.fci)} />
          </div>
          {trace && (
            <div className="readouts">
              <Readout label="Reported energy (measured)" value={`${trace.reported.toFixed(5)} ± ${(trace.stderr * 1000).toFixed(2)} mHa`} tone="accent" />
              <Readout
                label="Reported error"
                value={mha(trace.reported - g.fci)}
                tone={Math.abs(trace.reported - g.fci) < CHEMICAL_ACCURACY && trace.stderr < CHEMICAL_ACCURACY ? 'good' : 'red'}
              />
              <Readout label="Measurements used" value={trace.measurements.toLocaleString('en-US')} />
            </div>
          )}
          <p className="small soft lab-note">
            Gradients come from the parameter-shift rule: two energy estimates at θ ± π/2. Each estimate measures all 14 non-constant terms with the chosen number of shots, and
            the energy you report is measured too — its noise falls only as 1/√shots. Here chemical accuracy takes roughly 10⁴–10⁵ shots per term — on the order of 10⁸ measurements for a whole run.
            <Cite ids={['shot-noise', 'chemical-accuracy']} />
          </p>
        </div>
      </div>

      <section className="lab-section">
        <h2 className="lab-h">Dissociation curve</h2>
        <LineChart
          series={[
            { name: 'Hartree–Fock', points: curveHF, tone: 'faint', dashed: true },
            { name: 'exact (FCI)', points: curveFCI, tone: 'ink' },
            ...results.map((x) => ({ name: `VQE ${x.r}`, points: [[x.r, x.energy - 0.004], [x.r, x.energy + 0.004]] as [number, number][], tone: 'accent' as const })),
          ]}
          xLabel="Bond length (Å)"
          yLabel="Energy (hartree)"
          marker={{ x: g.r, y: g.fci, label: `${g.r.toFixed(2)} Å` }}
          height={240}
        />
        <Legend
          items={[
            { label: 'Hartree–Fock (mean field)', tone: 'faint', dashed: true },
            { label: 'exact in this basis', tone: 'ink' },
            { label: 'your VQE runs', tone: 'accent' },
          ]}
        />
        <p className="small soft lab-note">
          Stretch the bond and Hartree–Fock fails badly: the electrons become strongly correlated. That regime — not H₂ itself — is where quantum computers might one day beat
          classical methods for drug-relevant chemistry. H₂ here is a 4-qubit toy that a laptop solves exactly.
        </p>
      </section>
    </LabFrame>
  )
}
