import { useId, useMemo, useState } from 'react'
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
  const n = step.questions.length
  const right = results.filter(Boolean).length
  const score = right / n
  const passed = score >= step.passMark
  const need = Math.ceil(step.passMark * n)

  const record = (ok: boolean) => setResults((r) => [...r.slice(0, i), ok])
  const next = () => {
    if (i < n - 1) setI(i + 1)
    else {
      setFinished(true)
      const final = results.filter(Boolean).length / n
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
      <div className={`quiz-result ${passed ? 'pass' : 'fail'}`} role="status">
        <span className="quiz-result-icon" aria-hidden>
          <Glyph name={passed ? 'check' : 'cross'} size={28} />
        </span>
        <div className="quiz-result-body">
          <h2 className="quiz-result-title">{passed ? 'You passed' : 'Not quite yet'}</h2>
          <p className="quiz-result-score">
            <span className="quiz-score mono">
              {right}/{n}
            </span>
            <span>
              {Math.round(score * 100)}% correct · pass mark {need} of {n}
            </span>
          </p>
          <p className="quiz-result-text">
            {passed
              ? done
                ? 'Your result is saved. Continue to the next step when you are ready.'
                : 'Saved. Continue to the next step when you are ready.'
              : `You need ${need} correct to pass. The explanations are the lesson, so read them and have another go.`}
          </p>
          <ol className="quiz-review" aria-label="Your answers">
            {results.map((ok, k) => (
              <li key={k} className={ok ? 'right' : 'wrong'}>
                <Glyph name={ok ? 'check' : 'cross'} size={14} />
                Question {k + 1}
                <span className="visually-hidden">{ok ? ' correct' : ' incorrect'}</span>
              </li>
            ))}
          </ol>
          {!passed && (
            <button className="btn" onClick={retry}>
              <Glyph name="restart" size={16} /> Try again
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="quiz">
      <div className="quiz-top">
        <span className="quiz-count">
          Question {i + 1} of {n}
        </span>
        <span className="quiz-pass">
          Pass mark: {need} of {n} correct
        </span>
      </div>
      <div className="quiz-progress" aria-hidden>
        {step.questions.map((_, k) => (
          <span key={k} className={k < results.length ? (results[k] ? 'right' : 'wrong') : k === i ? 'now' : ''} />
        ))}
      </div>
      <QuestionView key={i} q={q} seed={i} answered={results[i] !== undefined} onAnswer={record} />
      {results[i] !== undefined && (
        <div className="quiz-actions">
          <button className="btn" onClick={next}>
            {i < n - 1 ? 'Next question' : 'See result'} <Glyph name="arrow" className="arrow" size={16} />
          </button>
        </div>
      )}
    </div>
  )
}

function QuestionView({ q, seed, answered, onAnswer }: { q: Question; seed: number; answered: boolean; onAnswer: (ok: boolean) => void }) {
  const uid = useId()
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
  const promptId = `${uid}-prompt`

  return (
    <div className="question">
      <h2 className="question-prompt" id={promptId}>
        <Rich text={q.prompt} />
      </h2>
      {(q.type === 'single' || q.type === 'multi') && (
        <fieldset className="options" aria-labelledby={promptId}>
          {q.type === 'multi' && <p className="options-hint">Select all that apply.</p>}
          {optOrder.map((oi) => {
            const sel = picked.includes(oi)
            const isAnswer = q.type === 'single' ? oi === q.answer : q.answers.includes(oi)
            const state = answered ? (isAnswer ? (sel ? 'right' : 'missed') : sel ? 'wrong' : 'idle') : sel ? 'sel' : 'idle'
            return (
              <label key={oi} className={`option ${state}${answered ? ' locked' : ''}`}>
                <input
                  type={q.type === 'single' ? 'radio' : 'checkbox'}
                  name={`${uid}-q`}
                  checked={sel}
                  disabled={answered}
                  onChange={() => setPicked((p) => (q.type === 'single' ? [oi] : p.includes(oi) ? p.filter((x) => x !== oi) : [...p, oi]))}
                />
                <span className="option-text">
                  <Rich text={q.options[oi]} />
                </span>
                {answered && (isAnswer || sel) && (
                  <span className="option-status">
                    <Glyph name={isAnswer ? 'check' : 'cross'} size={16} />
                    {isAnswer ? (sel ? 'Correct' : 'Correct answer') : 'Incorrect'}
                  </span>
                )}
              </label>
            )
          })}
        </fieldset>
      )}
      {q.type === 'numeric' && (
        <div className="numeric">
          <input
            className="input mono"
            inputMode="decimal"
            value={num}
            disabled={answered}
            onChange={(e) => setNum(e.target.value)}
            aria-labelledby={promptId}
            placeholder="Your answer"
            onKeyDown={(e) => e.key === 'Enter' && canSubmit && !answered && submit()}
          />
          {q.unit && <span className="numeric-unit">{q.unit}</span>}
          {answered && (
            <span className="numeric-answer">
              Answer: <span className="mono">{q.answer.toLocaleString('en-US')}</span> {q.unit}
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
        <div className="quiz-actions">
          <button className="btn" onClick={submit} disabled={!canSubmit}>
            Check answer
          </button>
        </div>
      ) : (
        <div className={`explain ${ok ? 'right' : 'wrong'}`} role="status">
          <span className="explain-icon" aria-hidden>
            <Glyph name={ok ? 'checkCircle' : 'info'} size={20} />
          </span>
          <div>
            <p className="explain-label">{ok ? 'Correct' : 'Not quite'}</p>
            <p className="explain-text">
              <Rich text={q.explain} />
              <CiteMarks ids={q.cite} />
            </p>
            {!ok && q.type === 'order' && (
              <p className="explain-order">
                Correct order: {q.items.map((it, k) => `${k + 1}. ${it}`).join('  ')}
              </p>
            )}
          </div>
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
