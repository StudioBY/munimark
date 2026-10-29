import type { MayorTerm } from '@/types/db'

export interface MayorForYear {
  full_name: string
  term_label: string
  election_pct: string | null
  changed_from_previous: boolean | null
  person: {
    photo_url: string | null
    bio: string | null
    wikipedia_url: string | null
    slug: string | null
  } | null
}

/**
 * Resolve which mayor term applies for a given CBS data year.
 *
 * Term attribution logic (data-driven — no hardcoded city names):
 *   year 2014-2018 → term_2013   (2013 belongs to the 2008 term, absent here)
 *   year 2019-2023 → term_2018 (unless term_2021_special exists → use it from 2022+,
 *                                or term_2023_special → use it from 2023+)
 *   year 2024-2025 → term_2024_regular if it exists;
 *     BUT if the authority's latest election is term_2024_nov or term_2025_feb,
 *     year 2024 still belongs to term_2018 (war-delayed elections)
 *     Special replacements (term_2025_replacement) override for their range
 *   year 2026+     → is_current=true
 */
export function getMayorForYear(
  terms: MayorTerm[],
  year: number,
): MayorForYear | null {
  if (terms.length === 0) return null

  const byLabel = (label: string) => terms.find(t => t.term_label === label)
  const current = terms.find(t => t.is_current)

  // Helper: build result from a term row
  const toResult = (t: MayorTerm): MayorForYear => ({
    full_name: t.full_name,
    term_label: t.term_label,
    election_pct: t.election_pct,
    changed_from_previous: t.changed_from_previous,
    person: t.mayors
      ? { photo_url: t.mayors.photo_url, bio: t.mayors.background, wikipedia_url: t.mayors.wikipedia_url, slug: t.mayors.slug }
      : null,
  })

  // ── A mid-term term (special election, appointment) takes its own years ──
  if (year < 2026) {
    const mid = terms
      .filter(t => t.term_label !== 'term_2023_special' && midTermLabel(t.term_label))
      .filter(t => { const [a, b] = termAttributedYears(t.term_label); return year >= a && year <= b })
      .sort((a, b) => termAttributedYears(b.term_label)[0] - termAttributedYears(a.term_label)[0])[0]
    if (mid) return toResult(mid)
  }

  // ── Year 2026+ → current term ──
  if (year >= 2026) {
    return current ? toResult(current) : null
  }

  // ── Year 2024-2025 ──
  if (year >= 2024) {
    // Check for term_2023_special — it overrides from 2023 onward
    const special2023 = byLabel('term_2023_special')
    if (special2023) return toResult(special2023)

    // Check for replacement terms that apply in the 2024-2025 window
    // term_2025_replacement: the replaced mayor still serves 2024-2025,
    // the replacement is is_current and applies from 2026+.
    // So for 2024-2025, use term_2024_regular if it exists.

    const regular2024 = byLabel('term_2024_regular')

    // If authority has a war-delayed election (term_2024_nov / term_2025_feb),
    // those terms started AFTER the regular 2024 election date.
    // For year 2024, the authority was still under term_2018.
    // For year 2025, the delayed-election term applies.
    const delayed = byLabel('term_2024_nov') ?? byLabel('term_2025_feb')

    if (delayed) {
      if (year === 2024) {
        // War-delayed: 2024 still belongs to term_2018
        const t2018 = byLabel('term_2018')
        return t2018 ? toResult(t2018) : null
      }
      // year === 2025: the delayed election term applies
      return toResult(delayed)
    }

    if (regular2024) return toResult(regular2024)

    // Fallback to term_2018 if no 2024-era term exists
    const t2018 = byLabel('term_2018')
    return t2018 ? toResult(t2018) : null
  }

  // ── Year 2019-2023 ──
  if (year >= 2019) {
    // term_2023_special overrides from 2023+
    if (year >= 2023) {
      const special2023 = byLabel('term_2023_special')
      if (special2023) return toResult(special2023)
    }
    const t2018 = byLabel('term_2018')
    return t2018 ? toResult(t2018) : null
  }

  // ── Year 2014-2018 → term_2013 ──
  // 2014, not 2013. Elections are held in October, so a data year belongs to
  // whoever served THROUGH it: 2013 was served by the mayor elected in 2008,
  // who is not in our data at all. Returning term_2013 for 2013 credited a
  // whole year to someone who took office in its final weeks.
  // In practice our CBS data starts at 2014, so nothing is lost by refusing.
  if (year >= 2014) {
    const t2013 = byLabel('term_2013')
    return t2013 ? toResult(t2013) : null
  }

  return null
}

/**
 * A mid-term term: a special election (or a council's choice) after a head
 * left, or a ministry appointment — term_<year>_special / term_<year>_appointed,
 * with _h1 when the head took office before July. Like leaving (lib/terms.ts),
 * a year belongs to whoever held office through most of it: before July the
 * year of entry is theirs, otherwise attribution starts the year after.
 * It runs to the end of the regular cycle it falls in; a later term cuts it.
 */
export function midTermLabel(termLabel: string): { year: number; kind: 'special' | 'appointed'; firstHalf: boolean } | null {
  const m = termLabel.match(/^term_(\d{4})_(special|appointed)(_h1)?$/)
  return m ? { year: Number(m[1]), kind: m[2] as 'special' | 'appointed', firstHalf: !!m[3] } : null
}
// The last data year of the regular cycle a year falls in (elections 2013, 2018, 2024).
const cycleEnd = (y: number) => (y <= 2018 ? 2018 : y <= 2023 ? 2023 : 2028)

/** Map a term_label to a Hebrew display label */
/**
 * The years a term RUNS — the election year through the next election.
 *
 * Deliberately different from termAttributedYears(), which is the CBS data
 * window. Municipal elections are held in October, so the year of the election
 * is mostly served by the outgoing mayor and its data is attributed to them:
 *
 *     term_2013   in office 2013-2018      data years 2014-2018
 *     term_2018   in office 2018-2023      data years 2019-2023
 *
 * Both are correct answers to different questions — "when did he serve" and
 * "which year's numbers are his" — and the interface must not show one where
 * the reader expects the other. A chart that starts at 2014 under a heading
 * that says 2013 looks like a missing year rather than a rule.
 */
export function termSpanYears(termLabel: string): [number, number | null] {
  switch (termLabel) {
    case 'term_2013':             return [2013, 2018]
    case 'term_2018':             return [2018, 2024]
    case 'term_2023_special':     return [2023, 2024]
    case 'term_2023_appointed':   return [2023, 2024]
    case 'term_2024_regular':     return [2024, null]   // current
    case 'term_2024_nov':         return [2024, null]
    case 'term_2025_feb':         return [2025, null]
    case 'term_2025_replacement': return [2025, null]
    case 'term_2026_repeat':      return [2026, null]
  }
  const mid = midTermLabel(termLabel)
  if (mid) return [mid.year, mid.year <= 2018 ? 2018 : mid.year <= 2023 ? 2024 : null]
  return [2024, null]
}

/** "2013–2018", or "2024 –" while the term is still running. */
export function termSpanLabel(termLabel: string): string {
  const [from, to] = termSpanYears(termLabel)
  return to ? `${from}\u2013${to}` : `${from}\u2013`
}

/** "קדנציה 3" / "לפחות 3 קדנציות" when the count is a lower bound. */
export function termCountLabel(count: number | null, isMinimum: boolean): string | null {
  if (!count) return null
  const word = count === 1 ? 'קדנציה אחת' : `${count} קדנציות`
  return isMinimum ? `לפחות ${word}` : word
}

export function termDisplayLabel(termLabel: string): string {
  const map: Record<string, string> = {
    term_2013: 'קדנציית 2013',
    term_2018: 'קדנציית 2018',
    term_2024_regular: 'קדנציית 2024',
    term_2024_nov: 'קדנציית 2024 (נובמבר)',
    term_2025_feb: 'קדנציית 2025 (פברואר)',
    term_2021_special: 'קדנציה מיוחדת 2021',
    term_2023_special: 'קדנציה מיוחדת 2023',
    term_2025_replacement: 'מינוי 2025',
    term_2026_repeat: 'בחירות חוזרות 2026',
  }
  const mid = midTermLabel(termLabel)
  if (!map[termLabel] && mid) return mid.kind === 'special' ? `קדנציה מיוחדת ${mid.year}` : `מינוי ${mid.year}`
  return map[termLabel] ?? termLabel
}

/** Map a layer id to the year range it covers */
export function layerYearRange(layer: '2013' | '2018' | '2024'): [number, number] {
  switch (layer) {
    case '2013': return [2014, 2018]
    case '2018': return [2019, 2023]
    case '2024': return [2024, 2028]
  }
}

/** Map a term_label to its attributed CBS data year range */
// Ranges below mirror _shared/terms_years_muni_israel.csv, which is the single
// source of truth. A CBS year belongs to the mayor who served THROUGH it, so
// attribution starts the year AFTER the October election — term_2013 is
// 2014-2018, not 2013-2018, matching the way term_2018 is 2019-2023.
// Settled with the user 2026-09-16; do not change one copy without the other.
export function termAttributedYears(termLabel: string): [number, number] {
  switch (termLabel) {
    case 'term_2013':             return [2014, 2018]
    case 'term_2018':             return [2019, 2023]
    case 'term_2023_special':     return [2023, 2025]
    case 'term_2024_regular':     return [2024, 2028]
    case 'term_2024_nov':         return [2025, 2029]
    case 'term_2025_feb':         return [2025, 2029]
    case 'term_2025_replacement': return [2026, 2028]
    case 'term_2026_repeat':      return [2026, 2028]
  }
  const mid = midTermLabel(termLabel)
  if (mid) {
    const from = mid.firstHalf ? mid.year : mid.year + 1
    return [from, Math.max(from, cycleEnd(from))]
  }
  return [2024, 2030]
}

/** Format authority type for display: עירייה→"עיריית", etc. */
export function authorityTypePrefix(authorityType: string | null): string {
  if (authorityType === 'עירייה') return 'עיריית'
  if (authorityType === 'מועצה מקומית') return 'מ. מקומית'
  if (authorityType === 'מועצה אזורית') return 'מ. אזורית'
  // An unknown or missing type is not a regional council. Saying nothing is
  // the only honest answer: hard rule 1, no field is filled with a guess.
  return ''
}

/** Map a layer id to the term_label used to find the representative mayor */
export function layerRepresentativeYear(layer: '2013' | '2018' | '2024'): number {
  switch (layer) {
    case '2013': return 2015  // mid-term year for 2013 term
    case '2018': return 2021  // mid-term year for 2018 term
    case '2024': return 2024  // current term
  }
}
