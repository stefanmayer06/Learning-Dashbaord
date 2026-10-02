/**
 * Optional Supabase sync. Enabled only when VITE_SUPABASE_URL and
 * VITE_SUPABASE_ANON_KEY are set; otherwise the app is fully local.
 * Schema + row-level security: supabase/migrations/.
 */
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Capture, Certificate, CourseProgress, LearnerState, OutputRecord, Prefs, StepRecord } from './model'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigured = Boolean(url && key)

let clientPromise: Promise<SupabaseClient> | null = null
export function getClient() {
  if (!supabaseConfigured) throw new Error('Supabase is not configured')
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }),
  )
  return clientPromise
}

export async function currentUser(): Promise<User | null> {
  if (!supabaseConfigured) return null
  const sb = await getClient()
  const { data } = await sb.auth.getUser()
  return data.user ?? null
}

export async function onAuthChange(cb: (user: User | null) => void) {
  if (!supabaseConfigured) return () => {}
  const sb = await getClient()
  const { data } = sb.auth.onAuthStateChange((_e, session) => cb(session?.user ?? null))
  return () => data.subscription.unsubscribe()
}

export async function signInWithEmail(email: string) {
  const sb = await getClient()
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin + '/settings' },
  })
  if (error) throw error
}

export async function signOut() {
  const sb = await getClient()
  await sb.auth.signOut()
}

/* ───────────── pull ───────────── */

export async function pull(userId: string): Promise<Partial<LearnerState>> {
  const sb = await getClient()
  const [profile, steps, captures, outputs, certs] = await Promise.all([
    sb.from('learner_profiles').select('display_name, prefs').eq('user_id', userId).maybeSingle(),
    sb.from('step_progress').select('course_id, step_id, score, updated_at').eq('user_id', userId),
    sb.from('lab_captures').select('course_id, capture_key, summary, payload, saved_at').eq('user_id', userId),
    sb.from('work_outputs').select('course_id, output_id, fields, updated_at').eq('user_id', userId),
    sb.from('certificates').select('id, course_id, learner_name, course_title, course_version, issued_at').eq('user_id', userId),
  ])
  for (const r of [profile, steps, captures, outputs, certs]) if (r.error) throw r.error

  const courses: Record<string, CourseProgress> = {}
  const course = (id: string) => (courses[id] ??= { steps: {}, captures: {}, outputs: {} })
  for (const s of steps.data ?? []) {
    course(s.course_id).steps[s.step_id] = { status: 'done', score: s.score ?? undefined, updatedAt: s.updated_at }
  }
  for (const c of captures.data ?? []) {
    course(c.course_id).captures[c.capture_key] = { key: c.capture_key, summary: c.summary, payload: c.payload, savedAt: c.saved_at }
  }
  for (const o of outputs.data ?? []) {
    course(o.course_id).outputs[o.output_id] = { fields: o.fields ?? {}, updatedAt: o.updated_at }
  }
  for (const c of certs.data ?? []) {
    course(c.course_id).certificate = {
      id: c.id,
      learnerName: c.learner_name,
      courseTitle: c.course_title,
      courseVersion: c.course_version,
      issuedAt: c.issued_at,
    }
  }
  return {
    name: profile.data?.display_name ?? '',
    prefs: (profile.data?.prefs as Partial<Prefs> | undefined) as Prefs | undefined,
    courses,
  }
}

/* ───────────── push (all upserts, idempotent) ───────────── */

export async function pushProfile(userId: string, name: string, prefs: Prefs) {
  const sb = await getClient()
  const { error } = await sb
    .from('learner_profiles')
    .upsert({ user_id: userId, display_name: name, prefs, updated_at: new Date().toISOString() })
  if (error) throw error
}

export async function pushStep(userId: string, courseId: string, stepId: string, rec: StepRecord) {
  const sb = await getClient()
  const { error } = await sb.from('step_progress').upsert({
    user_id: userId,
    course_id: courseId,
    step_id: stepId,
    score: rec.score ?? null,
    updated_at: rec.updatedAt,
  })
  if (error) throw error
}

export async function pushCapture(userId: string, courseId: string, c: Capture) {
  const sb = await getClient()
  const { error } = await sb.from('lab_captures').upsert({
    user_id: userId,
    course_id: courseId,
    capture_key: c.key,
    summary: c.summary,
    payload: c.payload,
    saved_at: c.savedAt,
  })
  if (error) throw error
}

export async function pushOutput(userId: string, courseId: string, outputId: string, rec: OutputRecord) {
  const sb = await getClient()
  const { error } = await sb.from('work_outputs').upsert({
    user_id: userId,
    course_id: courseId,
    output_id: outputId,
    fields: rec.fields,
    updated_at: rec.updatedAt,
  })
  if (error) throw error
}

export async function pushCertificate(userId: string, courseId: string, cert: Certificate) {
  const sb = await getClient()
  // Certificates are append-only (no UPDATE grant), so never ON CONFLICT DO UPDATE.
  const { error } = await sb.from('certificates').upsert(
    {
      id: cert.id,
      user_id: userId,
      course_id: courseId,
      learner_name: cert.learnerName,
      course_title: cert.courseTitle,
      course_version: cert.courseVersion,
      issued_at: cert.issuedAt,
    },
    { onConflict: 'id', ignoreDuplicates: true },
  )
  if (error) throw error
}

/** Public check of a credential id — works signed out (security-definer RPC). */
export async function verifyCertificate(id: string) {
  const sb = await getClient()
  const { data, error } = await sb.rpc('verify_certificate', { credential: id })
  if (error) throw error
  return (data as { learner_name: string; course_title: string; course_version: string; issued_at: string }[])[0] ?? null
}
