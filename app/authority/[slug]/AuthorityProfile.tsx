'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { AuthorityPageData } from '@/lib/loadAuthority'
import type { Score, ScoringConfig } from '@/types/db'
import type { Band } from '@/lib/score'
import { DEFAULT_SCOPE_NOTE, metricBreakdown, parseGroup, termSummary } from '@/lib/score'
import { authorityTerms, termForYear } from '@/lib/terms'
import type { AuthorityTerm } from '@/lib/terms'
import { authorityFullName } from '@/lib/seo'
import { ALL, hasPerformanceData, latestValue, toYearMap } from '@/lib/authorityMetrics'
import { WhyBreakdown, threeYearSpan } from '@/app/mayor/[slug]/ScoreSection'
import PerformanceChart from '@/app/mayor/[slug]/PerformanceChart'

const BAND_COLOR: Record<Band, string> = { A: 'var(--pos)', B: 'var(--accent)', C: 'var(--brass)', D: 'var(--neg)' }
const BAND_SOFT: Record<Band, string> = { A: 'var(--pos-soft)', B: 'var(--accent-soft)', C: 'var(--brass-soft)', D: 'var(--neg-soft)' }
const BAND_WORD: Record<Band, string> = {
  A: 'ביצועים גבוהים בקבוצת ההשוואה',
  B: 'מעל האמצע בקבוצת ההשוואה',
  C: 'מתחת לאמצע בקבוצת ההשוואה',
  D: 'ביצועים נמוכים בקבוצת ההשוואה',
}

const n1 = (v: number | null | undefined) => (v == null ? '—' : Number(v).toFixed(1))
const signed = (v: number) => (v > 0 ? '+' : '') + v.toFixed(1)
const shortName = (name: string) => name.split(/\s+/).slice(-1)[0]
const initials = (name: string) => name.split(/\s+/).map(w => w.charAt(0)).slice(0, 2).join('')

// ── Trend across the authority's whole record, terms shaded and named ────────
function TermTrend({ scores, terms, cfg, selected, onSelect }: {
  scores: Score[]; terms: AuthorityTerm[]; cfg: ScoringConfig
  selected: string | null; onSelect: (label: string) => void
}) {
  const ys = scores.filter(s => s.score != null)
  if (!ys.length) return null
  const first = ys[0].data_year, last = ys[ys.length - 1].data_year
  const n = last - first + 1
  const W = 680, H = 230, padT = 44, padB = 24, padX = 8, padR = 30
  const slot = (W - padX - padR) / n
  const bw = Math.min(36, slot * 0.6)
  const X = (yr: number) => padX + (yr - first) * slot
  const Y = (v: number) => padT + (1 - v / 100) * (H - padT - padB)
  const cuts: [number, Band][] = [[Number(cfg.cut_b_a), 'A'], [Number(cfg.cut_c_b), 'B'], [Number(cfg.cut_d_c), 'C']]
  const visible = terms
    .map(t => ({ t, a: Math.max(t.window[0], first), b: Math.min(t.window[1], last) }))
    .filter(x => x.a <= x.b)

  return (
    <svg className="ap-trend" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="ציון הרשות לאורך השנים, לפי קדנציות">
      {visible.map(({ t, a, b }, i) => {
        const x0 = X(a), x1 = X(b) + slot
        const sel = t.label === selected
        const span = b - a + 1
        return (
          <g key={t.label} className="ap-trend-term" onClick={() => onSelect(t.label)}>
            <rect x={x0 + 1} y={4} width={x1 - x0 - 2} height={H - padB - 4} rx={6}
              fill={sel ? 'var(--accent-soft)' : i % 2 ? 'var(--surface-2)' : 'transparent'}
              stroke={sel ? 'var(--accent)' : 'none'} strokeOpacity={0.35} />
            <text x={(x0 + x1) / 2} y={20} fontSize="11.5" fontWeight={700} textAnchor="middle"
              fill={sel ? 'var(--accent)' : 'var(--ink-2)'}>
              {span >= 2 ? t.name : shortName(t.name)}
            </text>
            <text x={(x0 + x1) / 2} y={34} fontSize="9.5" textAnchor="middle" fill="var(--ink-3)">
              {a === b ? a : `${a}–${b}`}
            </text>
          </g>
        )
      })}
      {cuts.map(([c, b]) => (
        <g key={b}>
          <line x1={padX} x2={W - padR + 4} y1={Y(c)} y2={Y(c)} stroke="var(--ink-3)" strokeOpacity={0.45} strokeDasharray="3 4" />
          <text x={W - padR + 8} y={Y(c) + 3} fontSize="9.5" fill="var(--ink-3)">{b}</text>
        </g>
      ))}
      {ys.map(s => {
        const v = Number(s.score)
        const t = termForYear(terms, s.data_year)
        const sel = t?.label === selected
        const x = X(s.data_year) + (slot - bw) / 2
        return (
          <g key={s.data_year} style={{ pointerEvents: 'none' }}>
            <title>{`${s.data_year}: ${v.toFixed(1)}`}</title>
            <rect x={x} y={Y(v)} width={bw} height={Y(0) - Y(v)} rx={3}
              fill={sel ? 'var(--accent)' : 'var(--ink-3)'} opacity={sel ? 0.9 : 0.35} />
            <text x={x + bw / 2} y={Y(v) - 4} fontSize="10" textAnchor="middle"
              fill={sel ? 'var(--ink)' : 'var(--ink-3)'} fontWeight={sel ? 700 : 500}>{Math.round(v)}</text>
            <text x={x + bw / 2} y={H - 7} fontSize="10" textAnchor="middle" fill="var(--ink-3)">{s.data_year}</text>
          </g>
        )
      })}
    </svg>
  )
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

  const terms = authorityTerms(mayorTerms)
  const latest = scores.length ? scores[scores.length - 1] : null
  const band = (latest?.band ?? null) as Band | null
  const grp = latest ? parseGroup(latest.comparison_group) : null
  const held = latest?.band && latest.band_natural && latest.band !== latest.band_natural

  // Terms worth a card: those with at least one data year we hold.
  const termCards = terms
    .map(t => ({ t, sum: termSummary(scores, t.window), dataYrs: dataYears.filter(y => y.data_year >= t.window[0] && y.data_year <= t.window[1]).length }))
    .filter(x => x.dataYrs > 0 || x.t.isCurrent)
    .reverse()

  const defaultTerm = termCards.find(x => x.sum.years.length > 1)?.t ?? termCards[0]?.t ?? null
  const [selLabel, setSelLabel] = useState<string | null>(defaultTerm?.label ?? null)
  const sel = terms.find(t => t.label === selLabel) ?? null
  const selScores = sel ? scores.filter(s => s.data_year >= sel.window[0] && s.data_year <= sel.window[1]) : []
  const [focusYear, setFocusYear] = useState<number | null>(null)
  const focus = selScores.find(s => s.data_year === focusYear) ?? selScores[selScores.length - 1] ?? null
  const breakdown = focus && cfg
    ? metricBreakdown(dataYears.find(y => y.data_year === focus.data_year), focus.comparison_group, anchors, cfg.domains)
    : null
  const selYRS = sel ? dataYears.map(y => y.data_year).filter(y => y >= sel.window[0] && y <= sel.window[1]) : []

  const pick = (label: string) => { setSelLabel(label); setFocusYear(null) }

  // Context: each number from the newest year that actually has it.
  const ctx = [
    { l: 'תושבים', v: latestValue(years, 'h_population'), fmt: (x: number) => Math.round(x).toLocaleString('he-IL') },
    { l: 'אשכול חברתי־כלכלי', v: latestValue(years, 'h_socio_cluster'), fmt: (x: number) => `${x} מתוך 10` },
    { l: 'פריפריאליות', v: latestValue(years, 'h_periphery'), fmt: (x: number) => `${x} מתוך 10` },
    { l: 'צפיפות (לקמ״ר)', v: latestValue(years, 'h_density'), fmt: (x: number) => Math.round(x).toLocaleString('he-IL') },
    { l: 'תוחלת חיים', v: latestValue(years, 'h_life_expectancy'), fmt: (x: number) => x.toFixed(1) },
    { l: 'בעלי תואר ראשון', v: latestValue(years, 'h_ba_degree_pct'), fmt: (x: number) => x.toFixed(1) + '%' },
    { l: 'בני 0–17', v: latestValue(years, 'h_youth_pct'), fmt: (x: number) => x.toFixed(1) + '%' },
    { l: 'בני 65+', v: latestValue(years, 'h_elderly_pct'), fmt: (x: number) => x.toFixed(1) + '%' },
    { l: 'שכר ממוצע', v: latestValue(years, 'd_avg_wage'), fmt: (x: number) => '₪' + Math.round(x).toLocaleString('he-IL') },
    { l: 'חברי מועצה', v: latestValue(years, 'h_council_members'), fmt: (x: number) => String(x) },
  ].filter(c => c.v != null)
  const district = latestValue(years, 'h_district')

  return (
    <>
      <nav className="mm-nav">
        <Link className="nav-back" href="/">→ כל הרשויות</Link>
        <div className="mm-logo"><span className="mark" />Munimark</div>
        <div className="nav-links"><Link href="/credits">קרדיטים</Link></div>
      </nav>

      <div className="mm-page">
        <div className="ap-draft">טיוטה: גרסה חדשה של עמוד הרשות. <Link href={`/mayor/${authority.slug}`}>לגרסה הנוכחית</Link></div>

        {/* ── HERO: the authority alone ───────────────────────────── */}
        <div className="card ap-hero section">
          <div className="ap-hero-top">
            <div className="ap-logo" title="סמל הרשות יתווסף">{authority.name_display.slice(0, 2)}</div>
            <div className="ap-id">
              <div className="eyebrow">{[authority.authority_type, district?.value && `מחוז ${district.value}`].filter(Boolean).join(' · ')}</div>
              <h1 className="ap-name">{fullName}</h1>
              {grp && latest && (
                <div className="ap-group">
                  נמדדת מול <b>{grp.type === 'עירייה' ? 'עיריות' : grp.type === 'מועצה מקומית' ? 'מועצות מקומיות' : 'מועצות אזוריות'} באשכול {grp.cluster}</b>
                </div>
              )}
            </div>

            <div className="ap-score">
              {latest && band ? (
                <>
                  <div className="ap-badge" style={{ borderColor: BAND_COLOR[band], background: BAND_SOFT[band] }}>
                    <span className="ap-badge-letter" style={{ color: BAND_COLOR[band] }}>{band}</span>
                  </div>
                  <div className="ap-score-text">
                    <div className="ap-score-big num">{n1(latest.score_3yr)}<small> / 100</small></div>
                    <div className="ap-score-l">ממוצע {threeYearSpan(latest)} · {BAND_WORD[band]}</div>
                    <div className="ap-score-yr">ציון {latest.data_year} לבדו: <b className="num">{n1(latest.score)}</b></div>
                  </div>
                </>
              ) : (
                <div className="ap-noscore">
                  <b>אין ציון</b>
                  <span>אין לרשות קבוצת השוואה של חמש רשויות לפחות. זה לא ציון אפס.</span>
                </div>
              )}
            </div>
          </div>

          {held && latest && (
            <div className="sc-note">הממוצע לבדו היה נותן דרגה {latest.band_natural}. דרגה משתנה רק כשהציון חוצה את הגבול ב־{cfg?.hysteresis_pts ?? 2} נקודות לפחות.</div>
          )}

          {ctx.length > 0 && (
            <div className="ap-ctx">
              {ctx.map(c => (
                <div key={c.l} className="ap-ctx-i">
                  <span className="l">{c.l}</span>
                  <span className="v num">{c.fmt(c.v!.value as number)}</span>
                  <span className="y num">{c.v!.year}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── THE RECORD, BY TERM ─────────────────────────────────── */}
        {latest && cfg && (
          <div className="section">
            <div className="sec-header">
              <div className="sec-title">
                ציון הרשות לאורך השנים
                <small>ציון שנה בודדת 2016–{latest.data_year} · כל שנה משויכת למי שכיהן בה · לחצו על קדנציה לפירוט</small>
              </div>
            </div>
            <div className="card ap-trend-card">
              <TermTrend scores={scores} terms={terms} cfg={cfg} selected={selLabel} onSelect={pick} />
            </div>
          </div>
        )}

        {/* ── HEADS OF THE AUTHORITY ──────────────────────────────── */}
        {termCards.length > 0 && (
          <div className="section">
            <div className="sec-header">
              <div className="sec-title">
                ראשי הרשות לאורך הקדנציות
                <small>ציון הקדנציה מחושב רק מהשנים שבהן כיהן ראש הרשות</small>
              </div>
            </div>
            <div className="ap-terms">
              {termCards.map(({ t, sum, dataYrs }) => {
                const on = t.label === selLabel
                const possible = Math.min(t.window[1], latest?.data_year ?? t.window[1]) - t.window[0] + 1
                return (
                  <div key={t.label} role="button" tabIndex={0} aria-pressed={on} className={`card ap-term${on ? ' on' : ''}`}
                    onClick={() => pick(t.label)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(t.label) } }}>
                    <div className="ap-term-head">
                      {t.photo
                        ? <img className="ap-term-photo" src={t.photo} alt={t.name} />
                        : <div className="ap-term-photo ap-term-initials">{initials(t.name)}</div>}
                      <div>
                        <div className="ap-term-name">{t.name}</div>
                        <div className="ap-term-span">
                          קדנציה {t.spanLabel}{t.isCurrent && <span className="ap-current"> · מכהן/ת</span>}
                        </div>
                      </div>
                    </div>
                    {sum.years.length ? (
                      <div className="ap-term-stats">
                        <div><span className="l">ציון קדנציה</span><span className="v num">{n1(sum.mean)}</span></div>
                        <div>
                          <span className="l">שינוי</span>
                          <span className={`v num ${sum.delta == null ? '' : sum.delta >= 0 ? 'up' : 'down'}`}>
                            {sum.delta == null ? '—' : signed(sum.delta)}
                          </span>
                        </div>
                        <div><span className="l">שנים עם ציון</span><span className="v num">{sum.years.length}/{Math.max(possible, sum.years.length)}</span></div>
                      </div>
                    ) : (
                      <div className="ap-term-none">{dataYrs ? 'אין ציון לשנים אלה (הציונים מתחילים ב־2016)' : 'עדיין אין נתונים לקדנציה זו'}</div>
                    )}
                    {sum.years.length === 1 && <div className="ap-term-warn">שנה אחת בלבד, מוקדם לשפוט</div>}
                    <div className="ap-term-yrs">נתוני {t.window[0]}–{Math.min(t.window[1], latest?.data_year ?? t.window[1])}</div>
                    {t.personSlug && <Link className="ap-term-link" href={`/person/${t.personSlug}`} onClick={e => e.stopPropagation()}>לעמוד האישי ←</Link>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── DETAIL OF THE SELECTED TERM ─────────────────────────── */}
        {sel && (
          <div className="section">
            <div className="sec-header">
              <div className="sec-title">
                {sel.name}: קדנציה {sel.spanLabel}
                <small>מה מרכיב את הציון, ומדדי הביצוע בשנות הקדנציה</small>
              </div>
              {selScores.length > 0 && (
                <div className="year-sel">
                  {selScores.map(s => (
                    <button key={s.data_year} className={`yr${s.data_year === focus?.data_year ? ' active' : ''}`} onClick={() => setFocusYear(s.data_year)}>
                      {s.data_year}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {focus && breakdown ? (
              <div className="card sc-card"><WhyBreakdown focus={focus} breakdown={breakdown} /></div>
            ) : (
              <div className="no-data-placeholder"><p>אין ציון לשנות קדנציה זו</p></div>
            )}
            {selYRS.length > 1 && (
              <div className="perf-grid ap-perf">
                {ALL.filter(m => m.dir !== 0).map(m => (
                  <PerformanceChart key={m.k} metricKey={m.k} label={m.l} category={m.cat}
                    years={selYRS} values={selYRS.map(y => D[y]?.[m.k] ?? null)} formatter={m.fn} direction={m.dir} />
                ))}
              </div>
            )}
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
        המקור: נתוני הלשכה המרכזית לסטטיסטיקה ומשרד הפנים · עיבוד Munimark · הציון מחושב מול רשויות דומות ואינו דירוג כולל של ראש הרשות. · <Link href="/credits" style={{ color: 'var(--ink-2)', textDecoration: 'underline' }}>קרדיטים ורישיונות</Link>
      </footer>
    </>
  )
}
