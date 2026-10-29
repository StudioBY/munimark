-- ============================================================
-- Munimark — Migration 014: letter grades (methodology v2) beside v1
-- Date: 2026-10-29
--
-- Decided 2026-10-28, refined and approved 2026-10-29 (docs/STATUS_2026-10-17.md):
--   a letter per metric against its peer group; a domain letter from the mean
--   of its metric letters over three years; the band from the domains' points
--   over three years; an overall A needs a domain A and a D a domain D;
--   every level cut 15/30/30/25 on the published distribution, frozen.
--
-- THE ONE RISKY CHANGE: the unique key on `scores`.
--   It is (authority_id, data_year), so a v2 row for a year would REPLACE the
--   v1 row instead of sitting beside it. v2 must be written beside v1, never
--   over it — the published v1 grades stay checkable. The key becomes
--   (authority_id, data_year, methodology_version). Every existing row is v1,
--   so no existing row can violate the new key.
--
--   Consequence: the v1 scorer (compute_scores_2026-10-10.mjs) upserts on
--   'authority_id,data_year' and will fail after this. That is intended: v1's
--   anchors and cut points are frozen and it is not to be re-run.
-- ============================================================

BEGIN;

-- Found by its columns, not by an assumed name: a DROP of a name that does not
-- exist succeeds silently and would leave the old key in place.
DO $$
DECLARE c TEXT;
BEGIN
  SELECT con.conname INTO c
  FROM pg_constraint con
  WHERE con.conrelid = 'scores'::regclass AND con.contype = 'u'
    AND (SELECT array_agg(att.attname::TEXT ORDER BY att.attname)
         FROM unnest(con.conkey) k JOIN pg_attribute att
           ON att.attrelid = con.conrelid AND att.attnum = k) = ARRAY['authority_id', 'data_year'];
  IF c IS NULL THEN
    RAISE EXCEPTION 'unique key (authority_id, data_year) on scores not found; stop and check before going on';
  END IF;
  EXECUTE format('ALTER TABLE scores DROP CONSTRAINT %I', c);
END $$;

ALTER TABLE scores ADD CONSTRAINT scores_authority_year_method_key
  UNIQUE (authority_id, data_year, methodology_version);

-- v2 columns. v1 rows leave them NULL; v2 rows leave score/score_3yr/domain_* NULL.
ALTER TABLE scores ADD COLUMN IF NOT EXISTS points            NUMERIC(6,4);
ALTER TABLE scores ADD COLUMN IF NOT EXISTS points_3yr        NUMERIC(6,4);
ALTER TABLE scores ADD COLUMN IF NOT EXISTS domain_letters    JSONB;
ALTER TABLE scores ADD COLUMN IF NOT EXISTS domain_points_3yr JSONB;

COMMENT ON COLUMN scores.points IS
  'v2: this year alone — the mean of the domains'' points, each domain the mean of its metric letters (A=4 … D=1).';
COMMENT ON COLUMN scores.points_3yr IS
  'v2: the three-year mean of the domain points. The band is cut on this.';
COMMENT ON COLUMN scores.domain_letters IS
  'v2: {"education":"A", ...} from three-year domain points. A needs a mean ABOVE 3.0: a domain whose metrics were all B is a B.';
COMMENT ON COLUMN scores.domain_points_3yr IS
  'v2: the three-year domain points the letters come from, so every letter can be checked.';

-- The frozen cut points of each level, and the rules, published with the method.
ALTER TABLE scoring_config ADD COLUMN IF NOT EXISTS metric_cuts JSONB;
ALTER TABLE scoring_config ADD COLUMN IF NOT EXISTS domain_cuts JSONB;
ALTER TABLE scoring_config ADD COLUMN IF NOT EXISTS rules       JSONB;

COMMENT ON COLUMN scoring_config.metric_cuts IS
  'v2: [C, B, A] on the 0-100 metric score. Frozen: recomputing would restate every published letter.';
COMMENT ON COLUMN scoring_config.domain_cuts IS
  'v2: [C, B, A] on three-year domain points. Each cut strictly above its floor (C>1, B>2, A>3).';

COMMIT;

-- ============================================================
-- VERIFY AFTER RUNNING:
--   SELECT conname FROM pg_constraint WHERE conrelid = 'scores'::regclass AND contype = 'u';
--     -- scores_authority_year_method_key, and NOT scores_authority_id_data_year_key
--   SELECT count(*) FROM scores;                                  -- 2229, unchanged
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'scores' AND column_name IN ('points','points_3yr','domain_letters','domain_points_3yr');
--     -- four rows
-- ============================================================
