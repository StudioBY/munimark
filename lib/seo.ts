import type { Metadata } from 'next'
import type { Authority, AuthorityYearly, Mayor, MayorTerm, Score } from '@/types/db'
import { termCountLabel, termSpanYears } from '@/lib/getMayorForYear'

// ── Discovery layer: metadata, descriptions and JSON-LD ─────────────────────
//
// One rule governs everything in this file, the same one that governs the
// data: nothing is written that the database does not hold. A description
// states only counts and years computed from the rows; a JSON-LD field with
// no value is left out rather than filled with a plausible guess. A short,
// correct object is worth more to a crawler or a model than a full one that
// is partly invented — the second gets quoted, with our name on it.

export const SITE_URL = 'https://munimark.co.il'
export const SITE_NAME = 'Munimark'
export const SITE_DESCRIPTION =
  'ביצועי הרשויות המקומיות בישראל וראשי הרשויות שלהן, על בסיס נתוני הלשכה המרכזית לסטטיסטיקה ומשרד הפנים.'

// ── Metadata ─────────────────────────────────────────────────────────────────

/**
 * Canonical URL, Open Graph and Twitter for one route. Next.js merges
 * `openGraph` shallowly — a page that sets it replaces the layout's object
 * entirely — so siteName and locale are repeated here on every page.
 */
export function pageMetadata(opts: {
  title: string
  description: string
  path: string
  image?: string | null
  type?: 'website' | 'profile'
}): Metadata {
  const images = opts.image ? [opts.image] : undefined
  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: opts.path },
    openGraph: {
      title: opts.title,
      description: opts.description,
      url: opts.path,
      siteName: SITE_NAME,
      locale: 'he_IL',
      type: opts.type ?? 'website',
      images,
    },
    twitter: {
      card: 'summary',
      title: opts.title,
      description: opts.description,
      images,
    },
  }
}

// ── Shared helpers ───────────────────────────────────────────────────────────

/** "עיריית אשדוד", "המועצה המקומית באר יעקב" — spelled out, not abbreviated. */
export function authorityFullName(type: string | null, name: string): string {
  if (type === 'עירייה') return `עיריית ${name}`
  if (type === 'מועצה מקומית') return `המועצה המקומית ${name}`
  if (type === 'מועצה אזורית') return `המועצה האזורית ${name}`
  return name
}

/** tenure_start is stored as a year or a dd/mm/yyyy date; take the year. */
function tenureYear(tenureStart: string | null): number | null {
  const m = tenureStart ? String(tenureStart).match(/(\d{4})/) : null
  return m ? parseInt(m[1]) : null
}

/** Clip at a word boundary so a description never ends mid-word. */
function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return (space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:–—-]+$/, '') + '…'
}

/** Drop null / undefined / empty-array fields: a field with no value is not written. */
function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v != null && !(Array.isArray(v) && v.length === 0)),
  ) as Partial<T>
}

export const authorityUrl = (slug: string) => `${SITE_URL}/mayor/${slug}`
export const personUrl = (slug: string) => `${SITE_URL}/person/${slug}`

// ── Authority (/mayor/[slug]) ────────────────────────────────────────────────

// The 18 B (performance) columns — the same set MayorProfile uses to decide
// whether a year carries performance data. Kept in step with it by hand.
export const B_COLUMNS = [
  'b_bagrut_pct', 'b_bagrut_uni_pct', 'b_dropout_pct', 'b_students_per_class',
  'b_edu_spend_pct', 'b_welfare_spend_pct', 'b_budget_per_capita',
  'b_arnona_collection_pct', 'b_own_revenue_pct', 'b_budget_execution_pct',
  'b_surplus_deficit', 'b_migration_balance', 'b_population_growth_pct',
  'b_construction_starts', 'b_construction_completions', 'b_recycling_pct',
  'b_water_loss_pct', 'b_waste_per_capita',
] as const

type BRow = Pick<AuthorityYearly, 'data_year' | (typeof B_COLUMNS)[number]>

/**
 * How many of the 18 metrics this authority actually has, and over which
 * years. Counted from the rows, not assumed: a regional council without
 * matriculation data has fewer than 18, and the description says so.
 */
export function performanceCoverage(years: BRow[]) {
  const rec = (r: BRow) => r as unknown as Record<string, unknown>
  const withData = years.filter(r => B_COLUMNS.some(c => rec(r)[c] != null))
  const metrics = B_COLUMNS.filter(c => withData.some(r => rec(r)[c] != null)).length
  const ys = withData.map(r => r.data_year)
  return {
    metrics,
    firstYear: ys.length ? Math.min(...ys) : null,
    lastYear: ys.length ? Math.max(...ys) : null,
  }
}

/** "אשדוד — יחיאל לסרי. 18 מדדי ביצוע, 2014–2024, מול רשויות דומות." */
export function authorityDescription(opts: {
  authority: Pick<Authority, 'name_display'>
  mayorName: string | null
  years: BRow[]
  score: Pick<Score, 'comparison_group' | 'solo_group' | 'group_size'> | null
}): string {
  const { authority, mayorName, years, score } = opts
  const head = mayorName ? `${authority.name_display} — ${mayorName}.` : `${authority.name_display}.`
  const cov = performanceCoverage(years)
  if (!cov.metrics || cov.firstYear == null || cov.lastYear == null) {
    return `${head} ביצועי הרשות על בסיס נתוני הלמ"ס ומשרד הפנים.`
  }
  const span = cov.firstYear === cov.lastYear ? `${cov.firstYear}` : `${cov.firstYear}–${cov.lastYear}`
  const metrics = cov.metrics === 1 ? 'מדד ביצוע אחד' : `${cov.metrics} מדדי ביצוע`
  // Only claim a peer comparison when one was actually computed against peers.
  const peers =
    score?.comparison_group && !score.solo_group && (score.group_size ?? 0) > 1
      ? ', מול רשויות דומות'
      : ''
  return `${head} ${metrics}, ${span}${peers}.`
}

export function authorityJsonLd(opts: {
  authority: Authority
  district: string | null
  mayor: Pick<Mayor, 'name' | 'slug'> | null
}) {
  const { authority, district, mayor } = opts
  const url = authorityUrl(authority.slug)
  return {
    '@context': 'https://schema.org',
    ...compact({
      '@type': 'GovernmentOrganization',
      '@id': `${url}#org`,
      name: authorityFullName(authority.authority_type, authority.name_display),
      alternateName: authority.name_display,
      url,
      foundingDate: authority.established_year ? String(authority.established_year) : null,
      address: compact({
        '@type': 'PostalAddress',
        addressRegion: district,
        addressCountry: 'IL',
      }),
      identifier: {
        '@type': 'PropertyValue',
        propertyID: 'סמל רשות — הלשכה המרכזית לסטטיסטיקה',
        value: String(authority.symbol),
      },
      employee: mayor?.name
        ? compact({
            '@type': 'Person',
            '@id': mayor.slug ? `${personUrl(mayor.slug)}#person` : null,
            name: mayor.name,
            url: mayor.slug ? personUrl(mayor.slug) : null,
            jobTitle: `ראש ${authorityFullName(authority.authority_type, authority.name_display)}`,
          })
        : null,
    }),
  }
}

// ── Person (/person/[slug]) ──────────────────────────────────────────────────

type PersonRow = Pick<
  Mayor,
  'name' | 'slug' | 'photo_url' | 'background' | 'wikipedia_url' | 'tenure_start' | 'term_count' | 'tenure_is_minimum' | 'tenure_source'
> & {
  photo_artist?: string | null
  photo_license_url?: string | null
  photo_file_page?: string | null
}

type TermRow = Pick<MayorTerm, 'authority_symbol' | 'authority_type' | 'term_label' | 'is_current'>
type AuthRow = Pick<Authority, 'symbol' | 'authority_type' | 'name_display' | 'slug'>

function authorityForTerm(t: TermRow, authorities: AuthRow[]): AuthRow | undefined {
  return (
    authorities.find(a => a.symbol === t.authority_symbol && a.authority_type === t.authority_type) ??
    authorities.find(a => a.symbol === t.authority_symbol)
  )
}

/** Each authority the person headed, with the years their terms there span. */
function personPosts(terms: TermRow[], authorities: AuthRow[]) {
  const posts = new Map<string, { auth: AuthRow; from: number; to: number | null; current: boolean }>()
  for (const t of terms) {
    const auth = authorityForTerm(t, authorities)
    if (!auth) continue
    const [from, to] = termSpanYears(t.term_label)
    const p = posts.get(auth.slug)
    if (!p) {
      posts.set(auth.slug, { auth, from, to: t.is_current ? null : to, current: t.is_current })
    } else {
      p.from = Math.min(p.from, from)
      p.to = p.to == null || t.is_current || to == null ? null : Math.max(p.to, to)
      p.current ||= t.is_current
    }
  }
  return [...posts.values()].sort((a, b) => b.from - a.from)
}

/**
 * "יחיאל לסרי — ראש עיריית אשדוד, בתפקיד מ־2008, 3 קדנציות. <lead>"
 * Lower bounds stay lower bounds: "מ־2013 לפחות", "לפחות 3 קדנציות".
 */
export function personDescription(opts: {
  person: PersonRow
  terms: TermRow[]
  authorities: AuthRow[]
}): string {
  const { person, terms, authorities } = opts
  const name = person.name ?? 'ראש רשות'
  const posts = personPosts(terms, authorities)
  const current = posts.find(p => p.current)
  const past = posts.filter(p => !p.current)

  const parts: string[] = []
  if (current) {
    let role = `ראש ${authorityFullName(current.auth.authority_type, current.auth.name_display)}`
    const year = tenureYear(person.tenure_start)
    if (year) {
      // Same reading as PersonProfile: a "mixed" source already carries an
      // exact start year even when the term count is a floor.
      const isMin = Boolean(person.tenure_is_minimum) && !(person.tenure_source ?? '').startsWith('mixed')
      role += `, בתפקיד מ־${year}${isMin ? ' לפחות' : ''}`
    }
    const count = termCountLabel(person.term_count ?? null, Boolean(person.tenure_is_minimum))
    if (count) role += `, ${count}`
    parts.push(role)
  }
  for (const p of past) {
    const span = p.to ? `${p.from}–${p.to}` : `${p.from}–`
    parts.push(`${current ? 'קודם לכן ' : ''}ראש ${authorityFullName(p.auth.authority_type, p.auth.name_display)} (${span})`)
  }

  const head = parts.length ? `${name} — ${parts.join('; ')}.` : `${name}.`
  const lead = person.background ? ` ${person.background}` : ''
  return clip(head + lead, 220)
}

export function personJsonLd(opts: {
  person: PersonRow
  terms: TermRow[]
  authorities: AuthRow[]
}) {
  const { person, terms, authorities } = opts
  const url = person.slug ? personUrl(person.slug) : null
  const current = personPosts(terms, authorities).find(p => p.current)
  const orgName = current ? authorityFullName(current.auth.authority_type, current.auth.name_display) : null

  // An image with a recorded licence is described as one, so the credit
  // travels with the photo. Without a licence it is just a URL — the credits
  // page already says openly which photos lack one.
  const image = person.photo_url
    ? person.photo_license_url
      ? compact({
          '@type': 'ImageObject',
          contentUrl: person.photo_url,
          url: person.photo_url,
          license: person.photo_license_url,
          creditText: person.photo_artist,
          acquireLicensePage: person.photo_file_page,
        })
      : person.photo_url
    : null

  return {
    '@context': 'https://schema.org',
    ...compact({
      '@type': 'Person',
      '@id': url ? `${url}#person` : null,
      name: person.name,
      url,
      image,
      jobTitle: orgName ? `ראש ${orgName}` : null,
      worksFor: current
        ? {
            '@type': 'GovernmentOrganization',
            '@id': `${authorityUrl(current.auth.slug)}#org`,
            name: orgName,
            url: authorityUrl(current.auth.slug),
          }
        : null,
      description: person.background,
      sameAs: person.wikipedia_url ? [person.wikipedia_url] : null,
    }),
  }
}

// ── Site (/ and /credits) ────────────────────────────────────────────────────

export function websiteJsonLd() {
  // No SearchAction: the site has no search yet, and declaring one would
  // point crawlers at a URL that returns nothing.
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: 'he',
    description: SITE_DESCRIPTION,
  }
}

export function datasetJsonLd(opts: {
  authorityCount: number | null
  firstYear: number | null
  lastYear: number | null
}) {
  const { authorityCount, firstYear, lastYear } = opts
  return {
    '@context': 'https://schema.org',
    ...compact({
      '@type': 'Dataset',
      name: 'Munimark — מדדי ביצוע של הרשויות המקומיות בישראל',
      description:
        (authorityCount ? `נתוני ביצוע שנתיים של ${authorityCount} רשויות מקומיות בישראל` : 'נתוני ביצוע שנתיים של הרשויות המקומיות בישראל') +
        ' — חינוך, תקציב, דיור, סביבה והגירה — לצד פרטי ראשי הרשויות. מעובד מפרסומי הלשכה המרכזית לסטטיסטיקה ומלוח המחוונים של משרד הפנים.',
      url: `${SITE_URL}/credits`,
      inLanguage: 'he',
      temporalCoverage: firstYear && lastYear ? `${firstYear}/${lastYear}` : null,
      spatialCoverage: { '@type': 'Place', name: 'ישראל' },
      creator: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
      isBasedOn: [
        {
          '@type': 'Dataset',
          name: 'נתוני הרשויות המקומיות — הלשכה המרכזית לסטטיסטיקה',
          creator: { '@type': 'GovernmentOrganization', name: 'הלשכה המרכזית לסטטיסטיקה', url: 'https://www.cbs.gov.il' },
        },
        {
          '@type': 'Dataset',
          name: 'לוח המחוונים של משרד הפנים',
          url: 'https://municipal-data.org',
          creator: { '@type': 'GovernmentOrganization', name: 'משרד הפנים' },
        },
      ],
    }),
  }
}
