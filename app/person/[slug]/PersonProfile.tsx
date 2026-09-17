'use client'

import { useState } from 'react'
import Link from 'next/link'
import PerformanceChart from '@/app/mayor/[slug]/PerformanceChart'
import type { Authority, Mayor, AuthorityYearly, MayorTerm } from '@/types/db'
import { termDisplayLabel, termSpanLabel, termSpanYears, termCountLabel, termAttributedYears, authorityTypePrefix } from '@/lib/getMayorForYear'

interface Props {
  person: Mayor
  terms: MayorTerm[]
  authorities: Authority[]
  years: AuthorityYearly[]
}

// ── Data mapping (same as authority page) ────────────────────────────────────
function toYearMap(rows: AuthorityYearly[]) {
  const m: Record<number, Record<string, number | null>> = {}
  for (const r of rows) {
    m[r.data_year] = {
      זכאות_בגרות: r.b_bagrut_pct, בגרות_סף: r.b_bagrut_uni_pct,
      נשירה: r.b_dropout_pct, תלמידים: r.b_students_per_class,
      חינוך_אחוז: r.b_edu_spend_pct, רווחה_אחוז: r.b_welfare_spend_pct,
      תקציב_לנפש: r.b_budget_per_capita, ארנונה: r.b_arnona_collection_pct,
      עצמיות: r.b_own_revenue_pct, ביצוע: r.b_budget_execution_pct,
      עודף: r.b_surplus_deficit, מאזן: r.b_migration_balance,
      גידול: r.b_population_growth_pct, התחלות: r.b_construction_starts,
      גמר: r.b_construction_completions, מחזור: r.b_recycling_pct,
      פחת: r.b_water_loss_pct, פסולת: r.b_waste_per_capita,
      תוחלת_חיים: r.h_life_expectancy, תואר_ראשון: r.h_ba_degree_pct,
      צעירים: r.h_youth_pct, קשישים: r.h_elderly_pct,
    }
  }
  return m
}

// ── Formatters ───────────────────────────────────────────────────────────────
const f = {
  pct1: (v: number) => v.toFixed(1) + '%',
  pct2: (v: number) => v.toFixed(2) + '%',
  dec1: (v: number) => v.toFixed(1),
  ils:  (v: number) => '₪' + Math.round(v).toLocaleString('he-IL'),
  int:  (v: number) => Math.round(v).toLocaleString('he-IL'),
  sign: (v: number) => (v > 0 ? '+' : '') + Math.round(v).toLocaleString('he-IL'),
  waste:(v: number) => v.toFixed(2) + ' ק"ג',
}
const fmt = (v: number | null | undefined, fn: (n: number) => string) =>
  v != null ? fn(v) : '—'

const COL = { pos: '#2F7152', neg: '#B0432F', neu: '#928C81', accent: '#1E3A5F', brass: '#9A6F25' }

// ── KPI config ───────────────────────────────────────────────────────────────
const KPIS: { k: string; l: string; dir: 1 | -1 | 0; fn: (v: number) => string; lead?: boolean }[] = [
  { k: 'זכאות_בגרות', l: 'זכאות בגרות',   dir:  1, fn: f.pct1 },
  { k: 'נשירה',        l: 'נשירת תלמידים', dir: -1, fn: f.pct2 },
  { k: 'מאזן',         l: 'מאזן הגירה',    dir:  1, fn: f.sign, lead: true },
  { k: 'התחלות',       l: 'התחלות בנייה',  dir:  1, fn: f.int  },
  { k: 'עצמיות',       l: 'הכנסות עצמיות', dir:  1, fn: f.pct1 },
  { k: 'ארנונה',       l: 'גביית ארנונה',  dir:  1, fn: f.pct1 },
  { k: 'תקציב_לנפש',  l: 'תקציב לנפש',    dir:  1, fn: f.ils  },
  { k: 'מחזור',        l: 'מחזור פסולת',   dir:  1, fn: f.pct1 },
]

const ALL: { k: string; l: string; cat: string; dir: 1 | -1 | 0; fn: (v: number) => string }[] = [
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
]

// ── Term ordering ────────────────────────────────────────────────────────────
// A break in service, decided by YEARS rather than by position in TERM_ORDER.
// That array interleaves off-cycle terms (term_2023_special, term_2024_nov …),
// so an ordinary 2018 → 2024 succession sits two slots apart and an index test
// reports a gap that never happened — the page then showed רון חולדאי, who has
// served continuously since 1998, as having stepped away.
// A term continues the previous one when the previous one ran up to its start.
function isBreakInService(prev: MayorTerm | undefined, curr: MayorTerm): boolean {
  if (!prev) return false
  const prevEnd = termSpanYears(prev.term_label)[1]
  if (prevEnd === null) return false            // previous term still running
  return prevEnd < termSpanYears(curr.term_label)[0]
}

const TERM_ORDER = [
  'term_2013', 'term_2018', 'term_2023_special',
  'term_2024_regular', 'term_2024_nov', 'term_2025_feb',
  'term_2025_replacement', 'term_2026_repeat',
]

// ── Per-term data group ──────────────────────────────────────────────────────
interface TermGroup {
  term: MayorTerm
  auth: Authority | undefined
  yearRange: [number, number]
  years: number[]       // years within range that exist in authority_yearly
  withData: number[]    // subset of years that have non-null metric values
}

// Same rule as the authority page: a year earns a place only if it carries at
// least one of the 18 B metrics. Rows exist for 2025-2026 holding nothing but a
// few municipal-data.org dimension fields, and for years before an authority
// was established — both render as a flat empty run that looks like measured
// zero rather than absent data.
const B_COLUMNS = [
  'b_bagrut_pct', 'b_bagrut_uni_pct', 'b_dropout_pct', 'b_students_per_class',
  'b_edu_spend_pct', 'b_welfare_spend_pct', 'b_budget_per_capita',
  'b_arnona_collection_pct', 'b_own_revenue_pct', 'b_budget_execution_pct',
  'b_surplus_deficit', 'b_migration_balance', 'b_population_growth_pct',
  'b_construction_starts', 'b_construction_completions', 'b_recycling_pct',
  'b_water_loss_pct', 'b_waste_per_capita',
] as const

function hasPerformanceData(row: AuthorityYearly): boolean {
  return B_COLUMNS.some(c => (row as unknown as Record<string, unknown>)[c] != null)
}

export default function PersonProfile({ person, terms, authorities, years: allYears }: Props) {
  const years = allYears.filter(hasPerformanceData)
  const authMap = new Map(authorities.map(a => [`${a.symbol}|${a.authority_type}`, a]))
  const authBySymbol = new Map(authorities.map(a => [a.symbol, a]))

  // Sort terms chronologically
  const sortedTerms = [...terms].sort(
    (a, b) => TERM_ORDER.indexOf(a.term_label) - TERM_ORDER.indexOf(b.term_label)
  )

  // Build the full year→metric map from ALL authority_yearly rows
  const D = toYearMap(years)

  // Build per-term groups with properly scoped years
  const termGroups: TermGroup[] = sortedTerms.map(t => {
    const auth = authMap.get(`${t.authority_symbol}|${t.authority_type}`) ?? authBySymbol.get(t.authority_symbol)
    const [lo, hi] = termAttributedYears(t.term_label)
    // Only include years that exist in authority_yearly AND fall in the term's range
    const yrsInRange = years
      .filter(y => y.data_year >= lo && y.data_year <= hi)
      .map(y => y.data_year)
    const uniqueYrs = [...new Set(yrsInRange)].sort((a, b) => a - b)
    const withData = uniqueYrs.filter(y => D[y] && Object.values(D[y]).some(v => v != null))
    return { term: t, auth, yearRange: [lo, hi], years: uniqueYrs, withData }
  })

  // Flatten all person-attributed years (for KPI section)
  const allPersonYears = [...new Set(termGroups.flatMap(g => g.years))].sort((a, b) => a - b)
  const allWithData = [...new Set(termGroups.flatMap(g => g.withData))].sort((a, b) => a - b)

  const defaultYear = allWithData.length > 0 ? allWithData[allWithData.length - 1] : allPersonYears[allPersonYears.length - 1]

  const [curY, setCurY] = useState(defaultYear ?? 2024)
  const [view, setView] = useState<'charts' | 'table'>('charts')

  // Current and primary authority
  const currentTerm = terms.find(t => t.is_current)
  const currentAuth = currentTerm
    ? (authMap.get(`${currentTerm.authority_symbol}|${currentTerm.authority_type}`) ?? authBySymbol.get(currentTerm.authority_symbol))
    : null

  const roleLabel = (() => {
    if (currentTerm && currentAuth) {
      return `ראש ${authorityTypePrefix(currentAuth.authority_type)} ${currentAuth.name_display}`
    }
    const lastTerm = sortedTerms[sortedTerms.length - 1]
    const lastAuth = lastTerm
      ? (authMap.get(`${lastTerm.authority_symbol}|${lastTerm.authority_type}`) ?? authBySymbol.get(lastTerm.authority_symbol))
      : null
    if (lastAuth) {
      return `כיהן/ה כראש ${authorityTypePrefix(lastAuth.authority_type)} ${lastAuth.name_display}`
    }
    return ''
  })()

  const primaryAuth = currentAuth ?? (sortedTerms.length > 0
    ? (authMap.get(`${sortedTerms[sortedTerms.length - 1].authority_symbol}|${sortedTerms[sortedTerms.length - 1].authority_type}`) ?? authBySymbol.get(sortedTerms[sortedTerms.length - 1].authority_symbol))
    : null)

  const initials = (person.name ?? '').split(/\s+/).map(w => w.charAt(0)).slice(0, 2).join('')

  // tenure_start is stored as a year or a dd/mm/yyyy date; take the year.
  const tenureYear = person.tenure_start
    ? parseInt(String(person.tenure_start).match(/(\d{4})/)?.[1] ?? '')
    : null
  // TRUE when they were already serving when mayor_terms begins, so the term
  // count is a floor. Rendered as "לפחות" rather than asserted as a total.
  const tenureIsMin = Boolean(person.tenure_is_minimum)
  const termsLabel = termCountLabel(person.term_count ?? null, tenureIsMin)

  return (
    <>
      <nav className="mm-nav">
        <Link className="nav-back" href={primaryAuth ? `/mayor/${primaryAuth.slug}` : '/'}>
          → לעמוד הרשות
        </Link>
        <div className="mm-logo">
          <span className="mark" />
          Munimark
        </div>
        <div className="nav-links">
          <a href="#">השוואה</a>
          <a href="#">מתודולוגיה</a>
          <a href="#">אודות</a>
        </div>
      </nav>

      <div className="mm-page">

        {/* ── HERO ──────────────────────────────────────────────── */}
        <div className="card hero section">
          {person.photo_url ? (
            <img className="hero-photo" src={person.photo_url} alt={person.name ?? ''} />
          ) : (
            <div className="hero-photo hero-photo-initials">{initials}</div>
          )}

          <div className="hero-main">
            <div className="hero-name">{person.name ?? 'ראש רשות'}</div>
            <div className="hero-city">{roleLabel}</div>
            <div className="hero-meta">
              {/* Tenure belongs to the PERSON, not to the authority: the city
                  page answers how the city is doing, this one answers who has
                  been running it and for how long. */}
              {tenureYear && (
                <div className="mi">
                  <span className="l">כהונה</span>
                  <span className="v ac">
                    {tenureIsMin && !(person.tenure_source ?? '').startsWith('mixed')
                      ? `מ־${tenureYear} לפחות`
                      : `מ־${tenureYear}`}
                  </span>
                </div>
              )}
              {termsLabel && (
                <div className="mi">
                  <span className="l">ותק</span>
                  <span className="v">{termsLabel}</span>
                </div>
              )}
              {person.background && (
                <div className="mi person-bio">
                  <span className="v">{person.background.slice(0, 300)}{person.background.length > 300 ? '...' : ''}</span>
                </div>
              )}
              {person.wikipedia_url && (
                <div className="mi">
                  <a href={person.wikipedia_url} target="_blank" rel="noopener noreferrer" className="person-wiki-link">
                    ויקיפדיה ←
                  </a>
                </div>
              )}
            </div>
          </div>

          {primaryAuth && (
            <div className="hero-municipality">
              <div className="muni-logo">
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>
                  {primaryAuth.name_display.slice(0, 2)}
                </span>
              </div>
              <div className="muni-name">
                {authorityTypePrefix(primaryAuth.authority_type)}
                <br />{primaryAuth.name_display}
              </div>
            </div>
          )}
        </div>

        {/* ── TERM TIMELINE ────────────────────────────────────── */}
        <div className="section">
          <div className="sec-header">
            <div className="sec-title">קדנציות</div>
          </div>
          <div className="term-timeline">
            {sortedTerms.map((t, i) => {
              const auth = authMap.get(`${t.authority_symbol}|${t.authority_type}`) ?? authBySymbol.get(t.authority_symbol)
              const prev = sortedTerms[i - 1]
              const hasGap = isBreakInService(prev, t)
              return (
                <span key={t.id}>
                  {hasGap && <span className="term-gap">···</span>}
                  <span className={`term-badge${t.is_current ? ' term-badge-current' : ''}`}>
                    {/* the years in office, not the data window */}
                    {termSpanLabel(t.term_label)}
                    {auth && <span className="term-auth"> · {auth.name_display}</span>}
                  </span>
                </span>
              )
            })}
          </div>
        </div>

        {/* ── KPIs (all person years combined) ─────────────────── */}
        <div className="section">
          <div className="sec-header">
            <div className="sec-title">
              מדדי מפתח
              <small>נתונים לכל תקופות הכהונה</small>
            </div>
            {allWithData.length > 0 ? (
              <div className="year-sel">
                {allWithData.map(yr => (
                  <button key={yr} className={`yr${yr === curY ? ' active' : ''}`} onClick={() => setCurY(yr)}>
                    {yr}
                  </button>
                ))}
              </div>
            ) : (
              <div className="year-sel-empty">אין נתונים עדיין</div>
            )}
          </div>

          {allWithData.length > 0 ? (
            <div className="kpi-grid">
              {KPIS.map(m => {
                const v = D[curY]?.[m.k]
                const vals = allWithData.map(y => D[y]?.[m.k] ?? null)
                const d = vals[0] != null && v != null ? v - vals[0] : null
                const good = (m.dir === 0 || d === null) ? null : (m.dir === 1 ? d > 0 : d < 0)
                const tCls = good === null ? 'neu' : good ? 'up' : 'down'
                const col = m.lead ? COL.brass : (good === null ? COL.neu : good ? COL.pos : COL.neg)
                const dStr = d === null ? '—' :
                  (d > 0 ? '+' : '') + (Math.abs(d) > 100 ? Math.round(d).toLocaleString('he-IL')
                    : Math.abs(d) > 10 ? Math.round(d) : d.toFixed(2))
                const borderCls = m.lead ? 'kpi-lead' : (good === null ? '' : good ? 'kpi-up' : 'kpi-down')

                return (
                  <div key={m.k} className={`kpi ${borderCls}`}>
                    <div className="kpi-top">
                      <span className="kpi-name">{m.l}</span>
                      {m.lead && <span className="kpi-lead-tag">מוביל</span>}
                    </div>
                    <div className="kpi-val num">{fmt(v, m.fn)}</div>
                    <div className={`kpi-trend ${tCls}`}>
                      {tCls === 'up' ? '▲' : tCls === 'down' ? '▼' : '•'}
                      <span className="num">{dStr}</span>
                      {allWithData[0] && <span className="kpi-since">מאז {allWithData[0]}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="no-data-placeholder">
              <p>נתוני ביצוע יתווספו</p>
            </div>
          )}
        </div>

        {/* ── PERFORMANCE — one section per term ───────────────── */}
        {termGroups.map((g, gi) => {
          const prevGroup = termGroups[gi - 1]
          const hasGap = isBreakInService(prevGroup?.term, g.term)
          const [lo, hi] = g.yearRange
          const rangeLabel = hi >= 2030 ? `${lo}–היום` : `${lo}–${hi}`

          return (
            <div key={g.term.id}>
              {hasGap && <div className="term-section-gap" />}
              <div className="section">
                <div className="sec-header">
                  <div className="sec-title">
                    קדנציה {termSpanLabel(g.term.term_label)}
                    {g.auth && <span className="term-section-auth"> · {g.auth.name_display}</span>}
                    {/* Elections are in October, so a term won in 2013 owns the
                        data from 2014 on. Naming both, and saying which is
                        which, stops the offset looking like a missing year. */}
                    <small>נתונים {rangeLabel} · 18 מדדים</small>
                  </div>
                  {g.withData.length > 0 && (
                    <div className="view-toggle">
                      <button className={`vbtn${view === 'charts' ? ' active' : ''}`} onClick={() => setView('charts')}>גרפים</button>
                      <button className={`vbtn${view === 'table'  ? ' active' : ''}`} onClick={() => setView('table')}>טבלה</button>
                    </div>
                  )}
                </div>

                {g.withData.length > 0 ? (<>
                  {view === 'charts' && (
                    <div className="perf-grid">
                      {ALL.map(m => (
                        <PerformanceChart
                          key={m.k}
                          metricKey={m.k}
                          label={m.l}
                          category={m.cat}
                          years={g.withData}
                          values={g.withData.map(y => D[y]?.[m.k] ?? null)}
                          formatter={m.fn}
                          direction={m.dir}
                        />
                      ))}
                    </div>
                  )}

                  {view === 'table' && (
                    <div className="tbl-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>מדד</th>
                            <th>קטגוריה</th>
                            {g.withData.map(y => <th key={y} className="num">{y}</th>)}
                            <th className="num">שינוי</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ALL.map(m => {
                            const vals = g.withData.map(y => D[y]?.[m.k] ?? null)
                            const first = vals.find(v => v != null)
                            const last = [...vals].reverse().find(v => v != null)
                            const chg = (first != null && last != null) ? last - first : null
                            const good = (m.dir === 0 || chg === null) ? null : (m.dir === 1 ? chg > 0 : chg < 0)
                            const cls = chg === null ? 'neu' : good ? 'up' : 'down'
                            const cs = chg === null ? '—' :
                              (chg > 0 ? '+' : '') + (Math.abs(chg) > 100 ? Math.round(chg).toLocaleString('he-IL')
                                : Math.abs(chg) > 10 ? Math.round(chg) : chg.toFixed(2))
                            return (
                              <tr key={m.k}>
                                <td className="td-metric">{m.l}</td>
                                <td><span className="cat-chip">{m.cat}</span></td>
                                {vals.map((v, i) => (
                                  <td key={i} className="num td-v">{fmt(v, m.fn)}</td>
                                ))}
                                <td className={`num td-cur ${cls}`}>{cs}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>) : (
                  <div className="no-data-placeholder">
                    <p>נתוני ביצוע יתווספו</p>
                  </div>
                )}
              </div>
            </div>
          )
        })}

      </div>

      <footer className="mm-footer">
        המקור: נתוני הלשכה המרכזית לסטטיסטיקה ומשרד הפנים · עיבוד Munimark · הערכים מוצגים לצורכי השוואה ואינם מהווים המלצה. · <Link href="/credits" style={{ color: 'var(--ink-2)', textDecoration: 'underline' }}>קרדיטים ורישיונות</Link>
      </footer>
    </>
  )
}
