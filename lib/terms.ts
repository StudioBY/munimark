import type { MayorTerm } from '@/types/db'
import { termAttributedYears, termSpanLabel } from '@/lib/getMayorForYear'

// The terms of ONE authority, each with the data years attributed to it.
//
// The rule (TASK_TERM_WINDOW.md, settled): a data year belongs to whoever
// served through it, so attribution starts the year after the election — and a
// term's window ENDS the year before the next term's window starts IN THE SAME
// AUTHORITY. A fixed table per label cannot express a postponed election:
// term_2018 runs to 2023 where the next term is term_2024_regular, but to 2024
// where it is term_2025_feb or term_2024_nov. The last term keeps its own end.

export interface AuthorityTerm {
  label: string
  spanLabel: string            // the term's own years, e.g. "2018–2024"
  name: string
  photo: string | null
  personSlug: string | null
  isCurrent: boolean
  window: [number, number]     // attributed data years
}

export function authorityTerms(terms: MayorTerm[]): AuthorityTerm[] {
  const sorted = [...terms]
    .map(t => ({ t, start: termAttributedYears(t.term_label)[0], end: termAttributedYears(t.term_label)[1] }))
    .sort((a, b) => a.start - b.start)
  return sorted.map(({ t, start, end }, i) => {
    const next = sorted[i + 1]
    return {
      label: t.term_label,
      spanLabel: termSpanLabel(t.term_label),
      name: t.mayors?.name ?? t.full_name,
      photo: t.mayors?.photo_url ?? null,
      personSlug: t.mayors?.slug ?? null,
      isCurrent: t.is_current,
      window: [start, next ? Math.max(start, next.start - 1) : end] as [number, number],
    }
  })
}

/** The term a data year is attributed to, if any. */
export function termForYear(terms: AuthorityTerm[], year: number): AuthorityTerm | null {
  return terms.find(t => year >= t.window[0] && year <= t.window[1]) ?? null
}
