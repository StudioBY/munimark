'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Mayor } from '@/types/db'
import type { AuthorityPageData } from '@/lib/loadAuthority'
import type { Band } from '@/lib/score'
import { DEFAULT_SCOPE_NOTE, DOMAIN_LABELS, DOMAIN_ORDER, bandCuts, domainYearPoints, letterFor, metricBreakdown, metricSeries, parseGroup, termSummary } from '@/lib/score'
import { authorityTerms } from '@/lib/terms'
import { headRecord } from '@/lib/head'
import type { HeadStint } from '@/lib/head'
import { authorityFullName } from '@/lib/seo'
import { ALL, hasPerformanceData, toYearMap } from '@/lib/authorityMetrics'
import PerformanceChart from '@/app/mayor/[slug]/PerformanceChart'
import { MunimarkMark, Seal } from '@/app/authority/[slug]/Brand'
import MetricTrend from '@/app/authority/[slug]/MetricTrend'
import { Letter, LetterBreakdown } from '@/app/authority/[slug]/LetterBreakdown'

// Same as the authority page: context under the index metrics, never scored.
const BACKGROUND = ['תקציב_לנפש', 'חינוך_אחוז', 'רווחה_אחוז', 'תואר_ראשון', 'תוחלת_חיים', 'צעירים', 'קשישים']

const BAND_WORD: Record<Band, string> = {
  A: 'ביצועים גבוהים בקבוצת ההשוואה',
  B: 'מעל האמצע בקבוצת ההשוואה',
  C: 'מתחת לאמצע בקבוצת ההשוואה',
  D: 'ביצועים נמוכים בקבוצת ההשוואה',
}

const n2 = (v: number | null | undefined) => (v == null ? '—' : Number(v).toFixed(2))
const signed = (v: number) => (v > 0 ? '+' : '') + v.toFixed(2)
const h = (p: number) => Math.max(0, Math.min(1, (p - 1) / 3))
const spanText = (span: string) => (span.endsWith('–') ? `מ־${span.slice(0, -1)}` : span)
const yrsText = (w: [number, number]) => (w[0] === w[1] ? String(w[0]) : `${w[0]}–${w[1]}`)
const initials = (name: string) => name.split(/\s+/).map(w => w.charAt(0)).slice(0, 2).join('')
const groupPlural = (type: string) =>
  type === 'עירייה' ? 'עיריות' : type === 'מועצה מקומית' ? 'מועצות מקומיות' : 'מועצות אזוריות'
const headTitle = (type: string | null) =>
  type === 'עירייה' ? 'ראש העירייה' : type === 'מועצה מקומית' ? 'ראש המועצה המקומית' : 'ראש המועצה האזורית'

/** The authority's name as the hero says it: מודיעין-מכבים-רעות, not מודיעין. */
function officialName(a: AuthorityPageData['authority']) {
  const norm = (x: string) => x.replace(/\s*-\s*/g, '-').trim()
  return [a.name_display, a.name_cbs ?? ''].map(norm).sort((x, y) => y.length - x.length)[0]
}

export default function HeadProfile({ person, authorities }: { person: Mayor; authorities: AuthorityPageData[] }) {
  const slug = person.slug ?? ''
  const name = person.name ?? 'ראש רשות'

  // Per authority: its data years, terms and yearly domain points, exactly as
  // the authority page builds them, so both pages give a year the same letter.
  const ctx = authorities.map(a => {
    const born = a.authority.established_year ?? null
    const dataYears = a.years.filter(y => born == null || y.data_year >= born).filter(hasPerformanceData)
    const domPts: Record<number, Record<string, number | null>> = {}
    if (a.cfg) for (const s of a.scores) {
      domPts[s.data_year] = domainYearPoints(metricBreakdown(dataYears.find(y => y.data_year === s.data_year), s.comparison_group, a.anchors, a.cfg.domains, a.cfg.metric_cuts))
    }
    return { ...a, dataYears, D: toYearMap(dataYears), terms: authorityTerms(a.mayorTerms), domPts }
  })
  const bySlug = new Map(ctx.map(c => [c.authority.slug, c]))
  const rec = headRecord(slug, ctx.map(c => ({ slug: c.authority.slug, terms: c.terms, scores: c.scores, domainPoints: c.domPts, cfg: c.cfg })))
  const many = new Set(rec.stints.map(s => s.authoritySlug)).size > 1

  const lastStint = rec.stints[rec.stints.length - 1] ?? null
  const serving = lastStint?.term.isCurrent ?? false
  const home = lastStint ? bySlug.get(lastStint.authoritySlug) ?? null : null
  const homeName = home ? authorityFullName(home.authority.authority_type, officialName(home.authority)) : null
  // Years in office (the term's span), not data years: elected October 2013
  // is "since 2013" though the first data year attributed is 2014.
  const officeYears = (span: string) => span.match(/\d{4}/g)?.map(Number) ?? []
  const since = rec.stints[0] ? officeYears(rec.stints[0].term.spanLabel)[0] ?? null : null
  const until = lastStint && !serving ? officeYears(lastStint.term.spanLabel)[1] ?? null : null
  // mayor_terms begins with the 2013 election, so a head already in office
  // then may have served before it: a floor, not a start.
  const sinceText = since == null ? null : rec.stints[0].term.label === 'term_2013' ? `לפחות מ־${since}` : `מ־${since}`

  // The seal: the head's own newest scored year, with "+" for an A streak.
  const newest = rec.newest
  const seal = newest ? bySlug.get(newest.authoritySlug) ?? null : null
  const sealScore = seal?.scores.find(s => s.data_year === newest!.year) ?? null
  const sealGroup = sealScore ? parseGroup(sealScore.comparison_group) : null
  const sealNatural = newest?.points != null && seal?.cfg ? letterFor(newest.points, bandCuts(seal.cfg)) : null
  const plus = rec.streak >= 2
  const recent = rec.years.slice(-5)

  const segs = rec.stints.filter((s): s is HeadStint & { window: [number, number] } => s.window != null && s.grade != null)
  // No year yet is not the same as no score: an authority without a comparison
  // group (5 of them) has data years and no letter in any of them.
  const lastScored = lastStint ? (bySlug.get(lastStint.authoritySlug)?.scores ?? []).some(s => s.points != null) : false
  const waiting = lastStint && !lastStint.window && lastScored ? lastStint : null

  const defaultSeg = [...segs].reverse().find(s => s.grade!.scored > 1) ?? segs[segs.length - 1] ?? null
  const [selKey, setSelKey] = useState<string | null>(defaultSeg ? `${defaultSeg.authoritySlug}/${defaultSeg.term.label}` : null)
  const [focusYear, setFocusYear] = useState<number | null>(null)
  const [avgView, setAvgView] = useState(false)
  const keyOf = (s: HeadStint) => `${s.authoritySlug}/${s.term.label}`
  const pick = (s: HeadStint) => { setSelKey(keyOf(s)); setFocusYear(null); setAvgView(false) }

  const sel = segs.find(s => keyOf(s) === selKey) ?? null
  const sc = sel ? bySlug.get(sel.authoritySlug)! : null
  const pointsOf = (x: { points?: number | null }) => (x.points == null ? null : Number(x.points))
  const selScores = sel && sc ? sc.scores.filter(s => s.data_year >= sel.window[0] && s.data_year <= sel.window[1] && s.points != null) : []
  const selSum = sel && sc ? termSummary(sc.scores, sel.window, pointsOf) : null
  const prevSum = sel?.prev?.window && sc ? termSummary(sc.scores, sel.prev.window, pointsOf) : null
  const focus = selScores.find(s => s.data_year === focusYear) ?? selScores[selScores.length - 1] ?? null
  const breakdown = focus && sc?.cfg
    ? metricBreakdown(sc.dataYears.find(y => y.data_year === focus.data_year), focus.comparison_group, sc.anchors, sc.cfg.domains, sc.cfg.metric_cuts)
    : null
  const yearBreakdowns = sc?.cfg
    ? selScores.map(s => ({ year: s.data_year, b: metricBreakdown(sc.dataYears.find(y => y.data_year === s.data_year), s.comparison_group, sc.anchors, sc.cfg!.domains, sc.cfg!.metric_cuts) }))
    : []
  const selYRS = sel && sc ? sc.dataYears.map(y => y.data_year).filter(y => y >= sel.window[0] && y <= sel.window[1]) : []

  return (
    <>
      <nav className="mm-nav">
        <Link className="nav-back" href={home ? `/authority/${home.authority.slug}` : '/'}>→ {home ? 'לעמוד הרשות' : 'כל הרשויות'}</Link>
        <div className="mm-logo ap2-brand"><MunimarkMark size={24} />MuniMark</div>
        <div className="nav-links"><Link href="/credits">קרדיטים</Link></div>
      </nav>

      <div className="mm-page">
        <div className="ap-draft">טיוטה: גרסה חדשה של עמוד ראש הרשות. <Link href={`/person/${slug}`}>לגרסה הנוכחית</Link></div>

        {/* ── HERO: the person, then their seal ─────────────────────── */}
        <div className="card ap2-hero section">
          <div className="ap2-id">
            <div className="ap2-id-top">
              {person.photo_url
                ? <img className="hd-photo" src={person.photo_url} alt={name} />
                : <span className="hd-photo hd-photo-i">{initials(name)}</span>}
              <div className="ap2-title">
                {home && <div className="eyebrow">{serving ? headTitle(home.authority.authority_type) : `כיהן/ה כ${headTitle(home.authority.authority_type)}`}</div>}
                <h1 className="ap2-name">{name}</h1>
                {home && (
                  <div className="ap2-head">
                    <Link href={`/authority/${home.authority.slug}`}>{homeName}</Link>
                    {since != null && <span className="ap2-head-term"> · {serving ? `מכהן/ת ${sinceText}` : `${since}–${until}`}</span>}
                    {rec.stints.length > 1 && <span className="ap2-head-term"> · {rec.stints.length} קדנציות</span>}
                  </div>
                )}
              </div>
            </div>
            {person.background && (
              <div className="hd-bio">
                {person.background.slice(0, 280)}{person.background.length > 280 ? '…' : ''}
                {person.wikipedia_url && <> <a href={person.wikipedia_url} target="_blank" rel="noopener noreferrer">ויקיפדיה ←</a></>}
              </div>
            )}
          </div>

          <div className="ap2-seal hd-seal">
            {newest?.letter ? (
              <>
                <div className="ap2-seal-dial"><Seal letter={newest.letter} plus={plus} year={newest.year} size={200} /></div>
                <div className="ap2-seal-side">
                  <div className="ap2-seal-eyebrow">מדד ניהול וביצועים · {newest.year}</div>
                  <div className="ap2-seal-word">{BAND_WORD[newest.letter]}</div>
                  {plus && <div className="hd-plus">הסימן <bdi>+</bdi>: A בכל אחת מ־{rec.streak} השנים האחרונות, ברציפות</div>}

                  <div className="ap2-side-h">{recent.length < 5 ? 'כל השנים בכהונתו/ה' : '5 השנים האחרונות בכהונתו/ה'}</div>
                  <div className="ap2-years">
                    {recent.map(y => (
                      <div key={y.year} className={`ap2-yr${y.year === newest.year ? ' now' : ''}`}>
                        <Letter l={y.letter} />
                        <span className="num">{y.year}</span>
                      </div>
                    ))}
                  </div>

                  {sealGroup && <div className="ap2-seal-meta">נמדד/ת מול {groupPlural(sealGroup.type)} באשכול {sealGroup.cluster}</div>}
                  {!serving && <div className="ap2-seal-meta">השנה האחרונה בכהונתו/ה</div>}
                  {sealNatural && sealNatural !== newest.letter && (
                    <div className="ap2-seal-note">לפי הנקודות לבדן {sealNatural}, אבל {sealNatural === 'A' ? 'דרגה A מחייבת A לפחות בתחום אחד' : 'דרגה D ניתנת רק עם D לפחות בתחום אחד'}.</div>
                  )}
                </div>
              </>
            ) : (
              <div className="ap2-noscore">
                <MunimarkMark size={40} />
                <b>עוד אין שנת נתונים</b>
                <span>
                  {waiting
                    ? `השנה הראשונה של ${name} היא ${waiting.term.window[0]}. האות תופיע עם נתוני השנה הזו. זו לא דרגה נמוכה.`
                    : 'אין לרשות קבוצת השוואה של חמש רשויות לפחות. זו לא דרגה נמוכה.'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── the head's terms over their years, detail beneath ────── */}
        {segs.length > 0 && sel && sc?.cfg && selSum && (
          <div className="section">
            <div className="sec-header">
              <div className="sec-title">
                בתקופת כהונתו/ה
                <small>כל שנה מקבלת אות · מעל כל קדנציה האות שלה, ממוצע השנים · שנות ממלא/ת מקום אינן נזקפות לאף נבחר/ת · בחרו קדנציה כדי לראות מה עומד מאחורי האותיות</small>
              </div>
            </div>

            <div className="card tx">
              <div className="tx-cols" dir="ltr">
                {segs.map((s, si) => {
                  const on = keyOf(s) === selKey
                  const isLast = si === segs.length - 1
                  const c = bySlug.get(s.authoritySlug)!
                  const segCuts = c.cfg ? bandCuts(c.cfg) : null
                  const yrs = s.grade!.years
                  return (
                    <div key={keyOf(s)} className={`tx-seg${on ? ' on' : ''}`} style={{ flexGrow: yrs.length, flexBasis: 0 }}>
                      <button className={`tx-tab${yrs.length === 1 ? ' compact' : ''}`} dir="rtl" onClick={() => pick(s)} aria-pressed={on} title={`קדנציה ${spanText(s.term.spanLabel)} · ${yrsText(s.window)}`}>
                        <span className="tx-tab-text">
                          <span className="tx-tab-name">{many ? c.authority.name_display : `קדנציה ${spanText(s.term.spanLabel)}`}</span>
                          <span className="tx-tab-span">{yrsText(s.window)}</span>
                        </span>
                        <span className="tx-tab-score"><Letter l={s.grade!.letter} size="s" /></span>
                      </button>
                      <div className="tx-bars" onClick={() => pick(s)}>
                        {segCuts && ([['A', segCuts[2]], ['B', segCuts[1]], ['C', segCuts[0]]] as const).map(([bnd, cut]) => (
                          <div key={bnd} className="tx-cut" style={{ bottom: `calc(22px + (100% - 22px) * ${h(cut)})` }}>
                            {isLast && <span className="tx-cut-l">{bnd}</span>}
                          </div>
                        ))}
                        {yrs.map(y => (
                          <div key={y.year} className={`tx-col${on && focus?.data_year === y.year ? ' focus' : ''}`}>
                            <div className="tx-bar-area">
                              {y.points != null && (
                                <div className={`tx-bar bar-${y.letter}`} style={{ height: `${Math.max(3, h(y.points) * 100)}%` }} title={`${y.year}: ${y.letter} · ${y.points.toFixed(2)} נק׳`}>
                                  <span className="tx-bar-v">{y.letter}</span>
                                </div>
                              )}
                            </div>
                            <div className="tx-year num">{y.year}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="tx-panel">
                <div className="tx-panel-head">
                  <div className="tx-panel-id">
                    <div className="tx-panel-name">
                      קדנציה {spanText(sel.term.spanLabel)}{sel.term.isCurrent && <span className="ap-current"> · מכהן/ת</span>}
                    </div>
                    <div className="tx-panel-span">
                      <Link href={`/authority/${sc.authority.slug}`}>{authorityFullName(sc.authority.authority_type, officialName(sc.authority))}</Link>
                      {' '}· נתוני {yrsText(sel.window)}
                    </div>
                  </div>
                  <div className="tx-panel-stats">
                    <div>
                      <span className="l">אות הקדנציה{sel.term.isCurrent ? ' עד כה' : ''}</span>
                      <span className="v num"><Letter l={sel.grade!.letter} size="s" /> {n2(selSum.mean)}</span>
                    </div>
                    <div>
                      {/* the yearly letters beside the average, so it never hides an A year */}
                      <span className="l">האות בכל שנה</span>
                      <span className="v hd-yl">
                        {sel.grade!.years.map(y => (
                          <span key={y.year} className="hd-yl-y" title={String(y.year)}><Letter l={y.letter} size="s" /><span className="num">{String(y.year).slice(2)}</span></span>
                        ))}
                      </span>
                    </div>
                    <div>
                      <span className="l">שינוי בקדנציה</span>
                      <span className={`v num ${selSum.delta == null ? '' : selSum.delta >= 0 ? 'up' : 'down'}`}>{selSum.delta == null ? '—' : signed(selSum.delta)}</span>
                    </div>
                    {sel.prev && prevSum?.mean != null && selSum.mean != null && (
                      <div>
                        <span className="l">
                          מול {sel.prev.term.personSlug === slug ? 'הקדנציה הקודמת שלו/ה' : sel.prev.term.interim ? 'ממלא/ת המקום' : sel.prev.term.name}
                          {' '}({yrsText(sel.prev.window!)})
                        </span>
                        <span className="v num">
                          <Letter l={sel.prev.grade?.letter} size="s" />{' '}
                          <span className={selSum.mean - prevSum.mean >= 0 ? 'up' : 'down'}>{signed(selSum.mean - prevSum.mean)}</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                {sel.grade!.scored === 1 && <div className="ap-term-warn">שנה אחת בלבד בקדנציה זו. מוקדם לשפוט.</div>}
                {sel.term.window[0] < sel.window[0] && (
                  <div className="ap-term-warn">לשנים {sel.term.window[0]}–{sel.window[0] - 1} אין דרגה: המדד מתחיל ב־{sel.window[0]}.</div>
                )}

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

                {focus && breakdown && sc.cfg.domain_cuts && (
                  <LetterBreakdown view={avgView ? 'avg' : 'year'} focus={focus} breakdown={breakdown}
                    yearBreakdowns={yearBreakdowns} grade={sel.grade!} domainCuts={sc.cfg.domain_cuts} />
                )}

                {selYRS.length > 1 && (
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
                          {(sc.cfg!.domains[d] ?? []).map(field => (
                            <MetricTrend key={field} s={metricSeries(field, selYRS, sc.dataYears, sc.scores, sc.anchors, sc.cfg!.metric_cuts)} />
                          ))}
                        </div>
                      </div>
                    ))}

                    <div className="tx-sub">נתוני רקע</div>
                    <div className="mt-legend">לא נכללים במדד: הוצאות ונתוני אוכלוסייה. מוצגים להקשר בלבד.</div>
                    <div className="perf-grid">
                      {ALL.filter(m => BACKGROUND.includes(m.k)).map(m => (
                        <PerformanceChart key={m.k} metricKey={m.k} label={m.l} category={m.cat}
                          years={selYRS} values={selYRS.map(y => sc.D[y]?.[m.k] ?? null)} formatter={m.fn} direction={0} />
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
            <b>מה המדד אינו מודד.</b> {home?.cfg?.scope_note || DEFAULT_SCOPE_NOTE}
            {home?.cfg && <span className="sc-version"> · גרסת שיטה {home.cfg.methodology_version}</span>}
          </div>
        </div>
      </div>

      <footer className="mm-footer">
        המקור: נתוני הלשכה המרכזית לסטטיסטיקה ומשרד הפנים · עיבוד MuniMark · האות מחושבת מול רשויות דומות ואינה דירוג כולל של ראש הרשות.
        {person.photo_source && <> · תמונה: {person.photo_source}{person.photo_license ? ` (${person.photo_license})` : ''}</>}
        {' '}· <Link href="/credits" style={{ color: 'var(--ink-2)', textDecoration: 'underline' }}>קרדיטים ורישיונות</Link>
      </footer>
    </>
  )
}
