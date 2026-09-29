import { createClient } from '@supabase/supabase-js'

// Anonymous, cookie-less client for build-time and cached routes (sitemap).
// Deliberately the ANON key only: everything these routes read is public by
// definition, and RLS already hides unpublished authorities from it. Never
// fall back to the service-role key here — a sitemap built with elevated
// rights could list pages the public site itself refuses to serve.
//
// Returns null when the env is missing, so `next build` still succeeds
// without a database (it then emits only the static routes).
export function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key || url.startsWith('your_')) return null
  return createClient(url, key, { auth: { persistSession: false } })
}
