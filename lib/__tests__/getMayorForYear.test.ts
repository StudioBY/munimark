import { describe, expect, it } from 'vitest'
import type { MayorTerm } from '@/types/db'
import {
  authorityTypePrefix,
  getMayorForYear,
  layerRepresentativeYear,
  layerYearRange,
  termAttributedYears,
  termCountLabel,
  termDisplayLabel,
  termSpanLabel,
  termSpanYears,
} from '@/lib/getMayorForYear'

// Israeli municipal elections are held in October, so a CBS data year belongs
// to the mayor who served THROUGH it: attribution starts the year AFTER the
// election. The source of truth is _shared/terms_years_muni_israel.csv (not in
// this repo). term_2013 was once written as 2013-2018 here and was caught only
// by a manual cross-check; these tests exist so that never needs luck again.

function term(term_label: string, is_current = false): MayorTerm {
  return {
    id: term_label,
    authority_symbol: 70,
    authority_type: 'עירייה',
    authority_slug: 'ashdod',
    mayor_id: 1,
    term_label,
    full_name: `mayor of ${term_label}`,
    election_pct: null,
    is_current,
    changed_from_previous: null,
    source: null,
    notes: null,
    created_at: '2026-01-01',
    mayors: null,
  }
}

const labelFor = (terms: MayorTerm[], year: number) => getMayorForYear(terms, year)?.term_label ?? null

describe('termAttributedYears — which data years are a term\'s', () => {
  it.each([
    ['term_2013', [2014, 2018]],
    ['term_2018', [2019, 2023]],
    ['term_2024_regular', [2024, 2028]],
    ['term_2023_special', [2023, 2025]],
    ['term_2024_nov', [2025, 2029]],
    ['term_2025_feb', [2025, 2029]],
  ])('%s is attributed the data years %j', (label, range) => {
    expect(termAttributedYears(label)).toEqual(range)
  })

  it('does not give 2013 data to term_2013: the October 2013 election left that year to the outgoing mayor', () => {
    expect(termAttributedYears('term_2013')[0]).toBe(2014)
  })

  it('falls back to a default for an unknown label instead of throwing', () => {
    for (const bad of ['term_1999', '', 'nonsense']) {
      expect(() => termAttributedYears(bad)).not.toThrow()
      expect(termAttributedYears(bad)).toEqual([2024, 2030])
    }
  })
})

describe('termSpanYears — years in office, which are NOT the data years', () => {
  it.each([
    ['term_2013', [2013, 2018]],
    ['term_2018', [2018, 2024]],
    ['term_2024_regular', [2024, null]],
  ])('%s is in office %j (null = still serving)', (label, span) => {
    expect(termSpanYears(label)).toEqual(span)
  })

  it('differs from termAttributedYears for term_2013 — "when did they serve" vs "whose numbers are these"', () => {
    expect(termSpanYears('term_2013')).toEqual([2013, 2018])
    expect(termAttributedYears('term_2013')).toEqual([2014, 2018])
    expect(termSpanYears('term_2013')[0]).not.toBe(termAttributedYears('term_2013')[0])
  })

  it('treats an unknown label as a running term rather than throwing', () => {
    expect(termSpanYears('')).toEqual([2024, null])
    expect(termSpanYears('nonsense')).toEqual([2024, null])
  })
})

describe('termSpanLabel', () => {
  it('shows a closed term as "from–to"', () => {
    expect(termSpanLabel('term_2013')).toBe('2013–2018')
  })

  it('shows a running term with an open end, not an invented end year', () => {
    expect(termSpanLabel('term_2024_regular')).toBe('2024–')
  })

  it('does not throw on an unknown or empty label', () => {
    expect(() => termSpanLabel('')).not.toThrow()
    expect(termSpanLabel('')).toBe('2024–')
  })
})

describe('termCountLabel — a lower bound must stay a lower bound', () => {
  // mayor_terms begins at term_2013. Someone already serving then may have
  // started long before (Ron Huldai has led Tel Aviv since 1998), so their
  // count is a minimum. Dropping "לפחות" would state a false fact about a
  // real person.
  it.each([
    [3, true, 'לפחות 3 קדנציות'],
    [3, false, '3 קדנציות'],
    [1, false, 'קדנציה אחת'],
    [1, true, 'לפחות קדנציה אחת'],
  ] as const)('(%i, minimum=%s) reads "%s"', (count, isMin, expected) => {
    expect(termCountLabel(count, isMin)).toBe(expected)
  })

  it('never says "1 קדנציות" — one term is singular', () => {
    expect(termCountLabel(1, false)).not.toContain('1')
  })

  it('never drops "לפחות" when the count is a minimum', () => {
    for (const n of [1, 2, 3, 4, 7]) expect(termCountLabel(n, true)).toMatch(/^לפחות /)
  })

  it('returns null — not "0 קדנציות" — when there is no count', () => {
    expect(termCountLabel(null, false)).toBeNull()
    expect(termCountLabel(null, true)).toBeNull()
    expect(termCountLabel(0, false)).toBeNull()
    expect(termCountLabel(0, true)).toBeNull()
  })
})

describe('getMayorForYear — which term a data year belongs to', () => {
  const regular = [term('term_2013'), term('term_2018'), term('term_2024_regular', true)]

  it('returns null when the authority has no terms', () => {
    expect(getMayorForYear([], 2020)).toBeNull()
  })

  it('gives 2014-2018 to term_2013 and 2019-2023 to term_2018', () => {
    for (let y = 2014; y <= 2018; y++) expect(labelFor(regular, y)).toBe('term_2013')
    for (let y = 2019; y <= 2023; y++) expect(labelFor(regular, y)).toBe('term_2018')
  })

  it('gives 2024 to the regular 2024 term', () => {
    expect(labelFor(regular, 2024)).toBe('term_2024_regular')
  })

  it('agrees with termAttributedYears for every data year 2014-2025 in a regular authority', () => {
    for (let y = 2014; y <= 2025; y++) {
      const label = labelFor(regular, y)!
      const [from, to] = termAttributedYears(label)
      expect(y, `year ${y} -> ${label}`).toBeGreaterThanOrEqual(from)
      expect(y, `year ${y} -> ${label}`).toBeLessThanOrEqual(to)
    }
  })

  it('keeps 2024 with term_2018 where the election was war-delayed, and gives 2025 to the delayed term', () => {
    for (const delayed of ['term_2024_nov', 'term_2025_feb']) {
      const terms = [term('term_2013'), term('term_2018'), term(delayed, true)]
      expect(labelFor(terms, 2024)).toBe('term_2018')
      expect(labelFor(terms, 2025)).toBe(delayed)
    }
  })

  it('lets term_2023_special take over from 2023', () => {
    const terms = [term('term_2013'), term('term_2018'), term('term_2023_special', true)]
    expect(labelFor(terms, 2022)).toBe('term_2018')
    expect(labelFor(terms, 2023)).toBe('term_2023_special')
    expect(labelFor(terms, 2024)).toBe('term_2023_special')
  })

  it('uses the current term from 2026 on', () => {
    const terms = [term('term_2013'), term('term_2018'), term('term_2024_regular'), term('term_2025_replacement', true)]
    expect(labelFor(terms, 2026)).toBe('term_2025_replacement')
  })

  it('returns null — not a guess — for a year no held term covers', () => {
    expect(labelFor(regular, 2012)).toBeNull()
    expect(labelFor([term('term_2018')], 2016)).toBeNull()
  })

  // KNOWN BUG — reported, not fixed here. By the rule above, 2013 data
  // belongs to the mayor elected in 2008, whom mayor_terms does not hold, so
  // the answer should be null. getMayorForYear returns term_2013 instead.
  // `it.fails` keeps the suite green while the bug stands; once it is fixed
  // this test starts failing and should become a plain `it`.
  it('does not give 2013 data to term_2013', () => {
    expect(labelFor(regular, 2013)).toBeNull()
  })
})

describe('layerYearRange / layerRepresentativeYear', () => {
  it.each([
    ['2013', [2014, 2018], 2015],
    ['2018', [2019, 2023], 2021],
    ['2024', [2024, 2028], 2024],
  ] as const)('layer %s covers %j and is represented by %i', (layer, range, rep) => {
    expect(layerYearRange(layer)).toEqual(range)
    expect(layerRepresentativeYear(layer)).toBe(rep)
  })

  it('represents each layer by a year inside its own range', () => {
    for (const layer of ['2013', '2018', '2024'] as const) {
      const [from, to] = layerYearRange(layer)
      expect(layerRepresentativeYear(layer)).toBeGreaterThanOrEqual(from)
      expect(layerRepresentativeYear(layer)).toBeLessThanOrEqual(to)
    }
  })

  it('matches termAttributedYears for the 2013 and 2018 layers', () => {
    expect(layerYearRange('2013')).toEqual(termAttributedYears('term_2013'))
    expect(layerYearRange('2018')).toEqual(termAttributedYears('term_2018'))
  })

  it('does not throw on a layer outside the type (returns undefined)', () => {
    const bad = 'x' as unknown as '2013'
    expect(() => layerYearRange(bad)).not.toThrow()
    expect(layerYearRange(bad)).toBeUndefined()
    expect(layerRepresentativeYear(bad)).toBeUndefined()
  })
})

describe('authorityTypePrefix', () => {
  it.each([
    ['עירייה', 'עיריית'],
    ['מועצה מקומית', 'מ. מקומית'],
    ['מועצה אזורית', 'מ. אזורית'],
  ])('%s -> %s', (type, prefix) => {
    expect(authorityTypePrefix(type)).toBe(prefix)
  })

  // KNOWN BUG — reported, not fixed here. Any type that is not עירייה or
  // מועצה מקומית, including null and '', is labelled a regional council.
  // A missing type is a missing fact, not a regional council.
  it('does not call an authority of unknown type a regional council', () => {
    expect(authorityTypePrefix(null)).not.toBe('מ. אזורית')
    expect(authorityTypePrefix('')).not.toBe('מ. אזורית')
  })
})

describe('termDisplayLabel', () => {
  it('names known terms in Hebrew', () => {
    expect(termDisplayLabel('term_2013')).toBe('קדנציית 2013')
    expect(termDisplayLabel('term_2025_feb')).toBe('קדנציית 2025 (פברואר)')
  })

  it('shows an unknown label as-is rather than inventing a name', () => {
    expect(termDisplayLabel('term_2031')).toBe('term_2031')
  })
})
