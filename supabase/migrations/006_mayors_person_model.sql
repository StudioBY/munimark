-- ============================================================
-- Munimark — Migration 006: mayors becomes a PERSON table
-- Date: 2026-09-16
--
-- PROBLEM
--   mayors was created with UNIQUE(authority_id) — exactly one mayor row per
--   authority. That blocks two things the project needs:
--     1. The 175 מועצות have no mayor row at all and cannot get one alongside
--        anything else.
--     2. Legacy mode requires the mayors of term_2013 and term_2018 to exist
--        as PEOPLE, not just as names in mayor_terms.full_name.
--
--   mayor_terms already holds 766 term records with names for all 257
--   authorities across three terms. What is missing is the person behind them.
--
-- MODEL AFTER THIS MIGRATION
--   mayors      = a PERSON (name, photo, background, birth year, wikipedia)
--   mayor_terms = a TERM   (which person served which authority, when)
--   mayors.authority_id stays as the person's primary authority, so existing
--   queries keep working; is_current marks the serving mayor.
--
-- SAFETY
--   The 1:1 guarantee is preserved where it matters: a partial unique index
--   allows only ONE current mayor per authority. Historical rows are
--   unconstrained. app/mayor/[slug]/page.tsx must add .eq('is_current', true)
--   to its .single() query — see the note at the bottom.
-- ============================================================

-- ─── Backup before structural change (hard rule #3) ─────────
CREATE TABLE IF NOT EXISTS mayors_backup_20260916 AS SELECT * FROM mayors;

-- ─── 1. Mark who is currently serving ───────────────────────
ALTER TABLE mayors ADD COLUMN IF NOT EXISTS is_current BOOLEAN NOT NULL DEFAULT false;

-- Every row that exists today is a serving mayor (the table could not hold
-- anything else), so backfill before adding the constraint.
UPDATE mayors SET is_current = true WHERE is_current = false;

-- ─── 2. Drop the 1:1 constraint ─────────────────────────────
-- Found by definition rather than by assumed name: a DROP ... IF EXISTS on a
-- guessed name succeeds silently when the name is different, leaving the
-- constraint in place and the migration looking like it worked.
DO $$
DECLARE c RECORD; dropped INT := 0;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    WHERE rel.relname = 'mayors'
      AND ns.nspname  = 'public'
      AND con.contype = 'u'
      AND con.conkey  = ARRAY[
            (SELECT attnum FROM pg_attribute
             WHERE attrelid = rel.oid AND attname = 'authority_id')
          ]::smallint[]
  LOOP
    EXECUTE format('ALTER TABLE mayors DROP CONSTRAINT %I', c.conname);
    RAISE NOTICE 'dropped unique constraint %', c.conname;
    dropped := dropped + 1;
  END LOOP;

  IF dropped = 0 THEN
    RAISE NOTICE 'no UNIQUE(authority_id) constraint found — already removed';
  END IF;
END $$;

-- ─── 3. Re-assert 1:1 for CURRENT mayors only ───────────────
CREATE UNIQUE INDEX IF NOT EXISTS mayors_one_current_per_authority
  ON mayors(authority_id) WHERE is_current = true;

-- ─── 4. Term linkage ────────────────────────────────────────
ALTER TABLE mayors ADD COLUMN IF NOT EXISTS term_label TEXT;
COMMENT ON COLUMN mayors.term_label IS
  'The term this person record was created from (term_2013 / term_2018 / term_2024_*). Null for records predating migration 006.';

CREATE INDEX IF NOT EXISTS idx_mayors_authority     ON mayors(authority_id);
CREATE INDEX IF NOT EXISTS idx_mayors_is_current    ON mayors(is_current) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS idx_mayor_terms_mayor_id ON mayor_terms(mayor_id);

-- ─── 5. Provenance on the person record ─────────────────────
-- Distinguishes "name copied from the Interior Ministry roster" from
-- "verified against a source with a photo and a biography", so the manual
-- research still ahead can be tracked rather than guessed at.
ALTER TABLE mayors ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE mayors ADD COLUMN IF NOT EXISTS enrichment_status TEXT
  DEFAULT 'name_only';
COMMENT ON COLUMN mayors.enrichment_status IS
  'name_only | partial | complete — how far personal-detail research has got.';

-- Existing 82 rows already carry photos/wikipedia for most, so grade them.
UPDATE mayors SET enrichment_status =
  CASE
    WHEN name IS NULL                                  THEN 'name_only'
    WHEN photo_url IS NOT NULL AND background IS NOT NULL THEN 'complete'
    WHEN photo_url IS NOT NULL OR wikipedia_url IS NOT NULL THEN 'partial'
    ELSE 'name_only'
  END
WHERE enrichment_status IS NULL OR enrichment_status = 'name_only';

-- ─── 6. RLS for the new rows ────────────────────────────────
-- Migration 005 filters mayors through authorities.is_published; that policy
-- keeps working unchanged for person rows of unpublished councils.

-- ============================================================
-- VERIFY AFTER RUNNING (expect 82 / 82 / 0):
--   SELECT count(*) FROM mayors;                          -- 82
--   SELECT count(*) FROM mayors WHERE is_current;          -- 82
--   SELECT count(*) FROM mayors WHERE NOT is_current;      --  0
--   SELECT enrichment_status, count(*) FROM mayors GROUP BY 1;
--
-- REQUIRED CODE CHANGE (app breaks without it once councils are added):
--   app/mayor/[slug]/page.tsx line ~52
--       .from('mayors').select('*').eq('authority_id', authority.id)
--     + .eq('is_current', true)
--       .single<Mayor>()
-- ============================================================
