import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function fetchThumbnail(wikipediaUrl: string): Promise<string | null> {
  const title = wikipediaUrl.split('/wiki/').at(-1)
  if (!title) return null

  const apiUrl = `https://he.wikipedia.org/api/rest_v1/page/summary/${title}`

  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(apiUrl, {
      headers: { 'User-Agent': 'Munimark/1.0 (munimark.co.il)' },
    })
    if (res.status === 429) {
      const wait = attempt * 3000
      console.warn(`  429 rate-limit for ${title} — waiting ${wait / 1000}s (attempt ${attempt})`)
      await new Promise(r => setTimeout(r, wait))
      continue
    }
    if (!res.ok) {
      console.warn(`  HTTP ${res.status} for ${title}`)
      return null
    }
    const json = await res.json() as any
    return json?.thumbnail?.source ?? null
  }

  console.warn(`  Gave up after retries: ${title}`)
  return null
}

async function main() {
  // Fetch all mayors with wikipedia_url set but photo_url missing
  const { data: mayors, error } = await sb
    .from('mayors')
    .select('id, authority_id, name, wikipedia_url, photo_url')
    .not('wikipedia_url', 'is', null)
    .is('photo_url', null)

  if (error) { console.error('Failed to fetch mayors:', error); process.exit(1) }
  if (!mayors?.length) { console.log('No mayors need photo update.'); return }

  console.log(`Fetching photos for ${mayors.length} mayors...\n`)

  let found = 0, stillNull = 0, errors = 0

  for (const mayor of mayors) {
    const photoUrl = await fetchThumbnail(mayor.wikipedia_url!)

    if (!photoUrl) {
      console.log(`  NULL  ${mayor.name ?? `id:${mayor.id}`} — no thumbnail`)
      stillNull++
      continue
    }

    const { error: upErr } = await sb
      .from('mayors')
      .update({ photo_url: photoUrl })
      .eq('id', mayor.id)

    if (upErr) {
      console.error(`  ERROR ${mayor.name ?? `id:${mayor.id}`}:`, upErr.message)
      errors++
    } else {
      console.log(`  OK    ${mayor.name ?? `id:${mayor.id}`} → ${photoUrl}`)
      found++
    }

    // Be polite to Wikipedia
    await new Promise(r => setTimeout(r, 1000))
  }

  console.log('\n─────────────────────────────────')
  console.log(`Photos found & saved: ${found}`)
  console.log(`Still null:           ${stillNull}`)
  console.log(`Errors:               ${errors}`)
}

main().catch(console.error)
