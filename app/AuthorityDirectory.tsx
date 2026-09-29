'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { matchesQuery, searchWords } from '@/lib/hebrewSearch'

export interface DirectoryRow {
  slug: string
  name: string
  mayorName: string | null
  mayorPhoto: string | null
  authorityType: string | null
  district: string | null
}

const ALL = ''

// Controls use the design-system tokens from globals.css through Tailwind's
// arbitrary values, so the page stays in Tailwind without a second palette.
const control =
  'h-11 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-base text-[var(--ink)] ' +
  'outline-none transition-colors focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]'

export default function AuthorityDirectory({ rows }: { rows: DirectoryRow[] }) {
  const [query, setQuery] = useState('')
  const [type, setType] = useState(ALL)
  const [district, setDistrict] = useState(ALL)

  // Normalise once per row, not once per keystroke. The Latin slug is
  // searched too, so "tel aviv" finds תל אביב.
  const indexed = useMemo(
    () => rows.map(r => ({ row: r, words: searchWords([r.name, r.mayorName, r.slug]) })),
    [rows],
  )

  // Options come from the data itself — no list of types or districts is
  // hard-coded, and an authority with no recorded district simply has none.
  const types = useMemo(() => distinct(rows.map(r => r.authorityType)), [rows])
  const districts = useMemo(() => distinct(rows.map(r => r.district)), [rows])

  const visible = indexed
    .filter(
      ({ row, words }) =>
        (type === ALL || row.authorityType === type) &&
        (district === ALL || row.district === district) &&
        matchesQuery(words, query),
    )
    .map(i => i.row)

  const q = query.trim()
  const filtered = type !== ALL || district !== ALL
  const reset = () => {
    setQuery('')
    setType(ALL)
    setDistrict(ALL)
  }

  return (
    <>
      <div role="search" className="mb-4 flex flex-col gap-2 sm:flex-row">
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="חיפוש לפי שם רשות או ראש רשות"
          aria-label="חיפוש לפי שם רשות או שם ראש הרשות"
          autoComplete="off"
          enterKeyHint="search"
          className={`${control} flex-1 placeholder:text-[var(--ink-3)]`}
        />
        <div className="flex gap-2">
          <select
            value={type}
            onChange={e => setType(e.target.value)}
            aria-label="סינון לפי סוג רשות"
            className={`${control} min-w-0 flex-1 sm:flex-none`}
          >
            <option value={ALL}>כל סוגי הרשויות</option>
            {types.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select
            value={district}
            onChange={e => setDistrict(e.target.value)}
            aria-label="סינון לפי מחוז"
            className={`${control} min-w-0 flex-1 sm:flex-none`}
          >
            <option value={ALL}>כל המחוזות</option>
            {districts.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      <p aria-live="polite" className="mb-3 text-sm text-[var(--ink-3)]">
        מציג {visible.length} מתוך {rows.length}
      </p>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--line)] px-4 py-14 text-center text-[var(--ink-2)]">
          <p className="text-base">
            {q ? <>לא נמצאה רשות בשם &quot;{q}&quot;</> : 'לא נמצאה רשות'}
            {filtered && ' בסינון שנבחר'}
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-3 text-sm font-semibold text-[var(--accent)] underline underline-offset-4"
          >
            ניקוי החיפוש והסינון
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {visible.map(auth => (
            <Link
              key={auth.slug}
              href={`/mayor/${auth.slug}`}
              className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all p-4 flex gap-4 items-center"
            >
              {auth.mayorPhoto ? (
                <img
                  src={auth.mayorPhoto}
                  alt={auth.mayorName ?? ''}
                  className="w-14 h-14 rounded-xl object-cover bg-gray-100 flex-shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-blue-100 flex items-center justify-center text-2xl flex-shrink-0">👤</div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-bold text-gray-900 truncate">{auth.name}</div>
                <div className="text-sm text-gray-500 truncate">{auth.mayorName ?? '—'}</div>
                <div className="flex gap-2 mt-1.5 flex-wrap">
                  {auth.authorityType && (
                    <span className="text-[11px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">
                      {auth.authorityType}
                    </span>
                  )}
                  {auth.district && (
                    <span className="text-[11px] bg-gray-50 text-gray-500 px-1.5 py-0.5 rounded">
                      {auth.district}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}

function distinct(values: (string | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b, 'he'))
}
