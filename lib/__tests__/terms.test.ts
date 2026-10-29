import { describe, it, expect } from 'vitest'
import { authorityTerms, termForYear } from '../terms'
import type { MayorTerm } from '@/types/db'

const t = (term_label: string, full_name: string, is_current = false): MayorTerm => ({
  id: term_label, authority_symbol: 1, authority_type: 'עירייה', authority_slug: 'x', mayor_id: null,
  term_label, full_name, election_pct: null, is_current, changed_from_previous: null, source: null,
  notes: null, created_at: '', mayors: null,
})

// The three cases of TASK_TERM_WINDOW.md
describe('authorityTerms — a term ends where the next one in the same authority begins', () => {
  it('regular: term_2018 → 2019–2023', () => {
    const ts = authorityTerms([t('term_2024_regular', 'B', true), t('term_2018', 'A')])
    expect(ts.map(x => x.window)).toEqual([[2019, 2023], [2024, 2028]])
  })
  it('postponed to February 2025: term_2018 keeps 2024', () => {
    const ts = authorityTerms([t('term_2018', 'A'), t('term_2025_feb', 'B', true)])
    expect(ts[0].window).toEqual([2019, 2024])
  })
  it('November 2024: attribution of the next term starts 2025, so 2024 stays with term_2018', () => {
    const ts = authorityTerms([t('term_2018', 'A'), t('term_2024_nov', 'B', true)])
    expect(ts[0].window).toEqual([2019, 2024])
    expect(termForYear(ts, 2024)?.name).toBe('A')
  })
  it('a special 2023 election cuts the earlier term short', () => {
    const ts = authorityTerms([t('term_2018', 'A'), t('term_2023_special', 'B', true)])
    expect(ts[0].window).toEqual([2019, 2022])
    expect(termForYear(ts, 2023)?.name).toBe('B')
  })
  it('Nahal Sorek: a special 2021 election takes 2022–2023, then the regular 2024 term', () => {
    const ts = authorityTerms([t('term_2018', 'A'), t('term_2021_special', 'B'), t('term_2024_regular', 'B', true)])
    expect(ts.map(x => [x.name, x.window])).toEqual([['A', [2019, 2021]], ['B', [2022, 2023]], ['B', [2024, 2028]]])
  })
  it('sorts by start regardless of input order', () => {
    const ts = authorityTerms([t('term_2024_regular', 'C', true), t('term_2013', 'A'), t('term_2018', 'B')])
    expect(ts.map(x => x.name)).toEqual(['A', 'B', 'C'])
    expect(ts[0].window).toEqual([2014, 2018])
  })
})

describe('authorityTerms — a head who left mid-term (migration 015)', () => {
  const left = (x: MayorTerm, d: string): MayorTerm => ({ ...x, left_office: d, left_office_source: 'test' })
  it('Nahal Sorek: left in August 2021 keeps 2021, and the special election leaves no interim', () => {
    const ts = authorityTerms([left(t('term_2018', 'אסקוזידו'), '2021-08-01'), t('term_2021_special', 'רייכנר'), t('term_2024_regular', 'רייכנר', true)])
    expect(ts.map(x => [x.name, x.window])).toEqual([['אסקוזידו', [2019, 2021]], ['רייכנר', [2022, 2023]], ['רייכנר', [2024, 2028]]])
  })
  it('Ramla: resigned April 2017, successor elected June 2017 — 2016 his, 2017 the successor\'s', () => {
    const ts = authorityTerms([left(t('term_2013', 'לביא'), '2017-04-18'), t('term_2017_special_h1', 'וידל'), t('term_2018', 'וידל', true)])
    expect(ts.map(x => [x.name, x.window])).toEqual([['לביא', [2014, 2016]], ['וידל', [2017, 2018]], ['וידל', [2019, 2023]]])
  })
  it('Tel Mond: removed September 2016, appointed committee, special election December 2020', () => {
    const ts = authorityTerms([left(t('term_2013', 'גולן'), '2016-09-06'), t('term_2018', 'ועדה'), t('term_2020_special', 'קפלן'), t('term_2024_regular', 'קפלן', true)])
    expect(ts.map(x => [x.name, x.window])).toEqual([['גולן', [2014, 2016]], ['ממלא/ת מקום', [2017, 2018]], ['ועדה', [2019, 2020]], ['קפלן', [2021, 2023]], ['קפלן', [2024, 2028]]])
  })
  it('Shaar HaNegev: killed 7.10.2023, election postponed to November 2024 — 2023 is his, 2024 an interim', () => {
    const ts = authorityTerms([left(t('term_2018', 'ליבשטין'), '2023-10-07'), t('term_2024_nov', 'אפשטיין', true)])
    expect(ts.map(x => [x.name, x.window])).toEqual([['ליבשטין', [2019, 2023]], ['ממלא/ת מקום', [2024, 2024]], ['אפשטיין', [2025, 2029]]])
    expect(termForYear(ts, 2024)?.interim).toBe(true)
    expect(termForYear(ts, 2024)?.personSlug).toBeNull()
  })
  it('left in the first half of a year: that year is already the interim\'s', () => {
    const ts = authorityTerms([left(t('term_2018', 'A'), '2022-03-01'), t('term_2024_regular', 'B', true)])
    expect(ts.map(x => x.window)).toEqual([[2019, 2021], [2022, 2023], [2024, 2028]])
  })
  it('left in the last year of the term: nothing changes', () => {
    const ts = authorityTerms([left(t('term_2018', 'A'), '2023-11-01'), t('term_2024_regular', 'B', true)])
    expect(ts.map(x => x.window)).toEqual([[2019, 2023], [2024, 2028]])
  })
})
