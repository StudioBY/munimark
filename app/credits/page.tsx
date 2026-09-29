import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { indexProvenance, type ProvenanceRow } from '@/lib/provenance'
import JsonLd from '@/lib/JsonLd'
import { datasetJsonLd, pageMetadata } from '@/lib/seo'

export const revalidate = 86400

export const metadata = pageMetadata({
  title: 'קרדיטים ורישיונות | Munimark',
  description:
    'מקור ורישיון לכל תמונה ולכל טקסט ביוגרפי המוצגים ב-Munimark, לפי אדם, יוצר ורישיון.',
  path: '/credits',
})

type Row = {
  id: number
  name: string | null
  slug: string | null
  photo_url: string | null
  photo_artist: string | null
  photo_license: string | null
  photo_license_url: string | null
  photo_file_page: string | null
  photo_source: string | null
  background: string | null
  background_source_url: string | null
  background_license: string | null
  wikipedia_url: string | null
  authorities: { name_display: string | null; slug: string | null } | null
}

const SOURCE_LABEL: Record<string, string> = {
  'wikimedia-commons': 'ויקישיתוף',
  'he-wikipedia': 'ויקיפדיה העברית',
  'authority-site': 'אתר הרשות',
  'mayor-upload': 'הועלה על ידי ראש הרשות',
  'press-office': 'לשכת הדוברות',
}

export default async function CreditsPage() {
  const supabase = await createClient()

  // Provenance now lives in its own table (migration 011). The legacy columns
  // are still selected below and still used as a fallback, so this page is
  // correct whether or not that migration has run — and a failed query here
  // must not blank the credits, which is a licence obligation, not a feature.
  const { data: provRows } = await supabase
    .from('asset_provenance')
    .select('entity_type, entity_id, field, source, license, license_url, attribution, source_page')
    .eq('entity_type', 'mayor')
  const prov = indexProvenance(provRows as ProvenanceRow[] | null)

  const { data } = await supabase
    .from('mayors')
    .select(
      'id, name, slug, photo_url, photo_artist, photo_license, photo_license_url, ' +
        'photo_file_page, photo_source, background, background_source_url, ' +
        'background_license, wikipedia_url, authorities(name_display, slug)'
    )
    .eq('is_current', true)
    .order('name')

  // The Dataset description states the coverage the tables actually hold:
  // how many authorities, and the first and last data year.
  const [{ count: authorityCount }, { data: firstRow }, { data: lastRow }] = await Promise.all([
    supabase.from('authorities').select('id', { count: 'exact', head: true }),
    supabase.from('authority_yearly').select('data_year').order('data_year', { ascending: true }).limit(1).maybeSingle(),
    supabase.from('authority_yearly').select('data_year').order('data_year', { ascending: false }).limit(1).maybeSingle(),
  ])

  const rows = ((data ?? []) as unknown as Row[]).map(r => ({
    ...r,
    authority: Array.isArray(r.authorities) ? r.authorities[0] : r.authorities,
    photo: prov.get('mayor', r, 'photo_url'),
    text: prov.get('mayor', r, 'background'),
  }))

  const photos = rows
    .filter(r => r.photo_url)
    .sort((a, b) =>
      (a.authority?.name_display ?? '').localeCompare(b.authority?.name_display ?? '', 'he')
    )
  const texts = rows
    .filter(r => r.background && r.text.source_page)
    .sort((a, b) =>
      (a.authority?.name_display ?? '').localeCompare(b.authority?.name_display ?? '', 'he')
    )

  // Photos with no licence on record are listed too, openly. A public site that
  // cannot say where an image came from should say that, not stay silent.
  const unattributed = photos.filter(p => !p.photo.license)

  const byLicence = photos.reduce<Record<string, number>>((acc, p) => {
    const k = p.photo.license ?? 'ללא רישיון מתועד'
    acc[k] = (acc[k] ?? 0) + 1
    return acc
  }, {})

  return (
    <div dir="rtl">
      <JsonLd
        data={datasetJsonLd({
          authorityCount: authorityCount ?? null,
          firstYear: firstRow?.data_year ?? null,
          lastYear: lastRow?.data_year ?? null,
        })}
      />
      <nav className="mm-nav">
        <Link className="nav-back" href="/">→ כל הרשויות</Link>
        <div className="mm-logo">
          <span className="mark" />
          Munimark
        </div>
        <div className="nav-links">
          <a href="#photos">תמונות</a>
          <a href="#texts">טקסטים</a>
        </div>
      </nav>

      <div className="mm-page">
        <div className="section">
          <div className="eyebrow">ייחוס</div>
          <h1 className="sec-title" style={{ fontSize: 26, marginTop: 6 }}>
            קרדיטים ורישיונות
          </h1>
          <p style={{ marginTop: 12, maxWidth: 680, color: 'var(--ink-2)', fontSize: 14, lineHeight: 1.7 }}>
            התמונות והטקסטים הביוגרפיים ב-Munimark נאספו ממקורות פתוחים, רובם מוויקיפדיה
            העברית ומוויקישיתוף. רישיונות <strong>CC BY</strong> ו-<strong>CC BY-SA</strong> מחייבים
            לציין את שם היוצר, והדף הזה הוא מקום הציון. לכל פריט מופיעים היוצר, הרישיון
            וקישור לקובץ במקור — כדי שניתן יהיה לאמת כל אחד מהם באופן עצמאי.
          </p>
          <p style={{ marginTop: 10, maxWidth: 680, color: 'var(--ink-2)', fontSize: 14, lineHeight: 1.7 }}>
            מצאתם פריט שיוחס בטעות, או שאתם בעלי הזכויות ומעדיפים שיוסר —{' '}
            <a href="mailto:info@munimark.co.il" style={{ color: 'var(--accent)' }}>כתבו לנו</a>{' '}
            ונטפל בכך.
          </p>
        </div>

        <div className="section">
          <div className="card" style={{ padding: '18px 20px' }}>
            <div className="eyebrow">בקצרה</div>
            <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', marginTop: 10 }}>
              <Stat label="תמונות" value={photos.length} />
              <Stat label="טקסטים" value={texts.length} />
              {Object.entries(byLicence)
                .sort((a, b) => b[1] - a[1])
                .map(([lic, n]) => (
                  <Stat key={lic} label={lic} value={n} />
                ))}
            </div>
          </div>
        </div>

        {unattributed.length > 0 && (
          <div className="section">
            <div
              className="card"
              style={{ padding: '14px 18px', borderColor: 'var(--brass)', background: 'var(--brass-soft)' }}
            >
              <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>
                <strong>{unattributed.length} תמונות ללא רישיון מתועד.</strong>{' '}
                הן מוצגות כאן בשמן ולא מוסתרות:{' '}
                {unattributed.map(p => p.name).filter(Boolean).join(' · ')}. אנו פועלים לברר את
                מקורן, ונסיר כל תמונה שלא ניתן לאמת את רישיונה.
              </div>
            </div>
          </div>
        )}

        <div className="section" id="photos">
          <div className="sec-header">
            <div className="sec-title">תמונות</div>
            <div className="eyebrow">{photos.length} פריטים</div>
          </div>
          <div className="card tbl-wrap" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line)' }}>
                  <Th>רשות</Th>
                  <Th>ראש הרשות</Th>
                  <Th>יוצר</Th>
                  <Th>רישיון</Th>
                  <Th>מקור</Th>
                </tr>
              </thead>
              <tbody>
                {photos.map((p, i) => (
                  <tr
                    key={`${p.slug}-${i}`}
                    style={{ borderBottom: '1px solid var(--line-2)' }}
                  >
                    <Td>{p.authority?.name_display ?? '—'}</Td>
                    <Td>
                      {p.slug ? (
                        <Link href={`/person/${p.slug}`} style={{ color: 'var(--accent)' }}>
                          {p.name}
                        </Link>
                      ) : (
                        p.name
                      )}
                    </Td>
                    <Td muted>{p.photo.attribution ?? '—'}</Td>
                    <Td>
                      {p.photo.license ? (
                        p.photo.license_url ? (
                          <a
                            href={p.photo.license_url}
                            target="_blank"
                            rel="noopener noreferrer license"
                            style={{ color: 'var(--accent)' }}
                          >
                            {p.photo.license}
                          </a>
                        ) : (
                          p.photo.license
                        )
                      ) : (
                        <span style={{ color: 'var(--neg)' }}>לא מתועד</span>
                      )}
                    </Td>
                    <Td muted>
                      {p.photo.source_page ? (
                        <a
                          href={p.photo.source_page}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--accent)' }}
                        >
                          {SOURCE_LABEL[p.photo.source ?? ''] ?? 'דף הקובץ'}
                        </a>
                      ) : (
                        SOURCE_LABEL[p.photo.source ?? ''] ?? '—'
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="section" id="texts">
          <div className="sec-header">
            <div className="sec-title">טקסטים ביוגרפיים</div>
            <div className="eyebrow">{texts.length} פריטים</div>
          </div>
          <p style={{ marginBottom: 14, maxWidth: 680, color: 'var(--ink-2)', fontSize: 13.5, lineHeight: 1.7 }}>
            הרקע המקצועי המוצג בעמודי האישים לקוח מפסקת הפתיחה של הערך בוויקיפדיה העברית
            ומוצג כלשונו. הטקסטים מופצים ברישיון{' '}
            <a
              href="https://creativecommons.org/licenses/by-sa/4.0/deed.he"
              target="_blank"
              rel="noopener noreferrer license"
              style={{ color: 'var(--accent)' }}
            >
              CC BY-SA 4.0
            </a>
            , המחייב ייחוס והפצה ברישיון זהה. הייחוס הוא לכותבי הערך, כפי שהם מופיעים
            בהיסטוריית העריכות של כל ערך — הקישור שלצד כל שורה מוביל אליה.
          </p>
          <div className="card tbl-wrap" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--line)' }}>
                  <Th>רשות</Th>
                  <Th>ראש הרשות</Th>
                  <Th>רישיון</Th>
                  <Th>הערך במקור</Th>
                </tr>
              </thead>
              <tbody>
                {texts.map((t, i) => (
                  <tr key={`${t.slug}-t-${i}`} style={{ borderBottom: '1px solid var(--line-2)' }}>
                    <Td>{t.authority?.name_display ?? '—'}</Td>
                    <Td>
                      {t.slug ? (
                        <Link href={`/person/${t.slug}`} style={{ color: 'var(--accent)' }}>
                          {t.name}
                        </Link>
                      ) : (
                        t.name
                      )}
                    </Td>
                    <Td muted>{t.text.license ?? 'CC BY-SA'}</Td>
                    <Td>
                      <a
                        href={t.text.source_page!}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--accent)' }}
                      >
                        ויקיפדיה
                      </a>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="section">
          <div className="sec-title" style={{ fontSize: 15, marginBottom: 8 }}>נתוני הביצועים</div>
          <p style={{ maxWidth: 680, color: 'var(--ink-2)', fontSize: 13.5, lineHeight: 1.7 }}>
            הנתונים הכמותיים נלקחים משנתוני <strong>הלשכה המרכזית לסטטיסטיקה</strong> ומלוח
            המחוונים של <strong>משרד הפנים</strong> (municipal-data.org), ומוצגים לאחר עיבוד.
            שדות משני המקורות נשמרים בנפרד גם כשהם מודדים אותו מושג, כדי שניתן יהיה להצליב
            ביניהם. פרסומים ממשלתיים אלה פתוחים לשימוש חוזר.
          </p>
        </div>
      </div>

      <footer className="mm-footer">
        עודכן אוטומטית מתוך מאגר Munimark · דף זה נועד לקיים את חובת הייחוס שברישיונות
        CC BY ו-CC BY-SA
      </footer>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="num" style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th style={{ textAlign: 'right', padding: '11px 14px', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>
      {children}
    </th>
  )
}

function Td({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <td style={{ padding: '10px 14px', color: muted ? 'var(--ink-2)' : 'var(--ink)', verticalAlign: 'top' }}>
      {children}
    </td>
  )
}
