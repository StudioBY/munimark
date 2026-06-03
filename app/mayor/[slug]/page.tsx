import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Authority, Mayor, AuthorityYearly, Score } from '@/types/db'
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

  const [{ data: mayor }, { data: years }, { data: score }] = await Promise.all([
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
  ])

  const yearList = years ?? []
  const latestYear = yearList[yearList.length - 1]

  if (!mayor || !latestYear) notFound()

  return (
    <MayorProfile
      authority={authority}
      mayor={mayor}
      years={yearList}
      latestYear={latestYear}
      score={score ?? null}
    />
  )
}
