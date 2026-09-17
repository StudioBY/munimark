-- ============================================================
-- Munimark — Migration 009: attribution for photos and background text
-- Date: 2026-09-17
--
-- WHY
--   The identity layer currently stores a photo_url and a background blob with
--   no record of WHERE either came from or under WHAT LICENCE. 67 of the 68
--   existing photos are Wikimedia URLs carrying CC BY-SA, which obliges us to
--   credit the author. Today that obligation cannot be met, because the author
--   was never stored.
--
--   Munimark is a public site about named public figures. "No fabrication —
--   every field requires a verified source" (hard rule 1) has applied to the
--   data layer since day one; these columns extend it to the identity layer.
--
-- THE CREDITS PAGE
--   A single site-wide credits page is a recognised way to satisfy CC BY-SA
--   attribution, PROVIDED it names each work and its author rather than making
--   a blanket statement. These columns are what makes that page buildable:
--   one row per photo, with author, licence, and a link to the source file page.
--
--   Note that DISPLAYING an unmodified photo is not an adaptation, so the
--   share-alike term does not propagate to the rest of the site. That is only
--   a live question for text reproduced verbatim, which is why the background
--   fields below are tracked separately from the photo fields.
--
-- REPLACEABLE BY DESIGN
--   photo_source marks provenance so that a Wikimedia image can later be
--   swapped for one the authority head supplies directly through the admin
--   interface. At that point the attribution columns for that row become null
--   and the obligation simply ends. Nothing here assumes Wikimedia is permanent.
-- ============================================================

ALTER TABLE mayors ADD COLUMN IF NOT EXISTS photo_source        TEXT;
ALTER TABLE mayors ADD COLUMN IF NOT EXISTS photo_license       TEXT;
ALTER TABLE mayors ADD COLUMN IF NOT EXISTS photo_license_url   TEXT;
ALTER TABLE mayors ADD COLUMN IF NOT EXISTS photo_artist        TEXT;
ALTER TABLE mayors ADD COLUMN IF NOT EXISTS photo_file_page     TEXT;
ALTER TABLE mayors ADD COLUMN IF NOT EXISTS photo_fetched_at    TIMESTAMPTZ;

ALTER TABLE mayors ADD COLUMN IF NOT EXISTS background_source     TEXT;
ALTER TABLE mayors ADD COLUMN IF NOT EXISTS background_source_url TEXT;
ALTER TABLE mayors ADD COLUMN IF NOT EXISTS background_license    TEXT;

COMMENT ON COLUMN mayors.photo_source IS
  'Provenance: wikimedia-commons | he-wikipedia | authority-site | mayor-upload | press-office. Drives the credits page and marks which rows still carry a third-party licence obligation.';
COMMENT ON COLUMN mayors.photo_artist IS
  'Author as the source states it. Required by CC BY / CC BY-SA. Null is legitimate only for public-domain works or for a photo the authority head supplied directly.';
COMMENT ON COLUMN mayors.photo_file_page IS
  'The source FILE page (e.g. a Commons File: page), not the image URL. This is what the credits page links to, and where a reader verifies the licence independently.';
COMMENT ON COLUMN mayors.background_license IS
  'Licence of the background TEXT, kept apart from the photo licence. Verbatim CC BY-SA prose carries share-alike implications that an unmodified photo does not.';

-- Backfill what is already knowable: the existing Wikimedia photos.
-- Author and licence stay NULL — they were never captured and will not be
-- invented here. The harvester fills them per row, from the source.
UPDATE mayors
   SET photo_source = 'wikimedia-commons'
 WHERE photo_url LIKE '%upload.wikimedia.org%'
   AND photo_source IS NULL;

CREATE INDEX IF NOT EXISTS idx_mayors_photo_source
  ON mayors(photo_source) WHERE photo_url IS NOT NULL;

-- ============================================================
-- VERIFY AFTER RUNNING:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'mayors' AND column_name LIKE 'photo_%'
--       OR column_name LIKE 'background_%';          -- expect 9 rows
--   SELECT photo_source, count(*) FROM mayors
--    WHERE photo_url IS NOT NULL GROUP BY 1;         -- expect wikimedia-commons 67, null 1
-- ============================================================
