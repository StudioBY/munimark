-- ============================================================
-- Munimark — Migration 008: the 11 municipal-data.org metrics
--                           that were never ingested
-- Date: 2026-09-16
--
-- The Interior Ministry dashboard publishes 38 metrics. The 2026-07-30
-- extraction took 25 of them; 8 more were classified as duplicates of CBS and
-- used only for cross-checking, and 5 were never mapped at all. Re-reading the
-- site on 2026-09-16 (extract_munidata_v2) recovered 36 of the 38 — the two
-- left out are segmented by gender or age group, and flattening them into one
-- number would publish a figure the source never did.
--
-- NAMING: every column here carries a _moi suffix (משרד הפנים). Several are the
-- same CONCEPT as a CBS field we already store — population, migration balance,
-- housing starts, arnona collection — but they are a different measurement by a
-- different body, and merging them into one column would make it impossible to
-- say afterwards which number came from where. Two sources that agree are
-- evidence; two sources silently blended are neither.
--
-- WHY THESE MATTER
--   population_moi        2002-2025, 6168 values — reaches back seventeen years
--                         beyond our CBS window and forward one year past it
--   migration_moi         2014-2024 — covers term_2013 in full
--   housing_starts_moi    2002-2024
--   The rest are single-year 2024 measures, or 2020-2024 series, that add to
--   the display layer without touching scoring.
-- ============================================================

-- ── Deep history: these three reach outside the CBS window ──
ALTER TABLE authority_yearly ADD COLUMN IF NOT EXISTS d_population_moi          NUMERIC; -- אוכלוסייה (2002-2025)
ALTER TABLE authority_yearly ADD COLUMN IF NOT EXISTS d_migration_moi           NUMERIC; -- מאזן הגירה נטו (2014-2024)
ALTER TABLE authority_yearly ADD COLUMN IF NOT EXISTS d_housing_starts_moi      NUMERIC; -- התחלות בנייה למגורים (2002-2024)

-- ── Budget measures, 2024 unless noted ──
ALTER TABLE authority_yearly ADD COLUMN IF NOT EXISTS d_self_income_share_moi   NUMERIC; -- שיעור הכנסות עצמיות
ALTER TABLE authority_yearly ADD COLUMN IF NOT EXISTS d_arnona_collection_moi   NUMERIC; -- שיעור גבייה ארנונה נטו
ALTER TABLE authority_yearly ADD COLUMN IF NOT EXISTS d_current_deficit_moi     NUMERIC; -- שיעור גירעון שוטף
ALTER TABLE authority_yearly ADD COLUMN IF NOT EXISTS d_edu_subsidy_moi         NUMERIC; -- שיעור סבסוד חינוך
ALTER TABLE authority_yearly ADD COLUMN IF NOT EXISTS d_welfare_subsidy_moi     NUMERIC; -- שיעור סבסוד רווחה
ALTER TABLE authority_yearly ADD COLUMN IF NOT EXISTS d_deficit_auth_share_moi  NUMERIC; -- שיעור רשויות בגירעון
ALTER TABLE authority_yearly ADD COLUMN IF NOT EXISTS d_unbudgeted_funds        NUMERIC; -- קרנות בלתי מתוקצבות (2020-2024)

-- ── Human capital ──
ALTER TABLE authority_yearly ADD COLUMN IF NOT EXISTS d_hr_manager_gap          NUMERIC; -- פער ברמת משרת מנהל הון אנושי (2025)

COMMENT ON COLUMN authority_yearly.d_population_moi IS
  'Population per the Interior Ministry dashboard, 2002-2025. Kept separate from h_population (CBS): the two agree to a median 0.000%% where they overlap, and that agreement is only checkable while they stay apart.';
COMMENT ON COLUMN authority_yearly.d_migration_moi IS
  'Net internal migration per the Interior Ministry, 2014-2024. Distinct from b_migration_balance (CBS).';
COMMENT ON COLUMN authority_yearly.d_housing_starts_moi IS
  'Residential housing starts per the Interior Ministry, 2002-2024. Distinct from b_construction_starts (CBS), which counts area rather than units.';

CREATE INDEX IF NOT EXISTS idx_yearly_population_moi
  ON authority_yearly(data_year) WHERE d_population_moi IS NOT NULL;

-- ============================================================
-- VERIFY AFTER RUNNING (all 11 should return true):
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'authority_yearly' AND column_name LIKE '%_moi'
--      OR column_name IN ('d_unbudgeted_funds','d_hr_manager_gap')
--   ORDER BY column_name;
-- ============================================================
