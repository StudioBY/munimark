import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import JsonLd from '@/lib/JsonLd'
import { SITE_DESCRIPTION, pageMetadata, websiteJsonLd } from '@/lib/seo'
import AuthorityDirectory, { type DirectoryRow } from './AuthorityDirectory'

export const revalidate = 3600

export const metadata = pageMetadata({
  title: 'Munimark — דירוג ראשי רשויות',
  description: SITE_DESCRIPTION,
  path: '/',
})

export default async function HomePage() {
  const supabase = await createClient()

  const { data: authorities } = await supabase
    .from('authorities')
    .select(`
      id, slug, name_display,
      mayors(name, photo_url, is_current),
      authority_yearly(h_authority_type, h_district, data_year)
    `)
    .order('name_display')

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <JsonLd data={websiteJsonLd()} />
      <header className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-black text-gray-900">Munimark</h1>
          <p className="text-sm text-gray-500 mt-1">דירוג וניתוח ביצועי ראשי רשויות מקומיות בישראל</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {!authorities?.length ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg">אין נתונים עדיין</p>
            <p className="text-sm mt-2">הרץ את סקריפט הייבוא כדי לטעון את הנתונים</p>
            <code className="mt-3 block text-xs bg-gray-100 p-3 rounded-lg text-left">
              npx tsx --env-file=.env.local scripts/import-data.ts
            </code>
          </div>
        ) : (
          <AuthorityDirectory rows={authorities.map(toDirectoryRow)} />
        )}
      </main>

      <footer className="max-w-4xl mx-auto px-4 pb-10 text-xs text-gray-400 leading-relaxed">
        המקור: נתוני הלשכה המרכזית לסטטיסטיקה ומשרד הפנים · עיבוד Munimark ·{' '}
        <Link href="/credits" className="underline hover:text-gray-600">קרדיטים ורישיונות</Link>
      </footer>
    </div>
  )
}

type AuthorityQueryRow = {
  slug: string
  name_display: string
  mayors: { name: string | null; photo_url: string | null; is_current: boolean }[] | null
  authority_yearly: { h_authority_type: string | null; h_district: string | null; data_year: number }[] | null
}

function toDirectoryRow(auth: AuthorityQueryRow): DirectoryRow {
  // Since migration 006 an authority can hold former heads too; the card and
  // the search are about the one serving now. No current head -> none shown.
  const mayor = (auth.mayors ?? []).find(m => m.is_current) ?? null

  // Type and district from the LATEST year that records them: six authorities
  // were upgraded from local council to city inside the data window, so an
  // earlier year would file them under the wrong type.
  const years = [...(auth.authority_yearly ?? [])].sort((a, b) => b.data_year - a.data_year)
  const latest = (key: 'h_authority_type' | 'h_district') => years.find(y => y[key])?.[key] ?? null

  return {
    slug: auth.slug,
    name: auth.name_display,
    mayorName: mayor?.name ?? null,
    mayorPhoto: mayor?.photo_url ?? null,
    authorityType: latest('h_authority_type'),
    district: latest('h_district'),
  }
}
