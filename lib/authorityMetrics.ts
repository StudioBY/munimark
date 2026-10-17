import type { AuthorityYearly } from '@/types/db'

// Display config for the yearly metrics, shared by the authority pages.
// Moved out of MayorProfile so /mayor and /authority render the same numbers.

// ── Data mapping (DB column → display key) ────────────────────────────────────
export function toYearMap(rows: AuthorityYearly[]) {
  const m: Record<number, Record<string, number | null>> = {}
  for (const r of rows) {
    m[r.data_year] = {
      זכאות_בגרות:    r.b_bagrut_pct,
      בגרות_סף:       r.b_bagrut_uni_pct,
      נשירה:          r.b_dropout_pct,
      תלמידים:        r.b_students_per_class,
      חינוך_אחוז:     r.b_edu_spend_pct,
      רווחה_אחוז:     r.b_welfare_spend_pct,
      תקציב_לנפש:     r.b_budget_per_capita,
      ארנונה:          r.b_arnona_collection_pct,
      עצמיות:         r.b_own_revenue_pct,
      ביצוע:          r.b_budget_execution_pct,
      עודף:           r.b_surplus_deficit,
      מאזן:           r.b_migration_balance,
      גידול:          r.b_population_growth_pct,
      התחלות:         r.b_construction_starts,
      גמר:            r.b_construction_completions,
      מחזור:          r.b_recycling_pct,
      פחת:            r.b_water_loss_pct,
      פסולת:          r.b_waste_per_capita,
      // H-fields shown in demographics charts
      תוחלת_חיים:     r.h_life_expectancy,
      תואר_ראשון:     r.h_ba_degree_pct,
      צעירים:         r.h_youth_pct,
      קשישים:         r.h_elderly_pct,
    }
  }
  return m
}

// A year is worth showing only if it carries at least one of the 18 B metrics.
// H fields alone (district, נפה, קבוצת_פרופיל) describe the authority, not a year.
export const B_COLUMNS = [
  'b_bagrut_pct', 'b_bagrut_uni_pct', 'b_dropout_pct', 'b_students_per_class',
  'b_edu_spend_pct', 'b_welfare_spend_pct', 'b_budget_per_capita',
  'b_arnona_collection_pct', 'b_own_revenue_pct', 'b_budget_execution_pct',
  'b_surplus_deficit', 'b_migration_balance', 'b_population_growth_pct',
  'b_construction_starts', 'b_construction_completions', 'b_recycling_pct',
  'b_water_loss_pct', 'b_waste_per_capita',
] as const

export function hasPerformanceData(row: AuthorityYearly): boolean {
  return B_COLUMNS.some(c => (row as unknown as Record<string, unknown>)[c] != null)
}

// ── Formatters ────────────────────────────────────────────────────────────────
export const f = {
  pct1:  (v: number) => v.toFixed(1) + '%',
  pct2:  (v: number) => v.toFixed(2) + '%',
  dec1:  (v: number) => v.toFixed(1),
  dec2:  (v: number) => v.toFixed(2),
  ils:   (v: number) => '₪' + Math.round(v).toLocaleString('he-IL'),
  int:   (v: number) => Math.round(v).toLocaleString('he-IL'),
  sign:  (v: number) => (v > 0 ? '+' : '') + Math.round(v).toLocaleString('he-IL'),
  waste: (v: number) => v.toFixed(2) + ' ק"ג',
}

export const fmt = (v: number | null | undefined, fn: (n: number) => string) =>
  v != null ? fn(v) : '—'

// ── KPI config ────────────────────────────────────────────────────────────────
export const KPIS: { k: string; l: string; dir: 1 | -1 | 0; fn: (v: number) => string; lead?: boolean }[] = [
  { k: 'זכאות_בגרות', l: 'זכאות בגרות',   dir:  1, fn: f.pct1 },
  { k: 'נשירה',        l: 'נשירת תלמידים', dir: -1, fn: f.pct2 },
  { k: 'מאזן',         l: 'מאזן הגירה',    dir:  1, fn: f.sign, lead: true },
  { k: 'התחלות',       l: 'התחלות בנייה',  dir:  1, fn: f.int  },
  { k: 'עצמיות',       l: 'הכנסות עצמיות', dir:  1, fn: f.pct1 },
  { k: 'ארנונה',       l: 'גביית ארנונה',  dir:  1, fn: f.pct1 },
  { k: 'תקציב_לנפש',  l: 'תקציב לנפש',    dir:  1, fn: f.ils  },
  { k: 'מחזור',        l: 'מחזור פסולת',   dir:  1, fn: f.pct1 },
]

// ── ALL 22 metrics (18 performance + 4 demographics) ─────────────────────────
export const ALL: { k: string; l: string; cat: string; dir: 1 | -1 | 0; fn: (v: number) => string }[] = [
  { k: 'זכאות_בגרות', l: 'זכאות בגרות',       cat: 'חינוך',    dir:  1, fn: f.pct1 },
  { k: 'בגרות_סף',     l: "בגרות סף אוני׳",   cat: 'חינוך',    dir:  1, fn: f.pct1 },
  { k: 'נשירה',         l: 'נשירה',              cat: 'חינוך',    dir: -1, fn: f.pct2 },
  { k: 'תלמידים',       l: 'תלמידים לכיתה',     cat: 'חינוך',    dir: -1, fn: f.dec1 },
  { k: 'חינוך_אחוז',   l: "הוצ׳ חינוך",        cat: 'חינוך',    dir:  1, fn: f.pct1 },
  { k: 'תקציב_לנפש',   l: 'תקציב לנפש',         cat: 'פיננסי',   dir:  1, fn: f.ils  },
  { k: 'ארנונה',        l: 'גביית ארנונה',       cat: 'פיננסי',   dir:  1, fn: f.pct1 },
  { k: 'עצמיות',        l: 'הכנסות עצמיות',      cat: 'פיננסי',   dir:  1, fn: f.pct1 },
  { k: 'ביצוע',         l: 'ביצוע תקציב',        cat: 'פיננסי',   dir:  1, fn: f.pct1 },
  { k: 'עודף',          l: 'עודף/גירעון',         cat: 'פיננסי',   dir:  1, fn: f.sign },
  { k: 'רווחה_אחוז',   l: "הוצ׳ רווחה",          cat: 'פיננסי',   dir:  1, fn: f.pct1 },
  { k: 'מאזן',          l: 'מאזן הגירה',           cat: 'דמוגרפיה', dir:  1, fn: f.sign },
  { k: 'גידול',         l: 'גידול אוכלוסייה',     cat: 'דמוגרפיה', dir:  1, fn: f.pct1 },
  { k: 'התחלות',        l: 'התחלות בנייה',         cat: 'בנייה',    dir:  1, fn: f.int  },
  { k: 'גמר',           l: 'גמר בנייה',             cat: 'בנייה',    dir:  1, fn: f.int  },
  { k: 'מחזור',         l: 'מחזור פסולת',           cat: 'סביבה',    dir:  1, fn: f.pct1 },
  { k: 'פחת',           l: 'פחת מים',               cat: 'סביבה',    dir: -1, fn: f.pct1 },
  { k: 'פסולת',         l: 'פסולת לנפש',             cat: 'סביבה',    dir: -1, fn: f.waste },
  // Demographics (4 new) — H-class fields, shown but not scored
  { k: 'תוחלת_חיים',   l: 'תוחלת חיים',           cat: 'דמוגרפיה', dir:  1, fn: f.dec1 },
  { k: 'תואר_ראשון',   l: 'תואר ראשון+',           cat: 'דמוגרפיה', dir:  1, fn: f.pct1 },
  { k: 'צעירים',        l: 'צעירים 0–17',            cat: 'דמוגרפיה', dir:  0, fn: f.pct1 },
  { k: 'קשישים',        l: 'קשישים 65+',             cat: 'דמוגרפיה', dir:  0, fn: f.pct1 },
]


/** The newest year in which a field has a value — the newest ROW is often empty. */
export function latestValue<K extends keyof AuthorityYearly>(rows: AuthorityYearly[], col: K): { value: AuthorityYearly[K]; year: number } | null {
  for (let i = rows.length - 1; i >= 0; i--) {
    const v = rows[i][col]
    if (v != null && v !== '') return { value: v, year: rows[i].data_year }
  }
  return null
}
