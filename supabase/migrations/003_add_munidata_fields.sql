-- ============================================================
-- Migration 003: Add municipal-data.org fields to authority_yearly
-- Schema v2.3 — 3 new H fields + 25 new D fields
-- Source: Interior Ministry dashboard (municipal-data.org)
-- Date: 2026-07-30
--
-- STATUS: APPROVED 2026-07-30
-- ============================================================

-- ── Fix symbol uniqueness: different authority types can share a symbol ──
-- The old UNIQUE(symbol) was wrong — the real unique key is (symbol, authority_type).
ALTER TABLE authorities DROP CONSTRAINT IF EXISTS authorities_symbol_key;
ALTER TABLE authorities ADD CONSTRAINT authorities_symbol_type_key UNIQUE (symbol, authority_type);

-- ── Visibility guard for authorities ──────────────────────────
-- Existing 82 get is_published = true (default).
-- New 175 (מועצות) will be inserted with is_published = false.
ALTER TABLE authorities ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT true;

-- Replace the open RLS policy with one that filters unpublished
DROP POLICY IF EXISTS "public_read_authorities" ON authorities;
CREATE POLICY "public_read_authorities" ON authorities
  FOR SELECT USING (is_published = true);

-- ── New H: Context fields (3) ─────────────────────────────────
ALTER TABLE authority_yearly ADD COLUMN IF NOT EXISTS h_nafa                TEXT;    -- נפה
ALTER TABLE authority_yearly ADD COLUMN IF NOT EXISTS h_profile_group       TEXT;    -- קבוצת_פרופיל
ALTER TABLE authority_yearly ADD COLUMN IF NOT EXISTS h_confrontation_line  TEXT;    -- קו_עימות

-- ── New D: Display fields from demographics (2) ───────────────
ALTER TABLE authority_yearly ADD COLUMN IF NOT EXISTS d_natural_increase       NUMERIC; -- ריבוי_טבעי
ALTER TABLE authority_yearly ADD COLUMN IF NOT EXISTS d_avg_wage               NUMERIC; -- שכר_ממוצע

-- ── New D: Display fields from budget_economy (14) ────────────
ALTER TABLE authority_yearly ADD COLUMN IF NOT EXISTS d_arnona_charge_per_sqm  NUMERIC; -- ארנונה_חיוב_למר
ALTER TABLE authority_yearly ADD COLUMN IF NOT EXISTS d_arnona_other_share     NUMERIC; -- שיעור_ארנונה_אחרת
ALTER TABLE authority_yearly ADD COLUMN IF NOT EXISTS d_debt_per_household     NUMERIC; -- עומס_חוב_למשק_בית
ALTER TABLE authority_yearly ADD COLUMN IF NOT EXISTS d_debt_repayment_rate    NUMERIC; -- פרעון_מלוות_שנתי
ALTER TABLE authority_yearly ADD COLUMN IF NOT EXISTS d_net_accum_deficit      NUMERIC; -- גירעון_מצטבר_נטו
ALTER TABLE authority_yearly ADD COLUMN IF NOT EXISTS d_loan_burden_ratio      NUMERIC; -- יחס_עומס_מלוות
ALTER TABLE authority_yearly ADD COLUMN IF NOT EXISTS d_debt_concentration     NUMERIC; -- ריכוז_חוב
ALTER TABLE authority_yearly ADD COLUMN IF NOT EXISTS d_municipal_corporations NUMERIC; -- תאגידים_עירוניים
ALTER TABLE authority_yearly ADD COLUMN IF NOT EXISTS d_audit_deficiencies     NUMERIC; -- ליקויי_ביקורת
ALTER TABLE authority_yearly ADD COLUMN IF NOT EXISTS d_total_income           NUMERIC; -- הכנסות_כוללות
ALTER TABLE authority_yearly ADD COLUMN IF NOT EXISTS d_dev_funds_balance      NUMERIC; -- קרנות_פיתוח
ALTER TABLE authority_yearly ADD COLUMN IF NOT EXISTS d_extraordinary_income   NUMERIC; -- תברים_הכנסות
ALTER TABLE authority_yearly ADD COLUMN IF NOT EXISTS d_extraordinary_expenses NUMERIC; -- תברים_הוצאות
ALTER TABLE authority_yearly ADD COLUMN IF NOT EXISTS d_dev_project_funds      NUMERIC; -- קרנות_לפרויקטי_פיתוח

-- ── New D: Display fields from gov_mechanisms (5) ─────────────
ALTER TABLE authority_yearly ADD COLUMN IF NOT EXISTS d_govt_tenders           NUMERIC; -- קולות_קוראים_זכיות
ALTER TABLE authority_yearly ADD COLUMN IF NOT EXISTS d_equalization_grants    NUMERIC; -- מענקי_איזון
ALTER TABLE authority_yearly ADD COLUMN IF NOT EXISTS d_dev_grants             NUMERIC; -- מענקי_פיתוח
ALTER TABLE authority_yearly ADD COLUMN IF NOT EXISTS d_gap_reduction_fund     NUMERIC; -- קרן_צמצום_פערים
ALTER TABLE authority_yearly ADD COLUMN IF NOT EXISTS d_regional_services      NUMERIC; -- תקציב_שירותים_אזוריים

-- ── New D: Display fields from human_capital (4) ──────────────
ALTER TABLE authority_yearly ADD COLUMN IF NOT EXISTS d_cadets                 NUMERIC; -- צוערים
ALTER TABLE authority_yearly ADD COLUMN IF NOT EXISTS d_ceo_seniority          NUMERIC; -- ותק_מנכל
ALTER TABLE authority_yearly ADD COLUMN IF NOT EXISTS d_statutory_roles_pct    NUMERIC; -- איוש_תפקידים_סטטוטוריים
ALTER TABLE authority_yearly ADD COLUMN IF NOT EXISTS d_org_dev_plans          NUMERIC; -- תוכניות_פיתוח_ארגוני
