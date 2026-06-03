import { createClient } from '@supabase/supabase-js'

// Service-role client — never exposed to browser.
// Used only in generateStaticParams and server-side scripts.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) throw new Error('Missing Supabase env vars')

  return createClient(url, key, { auth: { persistSession: false } })
}
