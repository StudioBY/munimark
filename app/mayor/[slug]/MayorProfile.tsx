'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import PerformanceChart from './PerformanceChart'
import type { Authority, Mayor, AuthorityYearly, Score, MayorTerm } from '@/types/db'
import { getMayorForYear, termDisplayLabel, layerYearRange, layerRepresentativeYear } from '@/lib/getMayorForYear'
import type { MayorForYear } from '@/lib/getMayorForYear'

type Layer = '2013' | '2018' | '2024'

interface Props {
  authority: Authority
  mayor: Mayor | null
  years: AuthorityYearly[]
  latestYear: AuthorityYearly
  score: Score | null
  mayorTerms: MayorTerm[]
}

// ── Colours ───────────────────────────────────────────────────────────────────
const COL = { pos: '#2F7152', neg: '#B0432F', neu: '#928C81', accent: '#1E3A5F', brass: '#9A6F25' }

// ── Data mapping (DB column → display key) ────────────────────────────────────
function toYearMap(rows: AuthorityYearly[]) {
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

// ── Formatters ────────────────────────────────────────────────────────────────
const f = {
  pct1:  (v: number) => v.toFixed(1) + '%',
  pct2:  (v: number) => v.toFixed(2) + '%',
  dec1:  (v: number) => v.toFixed(1),
  dec2:  (v: number) => v.toFixed(2),
  ils:   (v: number) => '₪' + Math.round(v).toLocaleString('he-IL'),
  int:   (v: number) => Math.round(v).toLocaleString('he-IL'),
  sign:  (v: number) => (v > 0 ? '+' : '') + Math.round(v).toLocaleString('he-IL'),
  waste: (v: number) => v.toFixed(2) + ' ק"ג',
}

const fmt = (v: number | null | undefined, fn: (n: number) => string) =>
  v != null ? fn(v) : '—'

// ── KPI config ────────────────────────────────────────────────────────────────
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

// ── ALL 22 metrics (18 performance + 4 demographics) ─────────────────────────
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
  // Demographics (4 new) — H-class fields, shown but not scored
  { k: 'תוחלת_חיים',   l: 'תוחלת חיים',           cat: 'דמוגרפיה', dir:  1, fn: f.dec1 },
  { k: 'תואר_ראשון',   l: 'תואר ראשון+',           cat: 'דמוגרפיה', dir:  1, fn: f.pct1 },
  { k: 'צעירים',        l: 'צעירים 0–17',            cat: 'דמוגרפיה', dir:  0, fn: f.pct1 },
  { k: 'קשישים',        l: 'קשישים 65+',             cat: 'דמוגרפיה', dir:  0, fn: f.pct1 },
]

// ── Sparkline SVG ─────────────────────────────────────────────────────────────
function SparkSVG({ vals, color, highlightIdx }: { vals: (number|null)[], color: string, highlightIdx: number }) {
  const W = 100, H = 30, pad = 4
  const clean = vals.map((v, i) => [i, v] as [number, number|null]).filter(p => p[1] != null) as [number, number][]
  if (clean.length < 2) return null

  const ys = clean.map(p => p[1])
  const min = Math.min(...ys), max = Math.max(...ys), range = (max - min) || 1
  const stepX = W / (vals.length - 1)
  const X = (i: number) => i * stepX
  const Y = (v: number) => H - pad - ((v - min) / range) * (H - 2 * pad)
  const pts = clean.map(([i, v]) => [X(i), Y(v)] as [number, number])
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ')
  const area = d + ` L ${pts[pts.length-1][0].toFixed(1)} ${H} L ${pts[0][0].toFixed(1)} ${H} Z`

  const hv = vals[highlightIdx]
  const hl = hv != null
    ? `<circle cx="${X(highlightIdx).toFixed(1)}" cy="${Y(hv).toFixed(1)}" r="3.2" fill="${color}" stroke="#fff" stroke-width="1.5"/>`
    : ''
  const lastIdx = clean[clean.length - 1][0]
  const endMark = lastIdx !== highlightIdx && vals[lastIdx] != null
    ? `<circle cx="${X(lastIdx).toFixed(1)}" cy="${Y(vals[lastIdx]!).toFixed(1)}" r="1.8" fill="${color}"/>`
    : ''

  return (
    <div className="kpi-spark">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
        dangerouslySetInnerHTML={{ __html:
          `<path d="${area}" fill="${color}" opacity="0.07"/>` +
          `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>` +
          endMark + hl
        }}
      />
    </div>
  )
}

// ── Rank Ring ─────────────────────────────────────────────────────────────────
function RankRing({ pct, color, pending, children }: {
  pct: number, color: string, pending?: boolean, children: React.ReactNode
}) {
  const arcRef = useRef<SVGCircleElement>(null)
  const size = 64, sw = 5, r = (size - sw) / 2, circ = 2 * Math.PI * r
  const target = circ * (1 - pct / 100)

  useEffect(() => {
    if (pending || !arcRef.current) return
    const el = arcRef.current
    el.style.strokeDashoffset = String(circ)
    const dur = 950
    let start: number | null = null
    const step = (ts: number) => {
      if (!start) start = ts
      const p = Math.min((ts - start) / dur, 1)
      const e = 1 - Math.pow(1 - p, 3)
      el.style.strokeDashoffset = String(circ - (circ - target) * e)
      if (p < 1) requestAnimationFrame(step)
    }
    const raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [pct, circ, target, pending])

  return (
    <div className="rank-ring">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {pending ? (
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--line)" strokeWidth={sw} strokeDasharray="3 5"/>
        ) : (
          <>
            <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--line-2)" strokeWidth={sw}/>
            <circle ref={arcRef} cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={sw}
              strokeDasharray={circ} strokeDashoffset={circ} strokeLinecap="round"
              transform={`rotate(-90 ${size/2} ${size/2})`}
            />
          </>
        )}
      </svg>
      <div className="rank-ring-center">{children}</div>
    </div>
  )
}

// ── Hero score ring ───────────────────────────────────────────────────────────
function HeroRing({ score, maxScore }: { score: number | null, maxScore: number | null }) {
  const arcRef = useRef<SVGCircleElement>(null)
  const size = 96, sw = 6, r = (size - sw) / 2, circ = 2 * Math.PI * r
  const pct = (score != null && maxScore) ? score / maxScore : 0
  const target = circ * (1 - pct)
  const hasScore = score != null && maxScore != null

  useEffect(() => {
    if (!hasScore || !arcRef.current) return
    const el = arcRef.current
    el.style.strokeDashoffset = String(circ)
    const dur = 1100
    let start: number | null = null
    const step = (ts: number) => {
      if (!start) start = ts
      const p = Math.min((ts - start) / dur, 1)
      const e = 1 - Math.pow(1 - p, 3)
      el.style.strokeDashoffset = String(circ - (circ - target) * e)
      if (p < 1) requestAnimationFrame(step)
    }
    const raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [circ, target, hasScore])

  return (
    <div className="ring-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {!hasScore ? (
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--line)" strokeWidth={sw} strokeDasharray="3 5"/>
        ) : (
          <>
            <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--line)" strokeWidth={sw} strokeDasharray="3 5"/>
            <circle ref={arcRef} cx={size/2} cy={size/2} r={r} fill="none" stroke={COL.accent} strokeWidth={sw}
              strokeDasharray={String(circ)} strokeDashoffset={String(circ)} strokeLinecap="round"
              transform={`rotate(-90 ${size/2} ${size/2})`}
            />
          </>
        )}
      </svg>
      <div className="ring-center">
        <div className="ring-num num">{hasScore ? score : '—'}</div>
        <div className="ring-sub">ציון כולל</div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MayorProfile({ authority, mayor, years, latestYear, score, mayorTerms }: Props) {
  const sortedYears = [...years].sort((a, b) => a.data_year - b.data_year)
  const allYRS = sortedYears.map(y => y.data_year)
  const D = toYearMap(sortedYears)

  // ── Layer state (term selector) ──
  const [layer, setLayer] = useState<Layer>('2024')
  const [range] = [layerYearRange(layer)]
  const YRS = allYRS.filter(y => y >= range[0] && y <= range[1])
  const firstYr = YRS[0] ?? allYRS[0]
  const lastYr  = YRS[YRS.length - 1] ?? allYRS[allYRS.length - 1]

  const [curY, setCurY]  = useState(lastYr)
  const [view, setView]  = useState<'charts'|'table'>('charts')

  // Reset curY when layer changes — pick latest year with actual data
  useEffect(() => {
    const newYRS = allYRS.filter(y => y >= range[0] && y <= range[1])
    // Find latest year that has at least one non-null B-field value
    const withData = newYRS.filter(y => {
      const row = D[y]
      if (!row) return false
      return Object.values(row).some(v => v != null)
    })
    if (withData.length > 0) {
      setCurY(withData[withData.length - 1])
    } else if (newYRS.length > 0) {
      setCurY(newYRS[newYRS.length - 1])
    }
  }, [layer])

  // ── Term-aware mayor resolution ──
  const hasTerms = mayorTerms.length > 0
  const repYear = layerRepresentativeYear(layer)
  const termMayor: MayorForYear | null = hasTerms
    ? getMayorForYear(mayorTerms, repYear)
    : null

  // Displayed mayor: prefer term data, fall back to old 1:1 only for current term
  const displayName = termMayor?.full_name ?? mayor?.name ?? 'פרטי ראש הרשות בקרוב'
  const isCurrentTerm = termMayor?.term_label
    ? mayorTerms.some(t => t.term_label === termMayor.term_label && t.is_current)
    : false
  // Only fall back to old 1:1 photo when viewing the current term (identity match)
  const displayPhoto = termMayor?.person?.photo_url
    ?? (isCurrentTerm ? mayor?.photo_url : null)
    ?? null
  const displayElectionPct = termMayor?.election_pct ?? (isCurrentTerm ? mayor?.election_pct : null) ?? null
  const displayTermBadge = termMayor ? termDisplayLabel(termMayor.term_label) : null
  // Initials from the displayed mayor's name (for placeholder avatar)
  const mayorInitials = displayName.split(/\s+/).map(w => w.charAt(0)).slice(0, 2).join('')

  const tenureYear = mayor?.tenure_start
    ? parseInt(mayor.tenure_start.split('/').pop() ?? '')
    : null

  // Ribbon calculations
  const migFirst = D[firstYr]?.['מאזן']
  const migLast  = D[lastYr]?.['מאזן']
  const bagFirst = D[firstYr]?.['זכאות_בגרות']
  const bagLast  = D[lastYr]?.['זכאות_בגרות']
  const budFirst = D[firstYr]?.['תקציב_לנפש']
  const budLast  = D[lastYr]?.['תקציב_לנפש']
  const budChgPct = (budFirst && budLast)
    ? ((budLast - budFirst) / budFirst * 100).toFixed(1) + '%'
    : '—'
  const bagDelta  = (bagFirst != null && bagLast != null)
    ? (bagLast - bagFirst > 0 ? '+' : '') + (bagLast - bagFirst).toFixed(2) + ' נק׳ אחוז'
    : '—'

  // City initials for logo placeholder
  const initials = authority.name_display.slice(0, 2)

  return (
    <>
      {/* NAV */}
      <nav className="mm-nav">
        <Link className="nav-back" href="/">→ כל הרשויות</Link>
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
          {/* Photo */}
          {displayPhoto ? (
            <img
              className="hero-photo"
              src={displayPhoto}
              alt={displayName}
              onError={(e) => { (e.target as HTMLImageElement).style.background = '#E5E1D8' }}
            />
          ) : (
            <div className="hero-photo hero-photo-initials">
              {mayorInitials}
            </div>
          )}

          {/* Name + meta */}
          <div className="hero-main">
            <div className="hero-name">
              {displayName}
              {displayTermBadge && (
                <span className="term-badge">{displayTermBadge}</span>
              )}
            </div>
            <div className="hero-city">ראש {authority.authority_type === 'עירייה' ? 'העירייה' : 'הרשות'}</div>
            <div className="hero-meta">
              {tenureYear && (
                <div className="mi">
                  <span className="l">כהונה</span>
                  <span className="v ac">מ־{tenureYear}</span>
                </div>
              )}
              {latestYear.h_socio_cluster && (
                <div className="mi">
                  <span className="l">אשכול חברתי־כלכלי</span>
                  <span className="v">{latestYear.h_socio_cluster} / 10</span>
                </div>
              )}
              {latestYear.h_population && (
                <div className="mi">
                  <span className="l">תושבים ({lastYr})</span>
                  <span className="v num">{Math.round(latestYear.h_population).toLocaleString('he-IL')}</span>
                </div>
              )}
              {latestYear.h_district && (
                <div className="mi">
                  <span className="l">מחוז</span>
                  <span className="v">{latestYear.h_district}</span>
                </div>
              )}
              {displayElectionPct && (
                <div className="mi">
                  <span className="l">בבחירות האחרונות</span>
                  <span className="v num">{displayElectionPct}</span>
                </div>
              )}
            </div>
          </div>

          {/* Municipality */}
          <div className="hero-municipality">
            <div className="muni-logo">
              <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent)' }}>{initials}</span>
            </div>
            <div className="muni-name">
              {authority.authority_type === 'עירייה' ? 'עיריית' :
               authority.authority_type === 'מועצה מקומית' ? 'מ. מקומית' : 'מ. אזורית'}
              <br />{authority.name_display}
            </div>
          </div>

          {/* Score ring */}
          <div className="hero-score">
            <HeroRing score={score?.score ?? null} maxScore={score?.max_score ?? null} />
            <div className="hero-score-label">{score ? `ציון ${score.data_year}` : 'טרם חושב'}</div>
            <div className="hero-score-note">
              {score
                ? `${score.score}/${score.max_score} מדדים`
                : 'יעודכן עם\nהרחבת המאגר'}
            </div>
          </div>
        </div>

        {/* ── RANKINGS ──────────────────────────────────────────── */}
        <div className="rank-grid section">

          {/* Comparison group card */}
          <div className="card rank-card">
            <RankRing pct={score ? 80 : 0} color={COL.accent} pending={!score}>
              <div className="rank-num" style={{ color: COL.accent }}>
                {score ? '1' : '—'}
              </div>
              <div className="rank-of">
                {score ? `מתוך ${score.group_size ?? '—'}` : 'ממתין'}
              </div>
            </RankRing>
            <div>
              <div className="eyebrow rank-title">קבוצת השוואה</div>
              <div className="rank-desc">
                {authority.authority_type ?? latestYear.h_authority_type} · אשכול {latestYear.h_socio_cluster}
              </div>
              <div className="rank-meta">
                {score?.comparison_group ?? 'טרם חושב'}
              </div>
              <span className={`rank-flag ${score ? 'good' : 'mid'}`}>
                <span className="dot" />
                {score ? 'ציון חושב' : 'ממתין להשלמת הנתונים'}
              </span>
            </div>
          </div>

          {/* Cluster card */}
          <div className="card rank-card">
            <RankRing pct={0} color={COL.neu} pending>
              <div className="rank-num" style={{ color: 'var(--ink-3)' }}>—</div>
              <div className="rank-of">מתוך ?</div>
            </RankRing>
            <div>
              <div className="eyebrow rank-title">דירוג באשכול {latestYear.h_socio_cluster}</div>
              <div className="rank-desc">כל גדלי הרשויות</div>
              <div className="rank-meta">255 רשויות בישראל</div>
              <span className="rank-flag mid"><span className="dot" />ממתין להרחבת המאגר</span>
            </div>
          </div>

          {/* National card */}
          <div className="card rank-card">
            <RankRing pct={0} color={COL.neu} pending>
              <div className="rank-num" style={{ color: 'var(--ink-3)' }}>—</div>
              <div className="rank-of">מתוך 82</div>
            </RankRing>
            <div>
              <div className="eyebrow rank-title">דירוג ארצי</div>
              <div className="rank-desc">בין כל העיריות</div>
              <div className="rank-meta">82 עיריות בישראל</div>
              <span className="rank-flag mid"><span className="dot" />ממתין להשלמת הנתונים</span>
            </div>
          </div>

        </div>

        {/* ── Layer selector (term switcher) ─────────────────── */}
        <div className="section">
          <div className="sec-header">
            <div className="sec-title">
              קדנציה
              <small>בחר קדנציה להצגת ראש הרשות ומדדי הביצוע בתקופה</small>
            </div>
            <div className="layer-sel">
              {(['2024', '2018', '2013'] as Layer[]).map(l => (
                <button key={l} className={`layer-btn${l === layer ? ' active' : ''}`} onClick={() => setLayer(l)}>
                  {l === '2024' ? 'קדנציה נוכחית' : `קדנציית ${l}`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── KPIs ──────────────────────────────────────────────── */}
        <div className="section">
          <div className="sec-header">
            <div className="sec-title">
              מדדי מפתח
              <small>בחר שנה להצגת הערך — המגמה מוצגת לכל הקדנציה</small>
            </div>
            {YRS.length > 0 ? (
              <div className="year-sel">
                {YRS.map(yr => (
                  <button key={yr} className={`yr${yr === curY ? ' active' : ''}`} onClick={() => setCurY(yr)}>
                    {yr}
                  </button>
                ))}
              </div>
            ) : (
              <div className="year-sel-empty">אין נתונים לקדנציה זו</div>
            )}
          </div>
          {YRS.length > 0 ? (
            <div className="kpi-grid">
              {KPIS.map(m => {
                const v    = D[curY]?.[m.k]
                const vals = YRS.map(y => D[y]?.[m.k] ?? null)
                const d    = vals[0] != null && v != null ? v - vals[0] : null
                const good = (m.dir === 0 || d === null) ? null : (m.dir === 1 ? d > 0 : d < 0)
                const tCls = good === null ? 'neu' : good ? 'up' : 'down'
                const col  = m.lead ? COL.brass : (good === null ? COL.neu : good ? COL.pos : COL.neg)
                const dStr = d === null ? '—' :
                  (d > 0 ? '+' : '') + (Math.abs(d) > 100 ? Math.round(d).toLocaleString('he-IL')
                    : Math.abs(d) > 10 ? Math.round(d) : d.toFixed(2))
                const borderCls = m.lead ? 'kpi-lead' : (good === null ? '' : good ? 'kpi-up' : 'kpi-down')
                const hiIdx = YRS.indexOf(curY)

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
                      <span className="kpi-since">מאז {firstYr}</span>
                    </div>
                    <SparkSVG vals={vals} color={col} highlightIdx={hiIdx} />
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
          {YRS.length > 0 ? (<>
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

          {/* Ribbon */}
          <div className="ribbon">
            <div className="ri">
              <span className="l">מאזן הגירה</span>
              <span className="v num">
                {migFirst != null && <span className="from">{migFirst > 0 ? '+' : ''}{Math.round(migFirst).toLocaleString('he-IL')}</span>}
                {migFirst != null && migLast != null && <span className="arr">→</span>}
                {migLast != null && (migLast > 0 ? '+' : '') + Math.round(migLast).toLocaleString('he-IL')}
              </span>
            </div>
            <div className="ri">
              <span className="l">זכאות בגרות</span>
              <span className="v num">
                {bagDelta}
              </span>
            </div>
            <div className="ri">
              <span className="l">תקציב לנפש</span>
              <span className="v num">{budChgPct !== '—' ? (Number(budChgPct.replace('%','')) > 0 ? '+' : '') + budChgPct : '—'}</span>
            </div>
          </div>


          {/* Charts view */}
          {view === 'charts' && (
            <div className="perf-grid">
              {ALL.map(m => (
                <PerformanceChart
                  key={m.k}
                  metricKey={m.k}
                  label={m.l}
                  category={m.cat}
                  years={YRS}
                  values={YRS.map(y => D[y]?.[m.k] ?? null)}
                  formatter={m.fn}
                  direction={m.dir}
                />
              ))}
            </div>
          )}

          {/* Table view */}
          {view === 'table' && (
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr>
                    <th>מדד</th>
                    <th>קטגוריה</th>
                    {YRS.map(y => <th key={y} className="num">{y}</th>)}
                    <th className="num">שינוי</th>
                  </tr>
                </thead>
                <tbody>
                  {ALL.map(m => {
                    const vals = YRS.map(y => D[y]?.[m.k] ?? null)
                    const first = vals.find(v => v != null)
                    const last  = [...vals].reverse().find(v => v != null)
                    const chg   = (first != null && last != null) ? last - first : null
                    const good  = (m.dir === 0 || chg === null) ? null : (m.dir === 1 ? chg > 0 : chg < 0)
                    const cls   = chg === null ? 'neu' : good ? 'up' : 'down'
                    const cs    = chg === null ? '—' :
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

        {/* ── CONTEXT ───────────────────────────────────────────── */}
        <div className="section">
          <div className="sec-title" style={{ marginBottom: 14 }}>נתוני הקשר</div>
          <div className="card">
            <div className="ctx">
              <div className="ctx-i">
                <span className="ctx-l">סוג רשות</span>
                <span className="ctx-v">{latestYear.h_authority_type ?? '—'}</span>
              </div>
              <div className="ctx-i">
                <span className="ctx-l">מחוז</span>
                <span className="ctx-v">{latestYear.h_district ?? '—'}</span>
              </div>
              <div className="ctx-i">
                <span className="ctx-l">אוכלוסייה {lastYr}</span>
                <span className="ctx-v num">
                  {latestYear.h_population
                    ? Math.round(latestYear.h_population).toLocaleString('he-IL')
                    : '—'}
                </span>
              </div>
              <div className="ctx-i">
                <span className="ctx-l">אשכול</span>
                <span className="ctx-v num">
                  {latestYear.h_socio_cluster ?? '—'} <small>/ 10</small>
                </span>
              </div>
              <div className="ctx-i">
                <span className="ctx-l">פריפריאליות</span>
                <span className="ctx-v num">
                  {latestYear.h_periphery ?? '—'} <small>/ 10</small>
                </span>
              </div>
              <div className="ctx-i">
                <span className="ctx-l">תוחלת חיים</span>
                <span className="ctx-v num">
                  {latestYear.h_life_expectancy?.toFixed(1) ?? '—'}
                </span>
              </div>
              <div className="ctx-i">
                <span className="ctx-l">תואר ראשון+</span>
                <span className="ctx-v num">
                  {latestYear.h_ba_degree_pct?.toFixed(1) != null
                    ? latestYear.h_ba_degree_pct!.toFixed(1) + '%' : '—'}
                </span>
              </div>
              <div className="ctx-i">
                <span className="ctx-l">צעירים 0–17</span>
                <span className="ctx-v num">
                  {latestYear.h_youth_pct?.toFixed(1) != null
                    ? latestYear.h_youth_pct!.toFixed(1) + '%' : '—'}
                </span>
              </div>
              <div className="ctx-i">
                <span className="ctx-l">קשישים 65+</span>
                <span className="ctx-v num">
                  {latestYear.h_elderly_pct?.toFixed(1) != null
                    ? latestYear.h_elderly_pct!.toFixed(1) + '%' : '—'}
                </span>
              </div>
              <div className="ctx-i">
                <span className="ctx-l">חברי מועצה</span>
                <span className="ctx-v num">{latestYear.h_council_members ?? '—'}</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      <footer className="mm-footer">
        המקור: נתוני הלשכה המרכזית לסטטיסטיקה ומשרד הפנים · עיבוד Munimark · הערכים מוצגים לצורכי השוואה ואינם מהווים המלצה. הציון הכולל יחושב עם הרחבת מאגר הרשויות.
      </footer>
    </>
  )
}
