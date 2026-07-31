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
 *   year 2013-2018 → term_2013
 *   year 2019-2023 → term_2018 (unless term_2023_special exists → use it from 2023+)
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

  // ── Year 2013-2018 ──
  if (year >= 2013) {
    const t2013 = byLabel('term_2013')
    return t2013 ? toResult(t2013) : null
  }

  return null
}

/** Map a term_label to a Hebrew display label */
export function termDisplayLabel(termLabel: string): string {
  const map: Record<string, string> = {
    term_2013: 'קדנציית 2013',
    term_2018: 'קדנציית 2018',
    term_2024_regular: 'קדנציית 2024',
    term_2024_nov: 'קדנציית 2024 (נובמבר)',
    term_2025_feb: 'קדנציית 2025 (פברואר)',
    term_2023_special: 'קדנציה מיוחדת 2023',
    term_2025_replacement: 'מינוי 2025',
    term_2026_repeat: 'בחירות חוזרות 2026',
  }
  return map[termLabel] ?? termLabel
}

/** Map a layer id to the year range it covers */
export function layerYearRange(layer: '2013' | '2018' | '2024'): [number, number] {
  switch (layer) {
    case '2013': return [2013, 2018]
    case '2018': return [2019, 2023]
    case '2024': return [2024, 2030]
  }
}

/** Map a term_label to its attributed CBS data year range */
export function termAttributedYears(termLabel: string): [number, number] {
  switch (termLabel) {
    case 'term_2013':             return [2013, 2018]
    case 'term_2018':             return [2019, 2023]
    case 'term_2023_special':     return [2023, 2025]
    case 'term_2024_regular':     return [2024, 2026]
    case 'term_2024_nov':         return [2025, 2026]
    case 'term_2025_feb':         return [2025, 2026]
    case 'term_2025_replacement': return [2026, 2030]
    case 'term_2026_repeat':      return [2026, 2030]
    default:                      return [2024, 2030]
  }
}

/** Format authority type for display: עירייה→"עיריית", etc. */
export function authorityTypePrefix(authorityType: string | null): string {
  if (authorityType === 'עירייה') return 'עיריית'
  if (authorityType === 'מועצה מקומית') return 'מ. מקומית'
  return 'מ. אזורית'
}

/** Map a layer id to the term_label used to find the representative mayor */
export function layerRepresentativeYear(layer: '2013' | '2018' | '2024'): number {
  switch (layer) {
    case '2013': return 2015  // mid-term year for 2013 term
    case '2018': return 2021  // mid-term year for 2018 term
    case '2024': return 2024  // current term
  }
}
