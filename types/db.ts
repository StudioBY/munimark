export interface Authority {
  id: number
  symbol: number
  name_display: string
  name_cbs: string
  slug: string
  entity_id_obudget: string | null
}

export interface Mayor {
  id: number
  authority_id: number
  name: string | null
  birth_year: string | null
  tenure_start: string | null
  term_count: number | null
  background: string | null
  photo_url: string | null
  election_pct: string | null
  youtube_url: string | null
  youtube_subscribers: number | null
  youtube_video_count: number | null
  youtube_last_video: string | null
  youtube_active: boolean | null
}

export interface AuthorityYearly {
  id: number
  authority_id: number
  data_year: number
  // H
  h_district: string | null
  h_authority_type: string | null
  h_population: number | null
  h_socio_cluster: number | null
  h_periphery: number | null
  h_density: number | null
  h_youth_pct: number | null
  h_elderly_pct: number | null
  h_equalization_grant: number | null
  h_ba_degree_pct: number | null
  h_life_expectancy: number | null
  h_council_members: number | null
  // B
  b_budget_per_capita: number | null
  b_arnona_collection_pct: number | null
  b_budget_execution_pct: number | null
  b_own_revenue_pct: number | null
  b_surplus_deficit: number | null
  b_bagrut_pct: number | null
  b_bagrut_uni_pct: number | null
  b_dropout_pct: number | null
  b_students_per_class: number | null
  b_edu_spend_pct: number | null
  b_welfare_spend_pct: number | null
  b_construction_starts: number | null
  b_construction_completions: number | null
  b_population_growth_pct: number | null
  b_migration_balance: number | null
  b_water_loss_pct: number | null
  b_recycling_pct: number | null
  b_waste_per_capita: number | null
  b_edu_invest_per_capita: number | null
  b_welfare_invest_per_capita: number | null
  // D
  d_accidents_per_1000: number | null
  d_sewage_treated_pct: number | null
  d_water_violations: number | null
}

export interface Score {
  id: number
  authority_id: number
  data_year: number
  comparison_group: string
  score: number | null
  max_score: number | null
  group_size: number | null
  solo_group: boolean
}

export interface MayorPageData {
  authority: Authority
  mayor: Mayor
  years: AuthorityYearly[]
  latestYear: AuthorityYearly
  score: Score | null
}
