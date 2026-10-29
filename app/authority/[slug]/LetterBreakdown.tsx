import type { Score } from '@/types/db'
import { DOMAIN_LABELS, DOMAIN_ORDER, domainYearPoints, extremes, letterFor } from '@/lib/score'
import type { Band, MetricLine, TermGrade } from '@/lib/score'

/** A letter on its colour. */
export function Letter({ l, size = 'm' }: { l: Band | null | undefined; size?: 's' | 'm' | 'l' }) {
  return <span className={`lt lt-${size} ${l ? `lt-${l}` : 'lt-none'}`}>{l ?? '—'}</span>
}

const SUB_LETTERS = 'כל מדד מקבל אות מול רשויות דומות: A ל־15% החזקים, B ל־30% הבאים, C ל־30%, D ל־25% החלשים.'

/**
 * What stands behind the letters of one term, in one of two views:
 *  - a year: that year's domain letters, and its metrics;
 *  - the term average: each domain's letter over the term's years, and each
 *    metric's letter in every one of them.
 * The real value leads each metric line: "53.0%" before "D".
 */
export function LetterBreakdown({ view, focus, breakdown, yearBreakdowns, grade, domainCuts }: {
  view: 'year' | 'avg'
  focus: Score
  breakdown: Record<string, MetricLine[]>
  yearBreakdowns: { year: number; b: Record<string, MetricLine[]> }[]
  grade: TermGrade
  domainCuts: number[]
}) {
  const yrs = grade.years.filter(y => y.points != null).map(y => y.year)
  const termSpan = yrs.length > 1 ? `${yrs[0]}–${yrs[yrs.length - 1]}` : String(yrs[0] ?? '')
  const yearPts = domainYearPoints(breakdown)
  const dom = (d: string) => view === 'avg'
    ? grade.domains[d] ?? { points: null, letter: null }
    : { points: yearPts[d], letter: yearPts[d] == null ? null : letterFor(yearPts[d]!, domainCuts) }
  const { best, worst } = view === 'year' ? extremes(breakdown) : { best: null, worst: null }
  const last = yearBreakdowns[yearBreakdowns.length - 1]

  return (
    <div className="sc-why">
      <div className="sc-why-head">
        <div className="sc-term-title">
          {view === 'avg' ? `מה עומד מאחורי אות הקדנציה (${termSpan})` : `מה עומד מאחורי האות של ${focus.data_year}`}
        </div>
        <div className="sc-why-sub">
          {SUB_LETTERS}{' '}
          {view === 'avg'
            ? 'אות התחום היא ממוצע אותיות המדדים שלו בכל שנות הקדנציה.'
            : `אות התחום היא ממוצע אותיות המדדים שלו ב־${focus.data_year}.`}
        </div>
      </div>

      {(best || worst) && (
        <div className="sc-extremes">
          {best && (
            <div className="sc-ext good">
              <span className="l">החוזקה הבולטת ב־{focus.data_year}</span>
              <b>{best.label}</b> <span className="num">{best.valueText}</span> <Letter l={best.letter} size="s" />
            </div>
          )}
          {worst && worst !== best && (
            <div className="sc-ext weak">
              <span className="l">הנקודה החלשה ב־{focus.data_year}</span>
              <b>{worst.label}</b> <span className="num">{worst.valueText}</span> <Letter l={worst.letter} size="s" />
            </div>
          )}
        </div>
      )}

      <div className="sc-domains">
        {DOMAIN_ORDER.map(d => {
          const { points, letter } = dom(d)
          return (
            <details key={d} className="sc-domain lb-domain">
              <summary>
                <span className="sc-domain-name">{DOMAIN_LABELS[d]}</span>
                <Letter l={letter} />
                <span className="lb-span num">{view === 'avg' ? termSpan : focus.data_year}</span>
                <span className="lb-pts num">{points != null ? `${points.toFixed(2)} נק׳` : 'אין נתון'}</span>
                <span className="sc-chev" aria-hidden>▾</span>
              </summary>
              <div className="sc-metrics">
                {view === 'year' ? (
                  <>
                    <div className="lb-metrics-h">המדדים ב־{focus.data_year}</div>
                    {(breakdown[d] ?? []).map(m => (
                      <div key={m.field} className="lb-metric">
                        <span className="sc-metric-name">{m.label}</span>
                        <span className="lb-metric-val num">{m.valueText}</span>
                        <Letter l={m.letter} size="s" />
                        <span className="sc-metric-peer num">{m.letter == null ? 'לא נכלל השנה: אין נתון' : m.peerText}</span>
                      </div>
                    ))}
                  </>
                ) : (
                  <>
                    <div className="lb-metrics-h lb-avg-row">
                      <span>המדד · הערך ב־{last?.year}</span>
                      <span className="lb-avg-years">{yearBreakdowns.map(y => <span key={y.year} className="num">{y.year}</span>)}</span>
                    </div>
                    {(last?.b[d] ?? []).map(m => (
                      <div key={m.field} className="lb-avg-row lb-avg-line">
                        <span className="sc-metric-name">{m.label} <span className="lb-metric-val num">{m.valueText}</span></span>
                        <span className="lb-avg-years">
                          {yearBreakdowns.map(y => <Letter key={y.year} l={y.b[d]?.find(x => x.field === m.field)?.letter} size="s" />)}
                        </span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </details>
          )
        })}
      </div>
      <div className="sc-coverage num">
        {view === 'year' ? `${focus.metrics_used} מתוך ${focus.metrics_possible} מדדים נכללו ב־${focus.data_year} · ` : ''}
        אות תחום: A=4, B=3, C=2, D=1 בממוצע, ו־A מחייב ממוצע מעל 3
      </div>
    </div>
  )
}
