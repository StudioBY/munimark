-- ============================================================
-- Munimark — Migration 015: a head who left office mid-term
-- Date: 2026-10-29
--
-- The attribution rule (lib/terms.ts): a data year belongs to whoever served
-- through it, and a term runs until the year before the next term starts.
-- That holds while a head serves to the end. It breaks when a head leaves
-- mid-term and the next ELECTED term starts later: the years between are
-- credited to someone who was not there.
--
-- The case that found it: Ofir Libstein, head of Shaar HaNegev regional
-- council from December 2018, was killed on 7 October 2023; the council was
-- run by an acting head (Yossi Keren) until the postponed election of November
-- 2024. Without this column, 2024 is attributed to Libstein.
--
-- Checked on 2026-10-29, the other councils whose 2023 election was postponed
-- by the war, where the head changed: Upper Galilee (Giora Zaltz served until
-- 25.3.2025) and Eshkol (Gadi Yarkoni until 3.12.2024) — both served through
-- 2024, so their attribution stands. Where the same head was re-elected there
-- is nothing to check.
--
-- Hard rule 1: a date is entered only with its source.
-- ============================================================

BEGIN;

ALTER TABLE mayor_terms ADD COLUMN IF NOT EXISTS left_office        DATE;
ALTER TABLE mayor_terms ADD COLUMN IF NOT EXISTS left_office_source TEXT;

COMMENT ON COLUMN mayor_terms.left_office IS
  'The day a head left office before the term ended (death, resignation, removal). NULL = served to the end. The year of leaving stays the head''s if they left after 30 June; the years from then until the next term are an interim, credited to no elected head.';
COMMENT ON COLUMN mayor_terms.left_office_source IS
  'Where left_office was verified. Required whenever left_office is set.';

ALTER TABLE mayor_terms ADD CONSTRAINT mayor_terms_left_office_sourced
  CHECK (left_office IS NULL OR left_office_source IS NOT NULL);

UPDATE mayor_terms
   SET left_office = DATE '2023-10-07',
       left_office_source = 'he.wikipedia.org/wiki/אופיר_ליבשטיין — infobox: ראש מועצה אזורית שער הנגב, דצמבר 2018 – 7 באוקטובר 2023; successor יוסי קרן (ממלא מקום). Retrieved 2026-10-29.'
 WHERE authority_symbol = 37
   AND authority_type = 'מועצה אזורית'
   AND term_label = 'term_2018';

-- exactly one row, or nothing changes
DO $$
BEGIN
  IF (SELECT count(*) FROM mayor_terms WHERE left_office IS NOT NULL) <> 1 THEN
    RAISE EXCEPTION 'expected exactly one term with left_office; stop and check';
  END IF;
END $$;

COMMIT;

-- ============================================================
-- VERIFY AFTER RUNNING:
--   SELECT full_name, term_label, left_office FROM mayor_terms WHERE left_office IS NOT NULL;
--     -- one row: אופיר ליבשטין · term_2018 · 2023-10-07
-- ============================================================
