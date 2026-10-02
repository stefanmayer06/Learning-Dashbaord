/**
 * Citations: content cites claims; claims cite sources. Within a lesson,
 * claims are numbered in order of first appearance, like footnotes, and the
 * notes sit in the Sources tab under the lesson (and on the ledger page).
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Claim, CourseBundle, Lesson, Source, Step } from '../content/schema'
import { fmtDate } from '../content/stats'
import { Glyph } from './Glyph'

interface CiteCtx {
  number: (id: string) => number
  claims: Record<string, Claim>
  sources: Record<string, Source>
  focused: string | null
  focus: (id: string | null) => void
}

const Ctx = createContext<CiteCtx | null>(null)

export function stepClaimIds(step: Step): string[] {
  const ids: string[] = []
  const add = (xs?: string[]) => xs?.forEach((x) => ids.push(x))
  switch (step.type) {
    case 'reel':
      step.reel.shots.forEach((s) => add(s.cite))
      break
    case 'widget': {
      add(step.cite)
      const pr = step.props as Record<string, unknown>
      for (const k of ['cards', 'items'] as const) {
        if (Array.isArray(pr[k])) (pr[k] as { cite?: string[] }[]).forEach((c) => add(c.cite))
      }
      if (Array.isArray(pr.cite)) add(pr.cite as string[])
      break
    }
    case 'quiz':
      step.questions.forEach((q) => add(q.cite))
      break
    case 'embed':
      add(step.cite)
      break
    case 'recap':
      step.points.forEach((p) => add(p.cite))
      break
  }
  return [...new Set(ids)]
}

export function lessonClaimIds(lesson: Lesson) {
  return [...new Set(lesson.steps.flatMap(stepClaimIds))]
}

export function CiteProvider({ bundle, order, children }: { bundle: CourseBundle; order: string[]; children: ReactNode }) {
  const [focused, setFocused] = useState<string | null>(null)
  const value = useMemo<CiteCtx>(() => {
    const idx = new Map(order.map((id, i) => [id, i + 1]))
    return {
      number: (id) => idx.get(id) ?? 0,
      claims: bundle.claims,
      sources: bundle.sources,
      focused,
      focus: setFocused,
    }
  }, [bundle, order, focused])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCite() {
  return useContext(Ctx)
}

export function CiteMarks({ ids }: { ids: string[] }) {
  const ctx = useCite()
  if (!ctx || !ids.length) return null
  return (
    <sup className="cite-marks">
      {ids.map((id) => (
        <button
          key={id}
          className="cite-mark"
          onClick={() => {
            ctx.focus(id)
            document.getElementById(`note-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
          }}
          aria-label={`Source note ${ctx.number(id)}: ${ctx.claims[id]?.text ?? id}`}
          title={ctx.claims[id]?.text}
        >
          {ctx.number(id)}
        </button>
      ))}
    </sup>
  )
}

export const STATUS_LABEL: Record<string, string> = {
  verified: 'Verified',
  contested: 'Contested',
  estimate: 'Estimate',
  derived: 'Derived',
}
export const STATUS_CLASS: Record<string, string> = {
  verified: 'chip-good',
  contested: 'chip-red',
  estimate: 'chip-warn',
  derived: 'chip-accent',
}
export const KIND_LABEL: Record<string, string> = {
  paper: 'peer-reviewed',
  preprint: 'preprint',
  official: 'primary',
  regulator: 'regulator',
  standard: 'standard',
  docs: 'docs',
  book: 'book',
  news: 'news',
  dataset: 'dataset',
}

export function ClaimNote({ claim, n, sources, live }: { claim: Claim; n?: number; sources: Record<string, Source>; live?: boolean }) {
  const ctx = useCite()
  return (
    <div id={`note-${claim.id}`} data-status={claim.status} className={`note${ctx?.focused === claim.id ? ' focused' : ''}${live ? ' live' : ''}`}>
      <div className="note-head">
        {n ? (
          <span className="note-n" aria-label={`Note ${n}`}>
            {n}
          </span>
        ) : null}
        <span className={`chip ${STATUS_CLASS[claim.status]}`}>{STATUS_LABEL[claim.status]}</span>
        <span className="note-date">Checked {fmtDate(claim.checkedOn)}</span>
      </div>
      <p className="note-text">{claim.text}</p>
      {claim.note && (
        <p className="note-caveat">
          <Glyph name="info" size={15} />
          <span>{claim.note}</span>
        </p>
      )}
      <ul className="note-sources" aria-label="Sources">
        {claim.sources.map((sid) => {
          const s = sources[sid]
          if (!s) return null
          return (
            <li key={sid}>
              <a href={s.url} target="_blank" rel="noreferrer noopener">
                {s.title}
                <Glyph name="external" size={12} className="note-ext" />
              </a>
              <span className="note-src-meta">
                {s.publisher ?? s.authors} · {s.year} · <span className={`note-kind${s.kind === 'preprint' ? ' warn-text' : ''}`}>{KIND_LABEL[s.kind]}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
