import { describe, expect, it } from 'vitest'
import type { Authority, AuthorityYearly } from '@/types/db'
import {
  SITE_URL,
  authorityDescription,
  authorityFullName,
  authorityJsonLd,
  performanceCoverage,
  personDescription,
  personJsonLd,
} from '@/lib/seo'

// Iron rule: a field with no data is not written — not null, not '', not a
// guess. This really happened: sameAs was silently absent from the page of a
// well-known mayor because the database field was empty. These tests make
// that absence a checked decision (key missing) rather than an accident.

/** Every value anywhere in the object, with its path. */
function leaves(value: unknown, path = '$'): [string, unknown][] {
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => leaves(v, `${path}.${k}`))
  }
  return [[path, value]]
}

function expectNoEmptyValues(obj: object) {
  for (const [path, v] of leaves(obj)) {
    expect(v, `${path} is written without a value`).not.toBeNull()
    expect(v, `${path} is written without a value`).not.toBeUndefined()
    expect(v, `${path} is written without a value`).not.toBe('')
  }
}

function expectAbsoluteIds(obj: object) {
  for (const [path, v] of leaves(obj)) {
    if (/\.(@id|url)$/.test(path) && !/image/.test(path)) {
      expect(String(v), path).toMatch(/^https:\/\/munimark\.co\.il\//)
    }
  }
}

const ashdod: Authority = {
  id: 1,
  symbol: 70,
  name_display: 'אשדוד',
  name_cbs: 'אשדוד',
  slug: 'ashdod',
  entity_id_obudget: null,
  authority_type: 'עירייה',
  is_published: true,
  established_year: null,
  established_note: null,
}
const authRow = { symbol: 70, authority_type: 'עירייה', name_display: 'אשדוד', slug: 'ashdod' }
const otherAuthRow = { symbol: 99, authority_type: 'מועצה מקומית', name_display: 'גן יבנה', slug: 'gan-yavne' }

const basePerson = {
  name: 'פלוני אלמוני',
  slug: 'ploni-almoni',
  photo_url: null as string | null,
  background: null as string | null,
  wikipedia_url: null as string | null,
  tenure_start: null as string | null,
  term_count: null as number | null,
  tenure_is_minimum: false as boolean | null,
  tenure_source: null as string | null,
}
const currentTerm = { authority_symbol: 70, authority_type: 'עירייה', term_label: 'term_2024_regular', is_current: true }

describe('authorityFullName', () => {
  it.each([
    ['עירייה', 'אשדוד', 'עיריית אשדוד'],
    ['מועצה מקומית', 'באר יעקב', 'המועצה המקומית באר יעקב'],
    ['מועצה אזורית', 'חוף אשקלון', 'המועצה האזורית חוף אשקלון'],
    [null, 'אשדוד', 'אשדוד'],
  ])('(%s, %s) -> %s', (type, name, expected) => {
    expect(authorityFullName(type, name)).toBe(expected)
  })

  it('writes only the name when the type is unknown — it does not guess one', () => {
    expect(authorityFullName('', 'אשדוד')).toBe('אשדוד')
    expect(authorityFullName('משהו אחר', 'אשדוד')).toBe('אשדוד')
  })
})

describe('personDescription', () => {
  it('keeps a lower-bound start year as a lower bound: "בתפקיד מ־1998 לפחות"', () => {
    const d = personDescription({
      person: { ...basePerson, tenure_start: '1998', term_count: 3, tenure_is_minimum: true, tenure_source: 'derived-mayor-terms' },
      terms: [currentTerm],
      authorities: [authRow],
    })
    expect(d).toContain('בתפקיד מ־1998 לפחות')
    expect(d).toContain('לפחות 3 קדנציות')
  })

  it('with a "mixed" source, states the start year exactly but still keeps "לפחות" on the term count', () => {
    const d = personDescription({
      person: { ...basePerson, tenure_start: '1998', term_count: 3, tenure_is_minimum: true, tenure_source: 'mixed-wikipedia' },
      terms: [currentTerm],
      authorities: [authRow],
    })
    expect(d).toContain('בתפקיד מ־1998')
    expect(d).not.toContain('מ־1998 לפחות')
    expect(d).toContain('לפחות 3 קדנציות')
  })

  it('reads the year out of a dd/mm/yyyy tenure_start', () => {
    const d = personDescription({
      person: { ...basePerson, tenure_start: '11/11/2008' },
      terms: [currentTerm],
      authorities: [authRow],
    })
    expect(d).toContain('בתפקיד מ־2008')
  })

  it('names the current post in full', () => {
    const d = personDescription({ person: basePerson, terms: [currentTerm], authorities: [authRow] })
    expect(d).toMatch(/^פלוני אלמוני — ראש עיריית אשדוד/)
  })

  it('lists earlier posts at another authority with "קודם לכן"', () => {
    const d = personDescription({
      person: basePerson,
      terms: [currentTerm, { authority_symbol: 99, authority_type: 'מועצה מקומית', term_label: 'term_2013', is_current: false }],
      authorities: [authRow, otherAuthRow],
    })
    expect(d).toContain('קודם לכן ראש המועצה המקומית גן יבנה (2013–2018)')
  })

  it('stays within 220 characters and never cuts a word in half', () => {
    const words = Array.from({ length: 80 }, (_, i) => `מילה${i}`)
    const background = words.join(' ')
    const d = personDescription({ person: { ...basePerson, background }, terms: [currentTerm], authorities: [authRow] })
    expect(d.length).toBeLessThanOrEqual(220)
    expect(d.endsWith('…')).toBe(true)
    const lastWord = d.slice(0, -1).split(' ').pop()!
    expect(words).toContain(lastWord)
  })

  it('never writes "undefined" or "null" for a person with almost no data', () => {
    const d = personDescription({ person: { ...basePerson, name: null }, terms: [], authorities: [] })
    expect(d).not.toMatch(/undefined|null/)
  })
})

describe('authorityDescription', () => {
  const years = [2014, 2019, 2024].map(y => ({ data_year: y, b_bagrut_pct: 70 }) as unknown as AuthorityYearly)

  it('contains the authority, its head and the year range', () => {
    const d = authorityDescription({ authority: ashdod, mayorName: 'פלוני אלמוני', years, score: null })
    expect(d).toContain('אשדוד')
    expect(d).toContain('פלוני אלמוני')
    expect(d).toContain('2014–2024')
  })

  it('without a head writes neither "undefined" nor a dangling dash', () => {
    const d = authorityDescription({ authority: ashdod, mayorName: null, years, score: null })
    expect(d).not.toMatch(/undefined|null/)
    expect(d).not.toMatch(/—\s*\./)
    expect(d.startsWith('אשדוד.')).toBe(true)
  })

  it('claims a peer comparison only when one was computed against peers', () => {
    const peers = { comparison_group: 'x', solo_group: false, group_size: 12 }
    const solo = { comparison_group: 'x', solo_group: true, group_size: 1 }
    expect(authorityDescription({ authority: ashdod, mayorName: null, years, score: peers })).toContain('מול רשויות דומות')
    expect(authorityDescription({ authority: ashdod, mayorName: null, years, score: solo })).not.toContain('מול רשויות דומות')
    expect(authorityDescription({ authority: ashdod, mayorName: null, years, score: null })).not.toContain('מול רשויות דומות')
  })

  it('does not invent a metric count or years when there is no data', () => {
    const d = authorityDescription({ authority: ashdod, mayorName: null, years: [], score: null })
    expect(d).not.toMatch(/\d/)
  })
})

describe('performanceCoverage', () => {
  it('counts the metrics that have data and the years that carry any', () => {
    const rows = [
      { data_year: 2014, b_bagrut_pct: 70, b_recycling_pct: null },
      { data_year: 2016, b_bagrut_pct: 71, b_recycling_pct: 20 },
      { data_year: 2024, b_bagrut_pct: null, b_recycling_pct: 22 },
      { data_year: 2025 }, // a year with no performance data at all
    ] as unknown as AuthorityYearly[]
    expect(performanceCoverage(rows)).toEqual({ metrics: 2, firstYear: 2014, lastYear: 2024 })
  })

  it('returns zeros and nulls — not a crash — for no rows or only empty rows', () => {
    expect(performanceCoverage([])).toEqual({ metrics: 0, firstYear: null, lastYear: null })
    expect(performanceCoverage([{ data_year: 2020 }] as unknown as AuthorityYearly[])).toEqual({
      metrics: 0,
      firstYear: null,
      lastYear: null,
    })
  })
})

describe('personJsonLd — a field with no data is not written', () => {
  const bare = personJsonLd({ person: basePerson, terms: [], authorities: [] })

  it('has no sameAs key at all when there is no wikipedia_url (not sameAs: null)', () => {
    expect(bare).not.toHaveProperty('sameAs')
  })

  it('has no image key when there is no photo', () => {
    expect(bare).not.toHaveProperty('image')
  })

  it('has no jobTitle or worksFor for someone without a current post', () => {
    expect(bare).not.toHaveProperty('jobTitle')
    expect(bare).not.toHaveProperty('worksFor')
  })

  it('writes no null, undefined or empty value anywhere', () => {
    expectNoEmptyValues(bare)
  })

  it('describes a licensed photo as an ImageObject carrying licence, credit and licence page', () => {
    const ld = personJsonLd({
      person: {
        ...basePerson,
        photo_url: 'https://upload.wikimedia.org/a.jpg',
        photo_license_url: 'https://creativecommons.org/licenses/by-sa/4.0/',
        photo_artist: 'צלם',
        photo_file_page: 'https://commons.wikimedia.org/wiki/File:A.jpg',
      },
      terms: [],
      authorities: [],
    })
    expect(ld.image).toMatchObject({
      '@type': 'ImageObject',
      license: 'https://creativecommons.org/licenses/by-sa/4.0/',
      creditText: 'צלם',
      acquireLicensePage: 'https://commons.wikimedia.org/wiki/File:A.jpg',
    })
  })

  it('writes a photo with no recorded licence as a plain URL, not an ImageObject with empty fields', () => {
    const ld = personJsonLd({ person: { ...basePerson, photo_url: 'https://upload.wikimedia.org/a.jpg' }, terms: [], authorities: [] })
    expect(ld.image).toBe('https://upload.wikimedia.org/a.jpg')
  })

  it('links a serving head to the authority, with absolute @id and url', () => {
    const ld = personJsonLd({
      person: { ...basePerson, wikipedia_url: 'https://he.wikipedia.org/wiki/X' },
      terms: [currentTerm],
      authorities: [authRow],
    })
    expect(ld.jobTitle).toBe('ראש עיריית אשדוד')
    expect(ld.worksFor).toMatchObject({ '@id': `${SITE_URL}/mayor/ashdod#org` })
    expect(ld.sameAs).toEqual(['https://he.wikipedia.org/wiki/X'])
    expect(ld['@id']).toBe(`${SITE_URL}/person/ploni-almoni#person`)
    expectAbsoluteIds(ld)
    expectNoEmptyValues(ld)
  })
})

describe('authorityJsonLd — a field with no data is not written', () => {
  it('has no foundingDate when established_year is unknown', () => {
    const ld = authorityJsonLd({ authority: ashdod, district: null, mayor: null })
    expect(ld).not.toHaveProperty('foundingDate')
  })

  it('writes foundingDate when established_year is known', () => {
    const ld = authorityJsonLd({ authority: { ...ashdod, established_year: 1956 }, district: null, mayor: null })
    expect(ld).toHaveProperty('foundingDate', '1956')
  })

  it('has no employee without a current head, and no addressRegion without a district', () => {
    const ld = authorityJsonLd({ authority: ashdod, district: null, mayor: null })
    expect(ld).not.toHaveProperty('employee')
    expect(ld.address).not.toHaveProperty('addressRegion')
    expectNoEmptyValues(ld)
  })

  it('links the current head to their person page with an absolute @id', () => {
    const ld = authorityJsonLd({ authority: ashdod, district: 'הדרום', mayor: { name: 'פלוני אלמוני', slug: 'ploni-almoni' } })
    expect(ld.employee).toMatchObject({ '@id': `${SITE_URL}/person/ploni-almoni#person` })
    expect(ld['@id']).toBe(`${SITE_URL}/mayor/ashdod#org`)
    expectAbsoluteIds(ld)
    expectNoEmptyValues(ld)
  })

  it('omits the employee link — rather than writing an empty one — when the head has no slug', () => {
    const ld = authorityJsonLd({ authority: ashdod, district: null, mayor: { name: 'פלוני אלמוני', slug: null } })
    expect(ld.employee).not.toHaveProperty('@id')
    expect(ld.employee).not.toHaveProperty('url')
    expectNoEmptyValues(ld)
  })
})
