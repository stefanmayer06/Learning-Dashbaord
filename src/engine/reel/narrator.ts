/**
 * Thin wrapper over the Web Speech API. The player treats narration as
 * optional: if the browser has no voices, reels still play with captions.
 */

export function speechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
}

export function listVoices(): SpeechSynthesisVoice[] {
  if (!speechSupported()) return []
  return window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('en'))
}

/** Prefer natural-sounding English voices when the learner hasn't chosen one. */
export function pickVoice(preferredURI: string | null): SpeechSynthesisVoice | null {
  const voices = listVoices()
  if (!voices.length) return null
  if (preferredURI) {
    const v = voices.find((x) => x.voiceURI === preferredURI)
    if (v) return v
  }
  const score = (v: SpeechSynthesisVoice) =>
    (/natural|neural|premium|enhanced/i.test(v.name) ? 8 : 0) +
    (/google/i.test(v.name) ? 4 : 0) +
    (/en-GB|en-US/i.test(v.lang) ? 2 : 0) +
    (v.localService ? 1 : 0)
  return [...voices].sort((a, b) => score(b) - score(a))[0]
}

export function onVoicesChanged(cb: () => void) {
  if (!speechSupported()) return () => {}
  window.speechSynthesis.addEventListener('voiceschanged', cb)
  return () => window.speechSynthesis.removeEventListener('voiceschanged', cb)
}

export class Narrator {
  /** Held so Chrome does not garbage-collect the utterance mid-sentence (which drops onend). */
  utter: SpeechSynthesisUtterance | null = null
  private token = 0
  speaking = false
  /** Character offset (within the full text passed to speak) of the current word. */
  charIndex = 0
  private offset = 0

  speak(
    text: string,
    opts: { voice: SpeechSynthesisVoice | null; rate: number; fromChar?: number },
    onEnd: () => void,
    onBoundary?: (charIndex: number) => void,
  ) {
    if (!speechSupported()) return
    this.cancel()
    const token = ++this.token
    this.offset = opts.fromChar ?? 0
    const chunk = text.slice(this.offset)
    if (!chunk.trim()) {
      onEnd()
      return
    }
    const u = new SpeechSynthesisUtterance(chunk)
    if (opts.voice) u.voice = opts.voice
    u.rate = opts.rate
    u.pitch = 1
    u.onboundary = (e) => {
      if (token !== this.token) return
      this.charIndex = this.offset + e.charIndex
      onBoundary?.(this.charIndex)
    }
    const finish = () => {
      if (token !== this.token) return
      this.speaking = false
      this.utter = null
      onEnd()
    }
    u.onend = finish
    u.onerror = finish
    this.utter = u
    this.speaking = true
    this.charIndex = this.offset
    window.speechSynthesis.speak(u)
  }

  cancel() {
    this.token++
    this.speaking = false
    this.utter = null
    if (speechSupported()) window.speechSynthesis.cancel()
  }
}
