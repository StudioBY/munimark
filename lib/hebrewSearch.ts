// ── Hebrew-aware search for place and person names ──────────────────────────
//
// A naive substring search fails on Hebrew exactly where users need it. Every
// rule below exists because the mismatch was already seen in this project's
// own data:
//
//   typed            stored              rule
//   ראש פנה          ראש פינה            vowel letters (skeleton match, below)
//   דאלית            דאלית אל-כרמל       match from the start of a word
//   בני עיש          בני עי"ש            quotes and gershayim removed
//   מעלות תרשיחא     מעלות-תרשיחא        hyphens become spaces
//   tel aviv         תל אביב             the Latin slug is searched too

/**
 * Normalise a name for comparison. Applied to both the query and the data.
 *
 *  - lower-case                  "Tel Aviv" = "tel aviv" (slugs are Latin)
 *  - remove " ' ׳ ״ and their    בני עי"ש = בני עיש; smart-quote keyboards on
 *    typographic variants        phones type ” and ’ instead of " and '
 *  - hyphens - ־ – — → space     מעלות-תרשיחא = מעלות תרשיחא
 *  - יי → י, וו → ו              the same word spelled with a doubled or a
 *                                single yod/vav (כתיב מלא / חסר)
 *  - final letters ך ם ן ף ץ →   a word being typed is a prefix, and its last
 *    regular forms               letter is final only once the word ends:
 *                                "רמ" must still find "רמת גן"
 *  - collapse whitespace
 */
export function normalizeHebrew(s: string): string {
  return s
    .toLowerCase()
    .replace(/["'׳״“”„‘’`]/g, '')
    .replace(/[-־–—]/g, ' ')
    .replace(/יי/g, 'י')
    .replace(/וו/g, 'ו')
    .replace(/[ךםןףץ]/g, c => ({ ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' })[c] as string)
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * The word without its non-initial yod and vav. Vowel letters are optional
 * in Hebrew spelling, so "פנה" and "פינה" are the same word to a reader —
 * and doubling rules alone cannot connect a missing yod to a present one.
 * The first letter is kept: word-initial י/ו are consonants (יבנה, ורד).
 */
function skeleton(word: string): string {
  return word.charAt(0) + word.slice(1).replace(/[יו]/g, '')
}

// A skeleton shorter than this is too loose to mean anything: "רום" (skeleton
// "רמ") would find every name starting with רמ.
const SKELETON_MIN = 3

function wordMatches(word: string, token: string): boolean {
  if (word.startsWith(token)) return true
  const sk = skeleton(token)
  return sk.length >= SKELETON_MIN && skeleton(word).startsWith(sk)
}

/** Pre-normalised words of every searchable field of one item. */
export function searchWords(fields: (string | null | undefined)[]): string[] {
  return fields.flatMap(f => (f ? normalizeHebrew(f).split(' ') : []))
}

/**
 * Every query token must match the START of some word — not any substring.
 * "רמ" finds רמלה and רמת גן, but not a name with רמ in the middle.
 * Tokens may match different fields, so "אשדוד לסרי" finds the city by
 * name and head together.
 */
export function matchesQuery(words: string[], query: string): boolean {
  const tokens = normalizeHebrew(query).split(' ').filter(Boolean)
  return tokens.every(t => words.some(w => wordMatches(w, t)))
}
