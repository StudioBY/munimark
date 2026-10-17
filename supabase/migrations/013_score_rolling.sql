-- ============================================================
-- Munimark — Migration 013: the rolling score behind the band
-- Date: 2026-10-11
--
-- The band is not set from a single year. Measured on the real data, a
-- single-year band changes for 40% of authorities between consecutive years —
-- a badge that turns over that often is not a badge. A three-year mean brings
-- that to 20%, and adding hysteresis (keep your band unless you clear the
-- boundary by 2 points, the way credit ratings work) brings it to 12%.
--
-- Three years is also the better claim. One year of municipal data is noise;
-- three is a record, which is what a term is judged on.
--
-- So two numbers are stored, and they answer different questions:
--   score      this year alone — the trend line, and the change across a term
--   score_3yr  this year and the two before it — what the band is set from
-- ============================================================

ALTER TABLE scores ADD COLUMN IF NOT EXISTS score_3yr     NUMERIC(5,2);
ALTER TABLE scores ADD COLUMN IF NOT EXISTS years_in_mean SMALLINT;
ALTER TABLE scores ADD COLUMN IF NOT EXISTS band_natural  TEXT;

COMMENT ON COLUMN scores.score_3yr IS
  'Mean of this year and the two before it, where those years have a score. The band is derived from this, not from `score`.';
COMMENT ON COLUMN scores.years_in_mean IS
  'How many years went into score_3yr — 1, 2 or 3. A band resting on one year is weaker evidence and the interface should be able to say so.';
COMMENT ON COLUMN scores.band_natural IS
  'The band score_3yr would give with no hysteresis. Stored so the published band can always be checked against the unsmoothed one: an authority is entitled to know it is being held at a grade it has just left.';

ALTER TABLE scoring_config ADD COLUMN IF NOT EXISTS rolling_years   SMALLINT DEFAULT 3;
ALTER TABLE scoring_config ADD COLUMN IF NOT EXISTS hysteresis_pts  NUMERIC(4,2) DEFAULT 2;
ALTER TABLE scoring_config ADD COLUMN IF NOT EXISTS scope_note      TEXT;

COMMENT ON COLUMN scoring_config.scope_note IS
  'What the index does NOT cover, published with it. Welfare outcomes, service quality, transparency, safety, culture and transport are outside it: the data does not exist for them, and a score that stays silent about its own scope is overclaiming.';

-- ============================================================
-- VERIFY:  SELECT column_name FROM information_schema.columns
--           WHERE table_name='scores' AND column_name LIKE '%3yr%';
-- ============================================================
