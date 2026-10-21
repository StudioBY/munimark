import type { Band } from '@/lib/score'

const r2 = (x: number) => Math.round(x * 100) / 100

/** The MuniMark mark: a broken ring around a dot, as in the brand deck. */
export function MunimarkMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <path d="M16 3.5a12.5 12.5 0 1 1-11.1 6.8" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <circle cx="16" cy="16" r="4.6" fill="currentColor" />
    </svg>
  )
}

/**
 * The seal: the three-year score as an arc on a ring, the way the deck shows
 * it. The ring text stays in Latin letters on purpose: Hebrew on an SVG
 * textPath renders reversed in some browsers, and a seal that reads backwards
 * is worse than none.
 */
export function Seal({ score, band, size = 210 }: { score: number; band: Band; size?: number }) {
  const c = 100, rArc = 66, rTop = 86, rBot = 93, circ = 2 * Math.PI * rArc
  const pct = Math.max(0, Math.min(100, score)) / 100
  const ticks = Array.from({ length: 60 }, (_, i) => i)
  const accent = band === 'A' ? 'var(--brand-gold)' : 'var(--brand-blue-light)'
  return (
    <svg className="seal" width={size} height={size} viewBox="0 0 200 200" direction="ltr" role="img" aria-label={`ציון ${score.toFixed(1)} מתוך 100, דרגה ${band}`}>
      <defs>
        <path id="seal-top" d={`M ${c - rTop} ${c} A ${rTop} ${rTop} 0 0 1 ${c + rTop} ${c}`} />
        <path id="seal-bottom" d={`M ${c - rBot} ${c} A ${rBot} ${rBot} 0 0 0 ${c + rBot} ${c}`} />
      </defs>
      <circle cx={c} cy={c} r={98} fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="1" />
      <circle cx={c} cy={c} r={78} fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="1" />
      {ticks.map(i => {
        const a = (i / 60) * 2 * Math.PI
        const long = i % 5 === 0
        return (
          // rounded: server and browser differ in the last float digit and React flags the mismatch
          <line key={i} x1={r2(c + Math.sin(a) * 78)} y1={r2(c - Math.cos(a) * 78)}
            x2={r2(c + Math.sin(a) * (long ? 73 : 75))} y2={r2(c - Math.cos(a) * (long ? 73 : 75))}
            stroke="rgba(255,255,255,.28)" strokeWidth="1" />
        )
      })}
      <circle cx={c} cy={c} r={rArc} fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.12)" strokeWidth="8" />
      <circle cx={c} cy={c} r={rArc} fill="none" stroke={accent} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={`${r2(circ * pct)} ${r2(circ)}`} transform={`rotate(-90 ${c} ${c})`} />
      <text fontSize="10.5" letterSpacing="3.2" fill="rgba(255,255,255,.75)" fontWeight="600">
        <textPath href="#seal-top" startOffset="50%" textAnchor="middle">MUNIMARK · PERFORMANCE INDEX</textPath>
      </text>
      <text fontSize="10" letterSpacing="3" fill={accent} fontWeight="700">
        <textPath href="#seal-bottom" startOffset="50%" textAnchor="middle">{`★ BAND ${band} ★`}</textPath>
      </text>
      <text x={c} y={c + 6} textAnchor="middle" fontSize="44" fontWeight="800" fill="#fff" letterSpacing="-2">{score.toFixed(1)}</text>
      <text x={c} y={c + 28} textAnchor="middle" fontSize="12" fill="rgba(255,255,255,.6)" fontWeight="600">/ 100</text>
    </svg>
  )
}
