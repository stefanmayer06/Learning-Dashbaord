import { useEffect, useRef, useState } from 'react'
import { useLearner } from '../store/LearnerProvider'
import { signInWithEmail, signOut, supabaseConfigured } from '../store/supabase'
import { listVoices, onVoicesChanged, pickVoice, speechSupported } from '../engine/reel/narrator'
import { Segmented } from '../ui/LabFrame'
import { Glyph } from '../ui/Glyph'
import { SyncChip } from '../ui/SyncChip'
import type { LearnerState } from '../store/model'

export function SettingsPage() {
  const { state, setName, setPrefs, sync, replaceAll } = useLearner()
  const [voices, setVoices] = useState(listVoices())
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => onVoicesChanged(() => setVoices(listVoices())), [])
  const chosen = pickVoice(state.prefs.voiceURI)

  return (
    <div className="settings page">
      <p className="label">Settings</p>
      <h1 className="display display-l">Your desk</h1>

      <section className="set-block">
        <h2 className="display display-s">You</h2>
        <label className="cf">
          <span className="label">Name (used on certificates and work exports)</span>
          <input className="input" value={state.name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        </label>
      </section>

      <section className="set-block">
        <h2 className="display display-s">Reels</h2>
        <div className="cf">
          <span className="label">Narration</span>
          {speechSupported() && voices.length ? (
            <Segmented label="Narration" value={state.prefs.narration ? 'on' : 'off'} onChange={(v) => setPrefs({ narration: v === 'on' })} options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]} />
          ) : (
            <p className="soft small">This browser has no speech voices, so reels play with captions only.</p>
          )}
        </div>
        {voices.length > 0 && (
          <label className="cf">
            <span className="label">Voice</span>
            <select className="select" value={chosen?.voiceURI ?? ''} onChange={(e) => setPrefs({ voiceURI: e.target.value || null })}>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
            <button
              className="btn btn-small btn-ghost"
              style={{ marginTop: 10, alignSelf: 'flex-start' }}
              onClick={() => {
                const u = new SpeechSynthesisUtterance('Every claim, checked line by line.')
                if (chosen) u.voice = chosen
                u.rate = state.prefs.speechRate
                window.speechSynthesis.cancel()
                window.speechSynthesis.speak(u)
              }}
            >
              Preview voice <Glyph name="voice" size={14} />
            </button>
          </label>
        )}
        <label className="cf">
          <span className="label">Speaking rate · {state.prefs.speechRate.toFixed(2)}×</span>
          <input type="range" min={0.7} max={1.4} step={0.05} value={state.prefs.speechRate} onChange={(e) => setPrefs({ speechRate: Number(e.target.value) })} />
        </label>
        <div className="cf">
          <span className="label">Captions</span>
          <Segmented label="Captions" value={state.prefs.captions ? 'on' : 'off'} onChange={(v) => setPrefs({ captions: v === 'on' })} options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]} />
        </div>
        <div className="cf">
          <span className="label">Theme</span>
          <Segmented
            label="Theme"
            value={state.prefs.theme}
            onChange={(v) => setPrefs({ theme: v })}
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Paper' },
              { value: 'dark', label: 'Lamp off' },
            ]}
          />
        </div>
      </section>

      <section className="set-block">
        <h2 className="display display-s">
          Sync <SyncChip status={sync.status} />
        </h2>
        {!supabaseConfigured ? (
          <div className="soft">
            <p>
              Running fully local: progress, lab results and work outputs are stored in this browser. To sync across devices, create a Supabase project, run the
              migration in <code>supabase/migrations</code>, and set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in <code>.env</code>. See the
              README.
            </p>
          </div>
        ) : sync.user ? (
          <div>
            <p>
              Signed in as <strong>{sync.user.email}</strong>. Changes sync automatically.
            </p>
            {sync.error && <p className="warn-text small">Last error: {sync.error}</p>}
            <button className="btn btn-small btn-ghost" onClick={() => signOut()}>
              Sign out
            </button>
          </div>
        ) : (
          <form
            className="signin"
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
            <label className="cf">
              <span className="label">Email — we'll send a magic link</span>
              <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <button className="btn btn-small" type="submit">
              Send sign-in link <Glyph name="arrow" className="arrow" size={14} />
            </button>
            {sent && <p className="small">{sent}</p>}
          </form>
        )}
      </section>

      <section className="set-block">
        <h2 className="display display-s">Your data</h2>
        <div className="course-hero-actions">
          <button
            className="btn btn-small btn-ghost"
            onClick={() => {
              const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }))
              const a = document.createElement('a')
              a.href = url
              a.download = 'margin-progress.json'
              a.click()
            }}
          >
            Export everything <Glyph name="download" size={14} />
          </button>
          <button className="btn btn-small btn-ghost" onClick={() => fileRef.current?.click()}>
            Import
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
          <button
            className="btn btn-small btn-ghost"
            onClick={() => {
              if (confirm('Erase all local progress, lab results and work outputs in this browser? (Synced copies in Supabase are kept.)')) {
                localStorage.removeItem('margin:learner:v1')
                location.reload()
              }
            }}
          >
            Erase local data
          </button>
        </div>
      </section>
    </div>
  )
}
