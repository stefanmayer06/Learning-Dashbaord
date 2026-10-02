import katex from 'katex'
import 'katex/dist/katex.min.css'
import { Fragment, useMemo } from 'react'
import { tokenize } from './text'

export { speakable, tokenize } from './text'

export function Tex({ tex, block = false, className }: { tex: string; block?: boolean; className?: string }) {
  const html = useMemo(
    () => katex.renderToString(tex, { displayMode: block, throwOnError: false, strict: 'ignore', output: 'html' }),
    [tex, block],
  )
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />
}

/**
 * Inline content mini-language shared by all content strings:
 *   **emphasis**   $inline tex$
 * Deliberately tiny — courses are meant to be watched and played, not read.
 */
export function Rich({ text, emClass = 'em' }: { text: string; emClass?: string }) {
  const parts = useMemo(() => tokenize(text), [text])
  return (
    <>
      {parts.map((p, i) =>
        p.kind === 'tex' ? (
          <Tex key={i} tex={p.value} />
        ) : p.kind === 'em' ? (
          <strong key={i} className={emClass}>
            {p.value}
          </strong>
        ) : (
          <Fragment key={i}>{p.value}</Fragment>
        ),
      )}
    </>
  )
}

