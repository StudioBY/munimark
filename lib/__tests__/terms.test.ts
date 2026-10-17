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
  it('sorts by start regardless of input order', () => {
    const ts = authorityTerms([t('term_2024_regular', 'C', true), t('term_2013', 'A'), t('term_2018', 'B')])
    expect(ts.map(x => x.name)).toEqual(['A', 'B', 'C'])
    expect(ts[0].window).toEqual([2014, 2018])
  })
})
