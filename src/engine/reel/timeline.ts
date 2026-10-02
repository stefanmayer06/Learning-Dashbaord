import type { Reel, Shot } from '../../content/schema'
import { speakable } from '../../ui/text'

export interface TimedShot {
  shot: Shot
  index: number
  start: number
  duration: number
  chapter: string
  words: string[]
}

export interface Timeline {
  shots: TimedShot[]
  total: number
  chapters: { title: string; start: number }[]
}

/** ~165 words/min plus a beat to land the visual. */
export function estimateDuration(narration: string) {
  const words = speakable(narration).split(/\s+/).filter(Boolean).length
  return Math.max(3.2, words / 2.75 + 1.1)
}

export function buildTimeline(reel: Reel): Timeline {
  let t = 0
  let chapter = 'Intro'
  const chapters: Timeline['chapters'] = []
  const shots = reel.shots.map((shot, index) => {
    if (shot.chapter) {
      chapter = shot.chapter
      chapters.push({ title: shot.chapter, start: t })
    } else if (index === 0) chapters.push({ title: chapter, start: 0 })
    const duration = shot.duration ?? estimateDuration(shot.narration)
    const ts: TimedShot = {
      shot,
      index,
      start: t,
      duration,
      chapter,
      words: speakable(shot.narration).split(/\s+/).filter(Boolean),
    }
    t += duration
    return ts
  })
  return { shots, total: t, chapters }
}

export function shotAt(tl: Timeline, time: number): TimedShot {
  const { shots } = tl
  let lo = 0
  let hi = shots.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (shots[mid].start <= time) lo = mid
    else hi = mid - 1
  }
  return shots[lo]
}

export function fmtTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

/**
 * Subtitle-style captions: the narration is cut into short phrases (≤ ~64
 * characters, preferring punctuation), and only the phrase being spoken is
 * shown, with already-spoken words brightened.
 */
export function captionChunks(text: string, max = 64): string[] {
  const words = text.split(/(\s+)/)
  const chunks: string[] = []
  let cur = ''
  for (const w of words) {
    if (!w) continue
    if ((cur + w).trimEnd().length > max && cur.trim()) {
      chunks.push(cur)
      cur = ''
    }
    cur += w
    // break after sentence ends, and after commas/dashes once the phrase is long enough
    if (/[.!?]$/.test(w) || (/[,;:—]$/.test(w) && cur.trim().length > max * 0.55)) {
      chunks.push(cur)
      cur = ''
    }
  }
  if (cur.trim()) chunks.push(cur)
  return chunks
}

/* ───────── animation helpers used by shots ───────── */

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x))
/** Progress of x through [a, b], clamped to 0..1. */
export const seg = (x: number, a: number, b: number) => clamp((x - a) / (b - a))
export const easeOut = (x: number) => 1 - Math.pow(1 - x, 3)
export const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
/** Entrance for item i of n spread over [a, b] of the shot, each taking `len`. */
export const stagger = (p: number, i: number, n: number, a = 0.04, b = 0.8, len = 0.18) => {
  const start = a + (n <= 1 ? 0 : ((b - a - len) * i) / (n - 1))
  return easeOut(seg(p, start, start + len))
}
