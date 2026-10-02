/**
 * The single source of truth for learner state in the UI. Local-first: every
 * change is written to localStorage immediately; when Supabase is configured
 * and the learner is signed in, changes are also pushed (fire-and-forget with
 * a visible sync status) and remote rows are merged in on sign-in.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import {
  credentialId,
  emptyCourse,
  emptyState,
  mergeState,
  normaliseState,
  type Capture,
  type Certificate,
  type CourseProgress,
  type LearnerState,
  type Prefs,
} from './model'
import * as remote from './supabase'

const KEY = 'margin:learner:v1'

function load(): LearnerState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw) as LearnerState
    if (parsed.version !== 1) return emptyState()
    return normaliseState(parsed)
  } catch {
    return emptyState()
  }
}

function save(s: LearnerState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* private mode / quota — the session still works in memory */
  }
}

export type SyncStatus = 'local' | 'signed-out' | 'syncing' | 'synced' | 'error'

interface Ctx {
  state: LearnerState
  course: (courseId: string) => CourseProgress
  completeStep: (courseId: string, stepId: string, score?: number) => void
  visit: (courseId: string, lessonId: string, stepId: string) => void
  saveCapture: (courseId: string, key: string, summary: string, payload: unknown) => void
  saveOutputField: (courseId: string, outputId: string, fieldId: string, value: unknown) => void
  issueCertificate: (courseId: string, courseTitle: string, courseVersion: string, learnerName?: string) => Certificate
  setName: (name: string) => void
  setPrefs: (p: Partial<Prefs>) => void
  replaceAll: (s: LearnerState) => void
  resetCourse: (courseId: string) => void
  sync: { status: SyncStatus; user: User | null; error?: string }
}

const LearnerCtx = createContext<Ctx | null>(null)

export function LearnerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LearnerState>(load)
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<SyncStatus>(remote.supabaseConfigured ? 'signed-out' : 'local')
  const [syncError, setSyncError] = useState<string>()
  const userRef = useRef<User | null>(null)
  userRef.current = user

  useEffect(() => save(state), [state])

  // theme preference → <html data-theme>
  useEffect(() => {
    const t = state.prefs.theme
    if (t === 'system') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', t)
  }, [state.prefs.theme])

  /* ── remote: auth + initial merge ── */
  useEffect(() => {
    if (!remote.supabaseConfigured) return
    let unsub = () => {}
    const adopt = async (u: User | null) => {
      setUser(u)
      if (!u) return setStatus('signed-out')
      setStatus('syncing')
      try {
        const remoteState = await remote.pull(u.id)
        setState((s) => mergeState(s, remoteState))
        setStatus('synced')
        setSyncError(undefined)
      } catch (e) {
        setStatus('error')
        setSyncError((e as Error).message)
      }
    }
    remote.currentUser().then(adopt)
    remote.onAuthChange(adopt).then((u) => (unsub = u))
    return () => unsub()
  }, [])

  // After the initial pull, push everything we have locally once (idempotent upserts).
  const pushedOnce = useRef(false)
  useEffect(() => {
    if (status !== 'synced' || !user || pushedOnce.current) return
    pushedOnce.current = true
    const jobs: Promise<unknown>[] = [remote.pushProfile(user.id, state.name, state.prefs)]
    for (const [cid, cp] of Object.entries(state.courses)) {
      for (const [sid, rec] of Object.entries(cp.steps)) jobs.push(remote.pushStep(user.id, cid, sid, rec))
      for (const c of Object.values(cp.captures)) jobs.push(remote.pushCapture(user.id, cid, c))
      for (const [oid, rec] of Object.entries(cp.outputs)) jobs.push(remote.pushOutput(user.id, cid, oid, rec))
      if (cp.certificate) jobs.push(remote.pushCertificate(user.id, cid, cp.certificate))
    }
    Promise.all(jobs).catch((e) => {
      setStatus('error')
      setSyncError((e as Error).message)
    })
  }, [status, user, state])

  const push = useCallback((job: (uid: string) => Promise<unknown>) => {
    const u = userRef.current
    if (!u) return
    setStatus('syncing')
    job(u.id)
      .then(() => {
        setStatus('synced')
        setSyncError(undefined)
      })
      .catch((e) => {
        setStatus('error')
        setSyncError((e as Error).message)
      })
  }, [])

  const updateCourse = useCallback((courseId: string, fn: (cp: CourseProgress) => CourseProgress) => {
    setState((s) => ({ ...s, courses: { ...s.courses, [courseId]: fn(s.courses[courseId] ?? emptyCourse()) } }))
  }, [])

  const ctx = useMemo<Ctx>(
    () => ({
      state,
      course: (id) => state.courses[id] ?? emptyCourse(),
      completeStep: (courseId, stepId, score) => {
        // keep the best score; never "un-complete"
        const prev = state.courses[courseId]?.steps[stepId]
        if (prev && (prev.score ?? 0) >= (score ?? 0)) return
        const rec = { status: 'done' as const, score, updatedAt: new Date().toISOString() }
        updateCourse(courseId, (cp) => ({ ...cp, steps: { ...cp.steps, [stepId]: rec } }))
        push((uid) => remote.pushStep(uid, courseId, stepId, rec))
      },
      visit: (courseId, lessonId, stepId) =>
        updateCourse(courseId, (cp) => ({ ...cp, lastVisited: { lessonId, stepId, at: new Date().toISOString() } })),
      saveCapture: (courseId, key, summary, payload) => {
        const c: Capture = { key, summary, payload, savedAt: new Date().toISOString() }
        updateCourse(courseId, (cp) => ({ ...cp, captures: { ...cp.captures, [key]: c } }))
        push((uid) => remote.pushCapture(uid, courseId, c))
      },
      saveOutputField: (courseId, outputId, fieldId, value) => {
        let rec = { fields: {}, updatedAt: '' } as CourseProgress['outputs'][string]
        updateCourse(courseId, (cp) => {
          rec = {
            fields: { ...(cp.outputs[outputId]?.fields ?? {}), [fieldId]: value },
            updatedAt: new Date().toISOString(),
          }
          return { ...cp, outputs: { ...cp.outputs, [outputId]: rec } }
        })
        debouncedPush(`${courseId}/${outputId}`, () => push((uid) => remote.pushOutput(uid, courseId, outputId, rec)))
      },
      issueCertificate: (courseId, courseTitle, courseVersion, learnerName) => {
        const existing = state.courses[courseId]?.certificate
        if (existing) return existing
        const issuedAt = new Date().toISOString()
        const name = learnerName?.trim() || state.name || 'Learner'
        const cert: Certificate = {
          id: credentialId(courseId, name, issuedAt, userRef.current?.id ?? ''),
          learnerName: name,
          courseTitle,
          courseVersion,
          issuedAt,
        }
        updateCourse(courseId, (cp) => ({ ...cp, certificate: cert }))
        push((uid) => remote.pushCertificate(uid, courseId, cert))
        return cert
      },
      setName: (name) => {
        setState((s) => ({ ...s, name }))
        debouncedPush('profile', () => push((uid) => remote.pushProfile(uid, name, state.prefs)))
      },
      setPrefs: (p) => {
        const prefs = { ...state.prefs, ...p }
        setState((s) => ({ ...s, prefs: { ...s.prefs, ...p } }))
        debouncedPush('profile', () => push((uid) => remote.pushProfile(uid, state.name, prefs)))
      },
      replaceAll: (s) => setState(normaliseState(s)),
      resetCourse: (courseId) =>
        setState((s) => {
          const courses = { ...s.courses }
          delete courses[courseId]
          return { ...s, courses }
        }),
      sync: { status, user, error: syncError },
    }),
    [state, status, user, syncError, updateCourse, push],
  )

  return <LearnerCtx.Provider value={ctx}>{children}</LearnerCtx.Provider>
}

const timers = new Map<string, ReturnType<typeof setTimeout>>()
function debouncedPush(key: string, fn: () => void, ms = 900) {
  clearTimeout(timers.get(key))
  timers.set(key, setTimeout(fn, ms))
}

export function useLearner() {
  const c = useContext(LearnerCtx)
  if (!c) throw new Error('useLearner outside LearnerProvider')
  return c
}
