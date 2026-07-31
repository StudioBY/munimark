/**
 * Munimark — Upload munidata extraction to Supabase
 * 1. Insert 175 new authorities (is_published = false)
 * 2. Upsert authority_yearly rows with 25 new D fields + 3 new H fields
 * 3. Apply סוג_רשות corrections for 5 upgraded cities
 *
 * Usage: npx tsx --env-file=.env.local scripts/upload-munidata.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
  db: { schema: 'public' },
})

// ── Paths ───────────────────────────────────────────────────
const AGENT_DIR = path.resolve(__dirname, '../../agents/agent_munidata')
const EXTRACT_PATH = path.join(AGENT_DIR, 'output/munidata_extract_2026-07-30.json')
const REGISTRY_PATH = path.resolve(__dirname, '../../_shared/authorities_registry.json')
const CORRECTIONS_PATH = path.join(AGENT_DIR, 'output/status_change_corrections_2026-07-30.json')

// ── Hebrew field → DB column mapping for munidata D fields ──
const D_FIELD_MAP: Record<string, string> = {
  'ריבוי_טבעי':                 'd_natural_increase',
  'שכר_ממוצע':                  'd_avg_wage',
  'ארנונה_חיוב_למר':            'd_arnona_charge_per_sqm',
  'שיעור_ארנונה_אחרת':          'd_arnona_other_share',
  'עומס_חוב_למשק_בית':          'd_debt_per_household',
  'פרעון_מלוות_שנתי':           'd_debt_repayment_rate',
  'גירעון_מצטבר_נטו':           'd_net_accum_deficit',
  'יחס_עומס_מלוות':             'd_loan_burden_ratio',
  'ריכוז_חוב':                  'd_debt_concentration',
  'תאגידים_עירוניים':           'd_municipal_corporations',
  'ליקויי_ביקורת':              'd_audit_deficiencies',
  'הכנסות_כוללות':              'd_total_income',
  'קרנות_פיתוח':                'd_dev_funds_balance',
  'תברים_הכנסות':               'd_extraordinary_income',
  'תברים_הוצאות':               'd_extraordinary_expenses',
  'קרנות_לפרויקטי_פיתוח':       'd_dev_project_funds',
  'קולות_קוראים_זכיות':         'd_govt_tenders',
  'מענקי_איזון':                'd_equalization_grants',
  'מענקי_פיתוח':                'd_dev_grants',
  'קרן_צמצום_פערים':            'd_gap_reduction_fund',
  'תקציב_שירותים_אזוריים':      'd_regional_services',
  'צוערים':                     'd_cadets',
  'ותק_מנכל':                   'd_ceo_seniority',
  'איוש_תפקידים_סטטוטוריים':    'd_statutory_roles_pct',
  'תוכניות_פיתוח_ארגוני':       'd_org_dev_plans',
}

const H_FIELD_MAP: Record<string, string> = {
  'נפה':           'h_nafa',
  'קבוצת_פרופיל':  'h_profile_group',
  'קו_עימות':      'h_confrontation_line',
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

function toSlug(name: string): string {
  return name
    .replace(/\s+/g, '-')
    .replace(/[^\u0590-\u05FF\w-]/g, '')
    .toLowerCase()
}

async function main() {
  console.log('='.repeat(60))
  console.log('Upload munidata to Supabase — 2026-07-30')
  console.log('='.repeat(60))

  // Load data
  const extract = JSON.parse(fs.readFileSync(EXTRACT_PATH, 'utf-8'))
  const registry: any[] = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'))
  const corrections = JSON.parse(fs.readFileSync(CORRECTIONS_PATH, 'utf-8'))

  const records: any[] = extract.records
  console.log(`Extraction: ${records.length} authority records`)
  console.log(`Registry: ${registry.length} authorities`)
  console.log(`Corrections: ${corrections.corrections.length} status changes`)

  // ── Step 1: Get existing authorities ──────────────────────
  // Use service role key to bypass RLS for admin operations
  const { data: existingAuths, error: fetchErr } = await supabase
    .from('authorities')
    .select('id, symbol, name_display')

  if (fetchErr) {
    console.error('Failed to fetch authorities:', fetchErr.message)
    // The RLS policy now filters by is_published, but service role bypasses RLS
    // Let's verify
    console.log('Note: Service role key should bypass RLS. Checking...')
  }

  const existingSymbols = new Set((existingAuths ?? []).map((a: any) => a.symbol))
  console.log(`\nExisting authorities in DB: ${existingSymbols.size}`)

  // ── Step 2: Insert 175 new authorities ────────────────────
  console.log('\n--- Inserting new authorities ---')
  const newAuths = registry.filter(r => !existingSymbols.has(r['סמל_רשות']))
  console.log(`New authorities to insert: ${newAuths.length}`)

  let insertOk = 0, insertFail = 0
  for (const auth of newAuths) {
    const symbol = auth['סמל_רשות']
    const nameDisplay = auth['שם_עיר_שגרתי'] || auth['שם_בלמס']
    const nameCbs = auth['שם_בלמס']
    const slug = toSlug(nameDisplay)
    const authorityType = auth['סוג_רשות']

    const { error } = await supabase
      .from('authorities')
      .insert({
        symbol,
        name_display: nameDisplay,
        name_cbs: nameCbs,
        slug,
        authority_type: authorityType,
        is_published: false,
      })

    if (error) {
      // Try with a disambiguated slug if slug conflict
      if (error.message.includes('duplicate') && error.message.includes('slug')) {
        const { error: retry } = await supabase
          .from('authorities')
          .insert({
            symbol,
            name_display: nameDisplay,
            name_cbs: nameCbs,
            slug: `${slug}-${symbol}`,
            authority_type: authorityType,
            is_published: false,
          })
        if (retry) {
          console.error(`  FAIL ${symbol} ${nameCbs}: ${retry.message}`)
          insertFail++
        } else {
          insertOk++
        }
      } else {
        console.error(`  FAIL ${symbol} ${nameCbs}: ${error.message}`)
        insertFail++
      }
    } else {
      insertOk++
    }
  }
  console.log(`  Inserted: ${insertOk} ok, ${insertFail} failed`)

  // ── Refresh authority map ─────────────────────────────────
  const { data: allAuths } = await supabase
    .from('authorities')
    .select('id, symbol')
  const symbolToId: Record<number, number> = {}
  for (const a of allAuths ?? []) {
    symbolToId[a.symbol] = a.id
  }
  console.log(`\nTotal authorities now: ${Object.keys(symbolToId).length}`)

  // Build unique_id → symbol map from registry
  const uidToSymbol: Record<string, number> = {}
  for (const r of registry) {
    uidToSymbol[r['unique_id']] = r['סמל_רשות']
  }

  // ── Step 3: Upsert authority_yearly with munidata fields ──
  console.log('\n--- Upserting authority_yearly ---')
  let yearOk = 0, yearFail = 0, yearSkip = 0

  for (const rec of records) {
    const uid = rec['unique_id']
    const symbol = uidToSymbol[uid]
    if (!symbol) { yearSkip++; continue }

    const authorityId = symbolToId[symbol]
    if (!authorityId) { yearSkip++; continue }

    // H fields from dim_muni (apply to all years)
    const hMuni = rec['הקשר_H_munidata'] ?? {}
    const hValues: Record<string, any> = {}
    for (const [heKey, dbCol] of Object.entries(H_FIELD_MAP)) {
      const val = hMuni[heKey]
      hValues[dbCol] = val === '' ? null : (val ?? null)
    }

    // Per-year D fields
    const yearlyData = rec['נתוני_רשות_שנתי'] ?? {}

    for (const [yearStr, yearObj] of Object.entries(yearlyData)) {
      const year = parseInt(yearStr)
      if (isNaN(year)) continue

      const dFields = (yearObj as any)['תצוגה_D'] ?? {}
      const dValues: Record<string, any> = {}
      for (const [heKey, dbCol] of Object.entries(D_FIELD_MAP)) {
        dValues[dbCol] = num(dFields[heKey])
      }

      const upsertRow: Record<string, any> = {
        authority_id: authorityId,
        data_year: year,
        ...hValues,
        ...dValues,
      }

      const { error } = await supabase
        .from('authority_yearly')
        .upsert(upsertRow, { onConflict: 'authority_id,data_year' })

      if (error) {
        console.error(`  FAIL ${uid} yr=${year}: ${error.message}`)
        yearFail++
      } else {
        yearOk++
      }
    }
  }
  console.log(`  Upserted: ${yearOk} ok, ${yearFail} failed, ${yearSkip} skipped`)

  // ── Step 4: Apply סוג_רשות corrections ────────────────────
  console.log('\n--- Applying סוג_רשות corrections ---')
  let corrOk = 0, corrFail = 0

  for (const corr of corrections.corrections) {
    const symbol = corr['סמל_רשות']
    const authorityId = symbolToId[symbol]
    if (!authorityId) {
      console.error(`  SKIP correction for symbol ${symbol}: not in DB`)
      continue
    }

    const perYear = corr['per_year_סוג_רשות'] ?? {}
    for (const [yearStr, statusVal] of Object.entries(perYear)) {
      const year = parseInt(yearStr)
      if (isNaN(year)) continue

      const { error } = await supabase
        .from('authority_yearly')
        .update({ h_authority_type: statusVal as string })
        .eq('authority_id', authorityId)
        .eq('data_year', year)

      if (error) {
        console.error(`  FAIL ${corr['שם_בלמס']} yr=${year}: ${error.message}`)
        corrFail++
      } else {
        corrOk++
      }
    }
  }
  console.log(`  Corrections: ${corrOk} ok, ${corrFail} failed`)

  // ── Summary ───────────────────────────────────────────────
  console.log('\n' + '='.repeat(60))
  console.log('UPLOAD SUMMARY')
  console.log('='.repeat(60))
  console.log(`  New authorities inserted: ${insertOk} (${insertFail} failed)`)
  console.log(`  Yearly rows upserted: ${yearOk} (${yearFail} failed, ${yearSkip} skipped)`)
  console.log(`  Status corrections applied: ${corrOk} (${corrFail} failed)`)
  console.log('='.repeat(60))
}

main().catch(e => { console.error(e); process.exit(1) })
