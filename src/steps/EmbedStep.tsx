import { useState } from 'react'
import type { Step } from '../content/schema'
import { Glyph } from '../ui/Glyph'
import { Rich } from '../ui/Tex'
import { CiteMarks } from '../ui/Cite'

type EmbedT = Extract<Step, { type: 'embed' }>

export function embedUrl(step: EmbedT) {
  if (step.provider === 'quirk') return `https://algassert.com/quirk#circuit=${encodeURIComponent(step.src)}`
  if (step.provider === 'youtube') return `https://www.youtube-nocookie.com/embed/${step.src}?rel=0&modestbranding=1`
  return step.src
}

/** External tools and videos, clearly labelled as someone else's work. */
export function EmbedStep({ step, done, onDone }: { step: EmbedT; done: boolean; onDone: () => void }) {
  const [loaded, setLoaded] = useState(false)
  const url = embedUrl(step)
  return (
    <div className="embed">
      <p className="embed-caption">
        <Rich text={step.caption} />
        <CiteMarks ids={step.cite} />
      </p>
      <div className="embed-box">
        <div className="embed-notice">
          <Glyph name="external" size={16} />
          <span>
            <strong>Third-party tool</strong> · {step.credit}. It loads from another site and needs an internet connection.
          </span>
          <a href={url} target="_blank" rel="noreferrer noopener" className="embed-open">
            Open in a new tab <Glyph name="external" size={14} />
          </a>
        </div>
        <div className="embed-frame">
          {!loaded && (
            <div className="embed-loading">
              <span className="embed-spinner" aria-hidden />
              Loading the external tool…
            </div>
          )}
          <iframe
            src={url}
            title={step.title}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            allow="fullscreen; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
          />
        </div>
      </div>
      {!done && (
        <div className="embed-actions">
          <button className="btn btn-ghost" onClick={onDone}>
            <Glyph name="check" size={16} /> I've explored it
          </button>
        </div>
      )}
    </div>
  )
}
