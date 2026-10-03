import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Glyph, type GlyphName } from '../ui/Glyph'
import { Breadcrumbs } from '../ui/Shell'
import { useDocumentTitle } from '../ui/useDocumentTitle'

const LEVELS = ['Complete beginner', 'Some background', 'Working knowledge', 'Expert in a neighbouring field']

const HOW: { glyph: GlyphName; title: string; line: string }[] = [
  { glyph: 'user', title: 'Describe it', line: 'Say what you want to learn, why, your level and how much time you have.' },
  { glyph: 'shield', title: 'Claude researches & verifies', line: 'Claude Code reads primary sources, records every claim with its sources, and runs the validator.' },
  { glyph: 'reel', title: 'The course appears here', line: 'Videos, labs, quizzes and assignments, with a ledger behind every fact.' },
]

/**
 * Courses are files in this repository, authored by Claude Code with the
 * add-subject skill. This page turns a few answers into the brief to hand it.
 */
export function CommissionPage() {
  useDocumentTitle('Commission a course')
  const [params] = useSearchParams()
  const topic = params.get('topic') ?? ''
  const [subject, setSubject] = useState(topic)
  const [goal, setGoal] = useState('')
  const [level, setLevel] = useState(LEVELS[0])
  const [hours, setHours] = useState(6)
  const [outputs, setOutputs] = useState('')
  const [must, setMust] = useState('')
  const [avoid, setAvoid] = useState('')
  const [copied, setCopied] = useState(false)

  // Home links here as /commission?topic=<search term>; a new link pre-fills the topic again.
  useEffect(() => {
    if (topic) setSubject(topic)
  }, [topic])

  const prompt = useMemo(
    () =>
      [
        `Use the add-subject skill (.claude/skills/add-subject/SKILL.md) to create a new Margin course.`,
        ``,
        `Subject: ${subject || '<what I want to learn>'}`,
        `Why I want it: ${goal || '<the job this knowledge should do for me>'}`,
        `My level: ${level}`,
        `Time budget: about ${hours} hours`,
        outputs ? `Work outputs I want to finish with: ${outputs}` : `Work outputs: propose a capstone deliverable that proves I can apply this.`,
        must ? `Must cover: ${must}` : '',
        avoid ? `Leave out: ${avoid}` : '',
        ``,
        `Non-negotiables:`,
        `- Research every factual claim against primary sources (papers, official releases, regulators, standards) and record it in claims.json + sources.json. News coverage may support but never solely back a claim. Mark projections as "estimate" and disputes as "contested" with the dispute explained.`,
        `- Teach through reels (narrated motion lessons) and interactive labs first; keep reading to short captions and recaps.`,
        `- Theory → practice → current landscape → capstone, with a clear unit-by-unit progression.`,
        `- Run \`npm run validate:strict\` and \`npm test\` and fix everything before committing. Summarise what was verified and anything you could not verify.`,
      ]
        .filter((l) => l !== '')
        .join('\n'),
    [subject, goal, level, hours, outputs, must, avoid],
  )

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard blocked: the text is selectable */
    }
  }

  return (
    <div className="pg commission">
      <header className="pg-head">
        <div className="page">
          <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Commission a course' }]} />
          <div className="pg-head-row">
            <div className="pg-head-text">
              <h1 className="display-m pg-title">Commission a course</h1>
              <p className="pg-desc">
                Every course here is a folder of plain files that Claude writes, sources and checks. Answer a few questions, then paste the brief into Claude Code in
                this repository.
              </p>
            </div>
          </div>
          <ol className="cm-how" aria-label="How commissioning works">
            {HOW.map((h, i) => (
              <li key={h.title} className="cm-how-step">
                <span className="glyph-tile" aria-hidden>
                  <Glyph name={h.glyph} size={22} />
                </span>
                <div>
                  <span className="cm-how-n">Step {i + 1}</span>
                  <h2 className="t-h3">{h.title}</h2>
                  <p className="small soft">{h.line}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </header>

      <div className="page pg-body cm-grid">
        <form className="card cm-form" onSubmit={(e) => e.preventDefault()}>
          <h2 className="t-h2">Tell us what you want to learn</h2>
          <div className="field">
            <label className="field-label" htmlFor="cm-subject">
              Topic
            </label>
            <input id="cm-subject" className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Options market making" />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="cm-goal">
              What should this let you do?
            </label>
            <textarea id="cm-goal" className="textarea" rows={3} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. Hold my own in conversations with our quant desk" />
          </div>
          <fieldset className="field cm-levels-field">
            <legend className="field-label">Your level</legend>
            <div className="cm-levels">
              {LEVELS.map((l) => (
                <label key={l} className={`cm-level${level === l ? ' on' : ''}`}>
                  <input type="radio" name="cm-level" value={l} checked={level === l} onChange={() => setLevel(l)} />
                  <span>{l}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="field">
            <label className="field-label cm-range-label" htmlFor="cm-hours">
              <span>Time budget</span>
              <span className="cm-range-value">
                {hours} hour{hours === 1 ? '' : 's'}
              </span>
            </label>
            <input id="cm-hours" type="range" min={1} max={30} value={hours} onChange={(e) => setHours(Number(e.target.value))} />
            <div className="cm-range-scale meta" aria-hidden>
              <span>1 h</span>
              <span>30 h</span>
            </div>
          </div>

          <fieldset className="cm-optional">
            <legend>Optional details</legend>
            <div className="field">
              <label className="field-label" htmlFor="cm-outputs">
                What do you want to have made at the end?
              </label>
              <input id="cm-outputs" className="input" value={outputs} onChange={(e) => setOutputs(e.target.value)} placeholder="e.g. a one-page strategy memo and a working pricing model" />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="cm-must">
                Must cover
              </label>
              <input id="cm-must" className="input" value={must} onChange={(e) => setMust(e.target.value)} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="cm-avoid">
                Leave out
              </label>
              <input id="cm-avoid" className="input" value={avoid} onChange={(e) => setAvoid(e.target.value)} />
            </div>
          </fieldset>
        </form>

        <section className="card cm-brief" aria-labelledby="cm-brief-title">
          <div className="cm-brief-head">
            <div>
              <h2 className="t-h3" id="cm-brief-title">
                Your brief for Claude Code
              </h2>
              <p className="meta">Updates as you type.</p>
            </div>
            <button className="btn btn-small" type="button" onClick={copy}>
              <Glyph name={copied ? 'check' : 'copy'} size={16} /> {copied ? 'Copied' : 'Copy brief'}
            </button>
          </div>
          <pre className="commission-prompt">{prompt}</pre>
          <div className="cm-brief-foot">
            <h3 className="cm-brief-foot-head">What to do with it</h3>
            <ol className="cm-brief-steps">
              <li>Open this repository in Claude Code (terminal, desktop, or claude.ai/code).</li>
              <li>Paste the brief. Claude researches, writes the course files and runs the validator.</li>
              <li>Review the claims ledger it produced, then reload this site. The course appears under All courses.</li>
            </ol>
          </div>
        </section>
      </div>
    </div>
  )
}
