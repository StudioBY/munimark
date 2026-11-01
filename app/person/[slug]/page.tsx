import { cache } from 'react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadAuthority, LETTERS_METHOD } from '@/lib/loadAuthority'
import type { Mayor, MayorTerm, Authority } from '@/types/db'
import HeadProfile from './HeadProfile'
import './head.css'

// The head's page in letter grades: one person, every term they served, in
// every authority. Replaced the old /person page when the site switched to
// letters (2026-11-01).

interface Props {
  params: Promise<{ slug: string }>
}

// cached per request: the metadata and the page ask for the same head
const loadHead = cache(async (slug: string) => {
  const supabase = await createClient()
  const { data: person } = await supabase.from('mayors').select('*').eq('slug', slug).maybeSingle<Mayor>()
  if (!person) return null

  const { data: terms } = await supabase
    .from('mayor_terms')
    .select('authority_symbol, authority_type')
    .eq('mayor_id', person.id)
    .returns<Pick<MayorTerm, 'authority_symbol' | 'authority_type'>[]>()
  // By symbol AND type, like loadAuthority: 6 CBS symbols are shared by a
  // local and a regional council. (mayor_terms.authority_slug was filled from
  // the same join on 2026-10-29, fix_term_authority_slugs.)
  const keys = new Set((terms ?? []).map(t => `${t.authority_symbol}|${t.authority_type}`))
  const symbols = [...new Set((terms ?? []).map(t => t.authority_symbol))]
  const { data: auths } = symbols.length
    ? await supabase.from('authorities').select('slug, symbol, authority_type').in('symbol', symbols)
        .returns<Pick<Authority, 'slug' | 'symbol' | 'authority_type'>[]>()
    : { data: [] as Pick<Authority, 'slug' | 'symbol' | 'authority_type'>[] }
  const slugs = (auths ?? []).filter(a => keys.has(`${a.symbol}|${a.authority_type}`)).map(a => a.slug)
  const authorities = (await Promise.all(slugs.map(s => loadAuthority(s, LETTERS_METHOD)))).filter(a => a != null)
  return { person, authorities }
})

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const data = await loadHead(slug)
  if (!data) return { title: 'Munimark' }
  return {
    title: `${data.person.name} | Munimark`,
  }
}

export default async function HeadPage({ params }: Props) {
  const { slug } = await params
  const data = await loadHead(slug)
  if (!data) notFound()
  return <HeadProfile person={data.person} authorities={data.authorities} />
}
