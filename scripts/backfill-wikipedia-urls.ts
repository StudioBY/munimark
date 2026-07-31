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

const SKIP_SYMBOLS = new Set([7300])

async function main() {
  const raw = JSON.parse(fs.readFileSync(SOURCE, 'utf8'))
  const records: any[] = raw.data

  const { data: auths } = await sb.from('authorities').select('id, symbol')
  const symMap = new Map<number, number>()
  for (const a of auths ?? []) symMap.set(a.symbol, a.id)

  let updated = 0, skipped = 0, errors = 0

  for (const rec of records) {
    const semel: number = rec['סמל_רשות']
    if (rec.confidence === 'not_found' || SKIP_SYMBOLS.has(semel)) { skipped++; continue }

    const authId = symMap.get(semel)
    if (!authId) { skipped++; continue }

    const { error } = await sb
      .from('mayors')
      .update({ wikipedia_url: rec.wikipedia_url ?? null })
      .eq('authority_id', authId)

    if (error) {
      console.error(`ERROR ${rec['שם_בלמס']} [${semel}]:`, error.message)
      errors++
    } else {
      console.log(`OK  ${rec['שם_בלמס']} [${semel}] → ${rec.wikipedia_url ?? 'null'}`)
      updated++
    }
  }

  console.log(`\nUpdated: ${updated}  Skipped: ${skipped}  Errors: ${errors}`)
}

main().catch(console.error)
