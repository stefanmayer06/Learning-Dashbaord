import { useMemo, useState } from 'react'
import type { Question, Step } from '../content/schema'
import { Glyph } from '../ui/Glyph'
import { Rich } from '../ui/Tex'
import { CiteMarks } from '../ui/Cite'

type QuizStepT = Extract<Step, { type: 'quiz' }>

function shuffled<T>(xs: T[], seed: number) {
  const idx = xs.map((_, i) => i)
  let s = seed + 11
  for (let i = idx.length - 1; i > 0; i--) {
    s = (s * 16807) % 2147483647
    const j = s % (i + 1)
    ;[idx[i], idx[j]] = [idx[j], idx[i]]
  }
  if (idx.every((v, i) => v === i) && idx.length > 1) idx.reverse()
  return idx
}

/** One question at a time, immediate feedback with the reasoning and its sources. */
export function QuizStep({ step, done, onPass }: { step: QuizStepT; done: boolean; onPass: (score: number) => void }) {
  const [i, setI] = useState(0)
  const [results, setResults] = useState<boolean[]>([])
  const [finished, setFinished] = useState(false)
  const q = step.questions[i]
  const score = results.filter(Boolean).length / step.questions.length
  const passed = score >= step.passMark

  const record = (ok: boolean) => setResults((r) => [...r.slice(0, i), ok])
  const next = () => {
    if (i < step.questions.length - 1) setI(i + 1)
    else {
      setFinished(true)
      const final = results.filter(Boolean).length / step.questions.length
      if (final >= step.passMark) onPass(final)
    }
  }
  const retry = () => {
    setI(0)
    setResults([])
    setFinished(false)
  }

  if (finished) {
    return (
      <div className={`quiz-result ${passed ? 'pass' : 'fail'}`}>
        <div className="quiz-score display">
          {results.filter(Boolean).length}
          <span>/{step.questions.length}</span>
        </div>
        <p>{passed ? 'Passed. On you go.' : `You need ${Math.ceil(step.passMark * step.questions.length)} to pass. The explanations are the lesson — have another go.`}</p>
        {!passed && (
          <button className="btn" onClick={retry}>
            Try again <Glyph name="restart" size={14} />
          </button>
        )}
        {passed && !done && <p className="label label-faint">Saved.</p>}
      </div>
    )
  }

  return (
    <div className="quiz">
      <div className="quiz-progress" aria-hidden>
        {step.questions.map((_, k) => (
          <span key={k} className={k < results.length ? (results[k] ? 'right' : 'wrong') : k === i ? 'now' : ''} />
        ))}
      </div>
      <p className="label label-faint">
        Question {i + 1} of {step.questions.length}
      </p>
      <QuestionView key={i} q={q} seed={i} answered={results[i] !== undefined} onAnswer={record} />
      {results[i] !== undefined && (
        <div className="lab-actions">
          <button className="btn" onClick={next}>
            {i < step.questions.length - 1 ? 'Next question' : 'See result'} <Glyph name="arrow" className="arrow" size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

function QuestionView({ q, seed, answered, onAnswer }: { q: Question; seed: number; answered: boolean; onAnswer: (ok: boolean) => void }) {
  const [picked, setPicked] = useState<number[]>([])
  const [num, setNum] = useState('')
  const [order, setOrder] = useState<number[]>(() => (q.type === 'order' ? shuffled(q.items, seed) : []))
  const optOrder = useMemo(() => ('options' in q ? shuffled(q.options, seed + 3) : []), [q, seed])
  const [ok, setOk] = useState<boolean | null>(null)

  const submit = () => {
    let correct = false
    if (q.type === 'single') correct = picked[0] === q.answer
    if (q.type === 'multi') correct = picked.length === q.answers.length && q.answers.every((a) => picked.includes(a))
    if (q.type === 'numeric') correct = Math.abs(Number(num.replace(/,/g, '')) - q.answer) <= q.tolerance
    if (q.type === 'order') correct = order.every((v, k) => v === k)
    setOk(correct)
    onAnswer(correct)
  }

  const canSubmit = q.type === 'numeric' ? num.trim() !== '' && !Number.isNaN(Number(num.replace(/,/g, ''))) : q.type === 'order' ? true : picked.length > 0

  return (
    <div className="question">
      <h3 className="question-prompt">
        <Rich text={q.prompt} />
      </h3>
      {(q.type === 'single' || q.type === 'multi') && (
        <div className="options" role={q.type === 'single' ? 'radiogroup' : 'group'}>
          {q.type === 'multi' && <p className="label label-faint">Select all that apply</p>}
          {optOrder.map((oi) => {
            const sel = picked.includes(oi)
            const isAnswer = q.type === 'single' ? oi === q.answer : q.answers.includes(oi)
            const state = answered ? (isAnswer ? 'right' : sel ? 'wrong' : 'idle') : sel ? 'sel' : 'idle'
            return (
              <button
                key={oi}
                role={q.type === 'single' ? 'radio' : 'checkbox'}
                aria-checked={sel}
                disabled={answered}
                className={`option ${state}`}
                onClick={() => setPicked((p) => (q.type === 'single' ? [oi] : p.includes(oi) ? p.filter((x) => x !== oi) : [...p, oi]))}
              >
                <span className="option-box">{answered && isAnswer ? <Glyph name="check" size={12} /> : answered && sel ? <Glyph name="cross" size={12} /> : null}</span>
                <span>
                  <Rich text={q.options[oi]} />
                </span>
              </button>
            )
          })}
        </div>
      )}
      {q.type === 'numeric' && (
        <div className="numeric">
          <input className="input mono" inputMode="decimal" value={num} disabled={answered} onChange={(e) => setNum(e.target.value)} aria-label="Your answer" onKeyDown={(e) => e.key === 'Enter' && canSubmit && !answered && submit()} />
          {q.unit && <span className="soft">{q.unit}</span>}
          {answered && (
            <span className="mono">
              answer: {q.answer.toLocaleString('en-US')} {q.unit}
            </span>
          )}
        </div>
      )}
      {q.type === 'order' && (
        <ol className="seq seq-compact">
          {order.map((item, pos) => (
            <li key={item} className={answered ? (item === pos ? 'right' : 'wrong') : ''}>
              <span className="seq-pos mono">{pos + 1}</span>
              <div className="seq-body">
                <Rich text={q.items[item]} />
              </div>
              {!answered && (
                <div className="seq-moves">
                  <button disabled={pos === 0} onClick={() => setOrder((o) => swap(o, pos, pos - 1))} aria-label="Earlier">
                    <Glyph name="up" size={14} />
                  </button>
                  <button disabled={pos === order.length - 1} onClick={() => setOrder((o) => swap(o, pos, pos + 1))} aria-label="Later">
                    <Glyph name="down" size={14} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
      {!answered ? (
        <div className="lab-actions">
          <button className="btn btn-ghost" onClick={submit} disabled={!canSubmit}>
            Check answer <Glyph name="check" size={14} />
          </button>
        </div>
      ) : (
        <div className={`explain ${ok ? 'right' : 'wrong'}`}>
          <span className="label">{ok ? 'Correct' : 'Not quite'}</span>
          <p>
            <Rich text={q.explain} />
            <CiteMarks ids={q.cite} />
          </p>
          {!ok && q.type === 'order' && (
            <p className="small soft">
              Correct order: {q.items.map((it, k) => `${k + 1}. ${it}`).join('  ')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function swap(a: number[], i: number, j: number) {
  const b = [...a]
  ;[b[i], b[j]] = [b[j], b[i]]
  return b
}
