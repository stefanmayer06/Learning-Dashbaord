/**
 * The Reel player: plays a JSON-described motion-graphics video in real time.
 *
 * Timing model
 *   Each shot has a duration (explicit or estimated from its narration).
 *   With narration on, the browser speaks each shot's text as it begins; if
 *   the voice is slower than the shot, the frame holds on its last moment
 *   until the voice finishes, so picture and sound never drift apart.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type CSSProperties, type KeyboardEvent } from 'react'
import type { Reel } from '../../content/schema'
import { Glyph } from '../../ui/Glyph'
import { Rich, speakable } from '../../ui/Tex'
import { useLearner } from '../../store/LearnerProvider'
import { Narrator, onVoicesChanged, pickVoice, speechSupported } from './narrator'
import { SHOT_COMPONENTS, FRAME } from './shots'
import { buildTimeline, captionChunks, fmtTime, shotAt, type TimedShot } from './timeline'
import { PLUGIN_SHOT_COMPONENTS } from '../../plugins/registry'
import './reel.css'

const RATES = [0.75, 1, 1.25, 1.5, 2]

export interface ReelPlayerProps {
  reel: Reel
  accent: string
  /** Called with claim ids of the shot on screen (for the margin notes). */
  onCite?: (ids: string[]) => void
  /** Fraction of the reel actually watched, 0..1. */
  onProgress?: (watched: number) => void
  citeNumber?: (id: string) => number
}

export function ReelPlayer({ reel, accent, onCite, onProgress, citeNumber }: ReelPlayerProps) {
  const { state, setPrefs } = useLearner()
  const prefs = state.prefs
  const tl = useMemo(() => buildTimeline(reel), [reel])
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [started, setStarted] = useState(false)
  const [rate, setRate] = useState(1)
  const [holding, setHolding] = useState(false)
  const [spokenChar, setSpokenChar] = useState<number | null>(null)
  const [showTranscript, setShowTranscript] = useState(false)
  const [voicesReady, setVoicesReady] = useState(() => speechSupported() && window.speechSynthesis.getVoices().length > 0)
  const [reduced] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches)

  const wrapRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.5)
  const narrator = useRef(new Narrator())
  const timeRef = useRef(0)
  const playingRef = useRef(false)
  const lastShot = useRef(-1)
  const watched = useRef(new Set<number>())
  const reportedWatch = useRef(0)

  const narrationOn = prefs.narration && voicesReady
  const narrationRef = useRef(narrationOn)
  narrationRef.current = narrationOn

  useEffect(() => onVoicesChanged(() => setVoicesReady(window.speechSynthesis.getVoices().length > 0)), [])

  // fit the 1280×720 stage into its box
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setScale(e.contentRect.width / FRAME.W))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const current = shotAt(tl, time)

  useEffect(() => {
    onCite?.(current.shot.cite)
  }, [current.index, onCite]) // eslint-disable-line react-hooks/exhaustive-deps

  const speakShot = useCallback(
    (ts: TimedShot, fromFraction = 0) => {
      if (!narrationRef.current) return
      const text = speakable(ts.shot.narration)
      let fromChar = 0
      if (fromFraction > 0.02) {
        const words = text.split(/(\s+)/)
        const target = Math.floor(ts.words.length * fromFraction)
        let w = 0
        for (const part of words) {
          if (w >= target) break
          fromChar += part.length
          if (part.trim()) w++
        }
      }
      setSpokenChar(fromChar)
      narrator.current.speak(
        text,
        { voice: pickVoice(prefs.voiceURI), rate: prefs.speechRate * rate, fromChar },
        () => {
          setHolding(false)
          setSpokenChar(null)
        },
        (ci) => setSpokenChar(ci),
      )
    },
    [prefs.voiceURI, prefs.speechRate, rate],
  )

  /* ── the clock ── */
  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000) * rate
      last = now
      let t = timeRef.current
      const cur = shotAt(tl, t)
      const end = cur.start + cur.duration
      const speaking = narrationRef.current && narrator.current.speaking
      if (speaking && t + dt >= end - 0.04) {
        t = end - 0.04 // hold the frame until the voice catches up
        setHolding(true)
      } else {
        t = t + dt
        setHolding(false)
      }
      if (t >= tl.total) {
        t = tl.total
        playingRef.current = false
        setPlaying(false)
      }
      watched.current.add(Math.floor(t))
      timeRef.current = t
      setTime(t)
      const next = shotAt(tl, Math.min(t, tl.total - 1e-6))
      if (next.index !== lastShot.current) {
        lastShot.current = next.index
        speakShot(next)
      }
      if (playingRef.current) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, rate, tl, speakShot])

  // report watch coverage
  useEffect(() => {
    const frac = Math.min(1, watched.current.size / Math.max(1, Math.ceil(tl.total)))
    if (frac - reportedWatch.current >= 0.02 || (frac >= 0.999 && reportedWatch.current < 0.999)) {
      reportedWatch.current = frac
      onProgress?.(frac)
    }
  }, [time, tl.total, onProgress])

  useEffect(() => () => narrator.current.cancel(), [])

  const play = useCallback(() => {
    if (timeRef.current >= tl.total - 0.01) {
      timeRef.current = 0
      setTime(0)
      lastShot.current = -1
    }
    setStarted(true)
    playingRef.current = true
    setPlaying(true)
    // keep keyboard shortcuts working once the poster button disappears
    if (!wrapRef.current?.contains(document.activeElement) || document.activeElement?.classList.contains('reel-poster')) {
      requestAnimationFrame(() => wrapRef.current?.focus({ preventScroll: true }))
    }
    const cur = shotAt(tl, timeRef.current)
    if (lastShot.current === cur.index) {
      // resume mid-shot: continue the sentence from roughly where we were
      speakShot(cur, (timeRef.current - cur.start) / cur.duration)
    }
  }, [tl, speakShot])

  const pause = useCallback(() => {
    playingRef.current = false
    setPlaying(false)
    setHolding(false)
    narrator.current.cancel()
  }, [])

  const seek = useCallback(
    (t: number) => {
      const clamped = Math.max(0, Math.min(tl.total - 0.001, t))
      timeRef.current = clamped
      setTime(clamped)
      narrator.current.cancel()
      setHolding(false)
      const cur = shotAt(tl, clamped)
      lastShot.current = cur.index
      if (playingRef.current) speakShot(cur, (clamped - cur.start) / cur.duration)
      else setSpokenChar(null)
    },
    [tl, speakShot],
  )

  const toggleNarration = () => {
    const next = !prefs.narration
    setPrefs({ narration: next })
    if (!next) narrator.current.cancel()
  }

  const fullscreen = () => {
    const el = wrapRef.current
    if (!el) return
    if (document.fullscreenElement) document.exitFullscreen()
    else el.requestFullscreen?.()
  }

  const onKey = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('input,select,textarea')) return
    const k = e.key.toLowerCase()
    // Space on a focused button keeps its native meaning (activate that button)
    if (k === ' ' && target.closest('button')) return
    if (target.closest('.rc-scrub') && (k === 'arrowleft' || k === 'arrowright')) return
    if (k === ' ' || k === 'k') {
      e.preventDefault()
      playing ? pause() : play()
    } else if (k === 'arrowright' || k === 'l') seek(timeRef.current + 5)
    else if (k === 'arrowleft' || k === 'j') seek(timeRef.current - 5)
    else if (k === 'c') setPrefs({ captions: !prefs.captions })
    else if (k === 'n') toggleNarration()
    else if (k === 'f') fullscreen()
    else if (k === 't') setShowTranscript((s) => !s)
  }

  /* ── render ── */
  const local = time - current.start
  const p = Math.min(1, Math.max(0, local / current.duration))
  const prev = current.index > 0 ? tl.shots[current.index - 1] : null
  const crossfade = prev && local < 0.35 ? 1 - local / 0.35 : 0

  const style = {
    '--accent': accent,
    '--s': scale,
  } as CSSProperties

  return (
    <div className="reel" ref={wrapRef} style={style} onKeyDown={onKey} tabIndex={0} aria-label={`Reel: ${reel.title}`}>
      <div className="reel-stage" ref={stageRef} onClick={() => (playing ? pause() : play())}>
        <div className="reel-canvas" style={{ transform: `scale(${scale})` }}>
          {crossfade > 0 && prev && (
            <div className="reel-layer" style={{ opacity: crossfade }}>
              <RenderShot ts={prev} p={1} reduced={reduced} />
            </div>
          )}
          <div className="reel-layer" style={{ opacity: crossfade > 0 ? 1 - crossfade * 0.6 : 1 }}>
            {started ? (
              <div style={{ transform: reduced ? undefined : `scale(${1 + 0.025 * p})`, transformOrigin: '50% 50%', width: '100%', height: '100%' }}>
                <RenderShot ts={current} p={p} reduced={reduced} />
              </div>
            ) : (
              <PosterFrame title={reel.title} tl={tl} />
            )}
          </div>
          <div className="reel-chrome">
            <span className="reel-chapter">{current.chapter}</span>
            {current.shot.cite.length > 0 && (
              <span className="reel-sourced" title="This moment is backed by the claims ledger">
                sourced {current.shot.cite.map((c) => citeNumber?.(c) ?? '•').join(' · ')}
              </span>
            )}
          </div>
          {prefs.captions && started && <Caption ts={current} p={p} spokenChar={spokenChar} narrating={narrationOn} />}
        </div>
        {!started && (
          <button className="reel-poster" onClick={(e) => (e.stopPropagation(), play())} aria-label="Play reel">
            <span className="reel-poster-play">
              <Glyph name="play" size={30} />
            </span>
            <span className="reel-poster-meta">
              <span className="label">Play · {fmtTime(tl.total)}</span>
              <span className="label reel-poster-sub">
                {narrationOn ? 'Narrated · captions on' : speechSupported() && voicesReady ? 'Captions on · press N for narration' : 'Captioned'}
              </span>
            </span>
          </button>
        )}
        {holding && playing && <div className="reel-hold" aria-hidden>narrator finishing…</div>}
      </div>

      <div className="reel-controls">
        <button className="rc-btn rc-play" onClick={() => (playing ? pause() : play())} aria-label={playing ? 'Pause' : 'Play'}>
          <Glyph name={playing ? 'pause' : time >= tl.total - 0.01 ? 'restart' : 'play'} size={18} />
        </button>
        <span className="rc-time mono">
          {fmtTime(time)} <span className="faint">/ {fmtTime(tl.total)}</span>
        </span>
        <Scrubber tl={tl} time={time} onSeek={seek} />
        <button
          className={`rc-btn ${prefs.captions ? 'on' : ''}`}
          onClick={() => setPrefs({ captions: !prefs.captions })}
          aria-pressed={prefs.captions}
          aria-label="Captions"
          title="Captions (C)"
        >
          <Glyph name="cc" size={18} />
        </button>
        <button
          className={`rc-btn ${narrationOn ? 'on' : ''}`}
          onClick={toggleNarration}
          aria-pressed={narrationOn}
          aria-label="Narration"
          title={voicesReady ? 'Narration (N)' : 'No speech voices available in this browser'}
          disabled={!voicesReady}
        >
          <Glyph name={narrationOn ? 'voice' : 'mute'} size={18} />
        </button>
        <button className="rc-btn rc-rate mono" onClick={() => setRate(RATES[(RATES.indexOf(rate) + 1) % RATES.length])} aria-label={`Speed ${rate}×`} title="Playback speed">
          {rate}×
        </button>
        <button className={`rc-btn ${showTranscript ? 'on' : ''}`} onClick={() => setShowTranscript((s) => !s)} aria-pressed={showTranscript} aria-label="Transcript" title="Transcript (T)">
          <Glyph name="transcript" size={18} />
        </button>
        <button className="rc-btn" onClick={fullscreen} aria-label="Fullscreen" title="Fullscreen (F)">
          <Glyph name="expand" size={18} />
        </button>
      </div>

      {showTranscript && (
        <ol className="reel-transcript">
          {tl.shots.map((ts) => (
            <li key={ts.index} className={ts.index === current.index ? 'now' : ''}>
              {ts.shot.chapter && <div className="label rt-chapter">{ts.shot.chapter}</div>}
              <button className="rt-line" onClick={() => seek(ts.start + 0.01)}>
                <span className="mono rt-time">{fmtTime(ts.start)}</span>
                <span>
                  <Rich text={ts.shot.narration} />
                  {ts.shot.cite.length > 0 && <sup className="rt-cite">{ts.shot.cite.map((c) => citeNumber?.(c) ?? '•').join(',')}</sup>}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

/** The still shown before playback: title and the chapter list. */
function PosterFrame({ title, tl }: { title: string; tl: ReturnType<typeof buildTimeline> }) {
  return (
    <div className="r-frame r-poster-frame">
      <div className="r-kicker">Reel · {tl.shots.length} scenes</div>
      <h2 className="r-poster-title">{title}</h2>
      <ol className="r-poster-chapters">
        {tl.chapters.map((c, i) => (
          <li key={i}>
            <span>{String(i + 1).padStart(2, '0')}</span>
            {c.title}
            <em>{fmtTime(c.start)}</em>
          </li>
        ))}
      </ol>
    </div>
  )
}

function RenderShot({ ts, p, reduced }: { ts: TimedShot; p: number; reduced: boolean }) {
  const shot = ts.shot
  const t = p * ts.duration
  if (shot.kind === 'plugin') {
    const C = PLUGIN_SHOT_COMPONENTS[shot.plugin]
    if (!C) return <div className="r-frame r-center">Unknown plugin shot “{shot.plugin}”</div>
    return <C props={shot.props} p={p} reduced={reduced} />
  }
  const C = SHOT_COMPONENTS[shot.kind] as ComponentType<{ shot: typeof shot; p: number; t: number; d: number; reduced: boolean }>
  return <C shot={shot} p={p} t={t} d={ts.duration} reduced={reduced} />
}

function Caption({ ts, p, spokenChar, narrating }: { ts: TimedShot; p: number; spokenChar: number | null; narrating: boolean }) {
  const text = speakable(ts.shot.narration)
  const chunks = useMemo(() => captionChunks(text), [text])
  const pos = narrating && spokenChar !== null ? spokenChar : Math.floor(text.length * Math.min(1, p / 0.9))
  let acc = 0
  let idx = chunks.length - 1
  for (let i = 0; i < chunks.length; i++) {
    if (pos < acc + chunks[i].length) {
      idx = i
      break
    }
    acc += chunks[i].length
  }
  const s = chunks[idx].trim()
  const within = Math.max(0, pos - acc)
  return (
    <div className="reel-caption" aria-live="off">
      <span className="rc-said">{s.slice(0, within)}</span>
      <span className="rc-unsaid">{s.slice(within)}</span>
    </div>
  )
}

function Scrubber({ tl, time, onSeek }: { tl: ReturnType<typeof buildTimeline>; time: number; onSeek: (t: number) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const at = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect()
    return ((clientX - r.left) / r.width) * tl.total
  }
  const dragging = useRef(false)
  return (
    <div
      className="rc-scrub"
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.round(tl.total)}
      aria-valuenow={Math.round(time)}
      aria-valuetext={`${fmtTime(time)} of ${fmtTime(tl.total)}`}
      onPointerDown={(e) => {
        dragging.current = true
        ;(e.target as Element).setPointerCapture(e.pointerId)
        onSeek(at(e.clientX))
      }}
      onPointerMove={(e) => {
        setHover(at(e.clientX))
        if (dragging.current) onSeek(at(e.clientX))
      }}
      onPointerUp={() => (dragging.current = false)}
      onPointerLeave={() => setHover(null)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') onSeek(time + 5)
        if (e.key === 'ArrowLeft') onSeek(time - 5)
      }}
    >
      <div className="rc-track" />
      <div className="rc-fill" style={{ width: `${(time / tl.total) * 100}%` }} />
      {tl.chapters.map((c, i) => (
        <span key={i} className="rc-tick" style={{ left: `${(c.start / tl.total) * 100}%` }} title={c.title} />
      ))}
      <span className="rc-head" style={{ left: `${(time / tl.total) * 100}%` }} />
      {hover !== null && (
        <span className="rc-hover label" style={{ left: `${Math.max(0, Math.min(100, (hover / tl.total) * 100))}%` }}>
          {shotAt(tl, Math.max(0, Math.min(tl.total - 0.01, hover))).chapter} · {fmtTime(Math.max(0, hover))}
        </span>
      )}
    </div>
  )
}
