-- ============================================================
-- Migration 005: Close the unpublished-authority data leak
-- Date: 2026-09-16
--
-- PROBLEM (verified live with the anon key on 2026-09-16):
--   `authorities` is filtered by is_published, but every child
--   table is open with USING (true). A public client could read
--   175 unpublished councils' rows from authority_yearly
--   (population, bagrut, budget — the full record) simply by
--   querying the child table directly.
--
-- FIX: every child table checks publication through its parent.
-- ============================================================

-- ─── authority_yearly ───────────────────────────────────────
DROP POLICY IF EXISTS "public_read_authority_yearly" ON authority_yearly;
CREATE POLICY "public_read_authority_yearly" ON authority_yearly
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM authorities a
      WHERE a.id = authority_yearly.authority_id
        AND a.is_published = true
    )
  );

-- ─── mayors ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "public_read_mayors" ON mayors;
CREATE POLICY "public_read_mayors" ON mayors
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM authorities a
      WHERE a.id = mayors.authority_id
        AND a.is_published = true
    )
  );

-- ─── scores ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "public_read_scores" ON scores;
CREATE POLICY "public_read_scores" ON scores
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM authorities a
      WHERE a.id = scores.authority_id
        AND a.is_published = true
    )
  );

-- ─── mayor_terms ────────────────────────────────────────────
-- Joins on (authority_symbol, authority_type), not authority_id.
-- Rows whose authority is absent from `authorities` stay hidden.
DROP POLICY IF EXISTS "public_read_mayor_terms" ON mayor_terms;
CREATE POLICY "public_read_mayor_terms" ON mayor_terms
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM authorities a
      WHERE a.symbol = mayor_terms.authority_symbol
        AND a.authority_type IS NOT DISTINCT FROM mayor_terms.authority_type
        AND a.is_published = true
    )
  );

-- ─── Supporting indexes for the policy lookups ──────────────
CREATE INDEX IF NOT EXISTS idx_authorities_published
  ON authorities(id) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_mayor_terms_symbol_type
  ON mayor_terms(authority_symbol, authority_type);

-- ============================================================
-- VERIFY AFTER RUNNING (expect 82 / 492 / 82 / 0):
--
--   SET LOCAL ROLE anon;
--   SELECT count(*) FROM authorities;                          -- 82
--   SELECT count(*) FROM authority_yearly
--     WHERE data_year BETWEEN 2019 AND 2024;                   -- 492  (82 x 6)
--   SELECT count(*) FROM mayors;                               -- 82
--   SELECT count(*) FROM authority_yearly ay
--     WHERE NOT EXISTS (SELECT 1 FROM authorities a
--                       WHERE a.id = ay.authority_id);         -- 0  (no leak)
--   RESET ROLE;
-- ============================================================
