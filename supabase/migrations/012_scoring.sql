-- ============================================================
-- Munimark — Migration 012: the scoring model
-- Date: 2026-10-10
--
-- `scores` was designed in migration 001 for a model we did not end up using
-- ("count of B-metrics where the authority leads its group"). It holds 0 rows,
-- so it is replaced rather than migrated.
--
-- WHY THAT MODEL WAS DROPPED — measured, not argued
--   On 2023 data it gave 29% of authorities a score of ZERO, and a median of
--   2 out of 20. In a group of nine, placing second scored the same as last:
--   every piece of information between first and last was discarded.
--
-- THE MODEL THIS TABLE SERVES
--   Each metric is scored 0-100 against FROZEN anchors — the 10th and 90th
--   percentile of that metric within the authority's own peer group. The metric
--   scores are averaged within five domains, and the five domains are averaged
--   equally into one number. That number maps to a band through frozen cut
--   points.
--
--   ABSOLUTE, NOT RELATIVE. A percentile would move whenever the peers moved,
--   which is useless for a badge an authority displays: the number has to mean
--   the same thing next year. Anchors are computed once and stored in
--   `scoring_anchors`, never recomputed per run. Removing a whole year from the
--   reference moves a score by 0.10 points at the median — the freeze holds.
--
--   FAIR BY CONSTRUCTION. Anchoring inside the peer group makes the score
--   independent of how wealthy the town is: measured correlation with the
--   socioeconomic cluster is -0.03. Anchored nationally instead it is +0.52,
--   which would have put the Arab and peripheral authorities at the bottom as
--   a matter of arithmetic.
--
--   MONETARY METRICS ARE ANCHORED PER YEAR. Budget per capita rose 22% between
--   2019 and 2024 while inflation ran 15-18%: nominal shekels drift, and frozen
--   anchors would read that drift as improvement. Comparing a money metric only
--   against the same year's peers cancels it without needing a price index.
--   `scoring_anchors.data_year` is NULL for the rest, set for these.
--
--   EQUAL WEIGHT PER DOMAIN, NOT PER METRIC. Equal weight per metric is not
--   neutral: it lets the CBS decide importance by how many columns it
--   publishes. Education would carry 28% of a municipal score and welfare 6%.
-- ============================================================

DROP TABLE IF EXISTS scores;

CREATE TABLE scores (
  id                  SERIAL PRIMARY KEY,
  authority_id        INTEGER  NOT NULL REFERENCES authorities(id) ON DELETE CASCADE,
  data_year           SMALLINT NOT NULL,

  score               NUMERIC(5,2),   -- 0-100, the published number
  band                TEXT,           -- A | B | C | D
  comparison_group    TEXT    NOT NULL,
  group_size          SMALLINT,

  -- the five domains, so a page can show WHY, not just the total
  domain_education    NUMERIC(5,2),
  domain_finance      NUMERIC(5,2),
  domain_welfare      NUMERIC(5,2),
  domain_environment  NUMERIC(5,2),
  domain_growth       NUMERIC(5,2),

  metrics_used        SMALLINT,       -- how many of the 21 this authority had
  metrics_possible    SMALLINT,
  methodology_version TEXT    NOT NULL,
  computed_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (authority_id, data_year)
);

COMMENT ON COLUMN scores.score IS
  'Absolute 0-100. Comparable across years and across comparison cuts, because the anchors behind it are frozen. NOT a percentile.';
COMMENT ON COLUMN scores.band IS
  'A-D from frozen cut points in scoring_config. A is roughly the top fifth.';
COMMENT ON COLUMN scores.metrics_used IS
  'An authority missing many metrics gets a score built on less evidence. Below the minimum the scorer writes no row at all rather than a thin one.';
COMMENT ON COLUMN scores.methodology_version IS
  'Which rule set produced this row. A change of method must not silently overwrite scores computed under the previous one.';

CREATE INDEX IF NOT EXISTS idx_scores_year      ON scores(data_year);
CREATE INDEX IF NOT EXISTS idx_scores_band      ON scores(band, data_year);
CREATE INDEX IF NOT EXISTS idx_scores_authority ON scores(authority_id, data_year);

-- ── The frozen anchors ──────────────────────────────────────────────────────
-- Stored, not recomputed. This table is what makes the score absolute: as long
-- as these rows do not change, a score of 67 means the same thing forever.
CREATE TABLE IF NOT EXISTS scoring_anchors (
  id               SERIAL PRIMARY KEY,
  methodology_version TEXT NOT NULL,
  comparison_group TEXT NOT NULL,
  field            TEXT NOT NULL,
  data_year        SMALLINT,          -- NULL = anchored across all history
  low              DOUBLE PRECISION NOT NULL,   -- p10 in the better-is-higher sense
  high             DOUBLE PRECISION NOT NULL,   -- p90
  n_observations   INTEGER NOT NULL,
  direction        TEXT NOT NULL,     -- higher_better | lower_better | close_to_100
  frozen_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (methodology_version, comparison_group, field, data_year)
);

COMMENT ON TABLE scoring_anchors IS
  'The frozen reference points behind every metric score. Recomputing these would silently restate every score ever published, so the scorer writes them once per methodology version and refuses to overwrite them afterwards.';
COMMENT ON COLUMN scoring_anchors.data_year IS
  'NULL for metrics anchored across all history. Set for monetary metrics, which are anchored within their own year so that inflation cancels.';

-- ── The frozen cut points and weights ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS scoring_config (
  methodology_version TEXT PRIMARY KEY,
  cut_d_c             NUMERIC(5,2) NOT NULL,   -- below this: D
  cut_c_b             NUMERIC(5,2) NOT NULL,
  cut_b_a             NUMERIC(5,2) NOT NULL,   -- at or above this: A
  domains             JSONB NOT NULL,          -- domain -> [fields]
  monetary_fields     JSONB NOT NULL,          -- anchored per year
  min_domains         SMALLINT NOT NULL DEFAULT 4,
  min_group_n         SMALLINT NOT NULL DEFAULT 12,
  notes               TEXT,
  frozen_at           TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE scoring_config IS
  'One row per methodology version: the cut points, the domain definition and which fields are treated as monetary. Published so the method can be checked, and frozen so a score keeps its meaning.';

ALTER TABLE scores          ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_anchors ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_config  ENABLE ROW LEVEL SECURITY;

-- Same published-authority rule as every other child table (migration 005).
DROP POLICY IF EXISTS "public_read_scores" ON scores;
CREATE POLICY "public_read_scores" ON scores
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM authorities a WHERE a.id = scores.authority_id AND a.is_published = true));

-- The method itself is public: a score nobody can check is not evidence.
DROP POLICY IF EXISTS "public_read_scoring_anchors" ON scoring_anchors;
CREATE POLICY "public_read_scoring_anchors" ON scoring_anchors FOR SELECT USING (true);
DROP POLICY IF EXISTS "public_read_scoring_config" ON scoring_config;
CREATE POLICY "public_read_scoring_config" ON scoring_config FOR SELECT USING (true);

-- ============================================================
-- VERIFY AFTER RUNNING:
--   SELECT count(*) FROM scores;            -- 0, the scorer fills it
--   SELECT count(*) FROM scoring_anchors;   -- 0 until the first run freezes them
--   \d scores                               -- score is NUMERIC, band exists
-- ============================================================
