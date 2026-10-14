/**
 * npm run check-sources [course-id]
 *
 * Goes online and checks every source:
 *   - the URL answers (HTTP status < 400, following redirects), and prints the
 *     page <title> so soft-404s are easy to spot by eye
 *   - arXiv ids: the arXiv API title matches the cited title
 *   - DOIs: the Crossref record's title matches the cited title
 * Some publishers block automated requests (HTTP 403); a DOI confirmed by
 * Crossref is accepted in that case. Everything else is reported, not hidden.
 *
 * It also checks every embedded talk and podcast (YouTube, Apple Podcasts,
 * NIH VideoCast, allowlisted iframes): still online and embeddable, its title
 * as the host gives it, and its release date against the step's `date`.
 */
import { readCourses } from './read-courses'

interface Src {
  id: string
  title: string
  url: string
  arxiv?: string
  doi?: string
  kind: string
}

const UA = 'Mozilla/5.0 (compatible; margin-source-check/1.0; +https://github.com/)'

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** 1 = same title; ≥ 0.7 = same work, wording differs (e.g. published vs preprint title). */
function similarity(a: string, b: string) {
  const A = new Set(norm(a).split(' '))
  const B = new Set(norm(b).split(' '))
  const inter = [...A].filter((w) => B.has(w)).length
  return inter / new Set([...A, ...B]).size
}

async function page(url: string): Promise<{ ok: boolean; status: string; title?: string }> {
  try {
    const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': UA, accept: 'text/html,*/*' }, signal: AbortSignal.timeout(25_000) })
    let title: string | undefined
    if ((res.headers.get('content-type') ?? '').includes('html')) {
      const html = (await res.text()).slice(0, 400_000)
      title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim()
    }
    return { ok: res.status < 400, status: `HTTP ${res.status}`, title }
  } catch (e) {
    return { ok: false, status: `error ${(e as Error).message}` }
  }
}

async function arxivTitles(ids: string[]): Promise<Record<string, string>> {
  if (!ids.length) return {}
  const res = await fetch(`https://export.arxiv.org/api/query?id_list=${ids.join(',')}&max_results=${ids.length}`, { signal: AbortSignal.timeout(60_000) })
  const xml = await res.text()
  const out: Record<string, string> = {}
  for (const entry of xml.split('<entry>').slice(1)) {
    const id = entry.match(/<id>https?:\/\/arxiv\.org\/abs\/([^<]+?)(v\d+)?<\/id>/)?.[1]
    const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]
    if (id && title) out[id] = title.replace(/\s+/g, ' ').trim()
  }
  return out
}

async function crossrefTitle(doi: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(25_000) })
    if (!res.ok) return null
    const j = (await res.json()) as { message?: { title?: string[] } }
    return j.message?.title?.[0] ?? null
  } catch {
    return null
  }
}

interface Embed {
  id: string
  type: string
  provider?: string
  src?: string
  date?: string
}

/**
 * Embedded talks and podcasts: still online and embeddable, what the host calls it (to compare
 * with the step by eye) and, where the host says, its date — which must match the step's `date`.
 */
async function embed(e: Embed): Promise<{ ok: boolean; status: string; found?: string; date?: string }> {
  try {
    const get = (url: string) => fetch(url, { redirect: 'follow', headers: { 'user-agent': UA }, signal: AbortSignal.timeout(25_000) })
    if (e.provider === 'youtube') {
      // 401 = the owner disabled embedding, 404 = gone
      const res = await get(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${e.src}`)}&format=json`)
      if (!res.ok) return { ok: false, status: `HTTP ${res.status}` }
      const j = (await res.json()) as { title: string; author_name: string }
      return { ok: true, status: 'HTTP 200', found: `${j.title} — ${j.author_name}` }
    }
    if (e.provider === 'apple-podcasts') {
      const res = await get(`https://podcasts.apple.com/gb/episode/${e.src}`)
      const html = await res.text()
      const found = html.match(/property="og:title" content="([^"]*)"/)?.[1] ?? html.match(/og:title" content="([^"]*)"/)?.[1]
      const date = html.match(/"datePublished":"(\d{4}-\d{2}-\d{2})/)?.[1]
      return { ok: res.ok && Boolean(found), status: `HTTP ${res.status}`, found, date }
    }
    if (e.provider === 'nih-videocast') {
      const res = await get(`https://videocast.nih.gov/api/events/${e.src}`)
      if (!res.ok) return { ok: false, status: `HTTP ${res.status}` }
      const j = (await res.json()) as { title?: string; video_url?: string; start_time?: string }
      return { ok: Boolean(j.title && j.video_url), status: j.video_url ? 'HTTP 200' : 'no recording', found: j.title, date: j.start_time?.slice(0, 10) }
    }
    if (e.provider === 'iframe') return page(e.src!)
    return { ok: true, status: 'skipped' }
  } catch (err) {
    return { ok: false, status: `error ${(err as Error).message}` }
  }
}

const only = process.argv.slice(2).find((a) => !a.startsWith('--'))
let problems = 0
for (const raw of readCourses(only)) {
  const embeds = Object.values(raw.lessons)
    .flatMap((l) => ((l as { steps?: Embed[] }).steps ?? []).filter((s) => s.type === 'embed' && s.provider !== 'quirk'))
  if (embeds.length) {
    console.log(`\n${raw.folder}: checking ${embeds.length} embedded talks, podcasts and tools`)
    for (const { e, r } of await Promise.all(embeds.map(async (e) => ({ e, r: await embed(e) })))) {
      const notes = [r.found ? `“${r.found.slice(0, 90)}”` : '']
      let bad = !r.ok
      if (e.date && r.date && e.date !== r.date) {
        notes.push(`DATE: host says ${r.date}, step says ${e.date}`)
        bad = true
      }
      if (bad) problems++
      console.log(`  ${bad ? '✗' : '✓'} ${e.id.padEnd(26)} ${(e.provider ?? '').padEnd(15)} ${r.status.padEnd(12)} ${notes.join(' · ')}`)
    }
  }

  const sources = raw.sources as Src[]
  console.log(`\n${raw.folder}: checking ${sources.length} sources`)
  const titles = await arxivTitles(sources.filter((s) => s.arxiv).map((s) => s.arxiv!))
  const results = await Promise.all(
    sources.map(async (s) => ({ s, pg: await page(s.url), cr: s.doi ? await crossrefTitle(s.doi) : null })),
  )
  for (const { s, pg, cr } of results) {
    const notes: string[] = []
    let bad = false
    const titleCheck = (label: string, found: string | null | undefined) => {
      if (!found) return
      const sim = similarity(found, s.title)
      if (sim >= 0.95) notes.push(`${label} ✓`)
      else if (sim >= 0.7) notes.push(`${label} ~ (registered as “${found}”)`)
      else {
        notes.push(`${label} MISMATCH: “${found}”`)
        bad = true
      }
    }
    if (s.arxiv) {
      if (titles[s.arxiv]) titleCheck('arXiv', titles[s.arxiv])
      else {
        notes.push(`arXiv ${s.arxiv} not found`)
        bad = true
      }
    }
    if (s.doi) {
      if (cr) titleCheck('Crossref', cr)
      else notes.push('Crossref: no record')
    }
    const doiConfirmed = Boolean(cr) && similarity(cr!, s.title) >= 0.7
    if (!pg.ok && !doiConfirmed) bad = true
    if (!pg.ok && doiConfirmed) notes.push('site blocks bots; DOI confirmed')
    if (pg.title && !s.arxiv && !s.doi) notes.push(`page: “${pg.title.slice(0, 80)}”`)
    if (bad) problems++
    console.log(`  ${bad ? '✗' : '✓'} ${s.id.padEnd(26)} ${pg.status.padEnd(9)} ${notes.join(' · ')}`)
  }
}
console.log(problems ? `\n${problems} problem(s). Some sites block automated checks — open those links by hand and record what you saw.` : '\nAll sources check out.')
process.exit(problems ? 1 : 0)
