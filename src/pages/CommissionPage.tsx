import { useMemo, useState } from 'react'
import { Glyph } from '../ui/Glyph'
import { Segmented } from '../ui/LabFrame'

const LEVELS = ['Complete beginner', 'Some background', 'Working knowledge', 'Expert in a neighbouring field']

/**
 * Courses are files in this repository, authored by Claude Code with the
 * add-subject skill. This page turns a few answers into the brief to hand it.
 */
export function CommissionPage() {
  const [subject, setSubject] = useState('')
  const [goal, setGoal] = useState('')
  const [level, setLevel] = useState(LEVELS[0])
  const [hours, setHours] = useState(6)
  const [outputs, setOutputs] = useState('')
  const [must, setMust] = useState('')
  const [avoid, setAvoid] = useState('')
  const [copied, setCopied] = useState(false)

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

  return (
    <div className="commission page">
      <p className="label">Commission</p>
      <h1 className="display display-l">What should you learn next?</h1>
      <p className="lede">
        Every course here is a folder of plain files that Claude writes, sources and checks. Answer a few questions, then paste the brief into Claude Code in this repository.
      </p>
      <div className="commission-grid">
        <form className="commission-form" onSubmit={(e) => e.preventDefault()}>
          <label className="cf">
            <span className="label">Subject</span>
            <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Options market making" />
          </label>
          <label className="cf">
            <span className="label">Why — what should this let you do?</span>
            <textarea className="textarea" rows={3} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. Hold my own in conversations with our quant desk" />
          </label>
          <div className="cf">
            <span className="label">Your level</span>
            <Segmented label="Level" value={level} onChange={setLevel} options={LEVELS.map((l) => ({ value: l, label: l }))} />
          </div>
          <label className="cf">
            <span className="label">Time budget · {hours} hours</span>
            <input type="range" min={1} max={30} value={hours} onChange={(e) => setHours(Number(e.target.value))} />
          </label>
          <label className="cf">
            <span className="label">What do you want to have made at the end? (optional)</span>
            <input className="input" value={outputs} onChange={(e) => setOutputs(e.target.value)} placeholder="e.g. a one-page strategy memo and a working pricing model" />
          </label>
          <label className="cf">
            <span className="label">Must cover (optional)</span>
            <input className="input" value={must} onChange={(e) => setMust(e.target.value)} />
          </label>
          <label className="cf">
            <span className="label">Leave out (optional)</span>
            <input className="input" value={avoid} onChange={(e) => setAvoid(e.target.value)} />
          </label>
        </form>
        <div className="commission-out">
          <div className="commission-out-head">
            <span className="label">Brief for Claude Code</span>
            <button
              className="btn btn-small"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(prompt)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1800)
                } catch {
                  /* clipboard blocked: the text is selectable */
                }
              }}
            >
              {copied ? 'Copied' : 'Copy'} <Glyph name={copied ? 'check' : 'copy'} size={14} />
            </button>
          </div>
          <pre className="commission-prompt">{prompt}</pre>
          <ol className="commission-steps small soft">
            <li>Open this repository in Claude Code (terminal, desktop, or claude.ai/code).</li>
            <li>Paste the brief. Claude researches, writes the course files and runs the validator.</li>
            <li>Review the claims ledger it produced, then reload this site — the course appears on the shelf.</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
