/** Text helpers for the content mini-language — no KaTeX here, so they're cheap to import. */

export type Token = { kind: 'text' | 'em' | 'tex'; value: string }

export function tokenize(text: string): Token[] {
  const out: Token[] = []
  const re = /\*\*([^*]+)\*\*|\$([^$]+)\$/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ kind: 'text', value: text.slice(last, m.index) })
    if (m[1] !== undefined) out.push({ kind: 'em', value: m[1] })
    else out.push({ kind: 'tex', value: m[2] })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ kind: 'text', value: text.slice(last) })
  return out
}

/** Plain text for narration / transcripts: strips markup, speaks TeX roughly. */
export function speakable(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\$([^$]+)\$/g, (_, t: string) =>
      t
        .replace(/\\sqrt\{([^}]*)\}/g, 'root $1')
        .replace(/\|([^|⟩>]*)\\rangle/g, 'ket $1')
        .replace(/\\(alpha|beta|gamma|theta|phi|psi|pi|epsilon|sigma|mu|lambda)/g, '$1')
        .replace(/\^\{?2\}?/g, ' squared')
        .replace(/[{}\\_^]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .replace(/ψ/g, 'psi')
    .replace(/≈/g, ' approximately ')
    .replace(/→/g, ' to ')
    .replace(/×/g, ' times ')
    .replace(/\s+/g, ' ')
    .trim()
}
