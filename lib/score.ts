import type { AuthorityYearly, Score, ScoringAnchor, ScoringConfig } from '@/types/db'

// Pure logic behind the score display. Everything here mirrors
// agents/scorer/scripts/compute_scores_2026-10-10.mjs — the page re-derives
// per-metric scores from the same frozen anchors so it can show WHY a domain
// scored what it did. It never recomputes a published number: the total, the
// domains and the band are read from `scores` as stored.

export type Band = 'A' | 'B' | 'C' | 'D'

export const DOMAIN_LABELS: Record<string, string> = {
  education: 'חינוך',
  finance: 'כספים',
  environment: 'סביבה',
  growth: 'צמיחה',
}
export const DOMAIN_ORDER = ['education', 'finance', 'environment', 'growth'] as const
type DomainKey = (typeof DOMAIN_ORDER)[number]

export function domainScore(s: Score, d: DomainKey): number | null {
  switch (d) {
    case 'education': return s.domain_education
    case 'finance': return s.domain_finance
    case 'environment': return s.domain_environment
    case 'growth': return s.domain_growth
  }
}

// Scorer field name → DB column, label and display format. Same map as the
// scorer's COLS, restricted to the fields v1 actually scores.
type Fmt = (v: number) => string
const pct1: Fmt = v => v.toFixed(1) + '%'
const pct2: Fmt = v => v.toFixed(2) + '%'
const dec1: Fmt = v => v.toFixed(1)
const int: Fmt = v => Math.round(v).toLocaleString('he-IL')
const sign: Fmt = v => (v > 0 ? '+' : '') + Math.round(v).toLocaleString('he-IL')
const kg: Fmt = v => v.toFixed(2) + ' ק"ג'

export const METRICS: Record<string, { col: keyof AuthorityYearly; label: string; fmt: Fmt }> = {
  'זכאות_בגרות':          { col: 'b_bagrut_pct',              label: 'זכאות לבגרות',          fmt: pct1 },
  'בגרות_סף_אוניברסיטאי': { col: 'b_bagrut_uni_pct',          label: 'בגרות ברמת סף אוני׳',   fmt: pct1 },
  'נשירה':                { col: 'b_dropout_pct',             label: 'נשירת תלמידים',         fmt: pct2 },
  'תלמידים_לכיתה':        { col: 'b_students_per_class',      label: 'תלמידים לכיתה',         fmt: dec1 },
  'גביית_ארנונה_אחוז':    { col: 'b_arnona_collection_pct',   label: 'גביית ארנונה',          fmt: pct1 },
  'ביצוע_תקציב_אחוז':     { col: 'b_budget_execution_pct',    label: 'ביצוע תקציב',           fmt: pct1 },
  'הכנסות_עצמיות_אחוז':   { col: 'b_own_revenue_pct',         label: 'הכנסות עצמיות',         fmt: pct1 },
  'עודף_גירעון':          { col: 'b_surplus_deficit',         label: 'עודף / גירעון',         fmt: sign },
  'יחס_עומס_מלוות':       { col: 'd_loan_burden_ratio',       label: 'עומס מלוות',            fmt: dec1 },
  'אחוז_פחת_מים':         { col: 'b_water_loss_pct',          label: 'פחת מים',               fmt: pct1 },
  'אחוז_מחזור_פסולת':     { col: 'b_recycling_pct',           label: 'מחזור פסולת',           fmt: pct1 },
  'פסולת_לנפש':           { col: 'b_waste_per_capita',        label: 'פסולת לנפש',            fmt: kg },
  'התחלות_בנייה':         { col: 'b_construction_starts',     label: 'התחלות בנייה',          fmt: int },
  'גמר_בנייה':            { col: 'b_construction_completions', label: 'גמר בנייה',            fmt: int },
  'גידול_אוכלוסייה_אחוז': { col: 'b_population_growth_pct',   label: 'גידול אוכלוסייה',       fmt: pct1 },
  'מאזן_הגירה':           { col: 'b_migration_balance',       label: 'מאזן הגירה',            fmt: sign },
}

// Published with the index. Used when scoring_config.scope_note is empty, so
// the page never shows a score without saying what it leaves out.
export const DEFAULT_SCOPE_NOTE =
  'המדד מכסה ארבעה תחומים: חינוך, ניהול כספי, סביבה וצמיחה. הוא אינו מודד תוצאות רווחה, איכות שירות לתושב, שקיפות, ביטחון, תרבות ותחבורה, משום שאין עליהם נתון ארצי אחיד. הציון אינו דירוג כולל של ראש הרשות.'

/** "עירייה|5" → { type: 'עירייה', cluster: 5 } */
export function parseGroup(g: string): { type: string; cluster: number | null } {
  const [type, c] = g.split('|')
  const n = Number(c)
  return { type, cluster: Number.isFinite(n) ? n : null }
}

/** The band a 0-100 score falls in by the frozen cut points, with no hysteresis. */
export function bandFor(score: number, cfg: Pick<ScoringConfig, 'cut_d_c' | 'cut_c_b' | 'cut_b_a'>): Band {
  if (score >= Number(cfg.cut_b_a)) return 'A'
  if (score >= Number(cfg.cut_c_b)) return 'B'
  if (score >= Number(cfg.cut_d_c)) return 'C'
  return 'D'
}

/** Same formula as the scorer's metricScore: clamp((better(v) - p10) / (p90 - p10)) × 100. */
export function metricScore(v: number | null | undefined, a: Pick<ScoringAnchor, 'low' | 'high' | 'direction'> | undefined): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v) || !a) return null
  if (a.high === a.low) return 50
  const b = a.direction === 'close_to_100' ? -Math.abs(v - 100) : a.direction === 'lower_better' ? -v : v
  return Math.max(0, Math.min(100, ((b - a.low) / (a.high - a.low)) * 100))
}

/**
 * The peer range in the metric's own units, worse end first. Anchors are stored
 * in the better-is-higher sense, so a lower-is-better metric is negated back.
 * For close-to-100 the anchors are distances from 100, which is what we return.
 */
export function peerRange(a: Pick<ScoringAnchor, 'low' | 'high' | 'direction'>): { worse: number; better: number; isDistance: boolean } {
  if (a.direction === 'higher_better') return { worse: a.low, better: a.high, isDistance: false }
  if (a.direction === 'lower_better') return { worse: -a.low, better: -a.high, isDistance: false }
  return { worse: -a.low, better: -a.high, isDistance: true }
}

export interface MetricLine {
  field: string
  label: string
  value: number | null
  valueText: string
  score: number | null
  peerText: string | null
}

/** Per-metric breakdown of one authority-year, grouped by domain. */
export function metricBreakdown(
  row: AuthorityYearly | undefined,
  group: string,
  anchors: ScoringAnchor[],
  domains: Record<string, string[]>,
): Record<string, MetricLine[]> {
  const out: Record<string, MetricLine[]> = {}
  for (const d of DOMAIN_ORDER) {
    out[d] = (domains[d] ?? []).map(field => {
      const m = METRICS[field]
      const raw = row && m ? (row[m.col] as number | null) : null
      // v1 has no monetary fields, so every anchor is year-less (data_year NULL).
      const a = anchors.find(x => x.comparison_group === group && x.field === field && x.data_year == null)
      const r = a ? peerRange(a) : null
      const peerText = !a || !m || !r
        ? null
        : r.isDistance
          ? `סטייה מ־100%: ${r.better.toFixed(1)}–${r.worse.toFixed(1)} נק׳`
          : `בקבוצה: חלש ${m.fmt(r.worse)} · חזק ${m.fmt(r.better)}`
      return {
        field,
        label: m?.label ?? field,
        value: raw,
        valueText: raw != null && m ? m.fmt(raw) : '—',
        score: metricScore(raw, a),
        peerText,
      }
    })
  }
  return out
}

export interface TermSummary {
  years: number[]          // data years in the window that have a score
  mean: number | null      // mean single-year score over those years
  first: Score | null
  last: Score | null
  delta: number | null     // last.score − first.score
}

/** The scored record of one term window, from the single-year scores. */
export function termSummary(scores: Score[], [from, to]: [number, number]): TermSummary {
  const inWin = scores
    .filter(s => s.data_year >= from && s.data_year <= to && s.score != null)
    .sort((a, b) => a.data_year - b.data_year)
  if (!inWin.length) return { years: [], mean: null, first: null, last: null, delta: null }
  const vals = inWin.map(s => Number(s.score))
  const first = inWin[0], last = inWin[inWin.length - 1]
  return {
    years: inWin.map(s => s.data_year),
    mean: vals.reduce((a, b) => a + b, 0) / vals.length,
    first,
    last,
    delta: inWin.length > 1 ? Number(last.score) - Number(first.score) : null,
  }
}

/** Strongest and weakest scored metric of a breakdown — the two things a briefing leads with. */
export function extremes(b: Record<string, MetricLine[]>): { best: MetricLine | null; worst: MetricLine | null } {
  const all = Object.values(b).flat().filter(m => m.score != null)
  if (!all.length) return { best: null, worst: null }
  const sorted = [...all].sort((a, b) => b.score! - a.score!)
  return { best: sorted[0], worst: sorted[sorted.length - 1] }
}
