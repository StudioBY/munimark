import type { MetadataRoute } from 'next'
import { createPublicClient } from '@/lib/supabase/public'
import { SITE_URL } from '@/lib/seo'

// Rebuilt daily. The pages it lists are generated statically from the same
// tables, so a new authority or person appears here on the next refresh.
export const revalidate = 86400

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // The data carries no per-row modification date, so lastModified is the
  // time this sitemap was generated — honest about what we know.
  const now = new Date()

  const entries: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: now, changeFrequency: 'monthly', priority: 1 },
    { url: `${SITE_URL}/credits`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
  ]

  const supabase = createPublicClient()
  if (!supabase) return entries

  const [{ data: authorities, error: authErr }, { data: people, error: peopleErr }] = await Promise.all([
    // Only authorities with yearly rows: /mayor/[slug] returns 404 without
    // them, and a sitemap that lists 404s teaches crawlers to distrust it.
    supabase.from('authorities').select('slug, authority_yearly!inner(data_year)').limit(1, { referencedTable: 'authority_yearly' }),
    supabase.from('mayors').select('slug').not('slug', 'is', null),
  ])
  // Fail the build rather than publish a sitemap that silently lost half the site.
  if (authErr) throw new Error(`sitemap: authorities query failed — ${authErr.message}`)
  if (peopleErr) throw new Error(`sitemap: mayors query failed — ${peopleErr.message}`)

  for (const a of authorities ?? []) {
    entries.push({ url: `${SITE_URL}/mayor/${a.slug}`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 })
  }
  // A person can appear more than once only if data is duplicated; list each URL once.
  for (const slug of new Set((people ?? []).map(p => p.slug as string))) {
    entries.push({ url: `${SITE_URL}/person/${slug}`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 })
  }
  return entries
}
