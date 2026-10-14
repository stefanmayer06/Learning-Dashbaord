import { useState } from 'react'
import { embedMedia, embedUrl, openUrl, type EmbedStepT } from '../content/media'
import { fmtDate, fmtMinutes } from '../content/stats'
import { Glyph } from '../ui/Glyph'
import { Rich } from '../ui/Tex'
import { CiteMarks } from '../ui/Cite'

const COPY = {
  video: { kind: 'Third-party video', loading: 'Loading the video…', done: "I've watched it" },
  audio: { kind: 'Third-party podcast', loading: 'Loading the episode…', done: "I've listened to it" },
  tool: { kind: 'Third-party tool', loading: 'Loading the external tool…', done: "I've explored it" },
}

/** External tools, talks and podcasts, clearly labelled as someone else's work. */
export function EmbedStep({ step, done, onDone }: { step: EmbedStepT; done: boolean; onDone: () => void }) {
  const [loaded, setLoaded] = useState(false)
  const media = embedMedia(step)
  const copy = COPY[media]
  const facts = [step.date && fmtDate(step.date), step.minutes && fmtMinutes(step.minutes)].filter(Boolean).join(' · ')
  // NIH VideoCast only lets https pages frame its player (CSP frame-ancestors), so a local http copy links out instead
  const framable = step.provider !== 'nih-videocast' || window.location.protocol === 'https:'
  return (
    <div className="embed">
      <p className="embed-caption">
        <Rich text={step.caption} />
        <CiteMarks ids={step.cite} />
      </p>
      <div className="embed-box">
        <div className="embed-notice">
          <Glyph name={media === 'audio' ? 'listen' : 'external'} size={16} />
          <span>
            <strong>{copy.kind}</strong> · {step.credit}
            {facts && <> · {facts}</>}. It loads from another site and needs an internet connection.
          </span>
          <a href={openUrl(step)} target="_blank" rel="noreferrer noopener" className="embed-open">
            Open in a new tab <Glyph name="external" size={14} />
          </a>
        </div>
        <div className={`embed-frame${media === 'audio' ? ' is-audio' : ''}`}>
          {!framable ? (
            <div className="embed-loading">
              <span>NIH plays its lectures only inside secure (https) sites, so this copy of Margin links to it instead.</span>
              <a href={openUrl(step)} target="_blank" rel="noreferrer noopener" className="btn btn-secondary">
                Watch on NIH VideoCast <Glyph name="external" size={16} />
              </a>
            </div>
          ) : (
            <>
              {!loaded && (
                <div className="embed-loading">
                  <span className="embed-spinner" aria-hidden />
                  {copy.loading}
                </div>
              )}
              <iframe
                src={embedUrl(step)}
                title={step.title}
                loading="lazy"
                onLoad={() => setLoaded(true)}
                allow="fullscreen; picture-in-picture; encrypted-media"
                referrerPolicy="strict-origin-when-cross-origin"
                sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
              />
            </>
          )}
        </div>
      </div>
      {!done && (
        <div className="embed-actions">
          <button className="btn btn-ghost" onClick={onDone}>
            <Glyph name="check" size={16} /> {copy.done}
          </button>
        </div>
      )}
    </div>
  )
}
