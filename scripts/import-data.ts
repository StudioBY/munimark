/**
 * Munimark — Data Import Script
 * Reads: output/merged_all_2026-06-01_v3.json
 * Upserts into Supabase: authorities, mayors, authority_yearly
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... npx tsx scripts/import-data.ts
 *
 * Or with dotenv:
 *   npx tsx --env-file=.env.local scripts/import-data.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// ── Config ───────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
const DATA_FILE    = path.resolve(__dirname, '../../output/merged_all_2026-06-01_v3.json')

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌  Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
})

// ── Slug generation ──────────────────────────────────────────
const SLUG_MAP: Record<string, string> = {
  'אשדוד':         'ashdod',
  'מודיעין':       'modiin',
  'דימונה':        'dimona',
  'אום אל-פחם':    'umm-al-fahm',
  'ירושלים':       'jerusalem',
  'תל אביב':       'tel-aviv',
  'כפר סבא':       'kfar-saba',
  'אשקלון':        'ashkelon',
  'פתח תקווה':     'petah-tikva',
  'ראשון לציון':   'rishon-lezion',
  'רמת גן':        'ramat-gan',
  'רעננה':         'raanana',
  'באר שבע':       'beer-sheva',
  'נהריה':         'nahariya',
}

function toSlug(name: string): string {
  return SLUG_MAP[name] ?? name
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '')
    .toLowerCase()
}

// ── Type helpers ─────────────────────────────────────────────
function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

function int(v: unknown): number | null {
  const n = num(v)
  return n === null ? null : Math.round(n)
}

// ── Main import ──────────────────────────────────────────────
async function main() {
  console.log(`📂  Reading ${DATA_FILE}`)
  const raw = fs.readFileSync(DATA_FILE, 'utf-8')
  const data = JSON.parse(raw)
  const authorities: any[] = data['רשויות']

  console.log(`   Found ${authorities.length} authorities\n`)

  let ok = 0, err = 0

  for (const auth of authorities) {
    const symbol: number        = auth['סמל_רשות']
    const conn                  = auth['מזהי_חיבור'] ?? {}
    const personal              = auth['מידע_אישי'] ?? {}
    const digital               = auth['נוכחות_דיגיטלית'] ?? {}
    const yearlyData: Record<string, any> = auth['נתוני_רשות_שנתי'] ?? {}

    const nameDisplay: string   = conn['שם_עיר_שגרתי'] ?? String(symbol)
    const nameCbs: string       = conn['שם_בלמס'] ?? nameDisplay
    const slug: string          = toSlug(nameDisplay)

    console.log(`→  ${nameDisplay} (symbol: ${symbol}, slug: ${slug})`)

    // ── 1. Upsert authority ──────────────────────────────────
    const { data: authRow, error: authErr } = await supabase
      .from('authorities')
      .upsert({
        symbol,
        name_display:      nameDisplay,
        name_cbs:          nameCbs,
        slug,
        entity_id_obudget: conn['entity_id_obudget'] ?? null,
      }, { onConflict: 'symbol,authority_type' })
      .select('id')
      .single()

    if (authErr || !authRow) {
      console.error(`   ❌  authority upsert failed:`, authErr?.message)
      err++
      continue
    }

    const authorityId: number = authRow.id

    // ── 2. Upsert mayor ─────────────────────────────────────
    const { error: mayorErr } = await supabase
      .from('mayors')
      .upsert({
        authority_id:       authorityId,
        name:               personal['שם_ראש_הרשות'] ?? null,
        birth_year:         personal['תאריך_לידה'] ?? null,
        tenure_start:       personal['תאריך_תחילת_כהונה'] ?? null,
        term_count:         int(personal['מספר_כהונות']),
        background:         personal['רקע_מקצועי'] ?? null,
        photo_url:          personal['כתובת_תמונה'] ?? null,
        election_pct:       personal['אחוז_קולות_בחירות_אחרונות'] ?? null,
        youtube_url:        digital['youtube_url'] ?? null,
        youtube_subscribers:int(digital['youtube_מנויים']),
        youtube_video_count:int(digital['youtube_מספר_סרטונים']),
        youtube_last_video: digital['youtube_סרטון_אחרון'] ?? null,
        youtube_active:     digital['youtube_פעיל'] ?? null,
      }, { onConflict: 'authority_id' })

    if (mayorErr) {
      console.error(`   ❌  mayor upsert failed:`, mayorErr.message)
    }

    // ── 3. Upsert yearly data ────────────────────────────────
    for (const [yearStr, yearObj] of Object.entries(yearlyData)) {
      const year = parseInt(yearStr)
      if (isNaN(year)) continue

      const H = (yearObj as any)['הקשר_H']    ?? {}
      const B = (yearObj as any)['ביצוע_B']   ?? {}
      const D = (yearObj as any)['תצוגה_D']   ?? {}

      const { error: yearErr } = await supabase
        .from('authority_yearly')
        .upsert({
          authority_id: authorityId,
          data_year:    year,

          // H
          h_district:           H['מחוז']                    ?? null,
          h_authority_type:     H['סוג_רשות']               ?? null,
          h_population:         num(H['אוכלוסייה']),
          h_socio_cluster:      int(H['אשכול_חברתי_כלכלי']),
          h_periphery:          int(H['פריפריאליות']),
          h_density:            num(H['צפיפות']),
          h_youth_pct:          num(H['אחוז_צעירים_0_17']),
          h_elderly_pct:        num(H['אחוז_קשישים_65+']),
          h_equalization_grant: num(H['מענק_איזון_כללי']),
          h_ba_degree_pct:      num(H['תואר_ראשון_אחוז']),
          h_life_expectancy:    num(H['תוחלת_חיים']),
          h_council_members:    int(H['מספר_חברי_מועצה']),

          // B
          b_budget_per_capita:          num(B['תקציב_לנפש']),
          b_arnona_collection_pct:      num(B['גביית_ארנונה_אחוז']),
          b_budget_execution_pct:       num(B['ביצוע_תקציב_אחוז']),
          b_own_revenue_pct:            num(B['הכנסות_עצמיות_אחוז']),
          b_surplus_deficit:            num(B['עודף_גירעון']),
          b_bagrut_pct:                 num(B['זכאות_בגרות']),
          b_bagrut_uni_pct:             num(B['בגרות_סף_אוניברסיטאי']),
          b_dropout_pct:                num(B['נשירה']),
          b_students_per_class:         num(B['תלמידים_לכיתה']),
          b_edu_spend_pct:              num(B['הוצאה_חינוך_אחוז']),
          b_welfare_spend_pct:          num(B['הוצאה_רווחה_אחוז']),
          b_construction_starts:        num(B['התחלות_בנייה']),
          b_construction_completions:   num(B['גמר_בנייה']),
          b_population_growth_pct:      num(B['גידול_אוכלוסייה_אחוז']),
          b_migration_balance:          num(B['מאזן_הגירה']),
          b_water_loss_pct:             num(B['אחוז_פחת_מים']),
          b_recycling_pct:              num(B['אחוז_מחזור_פסולת']),
          b_waste_per_capita:           num(B['פסולת_לנפש']),
          b_edu_invest_per_capita:      num(B['השקעה_חינוך_לנפש']),
          b_welfare_invest_per_capita:  num(B['השקעה_רווחה_לנפש']),

          // D (CBS)
          d_accidents_per_1000:  num(D['תאונות_ל_1000']),
          d_sewage_treated_pct:  num(D['אחוז_שפכים_מטופלים']),
          d_water_violations:    num(D['חריגות_מי_שתייה']),

          // H (munidata — Interior Ministry dashboard)
          h_nafa:                H['נפה'] ?? null,
          h_profile_group:       H['קבוצת_פרופיל'] ?? null,
          h_confrontation_line:  H['קו_עימות'] ?? null,

          // D (munidata — demographics)
          d_natural_increase:       num(D['ריבוי_טבעי']),
          d_avg_wage:               num(D['שכר_ממוצע']),

          // D (munidata — budget & economy)
          d_arnona_charge_per_sqm:  num(D['ארנונה_חיוב_למר']),
          d_arnona_other_share:     num(D['שיעור_ארנונה_אחרת']),
          d_debt_per_household:     num(D['עומס_חוב_למשק_בית']),
          d_debt_repayment_rate:    num(D['פרעון_מלוות_שנתי']),
          d_net_accum_deficit:      num(D['גירעון_מצטבר_נטו']),
          d_loan_burden_ratio:      num(D['יחס_עומס_מלוות']),
          d_debt_concentration:     num(D['ריכוז_חוב']),
          d_municipal_corporations: num(D['תאגידים_עירוניים']),
          d_audit_deficiencies:     num(D['ליקויי_ביקורת']),
          d_total_income:           num(D['הכנסות_כוללות']),
          d_dev_funds_balance:      num(D['קרנות_פיתוח']),
          d_extraordinary_income:   num(D['תברים_הכנסות']),
          d_extraordinary_expenses: num(D['תברים_הוצאות']),
          d_dev_project_funds:      num(D['קרנות_לפרויקטי_פיתוח']),

          // D (munidata — gov mechanisms)
          d_govt_tenders:           num(D['קולות_קוראים_זכיות']),
          d_equalization_grants:    num(D['מענקי_איזון']),
          d_dev_grants:             num(D['מענקי_פיתוח']),
          d_gap_reduction_fund:     num(D['קרן_צמצום_פערים']),
          d_regional_services:      num(D['תקציב_שירותים_אזוריות']),

          // D (munidata — human capital)
          d_cadets:                 num(D['צוערים']),
          d_ceo_seniority:          num(D['ותק_מנכל']),
          d_statutory_roles_pct:    num(D['איוש_תפקידים_סטטוטוריים']),
          d_org_dev_plans:          num(D['תוכניות_פיתוח_ארגוני']),
        }, { onConflict: 'authority_id,data_year' })

      if (yearErr) {
        console.error(`   ❌  year ${year} upsert failed:`, yearErr.message)
      }
    }

    console.log(`   ✅  ${Object.keys(yearlyData).length} years imported`)
    ok++
  }

  console.log(`\n══════════════════════════════════════`)
  console.log(`Import complete: ${ok} ok, ${err} errors`)
  console.log(`══════════════════════════════════════`)
}

main().catch(e => { console.error(e); process.exit(1) })
