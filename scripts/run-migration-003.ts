/**
 * Run migration 003 against Supabase via the SQL API.
 * Usage: npx tsx --env-file=.env.local scripts/run-migration-003.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function runSQL(sql: string): Promise<{ ok: boolean; error?: string }> {
  // Extract the project ref from the URL (e.g. https://abcdef.supabase.co -> abcdef)
  const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0]

  // Use Supabase Management API for SQL
  // But that requires a management token, not a service role key.
  // Alternative: use the pg_net extension or a custom RPC.

  // Simplest: use the supabase-js client to create a function that runs arbitrary SQL,
  // or use the PostgREST /rpc endpoint with a helper function.

  // Most reliable: Use the Supabase SQL endpoint (available on all projects)
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
  })

  // This won't work for DDL. Let's try a different approach.
  return { ok: false, error: 'Cannot run DDL via REST API' }
}

async function main() {
  console.log('Migration 003: Add munidata fields + visibility guard')
  console.log('='.repeat(60))

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

  // Read the migration SQL
  const sqlFile = fs.readFileSync(
    path.resolve(__dirname, '../supabase/migrations/003_add_munidata_fields.sql'),
    'utf-8'
  )

  // Parse individual statements
  const statements = sqlFile
    .split(';')
    .map(s => s.replace(/--.*$/gm, '').trim()) // strip comments
    .filter(s => s.length > 5)

  console.log(`Found ${statements.length} SQL statements\n`)

  // Execute each via rpc('exec_sql', ...) — requires a helper function.
  // First, try to create the helper function if it doesn't exist.
  const createHelper = `
    CREATE OR REPLACE FUNCTION exec_sql(query text)
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    BEGIN
      EXECUTE query;
    END;
    $$
  `

  // Try using the Supabase SQL HTTP API (undocumented but available)
  // POST /pg/query with Bearer token
  const sqlEndpoint = `${SUPABASE_URL}/pg/query`

  // First try the pg endpoint
  console.log('Trying SQL endpoint...')
  const testResp = await fetch(sqlEndpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: 'SELECT 1 as test' }),
  })

  if (testResp.ok) {
    console.log('SQL endpoint available! Running migration...\n')

    // Run the entire migration as one block
    const resp = await fetch(sqlEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sqlFile }),
    })

    if (resp.ok) {
      const result = await resp.json()
      console.log('Migration completed successfully!')
      console.log('Result:', JSON.stringify(result).slice(0, 200))
    } else {
      const errText = await resp.text()
      console.error('Migration failed:', resp.status, errText)

      // Try statement by statement
      console.log('\nRetrying statement by statement...\n')
      let okCount = 0
      let failCount = 0
      for (const stmt of statements) {
        const r = await fetch(sqlEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: stmt }),
        })
        if (r.ok) {
          console.log(`  OK: ${stmt.slice(0, 70)}...`)
          okCount++
        } else {
          const e = await r.text()
          console.error(`  FAIL: ${stmt.slice(0, 70)}...`)
          console.error(`    ${e.slice(0, 200)}`)
          failCount++
        }
      }
      console.log(`\nDone: ${okCount} ok, ${failCount} failed`)
    }
  } else {
    // pg endpoint not available, try creating exec_sql via RPC
    console.log('SQL endpoint not available (status:', testResp.status, ')')
    console.log('Trying exec_sql RPC approach...\n')

    // First create the helper function via a different approach
    // Try the Supabase REST SQL API (v2)
    const sqlV2Endpoint = SUPABASE_URL.replace('.supabase.co', '.supabase.co') + '/sql'
    const v2Resp = await fetch(sqlV2Endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: 'SELECT 1' }),
    })

    if (v2Resp.ok) {
      console.log('SQL v2 endpoint available!')
      const resp = await fetch(sqlV2Endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: sqlFile }),
      })
      if (resp.ok) {
        console.log('Migration completed successfully!')
      } else {
        console.error('Failed:', await resp.text())
      }
    } else {
      console.log('No SQL endpoint available.')
      console.log('Please run the migration manually via Supabase Dashboard > SQL Editor.')
      console.log('Migration file: supabase/migrations/003_add_munidata_fields.sql')

      // As a fallback, try to do what we CAN via the client:
      // We can't ALTER TABLE, but we can check if columns already exist
      console.log('\nChecking current table state...')
      const { data: sample } = await sb
        .from('authority_yearly')
        .select('*')
        .limit(1)

      if (sample && sample.length > 0) {
        const cols = Object.keys(sample[0])
        const hasNewCols = cols.includes('h_nafa')
        const hasPublished = cols.includes('is_published')
        console.log(`  authority_yearly columns: ${cols.length}`)
        console.log(`  Has new munidata columns: ${hasNewCols}`)

        // Check authorities table
        const { data: authSample } = await sb
          .from('authorities')
          .select('*')
          .limit(1)
        if (authSample && authSample.length > 0) {
          const authCols = Object.keys(authSample[0])
          console.log(`  authorities columns: ${authCols.join(', ')}`)
          console.log(`  Has is_published: ${authCols.includes('is_published')}`)
        }
      }
    }
  }
}

main().catch(e => { console.error(e); process.exit(1) })
