import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Authority, Mayor, AuthorityYearly, Score, MayorTerm } from '@/types/db'
import MayorProfile from './MayorProfile'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: auth } = await supabase
    .from('authorities')
    .select('name_display')
    .eq('slug', slug)
    .single()

  if (!auth) return { title: 'Munimark' }

  return {
    title: `${auth.name_display} | Munimark`,
    description: `פרופיל ביצועים של ראש הרשות — ${auth.name_display}`,
  }
}

export async function generateStaticParams() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url || url.startsWith('your_')) return []
  // Must use admin client (no cookies) — generateStaticParams runs at build time
  const supabase = createAdminClient()
  const { data } = await supabase.from('authorities').select('slug')
  return (data ?? []).map(r => ({ slug: r.slug }))
}

export default async function MayorPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: authority } = await supabase
    .from('authorities')
    .select('*')
    .eq('slug', slug)
    .single<Authority>()

  if (!authority) notFound()

  const [{ data: mayor }, { data: years }, { data: score }, { data: mayorTerms }] = await Promise.all([
    supabase
      .from('mayors')
      .select('*')
      .eq('authority_id', authority.id)
      .single<Mayor>(),
    supabase
      .from('authority_yearly')
      .select('*')
      .eq('authority_id', authority.id)
      .order('data_year', { ascending: true })
      .returns<AuthorityYearly[]>(),
    supabase
      .from('scores')
      .select('*')
      .eq('authority_id', authority.id)
      .order('data_year', { ascending: false })
      .limit(1)
      .single<Score>(),
    supabase
      .from('mayor_terms')
      .select('*, mayors(name, photo_url, background, wikipedia_url)')
      .eq('authority_symbol', authority.symbol)
      .eq('authority_type', authority.authority_type ?? '')
      .returns<MayorTerm[]>(),
  ])

  const yearList = years ?? []
  const latestYear = yearList[yearList.length - 1]

  // DEBUG: log H-field values from DB
  console.log('[DEBUG] authority_yearly h-fields for', slug, yearList.map(r => ({
    year: r.data_year,
    h_life_expectancy: r.h_life_expectancy,
    h_ba_degree_pct:   r.h_ba_degree_pct,
    h_youth_pct:       r.h_youth_pct,
    h_elderly_pct:     r.h_elderly_pct,
  })))

  if (!latestYear) notFound()

  return (
    <MayorProfile
      authority={authority}
      mayor={mayor ?? null}
      years={yearList}
      latestYear={latestYear}
      score={score ?? null}
      mayorTerms={mayorTerms ?? []}
    />
  )
}
