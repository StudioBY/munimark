'use client'

import type { AuthorityYearly, Score, ScoringAnchor, ScoringConfig } from '@/types/db'
import {
  DOMAIN_LABELS, DOMAIN_ORDER, DEFAULT_SCOPE_NOTE,
  domainScore, metricBreakdown, parseGroup, termSummary, extremes,
} from '@/lib/score'
import type { Band, MetricLine } from '@/lib/score'

const BAND_COLOR: Record<Band, string> = { A: 'var(--pos)', B: 'var(--accent)', C: 'var(--brass)', D: 'var(--neg)' }
const BAND_SOFT: Record<Band, string> = { A: 'var(--pos-soft)', B: 'var(--accent-soft)', C: 'var(--brass-soft)', D: 'var(--neg-soft)' }

const n1 = (v: number | null | undefined) => (v == null ? '—' : Number(v).toFixed(1))
const signed = (v: number) => (v > 0 ? '+' : '') + v.toFixed(1)

/** The badge: the band and the three-year score it rests on. Used in the hero. */
export function BandBadge({ score }: { score: Score | null }) {
  const band = (score?.band ?? null) as Band | null
  if (!score || !band) {
    return (
      <div className="sc-badge sc-badge-empty">
        <div className="sc-badge-letter">—</div>
        <div className="sc-badge-sub">אין ציון</div>
      </div>
    )
  }
  return (
    <div className="sc-badge" style={{ borderColor: BAND_COLOR[band], background: BAND_SOFT[band] }}>
      <div className="sc-badge-letter" style={{ color: BAND_COLOR[band] }}>{band}</div>
      <div className="sc-badge-sub"><span className="num">{n1(score.score_3yr)}</span> מתוך 100</div>
    </div>
  )
}

export function threeYearSpan(s: Score): string {
  const n = s.years_in_mean ?? 1
  return n > 1 ? `${s.data_year - n + 1}–${s.data_year}` : `${s.data_year}`
}

// ── Trend: one bar per scored year, the term window highlighted ──────────────
function Trend({ scores, window, cfg, focusYear }: {
  scores: Score[]; window: [number, number]; cfg: ScoringConfig; focusYear: number | null
}) {
  const W = 560, H = 190, padT = 14, padB = 22, padX = 6, padR = 44
  const ys = scores.filter(s => s.score != null).sort((a, b) => a.data_year - b.data_year)
  if (!ys.length) return null
  const slot = (W - padX - padR) / ys.length
  const bw = Math.min(34, slot * 0.62)
  const Y = (v: number) => padT + (1 - v / 100) * (H - padT - padB)
  const cuts: [number, Band][] = [[Number(cfg.cut_b_a), 'A'], [Number(cfg.cut_c_b), 'B'], [Number(cfg.cut_d_c), 'C']]
  return (
    <svg className="sc-trend" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="ציון שנתי לאורך השנים">
      {cuts.map(([c, b]) => (
        <g key={b}>
          <line x1={padX} x2={W - padR + 4} y1={Y(c)} y2={Y(c)} stroke="var(--ink-3)" strokeOpacity={0.45} strokeDasharray="3 4" />
          <text x={W - padR + 8} y={Y(c) + 3} fontSize="9.5" fill="var(--ink-3)" textAnchor="start">{b}</text>
        </g>
      ))}
      {ys.map((s, i) => {
        const inWin = s.data_year >= window[0] && s.data_year <= window[1]
        const x = padX + i * slot + (slot - bw) / 2
        const v = Number(s.score)
        const focus = s.data_year === focusYear
        return (
          <g key={s.data_year}>
            <title>{`${s.data_year}: ${v.toFixed(1)}`}</title>
            <rect x={x} y={Y(v)} width={bw} height={Y(0) - Y(v)} rx={3}
              fill={inWin ? 'var(--accent)' : 'var(--line)'} opacity={focus ? 1 : inWin ? 0.75 : 1} />
            <text x={x + bw / 2} y={Y(v) - 4} fontSize="10" textAnchor="middle"
              fill={inWin ? 'var(--ink)' : 'var(--ink-3)'} fontWeight={focus ? 700 : 500}>{Math.round(v)}</text>
            <text x={x + bw / 2} y={H - 6} fontSize="10" textAnchor="middle"
              fill={focus ? 'var(--ink)' : 'var(--ink-3)'} fontWeight={focus ? 700 : 400}>{s.data_year}</text>
          </g>
        )
      })}
    </svg>
  )
}

export function Bar({ v }: { v: number | null }) {
  return (
    <div className="sc-bar">
      {v != null && <div className="sc-bar-fill" style={{ width: `${Math.max(2, v)}%` }} />}
    </div>
  )
}

/** Domains and metrics for one scored year: the "why" behind the number. */
export function WhyBreakdown({ focus, breakdown }: { focus: Score; breakdown: Record<string, MetricLine[]> }) {
  const { best, worst } = extremes(breakdown)
  return (
      <div className="sc-why">
        <div className="sc-why-head">
          <div className="sc-term-title">מה מרכיב את הציון ב־{focus.data_year}</div>
          <div className="sc-why-sub">
            ארבעה תחומים במשקל שווה. כל מדד מקבל 0–100 מול קבוצת ההשוואה: 0 הוא רמת העשירון החלש בקבוצה, 100 רמת העשירון החזק.
          </div>
        </div>

        {(best || worst) && (
          <div className="sc-extremes">
            {best && <div className="sc-ext good"><span className="l">החוזקה הבולטת</span><b>{best.label}</b> <span className="num">{Math.round(best.score!)}</span></div>}
            {worst && worst !== best && <div className="sc-ext weak"><span className="l">הנקודה החלשה</span><b>{worst.label}</b> <span className="num">{Math.round(worst.score!)}</span></div>}
          </div>
        )}

        <div className="sc-domains">
          {DOMAIN_ORDER.map(d => {
            const v = domainScore(focus, d)
            const lines = breakdown[d] ?? []
            return (
              <details key={d} className="sc-domain">
                <summary>
                  <span className="sc-domain-name">{DOMAIN_LABELS[d]}</span>
                  <Bar v={v} />
                  <span className="sc-domain-v num">{v == null ? 'אין נתון' : Math.round(v)}</span>
                  <span className="sc-chev" aria-hidden>▾</span>
                </summary>
                <div className="sc-metrics">
                  {lines.map(m => (
                    <div key={m.field} className="sc-metric">
                      <span className="sc-metric-name">{m.label}</span>
                      <span className="sc-metric-val num">{m.valueText}</span>
                      <Bar v={m.score} />
                      <span className="sc-metric-score num">{m.score == null ? '—' : Math.round(m.score)}</span>
                      <span className="sc-metric-peer num">{m.score == null ? 'לא נכלל השנה: אין נתון' : m.peerText}</span>
                    </div>
                  ))}
                </div>
              </details>
            )
          })}
        </div>
        <div className="sc-coverage num">
          {focus.metrics_used} מתוך {focus.metrics_possible} מדדים נכללו בציון של {focus.data_year}
        </div>
      </div>
  )
}

// ── Main section ─────────────────────────────────────────────────────────────
export default function ScoreSection({ scores, anchors, cfg, years, window, termName, focusYear }: {
  scores: Score[]
  anchors: ScoringAnchor[]
  cfg: ScoringConfig | null
  years: AuthorityYearly[]
  window: [number, number]
  termName: string
  focusYear: number | null
}) {
  const scopeNote = cfg?.scope_note || DEFAULT_SCOPE_NOTE

  if (!cfg || !scores.length) {
    return (
      <div className="card sc-card">
        <div className="sc-empty">
          <div className="sc-empty-title">אין קבוצת השוואה</div>
          <p>
            הציון מחושב מול רשויות מאותו סוג ובאותו אשכול חברתי־כלכלי, ונדרשות לפחות חמש רשויות שונות בקבוצה.
            לרשות זו אין קבוצה כזו, ולכן לא חושב לה ציון. זה לא ציון אפס.
          </p>
        </div>
      </div>
    )
  }

  const sorted = [...scores].sort((a, b) => a.data_year - b.data_year)
  const latest = sorted[sorted.length - 1]
  const term = termSummary(sorted, window)
  // The year whose domains are broken down: the selected year if it was scored,
  // otherwise the last scored year of the term, otherwise the latest overall.
  const focus = sorted.find(s => s.data_year === focusYear) ?? term.last ?? latest
  const row = years.find(y => y.data_year === focus.data_year)
  const breakdown = metricBreakdown(row, focus.comparison_group, anchors, cfg.domains)
  const grp = parseGroup(focus.comparison_group)
  const latestBand = latest.band as Band | null
  const held = latest.band && latest.band_natural && latest.band !== latest.band_natural
  // The current band rests on three years; if most of them fall before this
  // term began, the badge is mostly the previous term's record. Say so.
  const bandFrom = latest.data_year - (latest.years_in_mean ?? 1) + 1
  const bandMostlyBeforeTerm = latest.data_year >= window[0] && latest.data_year <= window[1] &&
    (window[0] - bandFrom) > (latest.data_year - window[0] + 1)

  return (
    <div className="card sc-card">
      {/* ── Headline ── */}
      <div className="sc-head">
        <div className="sc-head-band">
          <BandBadge score={latest} />
        </div>
        <div className="sc-head-text">
          <div className="sc-head-title">
            דרגה {latestBand ?? '—'} במדד ניהול וביצועים
            <span className="sc-asof"> · נכון לנתוני {latest.data_year}</span>
          </div>
          <div className="sc-head-sub">
            ציון <b className="num">{n1(latest.score_3yr)}</b> מתוך 100, ממוצע השנים {threeYearSpan(latest)}.
            {' '}הדרגה נקבעת מממוצע של שלוש שנים, לא משנה בודדת.
          </div>
          {held && (
            <div className="sc-note">
              הממוצע לבדו היה נותן דרגה {latest.band_natural}. הדרגה נשמרת עד שהציון חוצה את הגבול ב־{cfg.hysteresis_pts ?? 2} נקודות לפחות, כדי שתנודה קטנה לא תחליף דרגה.
            </div>
          )}
          {bandMostlyBeforeTerm && (
            <div className="sc-note">
              רוב השנים שמאחורי הדרגה הנוכחית קודמות לקדנציה הנוכחית. היא משקפת בעיקר את הקדנציה הקודמת.
            </div>
          )}
        </div>
        <div className="sc-head-group">
          <div className="eyebrow">קבוצת השוואה ({focus.data_year})</div>
          <div className="sc-group-name">{grp.type} · אשכול {grp.cluster ?? '—'}</div>
          <div className="sc-group-meta num">{latest.group_size ?? '—'} רשויות בקבוצה ב־{latest.data_year}</div>
        </div>
      </div>

      {/* ── Term record ── */}
      <div className="sc-term">
        <div className="sc-term-title">{termName}</div>
        {term.years.length ? (
          <div className="sc-term-stats">
            <div className="sc-stat">
              <span className="l">ציון ממוצע בקדנציה</span>
              <span className="v num">{n1(term.mean)}</span>
            </div>
            <div className="sc-stat">
              <span className="l">שנה ראשונה ← אחרונה</span>
              <span className="v num">
                {term.first && `${n1(term.first.score)} (${term.first.data_year})`}
                {term.delta != null && term.last && ` ← ${n1(term.last.score)} (${term.last.data_year})`}
              </span>
            </div>
            <div className="sc-stat">
              <span className="l">שינוי לאורך הקדנציה</span>
              <span className={`v num ${term.delta == null ? '' : term.delta >= 0 ? 'up' : 'down'}`}>
                {term.delta == null ? 'שנה אחת בלבד' : `${signed(term.delta)} נק׳`}
              </span>
            </div>
            <div className="sc-stat">
              <span className="l">שנים עם ציון</span>
              <span className="v num">
                {term.years.length} מתוך {Math.min(window[1], latest.data_year) - window[0] + 1}
                {window[1] > latest.data_year && <small className="sc-sofar"> שפורסמו עד כה</small>}
              </span>
            </div>
          </div>
        ) : (
          <div className="sc-term-none">אין ציון לשנות קדנציה זו. הציונים מחושבים לשנים 2016–2024.</div>
        )}
        <Trend scores={sorted} window={window} cfg={cfg} focusYear={focus.data_year} />
        <div className="sc-trend-legend">
          <span><i style={{ background: 'var(--accent)' }} />שנות הקדנציה</span>
          <span><i style={{ background: 'var(--line)' }} />שנים אחרות</span>
          <span>ציון שנה בודדת · הקווים המקווקווים הם ספי הדרגות</span>
        </div>
      </div>

      <WhyBreakdown focus={focus} breakdown={breakdown} />

      {/* ── Scope ── */}
      <div className="sc-scope">
        <b>מה המדד אינו מודד.</b> {scopeNote}
        <span className="sc-version"> · גרסת שיטה {latest.methodology_version}</span>
      </div>
    </div>
  )
}
