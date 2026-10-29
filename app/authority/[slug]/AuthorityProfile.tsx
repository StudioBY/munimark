'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { AuthorityPageData } from '@/lib/loadAuthority'
import type { Band } from '@/lib/score'
import { DEFAULT_SCOPE_NOTE, DOMAIN_LABELS, DOMAIN_ORDER, bandCuts, domainYearPoints, letterFor, metricBreakdown, parseGroup, metricSeries, termGrade, termSummary } from '@/lib/score'
import type { TermGrade } from '@/lib/score'
import { authorityTerms, termForYear } from '@/lib/terms'
import type { AuthorityTerm } from '@/lib/terms'
import { authorityFullName } from '@/lib/seo'
import { AUTHORITY_LOGOS } from '@/lib/logos'
import { ALL, hasPerformanceData, latestValue, toYearMap } from '@/lib/authorityMetrics'
import { threeYearSpan } from '@/app/mayor/[slug]/ScoreSection'
import PerformanceChart from '@/app/mayor/[slug]/PerformanceChart'
import { MunimarkMark, Seal } from './Brand'
import MetricTrend from './MetricTrend'
import { Letter, LetterBreakdown } from './LetterBreakdown'

// Shown for context under the index metrics, never scored: spending is not
// performance, and demographics are what an authority works with.
const BACKGROUND = ['תקציב_לנפש', 'חינוך_אחוז', 'רווחה_אחוז', 'תואר_ראשון', 'תוחלת_חיים', 'צעירים', 'קשישים']

const BAND_WORD: Record<Band, string> = {
  A: 'ביצועים גבוהים בקבוצת ההשוואה',
  B: 'מעל האמצע בקבוצת ההשוואה',
  C: 'מתחת לאמצע בקבוצת ההשוואה',
  D: 'ביצועים נמוכים בקבוצת ההשוואה',
}

// v2 points run 1-4, so two decimals carry what one did on the 0-100 scale.
const n2 = (v: number | null | undefined) => (v == null ? '—' : Number(v).toFixed(2))
const signed = (v: number) => (v > 0 ? '+' : '') + v.toFixed(2)
// Height on the 1-4 points scale, as a share of the bar area.
const h = (p: number) => Math.max(0, Math.min(1, (p - 1) / 3))
// "2024–" reads backwards in RTL; an open term says when it began instead.
const spanText = (span: string) => (span.endsWith('\u2013') ? `מ־${span.slice(0, -1)}` : span)
const initials = (name: string) => name.split(/\s+/).map(w => w.charAt(0)).slice(0, 2).join('')
const groupPlural = (type: string) =>
  type === 'עירייה' ? 'עיריות' : type === 'מועצה מקומית' ? 'מועצות מקומיות' : 'מועצות אזוריות'
const headTitle = (type: string | null) =>
  type === 'עירייה' ? 'ראש העירייה' : type === 'מועצה מקומית' ? 'ראש המועצה המקומית' : 'ראש המועצה האזורית'

function Avatar({ t, size }: { t: AuthorityTerm; size: number }) {
  return t.photo
    ? <img className="tx-avatar" src={t.photo} alt={t.name} style={{ width: size, height: size }} />
    : <span className="tx-avatar tx-avatar-i" style={{ width: size, height: size, fontSize: size * 0.36 }}>{initials(t.name)}</span>
}

export default function AuthorityProfile({ authority, years, scores, anchors, cfg, mayorTerms }: AuthorityPageData) {
  const born = authority.established_year ?? null
  const dataYears = years
    .filter(y => born == null || y.data_year >= born)
    .filter(hasPerformanceData)
  const D = toYearMap(dataYears)
  // The hero carries the full official name: מודיעין-מכבים-רעות, not מודיעין.
  // Of the display and CBS names, the longer one is the full one (4 differ).
  const norm = (x: string) => x.replace(/\s*-\s*/g, '-').trim()
  const official = [authority.name_display, authority.name_cbs ?? ''].map(norm).sort((a, b) => b.length - a.length)[0]
  const fullName = authorityFullName(authority.authority_type, official)
  const logo = AUTHORITY_LOGOS[authority.slug] ?? null

  const terms = authorityTerms(mayorTerms)
  const current = terms.find(t => t.isCurrent) ?? null
  const latest = scores.length ? scores[scores.length - 1] : null
  const grp = latest ? parseGroup(latest.comparison_group) : null
  const pointsOf = (x: { points?: number | null }) => (x.points == null ? null : Number(x.points))
  const cuts = cfg ? bandCuts(cfg) : null

  // Yearly domain points, from each year's metric letters (they reproduce the
  // stored points). Term letters average them; the seal reads one year.
  const domPts: Record<number, Record<string, number | null>> = {}
  if (cfg) for (const s of scores) {
    domPts[s.data_year] = domainYearPoints(metricBreakdown(dataYears.find(y => y.data_year === s.data_year), s.comparison_group, anchors, cfg.domains, cfg.metric_cuts))
  }
  const gradeOf = (w: [number, number]): TermGrade | null => (cfg ? termGrade(w, scores, domPts, cfg) : null)

  // The seal is the newest data year's letter (decided 2026-10-29), the five
  // years up to it beside it. The "+" for an A streak belongs to the head's
  // page, not the authority's: it is not shown here.
  const scoredSpan = scores.filter(s => s.points != null).map(s => s.data_year)
  const everyYear = scoredSpan.length ? gradeOf([scoredSpan[0], scoredSpan[scoredSpan.length - 1]])?.years.filter(y => y.letter) ?? [] : []
  const headOf = (y: number) => { const t = termForYear(terms, y); return t ? (t.personSlug ?? t.name) : null }
  const newest = everyYear[everyYear.length - 1] ?? null
  const band = newest?.letter ?? null
  const recent = everyYear.slice(-5)
  const newestNatural = newest?.points != null && cuts ? letterFor(newest.points, cuts) : null

  // The timeline runs over the scored years only. Each term owns the columns
  // of the years attributed to it, so its tab sits directly over its bars.
  const scoredYears = scores.filter(s => s.points != null).map(s => s.data_year)
  const first = scoredYears[0], last = scoredYears[scoredYears.length - 1]
  const segments = scoredYears.length
    ? terms
        .map(t => ({ t, a: Math.max(t.window[0], first), b: Math.min(t.window[1], last), sum: termSummary(scores, t.window, pointsOf), grade: gradeOf(t.window) }))
        .filter(x => x.a <= x.b && x.sum.years.length > 0)
    : []

  const defaultSeg = [...segments].reverse().find(x => x.sum.years.length > 1) ?? segments[segments.length - 1] ?? null
  const [selLabel, setSelLabel] = useState<string | null>(defaultSeg?.t.label ?? null)
  const selIdx = segments.findIndex(x => x.t.label === selLabel)
  const selSeg = selIdx >= 0 ? segments[selIdx] : null
  const prevSeg = selIdx > 0 ? segments[selIdx - 1] : null
  const sel = selSeg?.t ?? null
  const selScores = sel ? scores.filter(s => s.data_year >= sel.window[0] && s.data_year <= sel.window[1]) : []
  const [focusYear, setFocusYear] = useState<number | null>(null)
  // the year view (the default) or the term average, beside the years
  const [avgView, setAvgView] = useState(false)
  const focus = selScores.find(s => s.data_year === focusYear) ?? selScores[selScores.length - 1] ?? null
  const breakdown = focus && cfg
    ? metricBreakdown(dataYears.find(y => y.data_year === focus.data_year), focus.comparison_group, anchors, cfg.domains, cfg.metric_cuts)
    : null
  const selYRS = sel ? dataYears.map(y => y.data_year).filter(y => y >= sel.window[0] && y <= sel.window[1]) : []
  const pick = (label: string) => { setSelLabel(label); setFocusYear(null); setAvgView(false) }
  const yearBreakdowns = cfg
    ? selScores.filter(s => s.points != null).map(s => ({
        year: s.data_year,
        b: metricBreakdown(dataYears.find(y => y.data_year === s.data_year), s.comparison_group, anchors, cfg.domains, cfg.metric_cuts),
      }))
    : []

  // Context, grouped. Each number from the newest year that actually has it.
  const v = latestValue
  const facts: { h: string; items: { l: string; v: ReturnType<typeof latestValue>; fmt: (x: number) => string }[] }[] = [
    { h: 'אוכלוסייה', items: [
      { l: 'תושבים', v: v(years, 'h_population'), fmt: x => Math.round(x).toLocaleString('he-IL') },
      { l: 'צפיפות לקמ״ר', v: v(years, 'h_density'), fmt: x => Math.round(x).toLocaleString('he-IL') },
      { l: 'בני 0–17', v: v(years, 'h_youth_pct'), fmt: x => x.toFixed(1) + '%' },
      { l: 'בני 65+', v: v(years, 'h_elderly_pct'), fmt: x => x.toFixed(1) + '%' },
    ] },
    { h: 'חברה וכלכלה', items: [
      { l: 'אשכול חברתי־כלכלי', v: v(years, 'h_socio_cluster'), fmt: x => `${x} מתוך 10` },
      { l: 'פריפריאליות', v: v(years, 'h_periphery'), fmt: x => `${x} מתוך 10` },
      { l: 'בעלי תואר ראשון', v: v(years, 'h_ba_degree_pct'), fmt: x => x.toFixed(1) + '%' },
      { l: 'שכר ממוצע', v: v(years, 'd_avg_wage'), fmt: x => '₪' + Math.round(x).toLocaleString('he-IL') },
      { l: 'תוחלת חיים', v: v(years, 'h_life_expectancy'), fmt: x => x.toFixed(1) },
    ] },
  ]
  const council = v(years, 'h_council_members')
  const district = v(years, 'h_district')
  const factRow = [
    ...facts.flatMap(g => g.items).filter(i => i.v).map(i => ({ l: i.l, text: i.fmt(i.v!.value as number), year: i.v!.year })),
    ...(council ? [{ l: 'חברי מועצה', text: String(council.value), year: council.year }] : []),
  ]

  return (
    <>
      <nav className="mm-nav">
        <Link className="nav-back" href="/">→ כל הרשויות</Link>
        <div className="mm-logo ap2-brand"><MunimarkMark size={24} />MuniMark</div>
        <div className="nav-links"><Link href="/credits">קרדיטים</Link></div>
      </nav>

      <div className="mm-page">
        <div className="ap-draft">טיוטה: גרסה חדשה של עמוד הרשות. <Link href={`/mayor/${authority.slug}`}>לגרסה הנוכחית</Link></div>

        {/* ── HERO: the authority, then its seal ──────────────────── */}
        <div className="card ap2-hero section">
          <div className="ap2-id">
            <div className="ap2-id-top">
              <div className={`ap2-logo${logo ? ' has-img' : ''}`}>
                {logo
                  ? <img src={logo.src} alt={`סמל ${fullName}`} />
                  : <span>{authority.name_display.slice(0, 2)}</span>}
              </div>
              <div className="ap2-title">
                <div className="eyebrow">{[authority.authority_type, district?.value && `מחוז ${district.value}`].filter(Boolean).join(' · ')}</div>
                <h1 className="ap2-name">{fullName}</h1>
                {current && (
                  <div className="ap2-head">
                    {headTitle(authority.authority_type)}:{' '}
                    {current.personSlug ? <Link href={`/head/${current.personSlug}`}>{current.name}</Link> : <b>{current.name}</b>}
                    <span className="ap2-head-term"> · קדנציה {spanText(current.spanLabel)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="ap2-seal">
            {newest && band ? (
              <>
                <div className="ap2-seal-dial"><Seal letter={band} year={newest.year} size={200} /></div>
                <div className="ap2-seal-side">
                  <div className="ap2-seal-eyebrow">מדד ניהול וביצועים · {newest.year}</div>
                  <div className="ap2-seal-word">{BAND_WORD[band]}</div>

                  <div className="ap2-side-h">5 השנים האחרונות</div>
                  <div className="ap2-years">
                    {recent.map(y => (
                      <div key={y.year} className={`ap2-yr${y.year === newest.year ? ' now' : ''}`} title={headOf(y.year) ? `${y.year} · ${termForYear(terms, y.year)?.name}` : String(y.year)}>
                        <Letter l={y.letter} />
                        <span className="num">{y.year}</span>
                      </div>
                    ))}
                  </div>

                  {grp && <div className="ap2-seal-meta">נמדדת מול {groupPlural(grp.type)} באשכול {grp.cluster}</div>}
                  {newestNatural && newestNatural !== band && (
                    <div className="ap2-seal-note">לפי הנקודות לבדן {newestNatural}, אבל {newestNatural === 'A' ? 'דרגה A מחייבת A לפחות בתחום אחד' : 'דרגה D ניתנת רק עם D לפחות בתחום אחד'}.</div>
                  )}
                </div>
              </>
            ) : (
              <div className="ap2-noscore">
                <MunimarkMark size={40} />
                <b>אין דרגה</b>
                <span>אין לרשות קבוצת השוואה של חמש רשויות לפחות. זו לא דרגה נמוכה.</span>
              </div>
            )}
          </div>
        </div>

        {/* ── the authority in numbers, one row ─────────────────────── */}
        <div className="card ap2-factrow section">
          {factRow.map(f => (
            // each number from the newest year that has it; the year is in the tooltip
            <div key={f.l} className="ap2-f" title={`${f.l} · נתוני ${f.year}`}>
              <span className="v num">{f.text}</span>
              <span className="l">{f.l}</span>
            </div>
          ))}
        </div>

        {/* ── ONE BLOCK: terms over their years, detail beneath ──── */}
        {segments.length > 0 && cfg && sel && selSeg && (
          <div className="section">
            <div className="sec-header">
              <div className="sec-title">
                הרשות לאורך השנים
                <small>כל שנה מקבלת אות ומשויכת לראש הרשות שכיהן בה · מעל כל קדנציה האות שלה · בחרו קדנציה כדי לראות מה עומד מאחורי האותיות</small>
              </div>
            </div>

            <div className="card tx">
              <div className="tx-cols" dir="ltr">
                {segments.map(({ t, a, b, sum, grade }, si) => {
                  const on = t.label === selLabel
                  const isLast = si === segments.length - 1
                  const yrs = Array.from({ length: b - a + 1 }, (_, i) => a + i)
                  return (
                    <div key={t.label} className={`tx-seg${on ? ' on' : ''}`} style={{ flexGrow: yrs.length, flexBasis: 0 }}>
                      <button className={`tx-tab${yrs.length === 1 ? ' compact' : ''}`} dir="rtl" onClick={() => pick(t.label)} aria-pressed={on} title={`${t.name} · ${a === b ? a : `${a}–${b}`}`}>
                        <Avatar t={t} size={34} />
                        <span className="tx-tab-text">
                          <span className="tx-tab-name">{t.name}</span>
                          <span className="tx-tab-span">{a === b ? a : `${a}–${b}`}</span>
                        </span>
                        <span className="tx-tab-score">{grade?.letter ? <Letter l={grade.letter} size="s" /> : '—'}</span>
                      </button>
                      <div className="tx-bars" onClick={() => pick(t.label)}>
                        {cuts && ([['A', cuts[2]], ['B', cuts[1]], ['C', cuts[0]]] as const).map(([bnd, cut]) => (
                          // 22px is the year row under the bars; the line is measured above it.
                          <div key={bnd} className="tx-cut" style={{ bottom: `calc(22px + (100% - 22px) * ${h(cut)})` }}>
                            {isLast && <span className="tx-cut-l">{bnd}</span>}
                          </div>
                        ))}
                        {yrs.map(y => {
                          const s = scores.find(x => x.data_year === y)
                          const val = s ? pointsOf(s) : null
                          const yl = grade?.years.find(x => x.year === y)?.letter ?? null
                          return (
                            <div key={y} className={`tx-col${on && focus?.data_year === y ? ' focus' : ''}`}>
                              <div className="tx-bar-area">
                                {val != null && (
                                  <div className={`tx-bar bar-${yl}`} style={{ height: `${Math.max(3, h(val) * 100)}%` }} title={`${y}: ${yl} · ${val.toFixed(2)} נק׳`}>
                                    <span className="tx-bar-v">{yl}</span>
                                  </div>
                                )}
                              </div>
                              <div className="tx-year num">{y}</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* the selected term, attached to its tab above */}
              <div className="tx-panel">
                <div className="tx-panel-head">
                  <Avatar t={sel} size={64} />
                  <div className="tx-panel-id">
                    <div className="tx-panel-name">
                      {sel.personSlug ? <Link href={`/head/${sel.personSlug}`}>{sel.name}</Link> : sel.name}
                    </div>
                    <div className="tx-panel-span">
                      קדנציה {spanText(sel.spanLabel)}{sel.isCurrent && <span className="ap-current"> · מכהן/ת</span>}
                      {' '}· נתוני {sel.window[0]}–{Math.min(sel.window[1], last)}
                    </div>
                  </div>
                  <div className="tx-panel-stats">
                    <div>
                      <span className="l">אות הקדנציה{sel.isCurrent ? ' עד כה' : ''}</span>
                      <span className="v num">
                        {selSeg.grade?.letter && <Letter l={selSeg.grade.letter} size="s" />} {n2(selSeg.sum.mean)}
                      </span>
                    </div>
                    <div>
                      <span className="l">שינוי בקדנציה</span>
                      <span className={`v num ${selSeg.sum.delta == null ? '' : selSeg.sum.delta >= 0 ? 'up' : 'down'}`}>
                        {selSeg.sum.delta == null ? '—' : signed(selSeg.sum.delta)}
                      </span>
                    </div>
                    {prevSeg && selSeg.sum.mean != null && prevSeg.sum.mean != null && (
                      <div>
                        <span className="l">מול הקדנציה הקודמת</span>
                        <span className={`v num ${selSeg.sum.mean - prevSeg.sum.mean >= 0 ? 'up' : 'down'}`}>{signed(selSeg.sum.mean - prevSeg.sum.mean)}</span>
                      </div>
                    )}
                    <div>
                      <span className="l">שנים עם דרגה</span>
                      <span className="v num">{selSeg.sum.years.length}/{Math.min(sel.window[1], last) - sel.window[0] + 1}</span>
                    </div>
                  </div>
                </div>
                {selSeg.sum.years.length === 1 && <div className="ap-term-warn">שנה אחת בלבד בקדנציה זו. מוקדם לשפוט.</div>}

                {selScores.length > 0 && (
                  <div className="tx-years">
                    <span className="tx-years-l">פירוט:</span>
                    <div className="year-sel">
                      {selScores.map(s => (
                        <button key={s.data_year} className={`yr${!avgView && s.data_year === focus?.data_year ? ' active' : ''}`} onClick={() => { setFocusYear(s.data_year); setAvgView(false) }}>
                          {s.data_year}
                        </button>
                      ))}
                      {selScores.length > 1 && (
                        <button className={`yr yr-avg${avgView ? ' active' : ''}`} onClick={() => setAvgView(true)}>ממוצע הקדנציה</button>
                      )}
                    </div>
                  </div>
                )}

                {focus && breakdown && selSeg.grade && cfg?.domain_cuts && (
                  <LetterBreakdown view={avgView ? 'avg' : 'year'} focus={focus} breakdown={breakdown}
                    yearBreakdowns={yearBreakdowns} grade={selSeg.grade} domainCuts={cfg.domain_cuts} />
                )}

                {selYRS.length > 1 && cfg && (
                  <>
                    <div className="tx-sub">מדדי המדד לאורך הקדנציה</div>
                    <div className="mt-legend">
                      הערך האמיתי בכל שנה, ומתחתיו האות שלו מול רשויות דומות.
                      <span className="mt-legend-band" aria-hidden /> הטווח של רשויות דומות, מהעשירון החלש לחזק.
                    </div>
                    {DOMAIN_ORDER.map(d => (
                      <div key={d} className="mt-domain">
                        <div className="mt-domain-h">{DOMAIN_LABELS[d]}</div>
                        <div className="mt-grid">
                          {(cfg.domains[d] ?? []).map(field => (
                            <MetricTrend key={field} s={metricSeries(field, selYRS, dataYears, scores, anchors, cfg.metric_cuts)} />
                          ))}
                        </div>
                      </div>
                    ))}

                    <div className="tx-sub">נתוני רקע</div>
                    <div className="mt-legend">לא נכללים במדד: הוצאות ונתוני אוכלוסייה. מוצגים להקשר בלבד.</div>
                    <div className="perf-grid">
                      {ALL.filter(m => BACKGROUND.includes(m.k)).map(m => (
                        <PerformanceChart key={m.k} metricKey={m.k} label={m.l} category={m.cat}
                          years={selYRS} values={selYRS.map(y => D[y]?.[m.k] ?? null)} formatter={m.fn} direction={0} />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="section">
          <div className="sc-scope">
            <b>מה המדד אינו מודד.</b> {cfg?.scope_note || DEFAULT_SCOPE_NOTE}
            {latest && <span className="sc-version"> · גרסת שיטה {latest.methodology_version}</span>}
          </div>
        </div>
      </div>

      <footer className="mm-footer">
        המקור: נתוני הלשכה המרכזית לסטטיסטיקה ומשרד הפנים · עיבוד MuniMark · הדרגה מחושבת מול רשויות דומות ואינו דירוג כולל של ראש הרשות.
        {logo && <> · {logo.source}</>} · <Link href="/credits" style={{ color: 'var(--ink-2)', textDecoration: 'underline' }}>קרדיטים ורישיונות</Link>
      </footer>
    </>
  )
}
