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
 * The seal: the newest data year's letter and that year, nothing else — the
 * years before it sit beside the seal, not inside it. A thin line crosses the
 * ring at 45° and runs out of it, as in the brand deck. The ring text stays in
 * Latin letters on purpose: Hebrew on an SVG textPath renders reversed in some
 * browsers, and a seal that reads backwards is worse than none.
 */
// `plus` is for the head's page (an A streak under one head); the authority page leaves it off.
export function Seal({ letter, plus = false, year, size = 210 }: { letter: Band; plus?: boolean; year: number; size?: number }) {
  const c = 100, rArc = 66, rTop = 86, rBot = 93
  const ticks = Array.from({ length: 60 }, (_, i) => i)
  const accent = letter === 'A' ? 'var(--brand-gold)' : letter === 'B' ? '#fff' : 'rgba(255,255,255,.5)'
  const label = `${letter}${plus ? '+' : ''}`
  // the diagonal: from inside the ring out past the seal's edge, both ways
  const k = Math.SQRT1_2
  const seg = (r0: number, r1: number, s: 1 | -1) =>
    ({ x1: r2(c + s * k * r0), y1: r2(c - s * k * r0), x2: r2(c + s * k * r1), y2: r2(c - s * k * r1) })
  return (
    <svg className="seal" width={size} height={size} viewBox="0 0 200 200" direction="ltr" role="img"
      overflow="visible" aria-label={`דרגה ${label} לשנת ${year}`}>
      <defs>
        <path id="seal-top" d={`M ${c - rTop} ${c} A ${rTop} ${rTop} 0 0 1 ${c + rTop} ${c}`} />
        <path id="seal-bottom" d={`M ${c - rBot} ${c} A ${rBot} ${rBot} 0 0 0 ${c + rBot} ${c}`} />
      </defs>
      <line {...seg(58, 190, 1)} stroke="var(--brand-gold)" strokeOpacity=".7" strokeWidth="1" />
      <line {...seg(58, 190, -1)} stroke="var(--brand-gold)" strokeOpacity=".7" strokeWidth="1" />
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
      <circle cx={c} cy={c} r={rArc} fill="var(--brand-navy)" stroke={accent} strokeWidth="5" />
      <text fontSize="10.5" letterSpacing="3.2" fill="rgba(255,255,255,.75)" fontWeight="600">
        <textPath href="#seal-top" startOffset="50%" textAnchor="middle">MUNIMARK · PERFORMANCE INDEX</textPath>
      </text>
      <text fontSize="10" letterSpacing="3" fill={letter === 'A' ? 'var(--brand-gold)' : 'var(--brand-blue-light)'} fontWeight="700">
        <textPath href="#seal-bottom" startOffset="50%" textAnchor="middle">{`★ BAND ${label} ★`}</textPath>
      </text>
      <text x={c} y={c + 16} textAnchor="middle" fontSize="64" fontWeight="800" fill={letter === 'A' ? 'var(--brand-gold)' : '#fff'}>
        {letter}{plus && <tspan fontSize="30" dy="-26">+</tspan>}
      </text>
      <text x={c} y={c + 40} textAnchor="middle" fontSize="13" fontWeight="600" letterSpacing="1.5" fill="rgba(255,255,255,.75)">{year}</text>
    </svg>
  )
}
