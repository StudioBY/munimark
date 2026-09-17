export interface Authority {
  id: number
  symbol: number
  name_display: string
  name_cbs: string
  slug: string
  entity_id_obudget: string | null
  authority_type: string | null
  is_published: boolean
  // migration 007 — the authority did not exist before this year, so earlier
  // rows are legitimately empty and must not be charted as zero coverage.
  established_year: number | null
  established_note: string | null
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
  wikipedia_url: string | null
  slug: string | null
  // added by migration 006 (person model)
  is_current: boolean
  term_label: string | null
  // migration 010 — a derived tenure that states its own limits
  tenure_is_minimum: boolean | null
  tenure_source: string | null
  source: string | null
  enrichment_status: 'name_only' | 'partial' | 'complete' | null
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
  // H (munidata)
  h_nafa: string | null
  h_profile_group: string | null
  h_confrontation_line: string | null
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
  // D (CBS)
  d_accidents_per_1000: number | null
  d_sewage_treated_pct: number | null
  d_water_violations: number | null
  // D (munidata — demographics)
  d_natural_increase: number | null
  d_avg_wage: number | null
  // D (munidata — budget & economy)
  d_arnona_charge_per_sqm: number | null
  d_arnona_other_share: number | null
  d_debt_per_household: number | null
  d_debt_repayment_rate: number | null
  d_net_accum_deficit: number | null
  d_loan_burden_ratio: number | null
  d_debt_concentration: number | null
  d_municipal_corporations: number | null
  d_audit_deficiencies: number | null
  d_total_income: number | null
  d_dev_funds_balance: number | null
  d_extraordinary_income: number | null
  d_extraordinary_expenses: number | null
  d_dev_project_funds: number | null
  // D (munidata — gov mechanisms)
  d_govt_tenders: number | null
  d_equalization_grants: number | null
  d_dev_grants: number | null
  d_gap_reduction_fund: number | null
  d_regional_services: number | null
  // D (munidata — human capital)
  d_cadets: number | null
  d_ceo_seniority: number | null
  d_statutory_roles_pct: number | null
  d_org_dev_plans: number | null
  // ── migration 008 (munidata v2) ──
  // Interior Ministry measures kept DELIBERATELY separate from their CBS
  // equivalents. population/migration/housing starts have CBS counterparts
  // above; merging them would destroy the cross-check that caught the
  // thousands trap. 2,300 overlapping years agree to a median 0.0000%.
  d_population_moi: number | null          // 2002-2025
  d_migration_moi: number | null           // 2014-2024
  d_housing_starts_moi: number | null      // 2002-2024 (units, not area)
  d_self_income_share_moi: number | null
  d_arnona_collection_moi: number | null
  d_current_deficit_moi: number | null
  d_edu_subsidy_moi: number | null
  d_welfare_subsidy_moi: number | null
  d_deficit_auth_share_moi: number | null
  d_unbudgeted_funds: number | null        // 2020-2024
  d_hr_manager_gap: number | null          // 2025
}

export interface MayorTerm {
  id: string
  authority_symbol: number
  authority_type: string
  authority_slug: string
  mayor_id: number | null
  term_label: string
  full_name: string
  election_pct: string | null
  is_current: boolean
  changed_from_previous: boolean | null
  source: string | null
  notes: string | null
  created_at: string
  mayors: {
    name: string | null
    photo_url: string | null
    background: string | null
    wikipedia_url: string | null
    slug: string | null
  } | null
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
