/**
 * Insert the 6 missing מועצות אזוריות that share symbols with other authority types,
 * then upsert their munidata yearly data.
 */
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

const D_FIELD_MAP: Record<string, string> = {
  'ריבוי_טבעי': 'd_natural_increase', 'שכר_ממוצע': 'd_avg_wage',
  'ארנונה_חיוב_למר': 'd_arnona_charge_per_sqm', 'שיעור_ארנונה_אחרת': 'd_arnona_other_share',
  'עומס_חוב_למשק_בית': 'd_debt_per_household', 'פרעון_מלוות_שנתי': 'd_debt_repayment_rate',
  'גירעון_מצטבר_נטו': 'd_net_accum_deficit', 'יחס_עומס_מלוות': 'd_loan_burden_ratio',
  'ריכוז_חוב': 'd_debt_concentration', 'תאגידים_עירוניים': 'd_municipal_corporations',
  'ליקויי_ביקורת': 'd_audit_deficiencies', 'הכנסות_כוללות': 'd_total_income',
  'קרנות_פיתוח': 'd_dev_funds_balance', 'תברים_הכנסות': 'd_extraordinary_income',
  'תברים_הוצאות': 'd_extraordinary_expenses', 'קרנות_לפרויקטי_פיתוח': 'd_dev_project_funds',
  'קולות_קוראים_זכיות': 'd_govt_tenders', 'מענקי_איזון': 'd_equalization_grants',
  'מענקי_פיתוח': 'd_dev_grants', 'קרן_צמצום_פערים': 'd_gap_reduction_fund',
  'תקציב_שירותים_אזוריים': 'd_regional_services', 'צוערים': 'd_cadets',
  'ותק_מנכל': 'd_ceo_seniority', 'איוש_תפקידים_סטטוטוריים': 'd_statutory_roles_pct',
  'תוכניות_פיתוח_ארגוני': 'd_org_dev_plans',
}

const H_FIELD_MAP: Record<string, string> = {
  'נפה': 'h_nafa', 'קבוצת_פרופיל': 'h_profile_group', 'קו_עימות': 'h_confrontation_line',
}

const MISSING_UIDS = [
  'מועצה_אזורית_26', 'מועצה_אזורית_28', 'מועצה_אזורית_29',
  'מועצה_אזורית_31', 'מועצה_אזורית_41', 'מועצה_אזורית_65',
]

async function main() {
  // Load registry and extraction
  const registry: any[] = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../../_shared/authorities_registry.json'), 'utf-8')
  )
  const extract = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../../agents/agent_munidata/output/munidata_extract_2026-07-30.json'), 'utf-8')
  )

  // Insert the 6 missing authorities
  console.log('Inserting 6 missing מועצות אזוריות...')
  for (const uid of MISSING_UIDS) {
    const regEntry = registry.find(r => r.unique_id === uid)!
    const slug = regEntry['שם_בלמס'].replace(/\s+/g, '-') + '-אזורית'

    const { data: inserted, error } = await sb
      .from('authorities')
      .insert({
        symbol: regEntry['סמל_רשות'],
        name_display: regEntry['שם_בלמס'],
        name_cbs: regEntry['שם_בלמס'],
        slug,
        authority_type: 'מועצה אזורית',
        is_published: false,
      })
      .select('id')
      .single()

    if (error) {
      console.log(`  FAIL ${uid}: ${error.message}`)
      continue
    }
    console.log(`  OK ${uid} -> id=${inserted.id}`)

    // Find this authority's extraction record and upsert yearly data
    const rec = extract.records.find((r: any) => r.unique_id === uid)
    if (!rec) { console.log(`    No extraction data for ${uid}`); continue }

    const hMuni = rec['הקשר_H_munidata'] ?? {}
    const hValues: Record<string, any> = {}
    for (const [heKey, dbCol] of Object.entries(H_FIELD_MAP)) {
      const val = hMuni[heKey]
      hValues[dbCol] = val === '' ? null : (val ?? null)
    }

    const yearlyData = rec['נתוני_רשות_שנתי'] ?? {}
    let yearOk = 0
    for (const [yearStr, yearObj] of Object.entries(yearlyData)) {
      const year = parseInt(yearStr)
      if (isNaN(year)) continue

      const dFields = (yearObj as any)['תצוגה_D'] ?? {}
      const dValues: Record<string, any> = {}
      for (const [heKey, dbCol] of Object.entries(D_FIELD_MAP)) {
        dValues[dbCol] = num(dFields[heKey])
      }

      const { error: yearErr } = await sb
        .from('authority_yearly')
        .upsert({
          authority_id: inserted.id,
          data_year: year,
          ...hValues,
          ...dValues,
        }, { onConflict: 'authority_id,data_year' })

      if (yearErr) console.log(`    FAIL yr=${year}: ${yearErr.message}`)
      else yearOk++
    }
    console.log(`    ${yearOk} yearly rows upserted`)
  }

  // Verify total count
  const { count } = await sb.from('authorities').select('*', { count: 'exact', head: true })
  console.log(`\nTotal authorities in DB: ${count}`)

  const { data: byPub } = await sb.rpc('', {}).catch(() => ({ data: null }))
  // Manual count
  const { data: published } = await sb.from('authorities').select('id', { count: 'exact', head: true }).eq('is_published', true)
  const { data: unpublished } = await sb.from('authorities').select('id', { count: 'exact', head: true }).eq('is_published', false)

  console.log('Done.')
}

main().catch(e => { console.error(e); process.exit(1) })
