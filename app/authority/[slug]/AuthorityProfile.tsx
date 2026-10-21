'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { AuthorityPageData } from '@/lib/loadAuthority'
import type { Band } from '@/lib/score'
import { DEFAULT_SCOPE_NOTE, metricBreakdown, parseGroup, termSummary } from '@/lib/score'
import { authorityTerms } from '@/lib/terms'
import type { AuthorityTerm } from '@/lib/terms'
import { authorityFullName } from '@/lib/seo'
import { AUTHORITY_LOGOS } from '@/lib/logos'
import { ALL, hasPerformanceData, latestValue, toYearMap } from '@/lib/authorityMetrics'
import { WhyBreakdown, threeYearSpan } from '@/app/mayor/[slug]/ScoreSection'
import PerformanceChart from '@/app/mayor/[slug]/PerformanceChart'
import { MunimarkMark, Seal } from './Brand'

const BAND_WORD: Record<Band, string> = {
  A: 'ביצועים גבוהים בקבוצת ההשוואה',
  B: 'מעל האמצע בקבוצת ההשוואה',
  C: 'מתחת לאמצע בקבוצת ההשוואה',
  D: 'ביצועים נמוכים בקבוצת ההשוואה',
}

const n1 = (v: number | null | undefined) => (v == null ? '—' : Number(v).toFixed(1))
const signed = (v: number) => (v > 0 ? '+' : '') + v.toFixed(1)
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
  const band = (latest?.band ?? null) as Band | null
  const grp = latest ? parseGroup(latest.comparison_group) : null
  const held = latest?.band && latest.band_natural && latest.band !== latest.band_natural

  // The timeline runs over the scored years only. Each term owns the columns
  // of the years attributed to it, so its tab sits directly over its bars.
  const scoredYears = scores.filter(s => s.score != null).map(s => s.data_year)
  const first = scoredYears[0], last = scoredYears[scoredYears.length - 1]
  const segments = scoredYears.length
    ? terms
        .map(t => ({ t, a: Math.max(t.window[0], first), b: Math.min(t.window[1], last), sum: termSummary(scores, t.window) }))
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
  const focus = selScores.find(s => s.data_year === focusYear) ?? selScores[selScores.length - 1] ?? null
  const breakdown = focus && cfg
    ? metricBreakdown(dataYears.find(y => y.data_year === focus.data_year), focus.comparison_group, anchors, cfg.domains)
    : null
  const selYRS = sel ? dataYears.map(y => y.data_year).filter(y => y >= sel.window[0] && y <= sel.window[1]) : []
  const pick = (label: string) => { setSelLabel(label); setFocusYear(null) }

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
                    {current.personSlug ? <Link href={`/person/${current.personSlug}`}>{current.name}</Link> : <b>{current.name}</b>}
                    <span className="ap2-head-term"> · קדנציה {spanText(current.spanLabel)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="ap2-facts">
              {facts.map(g => (
                <div key={g.h} className="ap2-fact-group">
                  <div className="ap2-fact-h">{g.h}</div>
                  <div className="ap2-fact-grid">
                    {g.items.filter(i => i.v).map(i => (
                      <div key={i.l} className="ap2-fact">
                        <span className="v num">{i.fmt(i.v!.value as number)}</span>
                        <span className="l">{i.l} <span className="y num">· {i.v!.year}</span></span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {council && (
                <div className="ap2-fact-group">
                  <div className="ap2-fact-h">שלטון</div>
                  <div className="ap2-fact-grid">
                    <div className="ap2-fact">
                      <span className="v num">{String(council.value)}</span>
                      <span className="l">חברי מועצה <span className="y num">· {council.year}</span></span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="ap2-seal">
            {latest && band ? (
              <>
                <div className="ap2-seal-eyebrow">מדד ניהול וביצועים</div>
                <Seal score={Number(latest.score_3yr)} band={band} />
                <div className={`ap2-band band-${band}`}>דרגה {band}</div>
                <div className="ap2-seal-word">{BAND_WORD[band]}</div>
                <div className="ap2-seal-meta">
                  ממוצע {threeYearSpan(latest)} · ציון {latest.data_year} לבדו <b className="num">{n1(latest.score)}</b>
                </div>
                {grp && <div className="ap2-seal-meta">נמדדת מול {groupPlural(grp.type)} באשכול {grp.cluster}</div>}
                {held && <div className="ap2-seal-note">הממוצע לבדו היה נותן {latest.band_natural}. דרגה משתנה רק כשחוצים את הגבול ב־{cfg?.hysteresis_pts ?? 2} נק׳.</div>}
              </>
            ) : (
              <div className="ap2-noscore">
                <MunimarkMark size={40} />
                <b>אין ציון</b>
                <span>אין לרשות קבוצת השוואה של חמש רשויות לפחות. זה לא ציון אפס.</span>
              </div>
            )}
          </div>
        </div>

        {/* ── ONE BLOCK: terms over their years, detail beneath ──── */}
        {segments.length > 0 && cfg && sel && selSeg && (
          <div className="section">
            <div className="sec-header">
              <div className="sec-title">
                הרשות לאורך הקדנציות
                <small>כל שנה משויכת לראש הרשות שכיהן בה · בחרו קדנציה כדי לראות מה עומד מאחורי הציון</small>
              </div>
            </div>

            <div className="card tx">
              <div className="tx-cols" dir="ltr">
                {segments.map(({ t, a, b, sum }, si) => {
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
                        <span className="tx-tab-score num">{n1(sum.mean)}</span>
                      </button>
                      <div className="tx-bars" onClick={() => pick(t.label)}>
                        {([['A', cfg.cut_b_a], ['B', cfg.cut_c_b], ['C', cfg.cut_d_c]] as const).map(([bnd, cut]) => (
                          // 22px is the year row under the bars; the line is measured above it.
                          <div key={bnd} className="tx-cut" style={{ bottom: `calc(22px + (100% - 22px) * ${Number(cut) / 100})` }}>
                            {isLast && <span className="tx-cut-l">{bnd}</span>}
                          </div>
                        ))}
                        {yrs.map(y => {
                          const s = scores.find(x => x.data_year === y)
                          const val = s?.score != null ? Number(s.score) : null
                          return (
                            <div key={y} className={`tx-col${on && focus?.data_year === y ? ' focus' : ''}`}>
                              <div className="tx-bar-area">
                                {val != null && (
                                  <div className="tx-bar" style={{ height: `${val}%` }} title={`${y}: ${val.toFixed(1)}`}>
                                    <span className="tx-bar-v num">{Math.round(val)}</span>
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
                      {sel.personSlug ? <Link href={`/person/${sel.personSlug}`}>{sel.name}</Link> : sel.name}
                    </div>
                    <div className="tx-panel-span">
                      קדנציה {spanText(sel.spanLabel)}{sel.isCurrent && <span className="ap-current"> · מכהן/ת</span>}
                      {' '}· נתוני {sel.window[0]}–{Math.min(sel.window[1], last)}
                    </div>
                  </div>
                  <div className="tx-panel-stats">
                    <div><span className="l">ציון קדנציה</span><span className="v num">{n1(selSeg.sum.mean)}</span></div>
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
                      <span className="l">שנים עם ציון</span>
                      <span className="v num">{selSeg.sum.years.length}/{Math.min(sel.window[1], last) - sel.window[0] + 1}</span>
                    </div>
                  </div>
                </div>
                {selSeg.sum.years.length === 1 && <div className="ap-term-warn">שנה אחת בלבד בקדנציה זו. מוקדם לשפוט.</div>}

                {selScores.length > 0 && (
                  <div className="tx-years">
                    <span className="tx-years-l">פירוט לשנה:</span>
                    <div className="year-sel">
                      {selScores.map(s => (
                        <button key={s.data_year} className={`yr${s.data_year === focus?.data_year ? ' active' : ''}`} onClick={() => setFocusYear(s.data_year)}>
                          {s.data_year}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {focus && breakdown && <WhyBreakdown focus={focus} breakdown={breakdown} />}

                {selYRS.length > 1 && (
                  <>
                    <div className="tx-sub">מדדי הביצוע לאורך הקדנציה</div>
                    <div className="perf-grid">
                      {ALL.filter(m => m.dir !== 0).map(m => (
                        <PerformanceChart key={m.k} metricKey={m.k} label={m.l} category={m.cat}
                          years={selYRS} values={selYRS.map(y => D[y]?.[m.k] ?? null)} formatter={m.fn} direction={m.dir} />
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
        המקור: נתוני הלשכה המרכזית לסטטיסטיקה ומשרד הפנים · עיבוד MuniMark · הציון מחושב מול רשויות דומות ואינו דירוג כולל של ראש הרשות.
        {logo && <> · {logo.source}</>} · <Link href="/credits" style={{ color: 'var(--ink-2)', textDecoration: 'underline' }}>קרדיטים ורישיונות</Link>
      </footer>
    </>
  )
}
