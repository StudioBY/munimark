import type { Score, ScoringConfig } from '@/types/db'
import type { AuthorityTerm } from '@/lib/terms'
import { aStreak, termGrade } from '@/lib/score'
import type { GradeYear, TermGrade } from '@/lib/score'

// The record of ONE head (a person) across the terms they served, possibly in
// more than one authority. Built from each authority's own term windows
// (lib/terms.ts), so a year belongs to the head only if it is attributed to
// them there: the years after a head left mid-term are an interim, and the
// year a successor took over is the successor's.

export interface HeadAuthorityInput {
  slug: string
  terms: AuthorityTerm[]
  scores: Pick<Score, 'data_year' | 'points'>[]
  domainPoints: Record<number, Record<string, number | null>>
  cfg: Pick<ScoringConfig, 'cut_d_c' | 'cut_c_b' | 'cut_b_a' | 'rules' | 'domain_cuts'> | null
}

export interface HeadStint {
  authoritySlug: string
  term: AuthorityTerm
  // the term's years that have a score so far; null when it has none yet
  window: [number, number] | null
  grade: TermGrade | null
  // whoever held the authority just before — another head, an interim, or
  // the same person's previous term
  prev: { term: AuthorityTerm; window: [number, number] | null; grade: TermGrade | null } | null
}

export interface HeadYear extends GradeYear { authoritySlug: string }

export interface HeadRecord {
  stints: HeadStint[]          // oldest first
  years: HeadYear[]            // the head's own scored years, oldest first
  newest: HeadYear | null      // the seal: the head's newest scored year
  streak: number               // consecutive A years ending at `newest`; "+" from 2
}

/** A term window clipped to the years an authority has scores for. */
export function scoredWindow(window: [number, number], scores: Pick<Score, 'data_year' | 'points'>[]): [number, number] | null {
  const ys = scores.filter(s => s.points != null).map(s => s.data_year)
  if (!ys.length) return null
  const a = Math.max(window[0], Math.min(...ys)), b = Math.min(window[1], Math.max(...ys))
  return a <= b ? [a, b] : null
}

export function headRecord(personSlug: string, auths: HeadAuthorityInput[]): HeadRecord {
  const stints: HeadStint[] = []
  for (const au of auths) {
    const sorted = [...au.terms].sort((a, b) => a.window[0] - b.window[0])
    const gradeOf = (w: [number, number] | null) => (w && au.cfg ? termGrade(w, au.scores, au.domainPoints, au.cfg) : null)
    sorted.forEach((t, i) => {
      if (t.interim || t.personSlug !== personSlug) return
      const window = scoredWindow(t.window, au.scores)
      const p = sorted[i - 1]
      const pw = p ? scoredWindow(p.window, au.scores) : null
      stints.push({
        authoritySlug: au.slug,
        term: t,
        window,
        grade: gradeOf(window),
        prev: p ? { term: p, window: pw, grade: gradeOf(pw) } : null,
      })
    })
  }
  stints.sort((a, b) => a.term.window[0] - b.term.window[0])
  const years = stints
    .flatMap(s => (s.grade?.years ?? []).filter(y => y.letter).map(y => ({ ...y, authoritySlug: s.authoritySlug })))
    .sort((a, b) => a.year - b.year)
  const newest = years[years.length - 1] ?? null
  // Every year here is this head's, so the streak breaks only on a letter
  // below A, a missing year, or a move to another authority.
  const streak = aStreak(years.map(y => ({ year: y.year, letter: y.letter, head: y.authoritySlug })))
  return { stints, years, newest, streak }
}
