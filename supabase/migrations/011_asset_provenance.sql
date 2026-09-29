-- ============================================================
-- Munimark — Migration 011: provenance out of `mayors`
-- Date: 2026-09-29
--
-- WHY
--   Migrations 009 and 010 added eleven metadata columns to `mayors` — a table
--   that describes a PERSON. A photo's licence is a property of the FILE, and
--   the moment we fetched it is a property of OUR SYSTEM; neither is a fact
--   about the authority head. Left alone, every new source would add three
--   more columns, and the table would become a log.
--
--   The same shape recurs for things that are not mayors at all: authority
--   emblems, documents, anything we display that someone else made. One table
--   keyed by (entity, field) answers all of them.
--
-- WHAT MOVES
--   photo_source, photo_license, photo_license_url, photo_artist,
--   photo_file_page, photo_fetched_at  →  one row, field = 'photo_url'
--   background_source, background_source_url, background_license
--                                      →  one row, field = 'background'
--
-- WHAT STAYS, AND WHY
--   photo_url and background stay on `mayors`: they are what the page shows.
--   tenure_source stays too — it records how a value in THIS table was
--   established, which is a fact about the row, not about a third party's file.
--
-- THE OLD COLUMNS ARE NOT DROPPED HERE
--   They are left in place and marked deprecated. Dropping them in the same
--   migration that fills the new table means a single mistake loses the only
--   copy of an attribution we are legally obliged to display. A later
--   migration drops them, once the site has been serving from the new table.
-- ============================================================

CREATE TABLE IF NOT EXISTS asset_provenance (
  id           SERIAL PRIMARY KEY,
  entity_type  TEXT        NOT NULL,          -- 'mayor' today; 'authority' next
  entity_id    INTEGER     NOT NULL,
  field        TEXT        NOT NULL,          -- the column it describes: 'photo_url', 'background'
  source       TEXT,                          -- wikimedia-commons | he-wikipedia | authority-site | mayor-upload
  license      TEXT,                          -- 'CC BY-SA 4.0', 'CC0', 'Public domain'
  license_url  TEXT,
  attribution  TEXT,                          -- the author, as the source states them
  source_page  TEXT,                          -- the FILE page, where a reader verifies it
  fetched_at   TIMESTAMPTZ,
  note         TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (entity_type, entity_id, field)
);

COMMENT ON TABLE asset_provenance IS
  'Where a displayed asset came from and under what licence. One row per (entity, field). Exists so that `mayors` can go back to describing a person: a file''s licence is a property of the file, not of the authority head.';
COMMENT ON COLUMN asset_provenance.field IS
  'The column this describes, e.g. photo_url or background. Kept as the join rather than a separate table per asset type, so an authority emblem or a document needs no new schema.';
COMMENT ON COLUMN asset_provenance.attribution IS
  'The author as the SOURCE states them. Required by CC BY / CC BY-SA. Null is legitimate only for public-domain work, or for a photo the subject supplied directly.';
COMMENT ON COLUMN asset_provenance.source_page IS
  'The page a reader opens to check the licence independently — a Commons File: page, not the image URL.';

CREATE INDEX IF NOT EXISTS idx_asset_provenance_entity
  ON asset_provenance(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_asset_provenance_license
  ON asset_provenance(license) WHERE license IS NOT NULL;

ALTER TABLE asset_provenance ENABLE ROW LEVEL SECURITY;

-- Public read, but only for a published authority — the same rule migration 005
-- applied to every other child table. Attribution for a row nobody can see
-- would leak the existence of an unpublished authority's head.
DROP POLICY IF EXISTS "public_read_asset_provenance" ON asset_provenance;
CREATE POLICY "public_read_asset_provenance" ON asset_provenance
  FOR SELECT USING (
    entity_type <> 'mayor' OR EXISTS (
      SELECT 1 FROM mayors m
        JOIN authorities a ON a.id = m.authority_id
       WHERE m.id = asset_provenance.entity_id
         AND a.is_published = true
    )
  );

-- ── Backfill from the columns added by 009 ──────────────────────────────────
INSERT INTO asset_provenance
  (entity_type, entity_id, field, source, license, license_url, attribution, source_page, fetched_at)
SELECT 'mayor', id, 'photo_url',
       photo_source, photo_license, photo_license_url, photo_artist, photo_file_page, photo_fetched_at
  FROM mayors
 WHERE photo_url IS NOT NULL
   AND (photo_source IS NOT NULL OR photo_license IS NOT NULL OR photo_artist IS NOT NULL)
ON CONFLICT (entity_type, entity_id, field) DO NOTHING;

INSERT INTO asset_provenance
  (entity_type, entity_id, field, source, license, license_url, source_page)
SELECT 'mayor', id, 'background',
       background_source, background_license, NULL, background_source_url
  FROM mayors
 WHERE background IS NOT NULL
   AND (background_source IS NOT NULL OR background_license IS NOT NULL)
ON CONFLICT (entity_type, entity_id, field) DO NOTHING;

COMMENT ON COLUMN mayors.photo_license IS 'DEPRECATED by migration 011 — read asset_provenance instead. Kept until the site serves from the new table.';
COMMENT ON COLUMN mayors.photo_artist  IS 'DEPRECATED by migration 011 — read asset_provenance instead.';
COMMENT ON COLUMN mayors.background_license IS 'DEPRECATED by migration 011 — read asset_provenance instead.';

-- ── Drift check for the derived tenure fields ───────────────────────────────
-- term_count and tenure_is_minimum are DERIVED from mayor_terms but stored on
-- mayors, so they can fall out of step silently once a term row is added.
--
-- A view is deliberately NOT used to replace them. tenure_start legitimately
-- mixes derived values with researched ones that mayor_terms cannot see —
-- רון חולדאי has led Tel Aviv since 1998, while our term data starts at 2013 —
-- so computing it on the fly would DESTROY information. The real risk is not
-- that the values are stored; it is that divergence goes unnoticed. So this
-- surfaces the divergence and leaves the values alone.
--
--   SELECT * FROM mayors_tenure_drift;   -- expect zero rows
CREATE OR REPLACE VIEW mayors_tenure_drift AS
WITH derived AS (
  SELECT m.id,
         count(DISTINCT t.term_label)                       AS terms_in_data,
         bool_or(t.term_label = 'term_2013')                AS present_at_earliest
    FROM mayors m
    JOIN mayor_terms t ON t.mayor_id = m.id
   WHERE m.is_current = true
   GROUP BY m.id
)
SELECT m.id, m.name, a.name_display AS authority,
       m.term_count        AS stored_term_count,
       d.terms_in_data     AS derived_term_count,
       m.tenure_is_minimum AS stored_is_minimum,
       d.present_at_earliest AS derived_is_minimum
  FROM mayors m
  JOIN derived d  ON d.id = m.id
  LEFT JOIN authorities a ON a.id = m.authority_id
 WHERE m.term_count IS DISTINCT FROM d.terms_in_data
    OR m.tenure_is_minimum IS DISTINCT FROM d.present_at_earliest;

COMMENT ON VIEW mayors_tenure_drift IS
  'Rows where the stored term_count / tenure_is_minimum disagree with mayor_terms. Expected to be empty; anything here means a term was added without re-running derive_tenure. Only covers people whose terms carry mayor_id.';

-- ============================================================
-- VERIFY AFTER RUNNING:
--   SELECT field, count(*) FROM asset_provenance GROUP BY field;
--       photo_url   185
--       background  138
--   SELECT count(*) FROM asset_provenance WHERE license IS NULL;   -- 0
--   SELECT count(*) FROM mayors_tenure_drift;                      -- see note above
-- ============================================================
