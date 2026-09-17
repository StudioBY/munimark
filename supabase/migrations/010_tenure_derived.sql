-- ============================================================
-- Munimark — Migration 010: make a derived tenure honest about its own limits
-- Date: 2026-09-17
--
-- term_count and tenure_start are about to be derived from mayor_terms, which
-- we already hold and which has already passed QA. No external source, no
-- licence, no scraping. 244 and 230 of 257 can be filled this way.
--
-- THE LIMIT THAT MUST BE RECORDED, NOT PAPERED OVER
--   mayor_terms begins at term_2013. For the 55 serving heads who already
--   appear in that first term, we cannot see whether they took office in 2013
--   or in 2003. Writing tenure_start = 2013 for them would state a fact we do
--   not have: אהרון דרור has led גן יבנה since 2003, and the page would say
--   2013 with the same confidence it says anything else.
--
--   So the derivation records WHICH KIND of answer it produced. 189 are exact.
--   55 are a lower bound, and the interface must say "לפחות" rather than
--   pretend. That is hard rule 10 — "missing" and "did not exist" are different
--   facts — applied to a boundary of our own data rather than the source's.
--
--   term_count is censored the same way and for the same reason: for those 55
--   it is the number of terms SINCE 2013, which is a minimum, not a total.
-- ============================================================

ALTER TABLE mayors ADD COLUMN IF NOT EXISTS tenure_is_minimum BOOLEAN DEFAULT FALSE;
ALTER TABLE mayors ADD COLUMN IF NOT EXISTS tenure_source     TEXT;

COMMENT ON COLUMN mayors.tenure_is_minimum IS
  'TRUE when the person already appears in term_2013, the earliest term we hold. Then tenure_start is "no later than" and term_count is "at least" — both are lower bounds and the UI must render them as such. FALSE means both are exact.';
COMMENT ON COLUMN mayors.tenure_source IS
  'How tenure_start and term_count were established: derived-mayor-terms | wikipedia | authority-site | manual. Keeps a derived value distinguishable from a researched one, so a later exact figure can safely overwrite a lower bound.';
COMMENT ON COLUMN mayors.tenure_start IS
  'Year the person took office at this authority — the ELECTION year (elections are held in October), not the CBS attribution window, which starts the following year. Read together with tenure_is_minimum.';
COMMENT ON COLUMN mayors.term_count IS
  'Number of terms served at this authority. Counted from term_2013 onward, so it is a minimum wherever tenure_is_minimum is TRUE.';

CREATE INDEX IF NOT EXISTS idx_mayors_tenure_source
  ON mayors(tenure_source) WHERE tenure_start IS NOT NULL;

-- ============================================================
-- VERIFY AFTER RUNNING:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'mayors'
--      AND column_name IN ('tenure_is_minimum','tenure_source');   -- 2 rows
-- ============================================================
