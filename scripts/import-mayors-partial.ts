import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SOURCE = path.resolve(
  '/Users/mac/Desktop/MuniMark/output/raw_extractions/wikipedia/mayors_partial_2026-06-04.json'
)

const SKIP_SYMBOLS = new Set([7300]) // נצרת — acting committee

async function main() {
  const raw = JSON.parse(fs.readFileSync(SOURCE, 'utf8'))
  const records: any[] = raw.data

  // Build symbol → record map from JSON
  const bySymbol = new Map<number, any>()
  for (const rec of records) bySymbol.set(rec['סמל_רשות'], rec)

  // Fetch all authorities
  const { data: auths, error: authErr } = await sb
    .from('authorities')
    .select('id, symbol, name_display')
  if (authErr) { console.error('Failed to fetch authorities:', authErr); process.exit(1) }

  // Fetch existing mayor rows
  const { data: existing } = await sb.from('mayors').select('authority_id')
  const existingSet = new Set(existing?.map(r => r.authority_id) ?? [])

  let inserted = 0, updated = 0, skipped = 0
  const errors: string[] = []

  for (const auth of auths ?? []) {
    if (existingSet.has(auth.id)) continue  // original 14 pilots — don't touch

    const rec = bySymbol.get(auth.symbol)
    const skipThis = !rec || rec.confidence === 'not_found' || SKIP_SYMBOLS.has(auth.symbol)

    const row: Record<string, any> = {
      authority_id:  auth.id,
      name:          (!skipThis ? rec.mayor_name   : null) ?? null,
      photo_url:     (!skipThis ? rec.photo_url    : null) ?? null,
      wikipedia_url: (!skipThis ? rec.wikipedia_url : null) ?? null,
    }

    const { error } = await sb.from('mayors').insert(row)

    if (error) {
      errors.push(`${auth.name_display} [${auth.symbol}]: ${error.message}`)
      console.error(`  ERROR   ${auth.name_display}:`, error.message)
    } else if (skipThis) {
      console.log(`  INSERTED (no data) ${auth.name_display} [${auth.symbol}]`)
      inserted++
    } else {
      console.log(`  INSERTED           ${auth.name_display} [${auth.symbol}] → ${rec.mayor_name}`)
      inserted++
    }
  }

  console.log('\n─────────────────────────────────')
  console.log(`Inserted: ${inserted}`)
  console.log(`Skipped (already existed): ${existingSet.size}`)
  console.log(`Errors:   ${errors.length}`)
  if (errors.length) errors.forEach(e => console.log('  ', e))
}

main().catch(console.error)
