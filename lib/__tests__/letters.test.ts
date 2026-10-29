import { describe, it, expect } from 'vitest'
import { letterFor, bandCuts, heldReason, termSummary, metricBreakdown, termGrade, aStreak, metricSeries } from '../score'
import type { Score, ScoringAnchor, AuthorityYearly } from '@/types/db'

// The v2 config as frozen on 2026-10-29.
const METRIC_CUTS = [18.316080283548324, 55.94541910331383, 95.75438818832815]
const BAND_CUTS = [2.1666666666666665, 2.402777777777778, 2.6347222222222224]

describe('letterFor — the scorer\'s letter()', () => {
  it('inclusive at the lower edge of each letter', () => {
    expect(letterFor(95.76, METRIC_CUTS)).toBe('A')
    expect(letterFor(95.75, METRIC_CUTS)).toBe('B')
    expect(letterFor(55.95, METRIC_CUTS)).toBe('B')
    expect(letterFor(18.32, METRIC_CUTS)).toBe('C')
    expect(letterFor(18.31, METRIC_CUTS)).toBe('D')
    expect(letterFor(0, METRIC_CUTS)).toBe('D')
    expect(letterFor(100, METRIC_CUTS)).toBe('A')
  })
})

describe('bandCuts', () => {
  const cfg = { cut_d_c: 2.17, cut_c_b: 2.4, cut_b_a: 2.63 }
  it('prefers the exact cuts in rules over the rounded columns', () => {
    expect(bandCuts({ ...cfg, rules: { band_cuts: BAND_CUTS } })).toEqual(BAND_CUTS)
    // the rounding bug: 2.632 is a B on the frozen cut, an A on the rounded one
    expect(letterFor(2.632, bandCuts({ ...cfg, rules: { band_cuts: BAND_CUTS } }))).toBe('B')
    expect(letterFor(2.632, bandCuts({ ...cfg, rules: null }))).toBe('A')
  })
})

describe('heldReason', () => {
  it('names the consistency rule when A has no domain A', () => {
    expect(heldReason({ band: 'B', band_natural: 'A', domain_letters: { education: 'B', finance: 'B' } })).toBe('consistency')
    expect(heldReason({ band: 'C', band_natural: 'D', domain_letters: { education: 'C' } })).toBe('consistency')
  })
  it('otherwise the stability margin', () => {
    expect(heldReason({ band: 'A', band_natural: 'B', domain_letters: { education: 'A' } })).toBe('stability')
    expect(heldReason({ band: 'B', band_natural: 'A', domain_letters: { education: 'A' } })).toBe('stability')
  })
  it('null when the band is the natural one', () => {
    expect(heldReason({ band: 'A', band_natural: 'A', domain_letters: {} })).toBeNull()
  })
})

describe('termSummary on v2 points', () => {
  const row = (y: number, points: number | null) => ({ data_year: y, score: null, points } as unknown as Score)
  it('averages the year points when told to', () => {
    const t = termSummary([row(2019, 2.5), row(2020, 2.7), row(2021, null)], [2019, 2023], s => s.points)
    expect(t.years).toEqual([2019, 2020])
    expect(t.mean).toBeCloseTo(2.6)
    expect(t.delta).toBeCloseTo(0.2)
  })
  it('v1 callers still read the 0-100 score', () => {
    expect(termSummary([row(2019, 2.5)], [2019, 2023]).years).toEqual([])
  })
})

describe('metricBreakdown with metric cuts', () => {
  const anchors: ScoringAnchor[] = [
    { comparison_group: 'עירייה|5', field: 'זכאות_בגרות', data_year: null, low: 60, high: 80, n_observations: 100, direction: 'higher_better' },
  ]
  const row = { b_bagrut_pct: 79 } as unknown as AuthorityYearly
  it('gives each metric its letter from its 0-100 score', () => {
    const b = metricBreakdown(row, 'עירייה|5', anchors, { education: ['זכאות_בגרות'] }, METRIC_CUTS)
    expect(b.education[0].score).toBeCloseTo(95)
    expect(b.education[0].letter).toBe('B')
  })
  it('no cuts (v1): no letter', () => {
    expect(metricBreakdown(row, 'עירייה|5', anchors, { education: ['זכאות_בגרות'] }).education[0].letter).toBeNull()
  })
})

describe('termGrade — the term to date', () => {
  const cfg = { cut_d_c: 2.17, cut_c_b: 2.4, cut_b_a: 2.63, rules: { band_cuts: BAND_CUTS }, domain_cuts: [1.9555555555555557, 2.4444444444444446, 3.016666666666667] }
  const strong = { education: 3.5, finance: 3, environment: 2.5, growth: 2.5 }   // one domain A
  const flat = { education: 3, finance: 3, environment: 3, growth: 2 }           // no domain A
  it('year one: the grade is that year\'s letter, the rest of the term empty', () => {
    const g = termGrade([2024, 2028], [{ data_year: 2024, points: 2.9 }], { 2024: strong }, cfg)
    expect(g.years.map(y => y.letter)).toEqual(['A', null, null, null, null])
    expect(g.scored).toBe(1)
    expect(g.letter).toBe('A')
    expect(g.plus).toBe(false)          // a single year is not a streak
  })
  it('the mean of the scored years, and + for A in every one of them', () => {
    const sc = [{ data_year: 2019, points: 2.8 }, { data_year: 2020, points: 2.7 }, { data_year: 2021, points: 2.9 }]
    const g = termGrade([2019, 2023], sc, { 2019: strong, 2020: strong, 2021: strong }, cfg)
    expect(g.points).toBeCloseTo(2.8)
    expect(g.letter).toBe('A')
    expect(g.plus).toBe(true)
  })
  it('an A mean over B years: A, but no +', () => {
    const sc = [{ data_year: 2019, points: 3.0 }, { data_year: 2020, points: 2.5 }]
    const g = termGrade([2019, 2023], sc, { 2019: strong, 2020: strong }, cfg)
    expect(g.years.map(y => y.letter).slice(0, 2)).toEqual(['A', 'B'])
    expect(g.letter).toBe('A')
    expect(g.plus).toBe(false)
  })
  it('consistency: A on points with no domain A is a B, for the term and for the year', () => {
    const g = termGrade([2024, 2028], [{ data_year: 2024, points: 2.9 }], { 2024: flat }, cfg)
    expect(g.natural).toBe('A')
    expect(g.letter).toBe('B')
    expect(g.years[0].letter).toBe('B')
  })
  it('no scored year yet: no grade', () => {
    const g = termGrade([2025, 2029], [{ data_year: 2024, points: 2.9 }], {}, cfg)
    expect(g.scored).toBe(0)
    expect(g.letter).toBeNull()
  })
})

describe('aStreak — the "+" on the seal', () => {
  const y = (year: number, letter: 'A' | 'B' | null, head = 'ביבס') => ({ year, letter, head })
  it('counts A years back from the newest, under the same head', () => {
    expect(aStreak([y(2021, 'B'), y(2022, 'A'), y(2023, 'A'), y(2024, 'A')])).toBe(3)
  })
  it('a re-elected head carries the streak across terms; a new head does not', () => {
    expect(aStreak([y(2023, 'A'), y(2024, 'A')])).toBe(2)
    expect(aStreak([y(2023, 'A', 'קודם'), y(2024, 'A', 'חדש')])).toBe(1)
  })
  it('zero when the newest year is not A, and a gap year breaks it', () => {
    expect(aStreak([y(2023, 'A'), y(2024, 'B')])).toBe(0)
    expect(aStreak([y(2022, 'A'), y(2024, 'A')])).toBe(1)
    expect(aStreak([])).toBe(0)
  })
})

describe('metricSeries', () => {
  const anchors: ScoringAnchor[] = [
    { comparison_group: 'עירייה|5', field: 'זכאות_בגרות', data_year: null, low: 60, high: 80, n_observations: 100, direction: 'higher_better' },
    { comparison_group: 'עירייה|6', field: 'זכאות_בגרות', data_year: null, low: 70, high: 90, n_observations: 100, direction: 'higher_better' },
    { comparison_group: 'עירייה|6', field: 'נשירה', data_year: null, low: -1.0, high: -0.4, n_observations: 100, direction: 'lower_better' },
  ]
  const rows = [
    { data_year: 2023, b_bagrut_pct: 79, b_dropout_pct: 0.5 },
    { data_year: 2024, b_bagrut_pct: 79, b_dropout_pct: null },
  ] as unknown as AuthorityYearly[]
  const scores = [{ data_year: 2023, comparison_group: 'עירייה|5' }, { data_year: 2024, comparison_group: 'עירייה|6' }]
  it('scores each year against that year\'s group; the band is the newest group\'s', () => {
    const s = metricSeries('זכאות_בגרות', [2023, 2024], rows, scores, anchors, METRIC_CUTS)
    expect(s.points.map(p => p.letter)).toEqual(['B', 'C'])   // the same 79%: 95 in group 5, 45 in group 6
    expect(s.band).toEqual({ worse: 70, better: 90 })
    expect(s.higherBetter).toBe(true)
  })
  it('lower-is-better: the band back in the metric\'s units; a missing value has no letter', () => {
    const s = metricSeries('נשירה', [2023, 2024], rows, scores, anchors, METRIC_CUTS)
    expect(s.band).toEqual({ worse: 1.0, better: 0.4 })
    expect(s.points[1]).toEqual({ year: 2024, value: null, letter: null })
    expect(s.higherBetter).toBe(false)
  })
})
