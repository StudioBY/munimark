import { describe, expect, it } from 'vitest'
import { matchesQuery, normalizeHebrew, searchWords } from '@/lib/hebrewSearch'

// Naive search fails in Hebrew on exactly what people type. Every case below
// is a mismatch already seen in this project's real data.

describe('normalizeHebrew', () => {
  it('removes gershayim and quotes, so בני עי"ש can be typed as בני עיש', () => {
    expect(normalizeHebrew('בני עי"ש')).toBe('בני עיש')
    expect(normalizeHebrew('בני עי״ש')).toBe('בני עיש')
    expect(normalizeHebrew("ג'סר א-זרקא")).toBe('גסר א זרקא')
  })

  it('removes the typographic quotes that phone keyboards type instead of plain ones', () => {
    expect(normalizeHebrew('בני עי”ש')).toBe('בני עיש')
  })

  it('turns every kind of hyphen into a space, so מעלות-תרשיחא = מעלות תרשיחא', () => {
    for (const dash of ['-', '־', '–', '—']) {
      expect(normalizeHebrew(`מעלות${dash}תרשיחא`)).toBe('מעלות תרשיחא')
    }
  })

  it('lower-cases Latin, because slugs are Latin', () => {
    expect(normalizeHebrew('Tel Aviv')).toBe('tel aviv')
  })

  it('maps final letters to regular ones, so a half-typed "רמ" and a whole "רם" compare alike', () => {
    expect(normalizeHebrew('רם')).toBe(normalizeHebrew('רמ'))
    expect(normalizeHebrew('ךםןףץ')).toBe('כמנפצ')
  })

  it('collapses doubled yod and vav', () => {
    expect(normalizeHebrew('קריית')).toBe('קרית')
    expect(normalizeHebrew('שוורץ')).toBe('שורצ')
  })

  it('collapses repeated spaces and trims', () => {
    expect(normalizeHebrew('  רמת   גן ')).toBe('רמת גנ')
  })
})

// A slice of real authority names, enough to test that matches are right AND
// that non-matches stay out.
const AUTHORITIES = [
  ['ראש פינה', 'rosh-pina'],
  ['לוד', 'lod'],
  ['בית שמש', 'beit-shemesh'],
  ['הוד השרון', 'hod-hasharon'],
  ['מעלות-תרשיחא', 'maalot-tarshiha'],
  ['בני עי"ש', 'bnei-ayish'],
  ['תל אביב-יפו', 'tel-aviv'],
  ['דאלית אל-כרמל', 'daliyat-al-karmel'],
  ['רמלה', 'ramla'],
  ['רמת גן', 'ramat-gan'],
  ['כרמיאל', 'karmiel'],
  ['אשדוד', 'ashdod'],
  ['חיפה', 'haifa'],
  ['קריית גת', 'kiryat-gat'],
  ['יבנה', 'yavne'],
  ['באר יעקב', 'beer-yaakov'],
].map(([name, slug]) => ({ name, words: searchWords([name, slug]) }))

const find = (query: string) => AUTHORITIES.filter(a => matchesQuery(a.words, query)).map(a => a.name)

describe('matchesQuery — what a person types finds what is stored', () => {
  it.each([
    ['ראש פנה', 'ראש פינה', 'a MISSING yod — not a doubled one'],
    ['לד', 'לוד', 'a missing vav in a whole two-letter name'],
    ['בת שמש', 'בית שמש', 'a missing yod'],
    ['הד השרון', 'הוד השרון', 'a missing vav'],
    ['מעלות תרשיחא', 'מעלות-תרשיחא', 'a hyphen typed as a space'],
    ['בני עיש', 'בני עי"ש', 'gershayim left out'],
    ['tel aviv', 'תל אביב-יפו', 'the Latin slug'],
    ['דאלית', 'דאלית אל-כרמל', 'the start of a longer name'],
    ['קרית גת', 'קריית גת', 'a single yod for a double'],
  ])('"%s" finds %s (%s)', (query, expected) => {
    expect(find(query)).toContain(expected)
  })

  it('"רמ" finds both רמלה and רמת גן', () => {
    expect(find('רמ')).toEqual(expect.arrayContaining(['רמלה', 'רמת גן']))
  })

  it('matches only from the start of a word: "רמ" does not find כרמיאל or דאלית אל-כרמל', () => {
    expect(find('רמ')).not.toContain('כרמיאל')
    expect(find('רמ')).not.toContain('דאלית אל-כרמל')
  })

  it('a one-letter query narrows the list rather than matching the whole country', () => {
    for (const letter of ['ר', 'א', 'ב']) {
      const hits = find(letter)
      expect(hits.length).toBeGreaterThan(0)
      expect(hits.length).toBeLessThan(AUTHORITIES.length)
    }
  })

  it('requires every typed word to match, so an extra word narrows the result', () => {
    expect(find('רמת')).toEqual(['רמת גן'])
    expect(find('רמת חיפה')).toEqual([])
  })

  it('lets the words match different fields, e.g. an authority and its head', () => {
    const words = searchWords(['תל אביב-יפו', 'רון חולדאי', 'tel-aviv'])
    expect(matchesQuery(words, 'חולדאי')).toBe(true)
    expect(matchesQuery(words, 'תל אביב חולדאי')).toBe(true)
  })

  it('treats an empty query as "no filter"', () => {
    expect(find('')).toHaveLength(AUTHORITIES.length)
    expect(find('   ')).toHaveLength(AUTHORITIES.length)
  })

  it('ignores missing fields instead of matching the text "null"', () => {
    const words = searchWords(['אשדוד', null, undefined])
    expect(matchesQuery(words, 'null')).toBe(false)
    expect(matchesQuery(words, 'undefined')).toBe(false)
  })

  // SKELETON_MIN = 2 was set by measurement, not taste: dropping one internal
  // yod or vav from every authority name that has one, 3 found 173 of 194 and
  // 2 found all 194. The names 3 loses are whole two-letter skeletons like
  // לוד. If someone raises it back to 3, this test fails.
  it('keeps SKELETON_MIN at 2: "לד" must still find לוד', () => {
    expect(find('לד')).toEqual(['לוד'])
  })
})
