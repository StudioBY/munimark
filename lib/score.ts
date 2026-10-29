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
  letter: Band | null      // v2: the metric's letter against its peer group
  peerText: string | null
}

/** Per-metric breakdown of one authority-year, grouped by domain. */
export function metricBreakdown(
  row: AuthorityYearly | undefined,
  group: string,
  anchors: ScoringAnchor[],
  domains: Record<string, string[]>,
  metricCuts?: number[] | null,
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
      const score = metricScore(raw, a)
      return {
        field,
        label: m?.label ?? field,
        value: raw,
        valueText: raw != null && m ? m.fmt(raw) : '—',
        score,
        letter: score != null && metricCuts ? letterFor(score, metricCuts) : null,
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

/**
 * The scored record of one term window, from the single-year values: the
 * 0-100 score in v1, or pass `yearValue` (v2: the year's points, 1-4).
 */
export function termSummary(
  scores: Score[],
  [from, to]: [number, number],
  yearValue: (s: Score) => number | null | undefined = s => s.score,
): TermSummary {
  const inWin = scores
    .filter(s => s.data_year >= from && s.data_year <= to && yearValue(s) != null)
    .sort((a, b) => a.data_year - b.data_year)
  if (!inWin.length) return { years: [], mean: null, first: null, last: null, delta: null }
  const vals = inWin.map(s => Number(yearValue(s)))
  const first = inWin[0], last = inWin[inWin.length - 1]
  return {
    years: inWin.map(s => s.data_year),
    mean: vals.reduce((a, b) => a + b, 0) / vals.length,
    first,
    last,
    delta: inWin.length > 1 ? vals[vals.length - 1] - vals[0] : null,
  }
}

/** Strongest and weakest scored metric of a breakdown — the two things a briefing leads with. */
export function extremes(b: Record<string, MetricLine[]>): { best: MetricLine | null; worst: MetricLine | null } {
  const all = Object.values(b).flat().filter(m => m.score != null)
  if (!all.length) return { best: null, worst: null }
  const sorted = [...all].sort((a, b) => b.score! - a.score!)
  return { best: sorted[0], worst: sorted[sorted.length - 1] }
}

// ── v2: letter grades ─────────────────────────────────────────────────────
// Mirrors agents/scorer/scripts/compute_scores_v2_2026-10-28.mjs. A metric's
// letter comes from its 0-100 score and the frozen metric cuts; the domain
// letters and the band are read from `scores` as stored, never recomputed.

export const LETTER_POINTS: Record<Band, number> = { A: 4, B: 3, C: 2, D: 1 }

/** The letter a value earns against [C, B, A] cut points — the scorer's `letter`. */
export function letterFor(v: number, cuts: number[]): Band {
  return v >= cuts[2] ? 'A' : v >= cuts[1] ? 'B' : v >= cuts[0] ? 'C' : 'D'
}

/**
 * The band cut points on the 1-4 points scale, exact. cut_* are NUMERIC(_,2)
 * and round 2.6347 to 2.63, which would move an authority across the line.
 */
export function bandCuts(cfg: Pick<ScoringConfig, 'cut_d_c' | 'cut_c_b' | 'cut_b_a' | 'rules'>): number[] {
  return cfg.rules?.band_cuts ?? [Number(cfg.cut_d_c), Number(cfg.cut_c_b), Number(cfg.cut_b_a)]
}

/** Why the published band differs from what the three-year mean alone gives. */
export function heldReason(s: Pick<Score, 'band' | 'band_natural' | 'domain_letters'>): 'consistency' | 'stability' | null {
  if (!s.band || !s.band_natural || s.band === s.band_natural) return null
  const ls = Object.values(s.domain_letters ?? {})
  if ((s.band_natural === 'A' && !ls.includes('A')) || (s.band_natural === 'D' && !ls.includes('D'))) return 'consistency'
  return 'stability'
}

// ── v2: the term to date (decided 2026-10-29) ─────────────────────────────
// The grade is the mean of the term's yearly points so far: the first year's
// letter in year one, one letter for the whole term at its end. Each year keeps
// its own letter beside it, and A in every year of the term (two at least)
// earns a "+". The consistency rule holds at both levels: A needs a domain A,
// D a domain D. The yearly points and every cut are v2's, frozen.

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

/** A domain's points in one year: the mean of its metric letters (A=4 … D=1). */
export function domainYearPoints(b: Record<string, MetricLine[]>): Record<string, number | null> {
  return Object.fromEntries(Object.entries(b).map(([d, ls]) =>
    [d, mean(ls.filter(l => l.letter).map(l => LETTER_POINTS[l.letter!]))]))
}

/** A from points with no domain A is a B; D with no domain D is a C. */
export function consistentLetter(natural: Band, domainLetters: (Band | null)[]): Band {
  if (natural === 'A' && !domainLetters.includes('A')) return 'B'
  if (natural === 'D' && !domainLetters.includes('D')) return 'C'
  return natural
}

export interface GradeYear { year: number; points: number | null; letter: Band | null }

export interface TermGrade {
  years: GradeYear[]       // every year of the window, scored or not
  scored: number
  points: number | null    // mean of the scored years' points
  natural: Band | null     // the letter of that mean alone
  letter: Band | null      // after the consistency rule
  plus: boolean
  domains: Record<string, { points: number | null; letter: Band | null }>
}

/**
 * The grade of one term window from its yearly points and yearly domain
 * points. `domainPoints` maps a year to that year's domain points, as
 * domainYearPoints gives them.
 */
export function termGrade(
  window: [number, number],
  scores: Pick<Score, 'data_year' | 'points'>[],
  domainPoints: Record<number, Record<string, number | null>>,
  cfg: Pick<ScoringConfig, 'cut_d_c' | 'cut_c_b' | 'cut_b_a' | 'rules' | 'domain_cuts'>,
): TermGrade {
  const cuts = bandCuts(cfg)
  const dCuts = cfg.domain_cuts ?? cuts
  const domLetters = (dp: Record<string, number | null> | undefined) =>
    Object.values(dp ?? {}).map(p => (p == null ? null : letterFor(p, dCuts)))
  const years: GradeYear[] = []
  for (let y = window[0]; y <= window[1]; y++) {
    const p = scores.find(s => s.data_year === y)?.points
    const points = p == null ? null : Number(p)
    years.push({ year: y, points, letter: points == null ? null : consistentLetter(letterFor(points, cuts), domLetters(domainPoints[y])) })
  }
  const scoredYears = years.filter(y => y.points != null)
  const points = mean(scoredYears.map(y => y.points!))
  const domainKeys = [...new Set(scoredYears.flatMap(y => Object.keys(domainPoints[y.year] ?? {})))]
  const domains = Object.fromEntries(domainKeys.map(d => {
    const p = mean(scoredYears.map(y => domainPoints[y.year]?.[d]).filter((v): v is number => v != null))
    return [d, { points: p, letter: p == null ? null : letterFor(p, dCuts) }]
  }))
  const natural = points == null ? null : letterFor(points, cuts)
  const letter = natural && consistentLetter(natural, Object.values(domains).map(d => d.letter))
  return {
    years,
    scored: scoredYears.length,
    points,
    natural,
    letter,
    plus: letter === 'A' && scoredYears.length >= 2 && scoredYears.every(y => y.letter === 'A'),
    domains,
  }
}

/**
 * Consecutive A years ending at the newest year, under one head. The seal
 * shows the newest year's letter (decided 2026-10-29), with a "+" from two:
 * a re-elected head carries the streak on, a new head starts from zero.
 */
export function aStreak(years: { year: number; letter: Band | null; head: string | null }[]): number {
  const ys = [...years].sort((a, b) => a.year - b.year)
  const last = ys[ys.length - 1]
  if (!last || last.letter !== 'A') return 0
  let n = 0
  for (let i = ys.length - 1; i >= 0; i--) {
    const y = ys[i]
    if (y.letter !== 'A' || y.head !== last.head || (i < ys.length - 1 && ys[i + 1].year !== y.year + 1)) break
    n++
  }
  return n
}

// ── per-metric trend: the real value each year, its letter, the peer range ──

export interface MetricSeries {
  field: string
  label: string
  fmt: (v: number) => string
  points: { year: number; value: number | null; letter: Band | null }[]
  // p10–p90 of the comparison group in the metric's own units, for the newest
  // year's group. Null for close-to-100 metrics, whose anchors are distances.
  band: { worse: number; better: number } | null
  higherBetter: boolean | null
}

/**
 * One scored metric over a run of years. Each year's letter is scored against
 * THAT year's comparison group (a cluster can change within a term); the band
 * drawn behind the line is the newest year's group.
 */
export function metricSeries(
  field: string,
  years: number[],
  rows: AuthorityYearly[],
  scores: Pick<Score, 'data_year' | 'comparison_group'>[],
  anchors: ScoringAnchor[],
  metricCuts: number[] | null | undefined,
): MetricSeries {
  const m = METRICS[field]
  const anchorFor = (g: string | undefined) => anchors.find(a => a.comparison_group === g && a.field === field && a.data_year == null)
  const points = years.map(year => {
    const raw = m ? (rows.find(r => r.data_year === year)?.[m.col] as number | null | undefined) : null
    const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : null
    const sc = metricScore(value, anchorFor(scores.find(s => s.data_year === year)?.comparison_group))
    return { year, value, letter: sc != null && metricCuts ? letterFor(sc, metricCuts) : null }
  })
  const newestGroup = [...scores].filter(s => years.includes(s.data_year)).sort((a, b) => a.data_year - b.data_year).pop()?.comparison_group
  const a = anchorFor(newestGroup)
  const r = a ? peerRange(a) : null
  return {
    field,
    label: m?.label ?? field,
    fmt: m?.fmt ?? (v => String(v)),
    points,
    band: r && !r.isDistance ? { worse: r.worse, better: r.better } : null,
    higherBetter: a ? (a.direction === 'higher_better' ? true : a.direction === 'lower_better' ? false : null) : null,
  }
}
