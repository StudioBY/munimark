import type { Band, MetricSeries } from '@/lib/score'
import { Letter } from './LetterBreakdown'

const DOT: Record<Band, string> = { A: 'var(--brand-gold)', B: 'var(--accent)', C: 'var(--brass)', D: 'var(--neg)' }
const r1 = (x: number) => Math.round(x * 10) / 10

/**
 * One scored metric over the term: the real value each year on a line, the
 * year's letter under it, and the peer range (p10–p90 of similar authorities)
 * shaded behind it. Colour follows the letter, not the direction of change:
 * a value can rise and still be a D.
 */
export default function MetricTrend({ s }: { s: MetricSeries }) {
  const W = 280, H = 118, padX = 16, padT = 12, padB = 36
  const vals = s.points.map(p => p.value).filter((v): v is number => v != null)
  const latest = [...s.points].reverse().find(p => p.value != null) ?? null
  const span = [...vals, ...(s.band ? [s.band.worse, s.band.better] : [])]
  let lo = Math.min(...span), hi = Math.max(...span)
  if (!Number.isFinite(lo)) { lo = 0; hi = 1 }
  if (hi === lo) { hi += 1; lo -= 1 }
  const pad = (hi - lo) * 0.12
  lo -= pad; hi += pad
  const n = s.points.length
  const X = (i: number) => r1(n === 1 ? W / 2 : padX + (i * (W - 2 * padX)) / (n - 1))
  const Y = (v: number) => r1(padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB))
  const line = s.points
    .map((p, i) => (p.value == null ? null : `${X(i)},${Y(p.value)}`))
    .filter(Boolean)
    .join(' ')

  return (
    <div className="mt-card">
      <div className="mt-head">
        <span className="mt-name">{s.label}</span>
        {s.higherBetter === false && <span className="mt-dir">נמוך = טוב</span>}
        {latest && (
          <span className="mt-now">
            <span className="num">{s.fmt(latest.value!)}</span>
            <Letter l={latest.letter} size="s" />
          </span>
        )}
      </div>
      {vals.length === 0 ? (
        <div className="mt-empty">אין נתון בשנים אלה</div>
      ) : (
        <svg className="mt-svg" viewBox={`0 0 ${W} ${H}`} role="img"
          aria-label={`${s.label}: ${s.points.map(p => `${p.year} ${p.value == null ? 'אין נתון' : s.fmt(p.value)} ${p.letter ?? ''}`).join(', ')}`}>
          {s.band && (
            <rect x={4} width={W - 8} rx={4}
              y={Y(Math.max(s.band.worse, s.band.better))}
              height={Math.max(1, Y(Math.min(s.band.worse, s.band.better)) - Y(Math.max(s.band.worse, s.band.better)))}
              fill="var(--brand-blue)" fillOpacity={0.08} />
          )}
          <polyline points={line} fill="none" stroke="var(--brand-navy)" strokeOpacity={0.55} strokeWidth={1.6} />
          {s.points.map((p, i) => (
            <g key={p.year}>
              {p.value != null && (
                <circle cx={X(i)} cy={Y(p.value)} r={4.5} fill={p.letter ? DOT[p.letter] : 'var(--ink-3)'} stroke="#fff" strokeWidth={1.5}>
                  <title>{`${p.year}: ${s.fmt(p.value)}${p.letter ? ` · ${p.letter}` : ''}`}</title>
                </circle>
              )}
              <text x={X(i)} y={H - 20} textAnchor="middle" fontSize="11" fontWeight="800"
                fill={p.letter ? DOT[p.letter] : 'var(--ink-3)'}>{p.letter ?? '—'}</text>
              <text x={X(i)} y={H - 6} textAnchor="middle" fontSize="9.5" fill="var(--ink-3)">{p.year}</text>
            </g>
          ))}
        </svg>
      )}
    </div>
  )
}
