import { createClient } from '@/lib/supabase/server'
import type { Authority, Mayor, AuthorityYearly, Score, MayorTerm, ScoringAnchor, ScoringConfig } from '@/types/db'

export interface AuthorityPageData {
  authority: Authority
  mayor: Mayor | null
  years: AuthorityYearly[]
  scores: Score[]
  anchors: ScoringAnchor[]
  cfg: ScoringConfig | null
  mayorTerms: MayorTerm[]
}

/** Everything an authority page renders, or null when the slug is unknown. */
export async function loadAuthority(slug: string): Promise<AuthorityPageData | null> {
  const supabase = await createClient()

  const { data: authority } = await supabase
    .from('authorities')
    .select('*')
    .eq('slug', slug)
    .single<Authority>()
  if (!authority) return null

  const [{ data: mayor }, { data: years }, { data: scoreRows }, { data: mayorTerms }, { data: cfgRows }] = await Promise.all([
    supabase
      .from('mayors')
      .select('*')
      // migration 006 turned `mayors` into a person table: an authority can
      // hold historical mayors too, so .single() needs the current one.
      .eq('authority_id', authority.id)
      .eq('is_current', true)
      .maybeSingle<Mayor>(),
    supabase
      .from('authority_yearly')
      .select('*')
      .eq('authority_id', authority.id)
      .order('data_year', { ascending: true })
      .returns<AuthorityYearly[]>(),
    // Every scored year, not just the latest: the page shows the term record
    // and the trend, and the band is read from the newest row.
    supabase
      .from('scores')
      .select('*')
      .eq('authority_id', authority.id)
      .order('data_year', { ascending: true })
      .returns<Score[]>(),
    supabase
      .from('mayor_terms')
      .select('*, mayors(name, photo_url, background, wikipedia_url, slug)')
      .eq('authority_symbol', authority.symbol)
      .eq('authority_type', authority.authority_type ?? '')
      .returns<MayorTerm[]>(),
    supabase
      .from('scoring_config')
      .select('*')
      .order('frozen_at', { ascending: false })
      .returns<ScoringConfig[]>(),
  ])

  // One methodology at a time: v2 will be written beside v1, never over it,
  // so a page must not mix rows from the two.
  const cfg = cfgRows?.[0] ?? null
  const scores = (scoreRows ?? []).filter(s => cfg && s.methodology_version === cfg.methodology_version)
  const groups = [...new Set(scores.map(s => s.comparison_group))]
  const { data: anchors } = cfg && groups.length
    ? await supabase
        .from('scoring_anchors')
        .select('comparison_group, field, data_year, low, high, n_observations, direction')
        .eq('methodology_version', cfg.methodology_version)
        .in('comparison_group', groups)
        .returns<ScoringAnchor[]>()
    : { data: [] as ScoringAnchor[] }

  return {
    authority,
    mayor: mayor ?? null,
    years: years ?? [],
    scores,
    anchors: anchors ?? [],
    cfg,
    mayorTerms: mayorTerms ?? [],
  }
}
