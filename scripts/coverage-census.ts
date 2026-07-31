/**
 * Munimark — Coverage Census
 * Queries Supabase to determine what data exists per authority type / field class / year.
 *
 * Usage: npx tsx --env-file=.env.local scripts/coverage-census.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
})

const H_COLUMNS = [
  'h_district', 'h_authority_type', 'h_population', 'h_socio_cluster',
  'h_periphery', 'h_density', 'h_youth_pct', 'h_elderly_pct',
  'h_equalization_grant', 'h_ba_degree_pct', 'h_life_expectancy', 'h_council_members'
]

const B_COLUMNS = [
  'b_budget_per_capita', 'b_arnona_collection_pct', 'b_budget_execution_pct',
  'b_own_revenue_pct', 'b_surplus_deficit', 'b_bagrut_pct', 'b_bagrut_uni_pct',
  'b_dropout_pct', 'b_students_per_class', 'b_edu_spend_pct', 'b_welfare_spend_pct',
  'b_construction_starts', 'b_construction_completions', 'b_population_growth_pct',
  'b_migration_balance', 'b_water_loss_pct', 'b_recycling_pct', 'b_waste_per_capita',
  'b_edu_invest_per_capita', 'b_welfare_invest_per_capita'
]

const D_COLUMNS = [
  'd_accidents_per_1000', 'd_sewage_treated_pct', 'd_water_violations'
]

async function main() {
  console.log('='.repeat(70))
  console.log('Munimark — Coverage Census  2026-07-30')
  console.log('='.repeat(70))

  // ── 1. Authorities count by type ──────────────────────────
  console.log('\n--- Authorities in DB ---')
  const { data: allAuths, error: authErr } = await supabase
    .from('authorities')
    .select('id, symbol, name_display, name_cbs')
  if (authErr) { console.error('authorities fetch error:', authErr.message); process.exit(1) }
  console.log(`  Total authorities in DB: ${allAuths!.length}`)

  // Build auth id -> symbol map
  const authIdToSymbol: Record<number, number> = {}
  for (const a of allAuths!) { authIdToSymbol[a.id] = a.symbol }

  // ── 2. Fetch ALL authority_yearly rows ─────────────────────
  const { data: allYearly, error: yearlyErr } = await supabase
    .from('authority_yearly')
    .select('*')
  if (yearlyErr) { console.error('authority_yearly fetch error:', yearlyErr.message); process.exit(1) }
  console.log(`  Total authority_yearly rows: ${allYearly!.length}`)

  // Attach authority_type from the yearly data itself (h_authority_type column)
  // Group by authority_type
  const byType: Record<string, any[]> = {}
  const authTypeMap: Record<number, string> = {} // authority_id -> latest type
  for (const row of allYearly!) {
    const atype = row.h_authority_type || 'unknown'
    if (!byType[atype]) byType[atype] = []
    byType[atype].push(row)
    // Track latest type per authority
    const existing = authTypeMap[row.authority_id]
    if (!existing || row.data_year > (allYearly!.find(r => r.authority_id === row.authority_id && r.h_authority_type === existing)?.data_year ?? 0)) {
      authTypeMap[row.authority_id] = atype
    }
  }

  // Count distinct authorities per type
  const authsByType: Record<string, Set<number>> = {}
  for (const row of allYearly!) {
    const atype = row.h_authority_type || 'unknown'
    if (!authsByType[atype]) authsByType[atype] = new Set()
    authsByType[atype].add(row.authority_id)
  }

  console.log('\n  Authorities with yearly data by type:')
  for (const [atype, ids] of Object.entries(authsByType)) {
    console.log(`    ${atype}: ${ids.size}`)
  }

  // ── 3. Get distinct years ──────────────────────────────────
  const years = [...new Set(allYearly!.map(r => r.data_year))].sort()
  console.log(`\n  Years in DB: ${years.join(', ')}`)

  // ── 4. Coverage matrix: per field class × year × authority type ──
  console.log('\n--- Coverage Matrix ---')

  const csvRows: string[] = []
  csvRows.push('field_class,field,year,עירייה_with_data,עירייה_total,מועצה_מקומית_with_data,מועצה_מקומית_total,מועצה_אזורית_with_data,מועצה_אזורית_total')

  const types = ['עירייה', 'מועצה מקומית', 'מועצה אזורית']

  // For each field, count non-null per type per year
  const allFields = [
    ...H_COLUMNS.map(c => ({ col: c, cls: 'H' })),
    ...B_COLUMNS.map(c => ({ col: c, cls: 'B' })),
    ...D_COLUMNS.map(c => ({ col: c, cls: 'D' })),
  ]

  // Summary by class
  const classSummary: Record<string, Record<string, Record<string, { with_data: number, total: number }>>> = {}

  for (const year of years) {
    const yearRows = allYearly!.filter(r => r.data_year === year)

    for (const { col, cls } of allFields) {
      for (const atype of types) {
        const typeRows = yearRows.filter(r => r.h_authority_type === atype)
        const total = typeRows.length
        const withData = typeRows.filter(r => r[col] !== null && r[col] !== undefined).length

        if (!classSummary[cls]) classSummary[cls] = {}
        if (!classSummary[cls][String(year)]) classSummary[cls][String(year)] = {}
        if (!classSummary[cls][String(year)][atype]) {
          classSummary[cls][String(year)][atype] = { with_data: 0, total: 0 }
        }
        // For class summary, track if ANY field in class has data
        if (withData > 0) {
          classSummary[cls][String(year)][atype].with_data = Math.max(classSummary[cls][String(year)][atype].with_data, withData)
          classSummary[cls][String(year)][atype].total = Math.max(classSummary[cls][String(year)][atype].total, total)
        } else if (total > 0) {
          classSummary[cls][String(year)][atype].total = Math.max(classSummary[cls][String(year)][atype].total, total)
        }

        // CSV row per field
        const cityTotal = types.indexOf(atype) === 0 ? total : undefined
        csvRows.push(`${cls},${col},${year},${
          atype === 'עירייה' ? `${withData},${total}` : ','
        },${
          atype === 'מועצה מקומית' ? `${withData},${total}` : ','
        },${
          atype === 'מועצה אזורית' ? `${withData},${total}` : ','
        }`)
      }
    }
  }

  // Better CSV: one row per field × year with all types
  const csvRows2: string[] = []
  csvRows2.push('field_class,field,year,עירייה_with_data,עירייה_total,מועצה_מקומית_with_data,מועצה_מקומית_total,מועצה_אזורית_with_data,מועצה_אזורית_total')

  for (const year of years) {
    const yearRows = allYearly!.filter(r => r.data_year === year)

    for (const { col, cls } of allFields) {
      const counts: string[] = []
      for (const atype of types) {
        const typeRows = yearRows.filter(r => r.h_authority_type === atype)
        const total = typeRows.length
        const withData = typeRows.filter(r => r[col] !== null && r[col] !== undefined).length
        counts.push(`${withData}`, `${total}`)
      }
      csvRows2.push(`${cls},${col},${year},${counts.join(',')}`)
    }
  }

  // ── 5. Mayors coverage ─────────────────────────────────────
  console.log('\n--- Mayors Coverage ---')
  const { data: allMayors, error: mayorErr } = await supabase
    .from('mayors')
    .select('authority_id, name, photo_url, wikipedia_url')
  if (mayorErr) { console.error('mayors fetch error:', mayorErr.message); process.exit(1) }

  console.log(`  Total mayor rows: ${allMayors!.length}`)
  const mayorsByType: Record<string, { total: number, with_name: number, with_photo: number, with_wiki: number }> = {}
  for (const m of allMayors!) {
    const atype = authTypeMap[m.authority_id] || 'unknown'
    if (!mayorsByType[atype]) mayorsByType[atype] = { total: 0, with_name: 0, with_photo: 0, with_wiki: 0 }
    mayorsByType[atype].total++
    if (m.name) mayorsByType[atype].with_name++
    if (m.photo_url) mayorsByType[atype].with_photo++
    if (m.wikipedia_url) mayorsByType[atype].with_wiki++
  }
  for (const [atype, counts] of Object.entries(mayorsByType)) {
    console.log(`  ${atype}: ${counts.total} rows, ${counts.with_name} with name, ${counts.with_photo} with photo, ${counts.with_wiki} with wiki`)
  }

  // ── 6. Print summary ──────────────────────────────────────
  console.log('\n--- Per-Class Summary ---')
  console.log('(max non-null count for any field in class)')
  for (const cls of ['H', 'B', 'D']) {
    console.log(`\n  Class ${cls}:`)
    if (!classSummary[cls]) { console.log('    No data'); continue }
    for (const year of years) {
      const ys = String(year)
      if (!classSummary[cls][ys]) continue
      const parts: string[] = []
      for (const atype of types) {
        const s = classSummary[cls][ys]?.[atype]
        if (s) {
          parts.push(`${atype}: ${s.with_data}/${s.total}`)
        }
      }
      console.log(`    ${year}: ${parts.join(' | ')}`)
    }
  }

  // ── 7. Detailed B-field coverage ──────────────────────────
  console.log('\n--- B-Field Detail (CBS Core) ---')
  for (const year of years) {
    const yearRows = allYearly!.filter(r => r.data_year === year)
    console.log(`\n  Year ${year}: ${yearRows.length} rows total`)
    for (const col of B_COLUMNS) {
      const parts: string[] = []
      for (const atype of types) {
        const typeRows = yearRows.filter(r => r.h_authority_type === atype)
        const withData = typeRows.filter(r => r[col] !== null && r[col] !== undefined).length
        if (typeRows.length > 0) parts.push(`${atype}: ${withData}/${typeRows.length}`)
      }
      if (parts.some(p => !p.includes('/0'))) {
        console.log(`    ${col}: ${parts.join(' | ')}`)
      }
    }
  }

  // ── 8. Scores coverage ────────────────────────────────────
  const { data: scores, error: scErr } = await supabase.from('scores').select('*')
  if (scErr) console.error('scores fetch error:', scErr.message)
  console.log(`\n--- Scores ---`)
  console.log(`  Total score rows: ${scores?.length ?? 0}`)

  // ── 9. Save CSV ───────────────────────────────────────────
  const csvPath = path.resolve(__dirname, '../../agents/agent_munidata/output/coverage_census_2026-07-30.csv')
  fs.writeFileSync(csvPath, csvRows2.join('\n'), 'utf-8')
  console.log(`\nCSV saved: ${csvPath}`)

  // ── 10. Save readable summary ─────────────────────────────
  const summaryLines: string[] = []
  summaryLines.push('Munimark Coverage Census — 2026-07-30')
  summaryLines.push('='.repeat(50))
  summaryLines.push(`\nAuthorities in DB: ${allAuths!.length}`)
  for (const [atype, ids] of Object.entries(authsByType)) {
    summaryLines.push(`  ${atype}: ${ids.size}`)
  }
  summaryLines.push(`\nYears in DB: ${years.join(', ')}`)
  summaryLines.push(`Total authority_yearly rows: ${allYearly!.length}`)
  summaryLines.push(`Total mayor rows: ${allMayors!.length}`)
  summaryLines.push(`Total score rows: ${scores?.length ?? 0}`)

  summaryLines.push('\n--- Coverage by Class × Year × Type ---')
  for (const cls of ['H', 'B', 'D']) {
    summaryLines.push(`\nClass ${cls}:`)
    if (!classSummary[cls]) { summaryLines.push('  No data'); continue }
    for (const year of years) {
      const ys = String(year)
      if (!classSummary[cls][ys]) continue
      const parts: string[] = []
      for (const atype of types) {
        const s = classSummary[cls][ys]?.[atype]
        if (s) parts.push(`${atype}: ${s.with_data}/${s.total}`)
      }
      summaryLines.push(`  ${year}: ${parts.join(' | ')}`)
    }
  }

  summaryLines.push('\n--- Mayors by Type ---')
  for (const [atype, counts] of Object.entries(mayorsByType)) {
    summaryLines.push(`  ${atype}: ${counts.total} rows, ${counts.with_name} name, ${counts.with_photo} photo, ${counts.with_wiki} wiki`)
  }

  const summaryPath = path.resolve(__dirname, '../../agents/agent_munidata/output/coverage_census_summary_2026-07-30.txt')
  fs.writeFileSync(summaryPath, summaryLines.join('\n'), 'utf-8')
  console.log(`Summary saved: ${summaryPath}`)

  console.log('\n' + '='.repeat(70))
  console.log('Census complete.')
  console.log('='.repeat(70))
}

main().catch(e => { console.error(e); process.exit(1) })
