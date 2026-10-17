import { describe, it, expect } from 'vitest'
import { bandFor, metricScore, peerRange, termSummary, parseGroup, metricBreakdown, extremes } from '../score'
import type { Score, ScoringAnchor, AuthorityYearly } from '@/types/db'

const cfg = { cut_d_c: 43.3, cut_c_b: 52.22, cut_b_a: 61.18 }

describe('bandFor', () => {
  it('uses the frozen cut points, inclusive at the lower edge of each band', () => {
    expect(bandFor(61.18, cfg)).toBe('A')
    expect(bandFor(61.17, cfg)).toBe('B')
    expect(bandFor(52.22, cfg)).toBe('B')
    expect(bandFor(43.3, cfg)).toBe('C')
    expect(bandFor(43.29, cfg)).toBe('D')
  })
})

describe('metricScore — must match the scorer exactly', () => {
  it('higher is better: p10 → 0, p90 → 100, clamped outside', () => {
    const a = { low: 80, high: 90, direction: 'higher_better' as const }
    expect(metricScore(80, a)).toBe(0)
    expect(metricScore(90, a)).toBe(100)
    expect(metricScore(85, a)).toBe(50)
    expect(metricScore(70, a)).toBe(0)
    expect(metricScore(99, a)).toBe(100)
  })
  it('lower is better: anchors are stored negated', () => {
    // dropout p10/p90 of (-v): worst -1.0, best -0.4
    const a = { low: -1.0, high: -0.4, direction: 'lower_better' as const }
    expect(metricScore(1.0, a)).toBeCloseTo(0)
    expect(metricScore(0.4, a)).toBeCloseTo(100)
    expect(metricScore(0.7, a)).toBeCloseTo(50)
  })
  it('close to 100: distance either side scores the same', () => {
    const a = { low: -4, high: 0, direction: 'close_to_100' as const }
    expect(metricScore(102, a)).toBeCloseTo(50)
    expect(metricScore(98, a)).toBeCloseTo(50)
    expect(metricScore(100, a)).toBe(100)
  })
  it('missing value or anchor is null, never zero', () => {
    const a = { low: 0, high: 1, direction: 'higher_better' as const }
    expect(metricScore(null, a)).toBeNull()
    expect(metricScore(5, undefined)).toBeNull()
  })
  it('a degenerate anchor scores 50, as the scorer does', () => {
    expect(metricScore(3, { low: 2, high: 2, direction: 'higher_better' })).toBe(50)
  })
})

describe('peerRange', () => {
  it('returns raw units, worse end first', () => {
    expect(peerRange({ low: -1, high: -0.4, direction: 'lower_better' })).toEqual({ worse: 1, better: 0.4, isDistance: false })
    expect(peerRange({ low: 80, high: 90, direction: 'higher_better' })).toEqual({ worse: 80, better: 90, isDistance: false })
  })
})

const s = (year: number, score: number): Score => ({
  id: year, authority_id: 1, data_year: year, score, band: 'B', band_natural: 'B', score_3yr: score,
  years_in_mean: 3, comparison_group: 'עירייה|5', group_size: 16, domain_education: 50, domain_finance: 50,
  domain_welfare: null, domain_environment: 50, domain_growth: 50, metrics_used: 16, metrics_possible: 16,
  methodology_version: 'v1',
})

describe('termSummary', () => {
  const all = [s(2018, 35), s(2019, 57.8), s(2021, 66.3), s(2023, 78.1), s(2024, 72.4)]
  it('uses only the years inside the window', () => {
    const t = termSummary(all, [2019, 2023])
    expect(t.years).toEqual([2019, 2021, 2023])
    expect(t.mean).toBeCloseTo((57.8 + 66.3 + 78.1) / 3)
    expect(t.delta).toBeCloseTo(78.1 - 57.8)
  })
  it('one scored year has no delta — a change needs two points', () => {
    const t = termSummary(all, [2024, 2028])
    expect(t.years).toEqual([2024])
    expect(t.delta).toBeNull()
  })
  it('an unscored window is empty, not zero', () => {
    expect(termSummary(all, [2010, 2014]).mean).toBeNull()
  })
})

describe('parseGroup', () => {
  it('splits type and cluster', () => {
    expect(parseGroup('מועצה אזורית|7')).toEqual({ type: 'מועצה אזורית', cluster: 7 })
  })
})

describe('metricBreakdown', () => {
  const anchors: ScoringAnchor[] = [
    { comparison_group: 'g', field: 'זכאות_בגרות', data_year: null, low: 80, high: 90, n_observations: 50, direction: 'higher_better' },
    { comparison_group: 'other', field: 'נשירה', data_year: null, low: -1, high: 0, n_observations: 50, direction: 'lower_better' },
  ]
  const row = { b_bagrut_pct: 85, b_dropout_pct: 0.5 } as unknown as AuthorityYearly
  const b = metricBreakdown(row, 'g', anchors, { education: ['זכאות_בגרות', 'נשירה'] })
  it('scores a metric against its own group only', () => {
    expect(b.education[0].score).toBe(50)
    // the dropout anchor belongs to another group: not scored, not borrowed
    expect(b.education[1].score).toBeNull()
  })
  it('extremes ignore unscored metrics', () => {
    const e = extremes(b)
    expect(e.best?.field).toBe('זכאות_בגרות')
    expect(e.worst?.field).toBe('זכאות_בגרות')
  })
})
