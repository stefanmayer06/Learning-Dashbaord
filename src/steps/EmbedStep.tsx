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
      <div className="embed-frame">
        {!loaded && <div className="embed-loading label label-faint">Loading external tool… (needs an internet connection)</div>}
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
      <div className="embed-meta">
        <p>
          <Rich text={step.caption} />
          <CiteMarks ids={step.cite} />
        </p>
        <p className="label label-faint">
          External · {step.credit} ·{' '}
          <a href={url} target="_blank" rel="noreferrer noopener">
            open in a new tab <Glyph name="external" size={11} style={{ display: 'inline', verticalAlign: '-1px' }} />
          </a>
        </p>
      </div>
      {!done && (
        <div className="lab-actions">
          <button className="btn btn-ghost" onClick={onDone}>
            I've explored it <Glyph name="check" size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
