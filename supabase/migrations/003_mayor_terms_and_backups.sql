-- ============================================================
-- Munimark — Phase 1: Mayor Terms table + backups
-- Date: 2026-07-30
-- Purpose: Create mayor_terms table for multi-term mayor
--          attribution. Backup existing authorities & mayors.
-- ============================================================

-- ─── Backups ────────────────────────────────────────────────
-- CREATE TABLE authorities_backup_20260730 AS SELECT * FROM authorities;  -- 82 rows
-- CREATE TABLE mayors_backup_20260730 AS SELECT * FROM mayors;            -- 82 rows
-- (Already executed directly; recorded here for reference)

-- ─── mayor_terms ────────────────────────────────────────────
-- Term-level attribution: one row per authority × election term.
-- Distinct from mayors table (person-level: bios, photos, media).
CREATE TABLE IF NOT EXISTS mayor_terms (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  authority_symbol      INTEGER NOT NULL,           -- סמל רשות (join key)
  authority_type        TEXT,                       -- סוג (עירייה / מועצה מקומית / מועצה אזורית)
  authority_slug        TEXT,                       -- URL slug where available
  mayor_id              INTEGER REFERENCES mayors(id), -- link to person record (null if not in DB)
  term_label            TEXT NOT NULL,              -- term_2013 / term_2018 / term_2024_regular /
                                                    -- term_2024_nov / term_2025_feb / term_2023_special /
                                                    -- term_2025_replacement / term_2026_repeat
  full_name             TEXT NOT NULL,              -- mayor name for this term
  election_pct          NUMERIC(5,2),               -- vote % (null if unknown)
  is_current            BOOLEAN DEFAULT FALSE,      -- currently serving mayor
  changed_from_previous BOOLEAN,                    -- did mayor change from prior term
  source                TEXT,                       -- sadna_2013 / interior_ministry_2018 /
                                                    -- interior_ministry_2024 / press_2024
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (authority_symbol, authority_type, term_label)
);

-- ─── CBS Year Attribution Rules ─────────────────────────────
-- Standard terms:
--   term_2013        → CBS years 2013-2018 (until next election)
--   term_2018        → CBS years 2019-2023
--   term_2024_regular → CBS year 2024+
--   term_2024_nov    → CBS year 2024 stays with term_2018 mayor
--                      (delayed elections, war evacuees); 2025+ → new mayor
--   term_2025_feb    → CBS year 2024 stays with term_2018 mayor; 2025+ → new mayor
--   term_2023_special → CBS years 2023+ (Yoav — special election)
--
-- Mid-term replacements (added 2026-07-30):
--   term_2025_replacement (Netanya 7400) → CBS years 2026+
--       2024-2025 remain attributed to term_2024_regular mayor (Feierberg-Ikar)
--   term_2026_repeat (Akko 7600) → CBS years 2026+
--       2024-2025 remain attributed to term_2024_regular mayor (Ben Shalush)

-- ─── RLS ────────────────────────────────────────────────────
ALTER TABLE mayor_terms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_mayor_terms" ON mayor_terms FOR SELECT USING (true);
