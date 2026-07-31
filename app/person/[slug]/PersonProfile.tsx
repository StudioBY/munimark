'use client'

import { useState } from 'react'
import Link from 'next/link'
import PerformanceChart from '@/app/mayor/[slug]/PerformanceChart'
import type { Authority, Mayor, AuthorityYearly, MayorTerm } from '@/types/db'
import { termDisplayLabel, layerYearRange } from '@/lib/getMayorForYear'

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

// ── KPI + ALL metrics (same as authority page) ───────────────────────────────
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

// ── Term ordering for timeline ───────────────────────────────────────────────
const TERM_ORDER = [
  'term_2013', 'term_2018', 'term_2023_special',
  'term_2024_regular', 'term_2024_nov', 'term_2025_feb',
  'term_2025_replacement', 'term_2026_repeat',
]

function termYearRange(label: string): [number, number] {
  if (label === 'term_2013') return [2013, 2018]
  if (label === 'term_2018') return [2019, 2023]
  if (label === 'term_2023_special') return [2023, 2025]
  if (label === 'term_2024_regular') return [2024, 2025]
  if (label === 'term_2024_nov') return [2024, 2025]
  if (label === 'term_2025_feb') return [2025, 2025]
  if (label === 'term_2025_replacement') return [2025, 2025]
  if (label === 'term_2026_repeat') return [2026, 2030]
  return [2024, 2030]
}

export default function PersonProfile({ person, terms, authorities, years }: Props) {
  const authMap = new Map(authorities.map(a => [a.symbol, a]))

  // Sort terms chronologically
  const sortedTerms = [...terms].sort(
    (a, b) => TERM_ORDER.indexOf(a.term_label) - TERM_ORDER.indexOf(b.term_label)
  )

  // Compute the union of year ranges for this person's terms
  const personYearSet = new Set<number>()
  for (const t of sortedTerms) {
    const [lo, hi] = termYearRange(t.term_label)
    for (let y = lo; y <= hi; y++) personYearSet.add(y)
  }

  // Filter authority_yearly to only their years
  const sortedYears = years
    .filter(y => personYearSet.has(y.data_year))
    .sort((a, b) => a.data_year - b.data_year)
  const D = toYearMap(sortedYears)
  const YRS = sortedYears.map(y => y.data_year)
  // Deduplicate (may have same year from multiple authority sources)
  const uniqueYRS = [...new Set(YRS)].sort((a, b) => a - b)

  const withData = uniqueYRS.filter(y => D[y] && Object.values(D[y]).some(v => v != null))
  const defaultYear = withData.length > 0 ? withData[withData.length - 1] : uniqueYRS[uniqueYRS.length - 1]

  const [curY, setCurY] = useState(defaultYear ?? 2024)
  const [view, setView] = useState<'charts' | 'table'>('charts')

  // Is currently serving?
  const currentTerm = terms.find(t => t.is_current)
  const currentAuth = currentTerm ? authMap.get(currentTerm.authority_symbol) : null

  // Role label
  const roleLabel = (() => {
    if (currentTerm && currentAuth) {
      const typeLabel = currentAuth.authority_type === 'עירייה' ? 'עיריית'
        : currentAuth.authority_type === 'מועצה מקומית' ? 'מ. מקומית'
        : 'מ. אזורית'
      return `ראש ${typeLabel} ${currentAuth.name_display}`
    }
    // Past mayor
    const lastTerm = sortedTerms[sortedTerms.length - 1]
    const lastAuth = lastTerm ? authMap.get(lastTerm.authority_symbol) : null
    if (lastAuth) {
      const typeLabel = lastAuth.authority_type === 'עירייה' ? 'עיריית'
        : lastAuth.authority_type === 'מועצה מקומית' ? 'מ. מקומית'
        : 'מ. אזורית'
      return `כיהן/ה כראש ${typeLabel} ${lastAuth.name_display}`
    }
    return ''
  })()

  // Primary authority for "back to authority page" link
  const primaryAuth = currentAuth ?? (sortedTerms.length > 0 ? authMap.get(sortedTerms[sortedTerms.length - 1]?.authority_symbol) : null)

  // Initials for placeholder
  const initials = (person.name ?? '').split(/\s+/).map(w => w.charAt(0)).slice(0, 2).join('')

  const firstYr = uniqueYRS[0]
  const lastYr = uniqueYRS[uniqueYRS.length - 1]

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

          {/* Authority logo area */}
          {primaryAuth && (
            <div className="hero-municipality">
              <div className="muni-logo">
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>
                  {primaryAuth.name_display.slice(0, 2)}
                </span>
              </div>
              <div className="muni-name">
                {primaryAuth.authority_type === 'עירייה' ? 'עיריית' :
                 primaryAuth.authority_type === 'מועצה מקומית' ? 'מ. מקומית' : 'מ. אזורית'}
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
              const auth = authMap.get(t.authority_symbol)
              const prev = sortedTerms[i - 1]
              const hasGap = prev && TERM_ORDER.indexOf(t.term_label) - TERM_ORDER.indexOf(prev.term_label) > 1
              return (
                <span key={t.id}>
                  {hasGap && <span className="term-gap">···</span>}
                  <span className={`term-badge${t.is_current ? ' term-badge-current' : ''}`}>
                    {termDisplayLabel(t.term_label)}
                    {auth && <span className="term-auth"> · {auth.name_display}</span>}
                  </span>
                </span>
              )
            })}
          </div>
        </div>

        {/* ── KPIs ──────────────────────────────────────────────── */}
        <div className="section">
          <div className="sec-header">
            <div className="sec-title">
              מדדי מפתח
              <small>נתונים לכל תקופת הכהונה</small>
            </div>
            {withData.length > 0 ? (
              <div className="year-sel">
                {withData.map(yr => (
                  <button key={yr} className={`yr${yr === curY ? ' active' : ''}`} onClick={() => setCurY(yr)}>
                    {yr}
                  </button>
                ))}
              </div>
            ) : (
              <div className="year-sel-empty">אין נתונים עדיין</div>
            )}
          </div>

          {withData.length > 0 ? (
            <div className="kpi-grid">
              {KPIS.map(m => {
                const v = D[curY]?.[m.k]
                const vals = withData.map(y => D[y]?.[m.k] ?? null)
                const d = vals[0] != null && v != null ? v - vals[0] : null
                const good = (m.dir === 0 || d === null) ? null : (m.dir === 1 ? d > 0 : d < 0)
                const tCls = good === null ? 'neu' : good ? 'up' : 'down'
                const col = m.lead ? COL.brass : (good === null ? COL.neu : good ? COL.pos : COL.neg)
                const dStr = d === null ? '—' :
                  (d > 0 ? '+' : '') + (Math.abs(d) > 100 ? Math.round(d).toLocaleString('he-IL')
                    : Math.abs(d) > 10 ? Math.round(d) : d.toFixed(2))
                const borderCls = m.lead ? 'kpi-lead' : (good === null ? '' : good ? 'kpi-up' : 'kpi-down')
                const hiIdx = withData.indexOf(curY)

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
                      {firstYr && <span className="kpi-since">מאז {firstYr}</span>}
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

        {/* ── PERFORMANCE ───────────────────────────────────────── */}
        <div className="section">
          {withData.length > 0 ? (<>
            <div className="sec-header">
              <div className="sec-title">
                ביצועים לאורך הקדנציה
                <small>סדרות שנתיות {firstYr}–{lastYr} · 18 מדדים</small>
              </div>
              <div className="view-toggle">
                <button className={`vbtn${view === 'charts' ? ' active' : ''}`} onClick={() => setView('charts')}>גרפים</button>
                <button className={`vbtn${view === 'table'  ? ' active' : ''}`} onClick={() => setView('table')}>טבלה</button>
              </div>
            </div>

            {view === 'charts' && (
              <div className="perf-grid">
                {ALL.map(m => (
                  <PerformanceChart
                    key={m.k}
                    metricKey={m.k}
                    label={m.l}
                    category={m.cat}
                    years={withData}
                    values={withData.map(y => D[y]?.[m.k] ?? null)}
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
                      {withData.map(y => <th key={y} className="num">{y}</th>)}
                      <th className="num">שינוי</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ALL.map(m => {
                      const vals = withData.map(y => D[y]?.[m.k] ?? null)
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

      <footer className="mm-footer">
        המקור: נתוני הלשכה המרכזית לסטטיסטיקה ומשרד הפנים · עיבוד Munimark · הערכים מוצגים לצורכי השוואה ואינם מהווים המלצה.
      </footer>
    </>
  )
}
