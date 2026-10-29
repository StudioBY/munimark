import { describe, it, expect } from 'vitest'
import { headRecord, scoredWindow } from '../head'
import type { HeadAuthorityInput } from '../head'
import type { AuthorityTerm } from '../terms'

// The v2 config as frozen on 2026-10-29.
const BAND_CUTS = [2.1666666666666665, 2.402777777777778, 2.6347222222222224]
const cfg = { cut_d_c: 2.17, cut_c_b: 2.4, cut_b_a: 2.63, rules: { band_cuts: BAND_CUTS }, domain_cuts: [1.956, 2.444, 3.017] }

const term = (label: string, window: [number, number], personSlug: string | null, extra: Partial<AuthorityTerm> = {}): AuthorityTerm =>
  ({ label, spanLabel: '', name: personSlug ?? 'ממלא/ת מקום', photo: null, personSlug, isCurrent: false, window, ...extra })

// points: 3.0 is an A on the band cuts, 2.5 a B. Every year has a domain A,
// so the consistency rule never holds an A back here.
const auth = (slug: string, terms: AuthorityTerm[], pts: Record<number, number>): HeadAuthorityInput => ({
  slug,
  terms,
  scores: Object.entries(pts).map(([y, p]) => ({ data_year: Number(y), points: p })),
  domainPoints: Object.fromEntries(Object.keys(pts).map(y => [Number(y), { education: 3.5, finance: 2.5 }])),
  cfg,
})

describe('scoredWindow', () => {
  const scores = [2016, 2017, 2018, 2024].map(y => ({ data_year: y, points: 3 }))
  it('clips a term to the years that have a score', () => {
    expect(scoredWindow([2014, 2018], scores)).toEqual([2016, 2018])
    expect(scoredWindow([2024, 2028], scores)).toEqual([2024, 2024])
  })
  it('null for a term with no scored year yet', () => {
    expect(scoredWindow([2025, 2029], scores)).toBeNull()
    expect(scoredWindow([2019, 2023], [])).toBeNull()
  })
})

describe('headRecord', () => {
  it('takes only the head\'s own terms, and the seal is their newest year', () => {
    const a = auth('modiin', [
      term('term_2013', [2014, 2018], 'other'),
      term('term_2018', [2019, 2023], 'me'),
      term('term_2024', [2024, 2028], 'me', { isCurrent: true }),
    ], { 2017: 2.5, 2018: 2.5, 2019: 2.5, 2020: 3, 2021: 3, 2022: 3, 2023: 3, 2024: 3 })
    const r = headRecord('me', [a])
    expect(r.stints.map(s => s.term.label)).toEqual(['term_2018', 'term_2024'])
    expect(r.years.map(y => y.year)).toEqual([2019, 2020, 2021, 2022, 2023, 2024])
    expect(r.newest?.year).toBe(2024)
    expect(r.newest?.letter).toBe('A')
    // a re-elected head carries the streak across terms
    expect(r.streak).toBe(5)
    expect(r.stints[1].window).toEqual([2024, 2024])
  })

  it('the predecessor is whoever held the authority before, with their grade', () => {
    const a = auth('x', [term('term_2018', [2019, 2023], 'other'), term('term_2024', [2024, 2028], 'me')],
      { 2019: 2.5, 2020: 2.5, 2024: 3 })
    const [s] = headRecord('me', [a]).stints
    expect(s.prev?.term.personSlug).toBe('other')
    expect(s.prev?.window).toEqual([2019, 2023])
    expect(s.prev?.grade?.scored).toBe(2)
    expect(s.prev?.grade?.letter).toBe('B')
  })

  it('a new head starts their own streak: the predecessor\'s A years are not theirs', () => {
    const a = auth('x', [term('term_2018', [2019, 2023], 'other'), term('term_2024', [2024, 2028], 'me')],
      { 2022: 3, 2023: 3, 2024: 3 })
    expect(headRecord('me', [a]).streak).toBe(1)
  })

  it('interim years after a head left are not the head\'s', () => {
    const a = auth('shaar-hanegev', [
      term('term_2018', [2019, 2023], 'me'),
      term('term_2018_interim', [2024, 2024], null, { interim: true }),
      term('term_2024', [2025, 2029], 'next'),
    ], { 2022: 3, 2023: 3, 2024: 2.5 })
    const r = headRecord('me', [a])
    expect(r.years.map(y => y.year)).toEqual([2022, 2023])
    expect(r.newest?.year).toBe(2023)
    expect(r.streak).toBe(2)
    // and the next head's predecessor is the interim, not the head who left
    expect(headRecord('next', [a]).stints[0].prev?.term.interim).toBe(true)
  })

  it('a head with no scored year yet has a stint but no seal', () => {
    const a = auth('x', [term('term_2018', [2019, 2024], 'other'), term('term_2025', [2025, 2029], 'me', { isCurrent: true })],
      { 2023: 3, 2024: 3 })
    const r = headRecord('me', [a])
    expect(r.stints).toHaveLength(1)
    expect(r.stints[0].window).toBeNull()
    expect(r.stints[0].grade).toBeNull()
    expect(r.newest).toBeNull()
    expect(r.streak).toBe(0)
  })

  it('the term letter averages the years, and each year keeps its own letter', () => {
    // mean 2.6, just under the A cut; the two weak years are D on points, C
    // by the consistency rule (no domain D)
    const a = auth('x', [term('term_2018', [2019, 2023], 'me')], { 2019: 3, 2020: 3, 2021: 2.0, 2022: 2.0, 2023: 3 })
    const [s] = headRecord('me', [a]).stints
    expect(s.grade?.years.map(y => y.letter)).toEqual(['A', 'A', 'C', 'C', 'A'])
    expect(s.grade?.letter).toBe('B')
  })

  it('a head elected in a special election carries the streak into the regular term', () => {
    const a = auth('nahal-sorek', [
      term('term_2018', [2019, 2021], 'eskozido'),
      term('term_2021_special', [2022, 2023], 'reichner'),
      term('term_2024_regular', [2024, 2028], 'reichner', { isCurrent: true }),
    ], { 2021: 3, 2022: 3, 2023: 3, 2024: 3 })
    const r = headRecord('reichner', [a])
    expect(r.years.map(y => y.year)).toEqual([2022, 2023, 2024])
    expect(r.streak).toBe(3)
    // the special term's predecessor is the head who left
    expect(r.stints[0].prev?.term.personSlug).toBe('eskozido')
  })

  it('a move to another authority breaks the streak', () => {
    const r = headRecord('me', [
      auth('a', [term('term_2018', [2019, 2023], 'me')], { 2022: 3, 2023: 3 }),
      auth('b', [term('term_2024', [2024, 2028], 'me')], { 2024: 3 }),
    ])
    expect(r.newest?.authoritySlug).toBe('b')
    expect(r.streak).toBe(1)
  })
})
