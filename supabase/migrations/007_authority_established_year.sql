-- ============================================================
-- Munimark — Migration 007: when did the authority start existing?
-- Date: 2026-09-16
--
-- PROBLEM
--   The last 21 QA failures were read as "required field missing" for
--   צור הדסה (2019-2022) and שער שומרון (2019-2021). They are not missing.
--   Those authorities did not exist yet.
--
--   Confirmed by two independent sources:
--     - municipal-data.org population series 2002-2025 is zero for צור הדסה
--       until 2023 and for שער שומרון until 2022 — matching our CBS gaps
--       exactly.
--     - he.wikipedia: שער שומרון declared a local council in 2022, formed by
--       merging עץ אפרים and שערי תקווה out of מועצה אזורית שומרון;
--       צור הדסה split from מועצה אזורית מטה יהודה in 2023.
--
--   "No data" and "did not exist" are different facts. Recording the second
--   one stops QA reporting a defect that is really a birthday, and lets a
--   profile say "the council was established in 2023" instead of drawing an
--   empty chart.
--
-- NOT A DELETE
--   The pre-establishment rows stay. They carry dimension fields (נפה,
--   קבוצת_פרופיל) and removing rows to make a check pass would hide the
--   history rather than describe it.
-- ============================================================

ALTER TABLE authorities ADD COLUMN IF NOT EXISTS established_year SMALLINT;
COMMENT ON COLUMN authorities.established_year IS
  'First year the authority existed in its current municipal status. NULL means it predates our data window (2019) and needs no special handling. Years before this are legitimately empty, not defective.';

ALTER TABLE authorities ADD COLUMN IF NOT EXISTS established_note TEXT;
COMMENT ON COLUMN authorities.established_note IS
  'Human-readable provenance for established_year, including the source.';

-- ─── The two authorities born inside our data window ────────
UPDATE authorities SET
  established_year = 2023,
  established_note = 'הופרדה ממועצה אזורית מטה יהודה והוכרזה מועצה מקומית ב-2023. מקור: ויקיפדיה + TheMarker 22.5.2023. אומת מול סדרת האוכלוסייה של משרד הפנים, שמתחילה ב-2023.'
WHERE symbol = 1113 AND authority_type = 'מועצה מקומית';

UPDATE authorities SET
  established_year = 2022,
  established_note = 'הוכרזה מועצה מקומית ב-2022 מאיחוד עץ אפרים ושערי תקווה, שהשתייכו למועצה אזורית שומרון. מקור: ויקיפדיה. אומת מול סדרת האוכלוסייה של משרד הפנים, שמתחילה ב-2022.'
WHERE symbol = 3826 AND authority_type = 'מועצה מקומית';

-- ─── Authorities that changed status mid-window ─────────────
-- Not births: these were local councils that became cities. Recorded for the
-- same reason — so the change is described rather than inferred.
UPDATE authorities SET
  established_note = COALESCE(established_note, '') ||
    'שודרגה ממועצה מקומית לעירייה במהלך תקופת הנתונים. השנים שלפני כן מסווגות כמועצה מקומית ב-h_authority_type.'
WHERE symbol IN (229, 481, 654, 1247, 2530) AND authority_type = 'עירייה';

CREATE INDEX IF NOT EXISTS idx_authorities_established
  ON authorities(established_year) WHERE established_year IS NOT NULL;

-- ============================================================
-- VERIFY AFTER RUNNING:
--   SELECT symbol, name_display, established_year, established_note
--   FROM authorities WHERE established_year IS NOT NULL
--      OR established_note IS NOT NULL
--   ORDER BY established_year NULLS LAST;
--   -- expect 2 rows with a year (1113 -> 2023, 3826 -> 2022)
--   --        5 rows with a note only (the upgraded cities)
-- ============================================================
