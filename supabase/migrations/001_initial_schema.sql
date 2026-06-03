-- ============================================================
-- Munimark — Initial Schema v2.2
-- Schema mirrors _shared/schema_v2.2.json
-- Join key: סמל_רשות (CBS numeric authority symbol)
-- ============================================================

-- ─── authorities ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS authorities (
  id                  SERIAL PRIMARY KEY,
  symbol              INTEGER NOT NULL UNIQUE,   -- סמל_רשות
  name_display        TEXT    NOT NULL,           -- שם_עיר_שגרתי
  name_cbs            TEXT    NOT NULL,           -- שם_בלמס
  slug                TEXT    NOT NULL UNIQUE,    -- URL slug (e.g. "ashdod")
  entity_id_obudget   TEXT,                       -- obudget entity ID
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_authorities_symbol ON authorities(symbol);
CREATE INDEX idx_authorities_slug   ON authorities(slug);

-- ─── mayors ─────────────────────────────────────────────────
-- One active mayor per authority.
-- Future: multiple rows if mayor changes (track by tenure dates).
CREATE TABLE IF NOT EXISTS mayors (
  id                  SERIAL PRIMARY KEY,
  authority_id        INTEGER NOT NULL REFERENCES authorities(id) ON DELETE CASCADE,
  name                TEXT,    -- שם_ראש_הרשות
  birth_year          TEXT,    -- תאריך_לידה (year string from Wikipedia)
  tenure_start        TEXT,    -- תאריך_תחילת_כהונה
  term_count          INTEGER, -- מספר_כהונות
  background          TEXT,    -- רקע_מקצועי
  photo_url           TEXT,    -- כתובת_תמונה
  election_pct        TEXT,    -- אחוז_קולות_בחירות_אחרונות
  -- digital presence
  youtube_url         TEXT,
  youtube_subscribers INTEGER,
  youtube_video_count INTEGER,
  youtube_last_video  TEXT,
  youtube_active      BOOLEAN,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(authority_id)
);

-- ─── authority_yearly ───────────────────────────────────────
-- One row per authority × year.
-- H = context (comparison group), B = performance (scored), D = display only.
CREATE TABLE IF NOT EXISTS authority_yearly (
  id                      SERIAL PRIMARY KEY,
  authority_id            INTEGER NOT NULL REFERENCES authorities(id) ON DELETE CASCADE,
  data_year               SMALLINT NOT NULL,

  -- ── H: Context (12 fields) ──────────────────────────────
  h_district              TEXT,    -- מחוז
  h_authority_type        TEXT,    -- סוג_רשות (עירייה / מועצה מקומית / מועצה אזורית)
  h_population            NUMERIC, -- אוכלוסייה
  h_socio_cluster         SMALLINT,-- אשכול_חברתי_כלכלי 1-10
  h_periphery             SMALLINT,-- פריפריאליות 1-10
  h_density               NUMERIC, -- צפיפות (persons/km²)
  h_youth_pct             NUMERIC, -- אחוז_צעירים_0_17
  h_elderly_pct           NUMERIC, -- אחוז_קשישים_65+
  h_equalization_grant    NUMERIC, -- מענק_איזון_כללי
  h_ba_degree_pct         NUMERIC, -- תואר_ראשון_אחוז
  h_life_expectancy       NUMERIC, -- תוחלת_חיים
  h_council_members       SMALLINT,-- מספר_חברי_מועצה

  -- ── B: Performance (20 fields) ──────────────────────────
  b_budget_per_capita     NUMERIC, -- תקציב_לנפש            higher_better
  b_arnona_collection_pct NUMERIC, -- גביית_ארנונה_אחוז      higher_better
  b_budget_execution_pct  NUMERIC, -- ביצוע_תקציב_אחוז       close_to_100
  b_own_revenue_pct       NUMERIC, -- הכנסות_עצמיות_אחוז     higher_better
  b_surplus_deficit       NUMERIC, -- עודף_גירעון            higher_better
  b_bagrut_pct            NUMERIC, -- זכאות_בגרות            higher_better
  b_bagrut_uni_pct        NUMERIC, -- בגרות_סף_אוניברסיטאי   higher_better
  b_dropout_pct           NUMERIC, -- נשירה                  lower_better
  b_students_per_class    NUMERIC, -- תלמידים_לכיתה          lower_better
  b_edu_spend_pct         NUMERIC, -- הוצאה_חינוך_אחוז       higher_better
  b_welfare_spend_pct     NUMERIC, -- הוצאה_רווחה_אחוז       higher_better
  b_construction_starts   NUMERIC, -- התחלות_בנייה           higher_better
  b_construction_completions NUMERIC, -- גמר_בנייה           higher_better
  b_population_growth_pct NUMERIC, -- גידול_אוכלוסייה_אחוז  higher_better
  b_migration_balance     NUMERIC, -- מאזן_הגירה             higher_better
  b_water_loss_pct        NUMERIC, -- אחוז_פחת_מים           lower_better
  b_recycling_pct         NUMERIC, -- אחוז_מחזור_פסולת       higher_better
  b_waste_per_capita      NUMERIC, -- פסולת_לנפש             lower_better
  b_edu_invest_per_capita NUMERIC, -- השקעה_חינוך_לנפש       higher_better
  b_welfare_invest_per_capita NUMERIC, -- השקעה_רווחה_לנפש   higher_better

  -- ── D: Display only (3 CBS fields) ──────────────────────
  d_accidents_per_1000    NUMERIC, -- תאונות_ל_1000
  d_sewage_treated_pct    NUMERIC, -- אחוז_שפכים_מטופלים
  d_water_violations      NUMERIC, -- חריגות_מי_שתייה

  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(authority_id, data_year)
);

CREATE INDEX idx_authority_yearly_auth_year ON authority_yearly(authority_id, data_year);

-- ─── scores ──────────────────────────────────────────────────
-- Computed by scorer agent. One row per authority × year.
CREATE TABLE IF NOT EXISTS scores (
  id                    SERIAL PRIMARY KEY,
  authority_id          INTEGER NOT NULL REFERENCES authorities(id) ON DELETE CASCADE,
  data_year             SMALLINT NOT NULL,
  comparison_group      TEXT NOT NULL, -- e.g. "עירייה_2_m"
  score                 SMALLINT,      -- total B-metrics where authority leads group
  max_score             SMALLINT,      -- total B-metrics available
  group_size            SMALLINT,      -- number of authorities in comparison group
  solo_group            BOOLEAN DEFAULT FALSE,
  computed_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(authority_id, data_year)
);

-- ─── Row Level Security ──────────────────────────────────────
ALTER TABLE authorities    ENABLE ROW LEVEL SECURITY;
ALTER TABLE mayors         ENABLE ROW LEVEL SECURITY;
ALTER TABLE authority_yearly ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores         ENABLE ROW LEVEL SECURITY;

-- Public read access for all tables
CREATE POLICY "public_read_authorities"     ON authorities     FOR SELECT USING (true);
CREATE POLICY "public_read_mayors"          ON mayors          FOR SELECT USING (true);
CREATE POLICY "public_read_authority_yearly" ON authority_yearly FOR SELECT USING (true);
CREATE POLICY "public_read_scores"          ON scores          FOR SELECT USING (true);
