import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { AuthorityYearly } from '@/types/db'
import { loadAuthority, ACTIVE_METHOD } from '@/lib/loadAuthority'
import MayorProfile from './MayorProfile'
import JsonLd from '@/lib/JsonLd'
import { B_COLUMNS, authorityDescription, authorityJsonLd, pageMetadata } from '@/lib/seo'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: auth } = await supabase
    .from('authorities')
    .select('id, name_display')
    .eq('slug', slug)
    .single()

  if (!auth) return { title: 'Munimark' }

  // Only what the description states: the current head's name, how many of
  // the 18 metrics this authority has data for, over which years, and whether
  // a peer comparison exists. All counted from the rows, per authority.
  const [{ data: mayor }, { data: years }, { data: score }] = await Promise.all([
    supabase
      .from('mayors')
      .select('name')
      .eq('authority_id', auth.id)
      .eq('is_current', true)
      .maybeSingle(),
    supabase
      .from('authority_yearly')
      .select(['data_year', ...B_COLUMNS].join(', '))
      .eq('authority_id', auth.id)
      .returns<Pick<AuthorityYearly, 'data_year' | (typeof B_COLUMNS)[number]>[]>(),
    supabase
      .from('scores')
      .select('comparison_group, group_size')
      .eq('authority_id', auth.id)
      .eq('methodology_version', ACTIVE_METHOD)
      .order('data_year', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  return pageMetadata({
    title: `${auth.name_display} | Munimark`,
    description: authorityDescription({
      authority: auth,
      mayorName: mayor?.name ?? null,
      years: years ?? [],
      score: score ?? null,
    }),
    path: `/mayor/${slug}`,
  })
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
  const data = await loadAuthority(slug)
  if (!data) notFound()
  const { authority, mayor, years: yearList, scores, anchors, cfg, mayorTerms } = data
  const latestYear = yearList[yearList.length - 1]

  if (!latestYear) notFound()

  return (
    <>
      <JsonLd
        data={authorityJsonLd({
          authority,
          // Latest year that records a district — the newest row may predate its import.
          district: [...yearList].reverse().find(r => r.h_district)?.h_district ?? null,
          mayor,
        })}
      />
      <MayorProfile
        authority={authority}
        mayor={mayor}
        years={yearList}
        latestYear={latestYear}
        scores={scores}
        anchors={anchors}
        scoringConfig={cfg}
        mayorTerms={mayorTerms}
      />
    </>
  )
}
