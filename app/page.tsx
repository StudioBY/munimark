import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const revalidate = 3600

export default async function HomePage() {
  const supabase = await createClient()

  const { data: authorities } = await supabase
    .from('authorities')
    .select(`
      id, slug, name_display,
      mayors(name, photo_url),
      authority_yearly(h_authority_type, h_district, data_year)
    `)
    .order('name_display')

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {authorities.map((auth: any) => {
              const mayor = Array.isArray(auth.mayors) ? auth.mayors[0] : auth.mayors
              const latestYearData = (auth.authority_yearly as any[])
                ?.sort((a: any, b: any) => b.data_year - a.data_year)[0]

              return (
                <Link
                  key={auth.slug}
                  href={`/mayor/${auth.slug}`}
                  className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all p-4 flex gap-4 items-center"
                >
                  {mayor?.photo_url ? (
                    <img
                      src={mayor.photo_url}
                      alt={mayor.name ?? ''}
                      className="w-14 h-14 rounded-xl object-cover bg-gray-100 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-blue-100 flex items-center justify-center text-2xl flex-shrink-0">👤</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-900 truncate">{auth.name_display}</div>
                    <div className="text-sm text-gray-500 truncate">{mayor?.name ?? '—'}</div>
                    <div className="flex gap-2 mt-1.5 flex-wrap">
                      {latestYearData?.h_authority_type && (
                        <span className="text-[11px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">
                          {latestYearData.h_authority_type}
                        </span>
                      )}
                      {latestYearData?.h_district && (
                        <span className="text-[11px] bg-gray-50 text-gray-500 px-1.5 py-0.5 rounded">
                          {latestYearData.h_district}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </main>

      <footer className="max-w-4xl mx-auto px-4 pb-10 text-xs text-gray-400 leading-relaxed">
        המקור: נתוני הלשכה המרכזית לסטטיסטיקה ומשרד הפנים · עיבוד Munimark ·{' '}
        <Link href="/credits" className="underline hover:text-gray-600">קרדיטים ורישיונות</Link>
      </footer>
    </div>
  )
}
