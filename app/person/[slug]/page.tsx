import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Mayor, AuthorityYearly, MayorTerm, Authority } from '@/types/db'
import PersonProfile from './PersonProfile'
import JsonLd from '@/lib/JsonLd'
import { pageMetadata, personDescription, personJsonLd } from '@/lib/seo'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: person } = await supabase
    .from('mayors')
    .select('*')
    .eq('slug', slug)
    .single<Mayor>()

  if (!person) return { title: 'Munimark' }

  // The description names the posts held, from mayor_terms, so it needs the
  // terms and the authorities they point to — the same lookup as the page.
  const { data: terms } = await supabase
    .from('mayor_terms')
    .select('authority_symbol, authority_type, term_label, is_current')
    .eq('mayor_id', person.id)
  const symbols = [...new Set((terms ?? []).map(t => t.authority_symbol))]
  const { data: authorities } = symbols.length
    ? await supabase
        .from('authorities')
        .select('symbol, authority_type, name_display, slug')
        .in('symbol', symbols)
    : { data: [] }

  return pageMetadata({
    title: `${person.name} | Munimark`,
    description: personDescription({ person, terms: terms ?? [], authorities: authorities ?? [] }),
    path: `/person/${slug}`,
    image: person.photo_url,
    type: 'profile',
  })
}

export async function generateStaticParams() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url || url.startsWith('your_')) return []
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('mayors')
    .select('slug')
    .not('slug', 'is', null)
  return (data ?? []).map(r => ({ slug: r.slug! }))
}

export default async function PersonPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  // Fetch person record
  const { data: person } = await supabase
    .from('mayors')
    .select('*')
    .eq('slug', slug)
    .single<Mayor>()

  if (!person) notFound()

  // Fetch all their mayor_terms (possibly across multiple authorities)
  const { data: terms } = await supabase
    .from('mayor_terms')
    .select('*')
    .eq('mayor_id', person.id)
    .returns<MayorTerm[]>()

  const termList = terms ?? []

  // Get unique authority symbols from their terms
  const authKeys = [...new Set(termList.map(t => `${t.authority_symbol}|${t.authority_type}`))]

  // Fetch authority records and yearly data for their authorities
  let authorities: Authority[] = []
  let allYears: AuthorityYearly[] = []

  if (authKeys.length > 0) {
    // Get authorities by symbol
    const symbols = [...new Set(termList.map(t => t.authority_symbol))]
    const { data: auths } = await supabase
      .from('authorities')
      .select('*')
      .in('symbol', symbols)
      .returns<Authority[]>()
    authorities = auths ?? []

    // Get yearly data for those authorities
    const authIds = authorities.map(a => a.id)
    if (authIds.length > 0) {
      const { data: years } = await supabase
        .from('authority_yearly')
        .select('*')
        .in('authority_id', authIds)
        .order('data_year', { ascending: true })
        .returns<AuthorityYearly[]>()
      allYears = years ?? []
    }
  }

  return (
    <>
      <JsonLd data={personJsonLd({ person, terms: termList, authorities })} />
      <PersonProfile
        person={person}
        terms={termList}
        authorities={authorities}
        years={allYears}
      />
    </>
  )
}
