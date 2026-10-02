import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useLearner } from '../store/LearnerProvider'
import { signInWithEmail, signOut, supabaseConfigured } from '../store/supabase'
import { listVoices, onVoicesChanged, pickVoice, speechSupported } from '../engine/reel/narrator'
import { Segmented } from '../ui/LabFrame'
import { Glyph, type GlyphName } from '../ui/Glyph'
import { Breadcrumbs } from '../ui/Shell'
import { SyncChip } from '../ui/SyncChip'
import type { LearnerState } from '../store/model'

const SECTIONS: { id: string; label: string; glyph: GlyphName }[] = [
  { id: 'profile', label: 'Profile', glyph: 'user' },
  { id: 'appearance', label: 'Appearance', glyph: 'lamp' },
  { id: 'narration', label: 'Narration', glyph: 'voice' },
  { id: 'data', label: 'Your data', glyph: 'download' },
  { id: 'sync', label: 'Sync', glyph: 'sync' },
]

const ON_OFF = [
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
]

function Row({ label, help, htmlFor, children }: { label: string; help?: ReactNode; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="set-row">
      <div className="set-row-text">
        {htmlFor ? (
          <label className="set-row-label" htmlFor={htmlFor}>
            {label}
          </label>
        ) : (
          <span className="set-row-label">{label}</span>
        )}
        {help && <p className="set-row-help">{help}</p>}
      </div>
      <div className="set-row-control">{children}</div>
    </div>
  )
}

function Card({ id, title, desc, extra, children }: { id: string; title: string; desc: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="card set-card" aria-labelledby={`${id}-title`}>
      <header className="set-card-head">
        <div>
          <h2 className="t-h3" id={`${id}-title`}>
            {title}
          </h2>
          <p className="set-card-desc">{desc}</p>
        </div>
        {extra}
      </header>
      <div className="set-card-body">{children}</div>
    </section>
  )
}

export function SettingsPage() {
  const { state, setName, setPrefs, sync, replaceAll } = useLearner()
  const { hash } = useLocation()
  const [voices, setVoices] = useState(listVoices())
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => onVoicesChanged(() => setVoices(listVoices())), [])
  // Lazy-loaded page: jump to /settings#data once the section exists.
  useEffect(() => {
    if (hash.length > 1) document.getElementById(hash.slice(1))?.scrollIntoView()
  }, [hash])
  const chosen = pickVoice(state.prefs.voiceURI)
  const hasVoices = speechSupported() && voices.length > 0

  return (
    <div className="pg settings">
      <header className="pg-head">
        <div className="page">
          <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Settings' }]} />
          <div className="pg-head-row">
            <div className="pg-head-text">
              <h1 className="display-m pg-title">Settings</h1>
              <p className="pg-desc">Your name, how lessons look and sound, and where your progress is stored.</p>
            </div>
          </div>
        </div>
      </header>

      <div className="page pg-body set-layout">
        <nav className="set-nav" aria-label="Settings sections">
          <ul>
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className={hash === `#${s.id}` ? 'active' : undefined}>
                  <Glyph name={s.glyph} size={17} />
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="set-main">
          <Card id="profile" title="Profile" desc="How you appear on certificates and exports.">
            <Row label="Name" htmlFor="set-name" help="Printed on certificates and work exports.">
              <input id="set-name" className="input" value={state.name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" />
            </Row>
          </Card>

          <Card id="appearance" title="Appearance" desc="Light, dark, or follow your device.">
            <Row label="Theme" help="System matches your operating system setting.">
              <Segmented
                label="Theme"
                value={state.prefs.theme}
                onChange={(v) => setPrefs({ theme: v })}
                options={[
                  { value: 'system', label: 'System' },
                  { value: 'light', label: 'Light' },
                  { value: 'dark', label: 'Dark' },
                ]}
              />
            </Row>
          </Card>

          <Card id="narration" title="Narration" desc="How videos speak and caption.">
            <Row label="Narration" help={hasVoices ? 'Videos are read aloud by your browser’s voice.' : 'This browser has no speech voices, so videos play with captions only.'}>
              {hasVoices ? (
                <Segmented label="Narration" value={state.prefs.narration ? 'on' : 'off'} onChange={(v) => setPrefs({ narration: v === 'on' })} options={ON_OFF} />
              ) : (
                <span className="chip">Not available</span>
              )}
            </Row>
            {voices.length > 0 && (
              <Row label="Voice" htmlFor="set-voice" help="Voices come from your browser and operating system.">
                <div className="set-voice">
                  <select id="set-voice" className="select" value={chosen?.voiceURI ?? ''} onChange={(e) => setPrefs({ voiceURI: e.target.value || null })}>
                    {voices.map((v) => (
                      <option key={v.voiceURI} value={v.voiceURI}>
                        {v.name} ({v.lang})
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={() => {
                      const u = new SpeechSynthesisUtterance('Every claim, checked line by line.')
                      if (chosen) u.voice = chosen
                      u.rate = state.prefs.speechRate
                      window.speechSynthesis.cancel()
                      window.speechSynthesis.speak(u)
                    }}
                  >
                    <Glyph name="voice" size={17} /> Preview
                  </button>
                </div>
              </Row>
            )}
            <Row label="Speaking rate" htmlFor="set-rate" help="Slower or faster than normal speech.">
              <div className="set-range">
                <input id="set-rate" type="range" min={0.7} max={1.4} step={0.05} value={state.prefs.speechRate} onChange={(e) => setPrefs({ speechRate: Number(e.target.value) })} />
                <span className="set-range-value mono">{state.prefs.speechRate.toFixed(2)}×</span>
              </div>
            </Row>
            <Row label="Captions" help="Show the narration as text over the video.">
              <Segmented label="Captions" value={state.prefs.captions ? 'on' : 'off'} onChange={(v) => setPrefs({ captions: v === 'on' })} options={ON_OFF} />
            </Row>
          </Card>

          <Card id="data" title="Your data" desc="Everything is stored in this browser unless you turn on sync.">
            <Row label="Export everything" help="Progress, lab results and work outputs as one JSON file.">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }))
                  const a = document.createElement('a')
                  a.href = url
                  a.download = 'margin-progress.json'
                  a.click()
                }}
              >
                <Glyph name="download" size={17} /> Export
              </button>
            </Row>
            <Row label="Import" help="Replace what is stored here with a Margin export file.">
              <button className="btn btn-secondary" onClick={() => fileRef.current?.click()}>
                <Glyph name="up" size={17} /> Import file
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  try {
                    const parsed = JSON.parse(await f.text()) as LearnerState
                    if (parsed.version !== 1) throw new Error('Unrecognised file')
                    replaceAll(parsed)
                  } catch (err) {
                    alert(`Import failed: ${(err as Error).message}`)
                  }
                }}
              />
            </Row>
            <Row label="Erase local data" help="Removes progress, lab results and work outputs from this browser. Synced copies are kept.">
              <button
                className="btn btn-danger"
                onClick={() => {
                  if (confirm('Erase all local progress, lab results and work outputs in this browser? (Synced copies in Supabase are kept.)')) {
                    localStorage.removeItem('margin:learner:v1')
                    location.reload()
                  }
                }}
              >
                Erase local data
              </button>
            </Row>
          </Card>

          <Card id="sync" title="Sync" desc="Optional: keep progress in step across devices." extra={<SyncChip status={sync.status} />}>
            {!supabaseConfigured ? (
              <div className="set-prose">
                <p>
                  Margin is running fully local: progress, lab results and work outputs are stored in this browser. To sync across devices, create a Supabase project, run
                  the migration in <code>supabase/migrations</code>, and set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in <code>.env</code>.
                  See the README.
                </p>
              </div>
            ) : sync.user ? (
              <Row label="Signed in" help="Changes sync automatically.">
                <div className="set-signed">
                  <strong>{sync.user.email}</strong>
                  <button className="btn btn-secondary btn-small" onClick={() => signOut()}>
                    Sign out
                  </button>
                </div>
                {sync.error && <p className="warn-text small">Last error: {sync.error}</p>}
              </Row>
            ) : (
              <form
                className="set-row"
                onSubmit={async (e) => {
                  e.preventDefault()
                  try {
                    await signInWithEmail(email)
                    setSent(`Check ${email} for a sign-in link.`)
                  } catch (err) {
                    setSent(`Could not send link: ${(err as Error).message}`)
                  }
                }}
              >
                <div className="set-row-text">
                  <label className="set-row-label" htmlFor="set-email">
                    Email
                  </label>
                  <p className="set-row-help">We'll send a one-time sign-in link. No password.</p>
                </div>
                <div className="set-row-control set-signin">
                  <input id="set-email" className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                  <button className="btn" type="submit">
                    Send sign-in link <Glyph name="arrow" className="arrow" size={16} />
                  </button>
                  {sent && <p className="small soft">{sent}</p>}
                </div>
              </form>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
