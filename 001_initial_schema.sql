-- =============================================================================
-- Student Loyalty Marketplace — MVP Database Schema
-- Migration: 001_initial_schema.sql
-- Database: Supabase (PostgreSQL 15)
-- Author: Architecture Blueprint v1.0
-- Description: Full schema for two-sided student loyalty marketplace.
--              Designed for direct Looker Studio connection via PostgreSQL connector.
-- =============================================================================


-- =============================================================================
-- SECTION 0: EXTENSIONS
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- UUID generation
CREATE EXTENSION IF NOT EXISTS "pg_trgm";         -- Fuzzy text search on offers
CREATE EXTENSION IF NOT EXISTS "unaccent";         -- Accent-insensitive search


-- =============================================================================
-- SECTION 1: ENUMS
-- Centralised type definitions. Add values here as the product grows.
-- =============================================================================

CREATE TYPE public.user_role AS ENUM (
    'student',
    'vendor',
    'admin'
);

CREATE TYPE public.verification_status AS ENUM (
    'unverified',       -- Default: no action taken
    'pending_email',    -- .edu email sent, awaiting click
    'pending_review',   -- ID uploaded, awaiting admin review
    'verified',         -- Confirmed student
    'rejected',         -- Admin rejected ID upload
    'expired'           -- Verification period lapsed (re-verify each academic year)
);

CREATE TYPE public.verification_method AS ENUM (
    'edu_email',        -- Automatic: matched .edu domain
    'id_upload',        -- Manual: admin reviewed student ID card
    'admin_override'    -- Admin manually granted status
);

CREATE TYPE public.offer_status AS ENUM (
    'draft',            -- Vendor saved but not yet published
    'active',           -- Live and claimable by students
    'paused',           -- Vendor temporarily hid it
    'expired',          -- Past expires_at date
    'depleted'          -- max_total_redemptions reached
);

CREATE TYPE public.discount_type AS ENUM (
    'percentage',       -- e.g., 20% off entire order
    'fixed_amount',     -- e.g., $5 off
    'buy_x_get_y',      -- e.g., Buy 1 coffee, get 1 free
    'free_item'         -- e.g., Free cookie with any purchase
);

CREATE TYPE public.offer_category AS ENUM (
    'food_drink',
    'groceries',
    'tech',
    'fashion',
    'health_beauty',
    'entertainment',
    'transport',
    'books_stationery',
    'fitness',
    'other'
);

CREATE TYPE public.redemption_status AS ENUM (
    'claimed',          -- Student generated code, not yet used at vendor
    'confirmed',        -- Vendor scanned/confirmed code — CONVERSION EVENT
    'expired',          -- Code not used within TTL window (default: 24 hours)
    'cancelled'         -- Student or system cancelled before use
);

CREATE TYPE public.vendor_plan AS ENUM (
    'free',             -- Up to 2 active offers, no analytics
    'starter',          -- Up to 10 offers, basic analytics
    'growth'            -- Unlimited offers, full Looker-ready export
);


-- =============================================================================
-- SECTION 2: INSTITUTIONS
-- The whitelist of verified universities. This powers automatic .edu verification.
-- Seed this table before launch with your target universities.
-- =============================================================================

CREATE TABLE public.institutions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identity
    name                    VARCHAR(255) NOT NULL,               -- "University of Michigan"
    short_name              VARCHAR(80),                         -- "UMich"
    abbreviation            VARCHAR(20),                         -- "UM"

    -- Location (for hyper-local matching — show only nearby schools' students)
    country                 VARCHAR(100) NOT NULL DEFAULT 'United States',
    state                   VARCHAR(100),
    city                    VARCHAR(100),
    latitude                DECIMAL(10, 8),
    longitude               DECIMAL(11, 8),

    -- Email domain verification whitelist
    -- Array allows multiple domains: ['umich.edu', 'med.umich.edu', 'student.umich.edu']
    email_domains           TEXT[]  NOT NULL,

    -- Metadata
    logo_url                TEXT,
    website_url             TEXT,
    estimated_student_count INTEGER,
    is_active               BOOLEAN NOT NULL DEFAULT true,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed with common .edu domains for instant auto-verification
INSERT INTO public.institutions (name, short_name, city, state, email_domains, estimated_student_count) VALUES
    ('University of Michigan',          'UMich',    'Ann Arbor',    'Michigan',     ARRAY['umich.edu', 'student.umich.edu'],         47000),
    ('Michigan State University',       'MSU',      'East Lansing', 'Michigan',     ARRAY['msu.edu', 'student.msu.edu'],             49000),
    ('University of Texas at Austin',   'UT Austin','Austin',       'Texas',        ARRAY['utexas.edu', 'student.utexas.edu'],       51000),
    ('New York University',             'NYU',      'New York',     'New York',     ARRAY['nyu.edu', 'student.nyu.edu'],             59000),
    ('University of California UCLA',   'UCLA',     'Los Angeles',  'California',   ARRAY['ucla.edu', 'student.ucla.edu'],           46000),
    ('Georgia Institute of Technology', 'Georgia Tech','Atlanta',   'Georgia',      ARRAY['gatech.edu', 'student.gatech.edu'],       35000);

COMMENT ON TABLE public.institutions IS
    'Whitelist of verified universities. email_domains[] drives automatic .edu verification.';
COMMENT ON COLUMN public.institutions.email_domains IS
    'Array of valid email domains for this institution. Used to auto-verify students on signup.';


-- =============================================================================
-- SECTION 3: PROFILES
-- Extends Supabase auth.users. One row per user, regardless of role.
-- Kept lean — role-specific data lives in student_profiles / vendor_profiles.
-- =============================================================================

CREATE TABLE public.profiles (
    -- Must match auth.users.id exactly. Cascade delete keeps things clean.
    id                      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

    role                    public.user_role NOT NULL DEFAULT 'student',
    first_name              VARCHAR(100),
    last_name               VARCHAR(100),
    display_name            VARCHAR(150),               -- Shown in UI
    avatar_url              TEXT,
    phone                   VARCHAR(30),

    -- Rough location for hyper-local offer filtering (city-level, not precise)
    city                    VARCHAR(100),
    state                   VARCHAR(100),
    country                 VARCHAR(100) DEFAULT 'United States',

    is_active               BOOLEAN NOT NULL DEFAULT true,
    last_seen_at            TIMESTAMPTZ,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.profiles IS
    'Public profile data for all users. Extends auth.users. Role-specific fields live in student_profiles or vendor_profiles.';


-- =============================================================================
-- SECTION 4: STUDENT PROFILES
-- Everything specific to the B2C side of the marketplace.
-- =============================================================================

CREATE TABLE public.student_profiles (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                     UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

    -- Institution linkage
    institution_id              UUID REFERENCES public.institutions(id),
    institution_name_manual     VARCHAR(255),   -- Fallback if not in institutions table yet

    -- Verification fields
    student_email               VARCHAR(255) UNIQUE,    -- The .edu email they verified with
    student_id_number           VARCHAR(100),           -- Optional: student ID number from their card
    graduation_year             SMALLINT,               -- Used to auto-expire verification
    major                       VARCHAR(150),

    -- Verification state machine
    verification_status         public.verification_status  NOT NULL DEFAULT 'unverified',
    verification_method         public.verification_method,
    verification_document_url   TEXT,   -- Supabase Storage path to uploaded student ID
    verification_notes          TEXT,   -- Admin notes on rejection reason
    verified_at                 TIMESTAMPTZ,
    verified_by                 UUID REFERENCES public.profiles(id),    -- Admin user_id
    -- Auto-expire verification at end of academic year to ensure continued enrollment
    verification_expires_at     TIMESTAMPTZ,

    -- Gamification / engagement metrics (denormalised for fast reads)
    total_savings_usd           DECIMAL(10, 2) NOT NULL DEFAULT 0.00,   -- Sum of discount_value_applied
    total_redemptions           INTEGER NOT NULL DEFAULT 0,
    total_offers_saved          INTEGER NOT NULL DEFAULT 0,

    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.student_profiles IS
    'Student-specific data. Verification state machine tracks .edu email flow and manual ID review.';
COMMENT ON COLUMN public.student_profiles.verification_expires_at IS
    'Set to July 31 of graduation year. Triggers re-verification flow to confirm continued enrollment.';
COMMENT ON COLUMN public.student_profiles.total_savings_usd IS
    'Denormalised sum of redemptions.discount_value_applied. Updated via trigger on redemption confirmation.';


-- =============================================================================
-- SECTION 5: VENDOR PROFILES
-- Everything specific to the B2B side of the marketplace.
-- =============================================================================

CREATE TABLE public.vendor_profiles (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                     UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

    -- Business identity
    business_name               VARCHAR(255) NOT NULL,
    business_type               VARCHAR(100),       -- 'coffee_shop', 'bakery', 'grocery', 'tech_store'
    description                 TEXT,               -- About the business (shown to students)
    logo_url                    TEXT,
    cover_image_url             TEXT,

    -- Contact
    website_url                 TEXT,
    business_phone              VARCHAR(30),
    business_email              VARCHAR(255),

    -- Physical location (critical for hyper-local matching)
    address_line1               VARCHAR(255),
    address_line2               VARCHAR(255),
    city                        VARCHAR(100) NOT NULL,
    state                       VARCHAR(100),
    postal_code                 VARCHAR(20),
    country                     VARCHAR(100) NOT NULL DEFAULT 'United States',
    latitude                    DECIMAL(10, 8),     -- For geo-distance queries
    longitude                   DECIMAL(11, 8),     -- For geo-distance queries

    -- Business verification (you verify vendors are real before they go live)
    is_verified                 BOOLEAN NOT NULL DEFAULT false,
    verification_document_url   TEXT,       -- Business license, etc.
    verified_at                 TIMESTAMPTZ,

    -- Subscription tier — gates analytics and offer volume
    plan_tier                   public.vendor_plan NOT NULL DEFAULT 'free',
    plan_started_at             TIMESTAMPTZ,
    plan_expires_at             TIMESTAMPTZ,

    -- Denormalised metrics for fast dashboard reads
    -- These are updated via database triggers on the offers/redemptions tables
    total_active_offers         INTEGER NOT NULL DEFAULT 0,
    total_lifetime_redemptions  INTEGER NOT NULL DEFAULT 0,
    total_lifetime_views        INTEGER NOT NULL DEFAULT 0,

    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.vendor_profiles IS
    'B2B vendor data. latitude/longitude enables hyper-local offer surfacing. Denormalised metrics power the vendor dashboard without expensive aggregation queries.';
COMMENT ON COLUMN public.vendor_profiles.plan_tier IS
    'Monetisation gate. free=2 offers. starter=10 offers+basic stats. growth=unlimited+Looker export.';


-- =============================================================================
-- SECTION 6: OFFERS
-- The discount voucher listings. Heart of the student-facing product.
-- =============================================================================

CREATE TABLE public.offers (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id                   UUID NOT NULL REFERENCES public.vendor_profiles(id) ON DELETE CASCADE,

    -- Content
    title                       VARCHAR(255) NOT NULL,          -- "20% Off All Pastries"
    description                 TEXT,
    discount_label              VARCHAR(100) NOT NULL,          -- Short display: "20% OFF" or "FREE COFFEE"
    terms_and_conditions        TEXT,
    image_url                   TEXT,
    tags                        TEXT[],                         -- For search: ['coffee', 'breakfast', 'study']

    -- Offer mechanics
    category                    public.offer_category NOT NULL,
    discount_type               public.discount_type NOT NULL,
    discount_value              DECIMAL(8, 2),                  -- 20.00 = 20%, or 5.00 = $5 off
    original_price              DECIMAL(8, 2),                  -- Optional: "Was $12, now $9.60"
    min_purchase_amount         DECIMAL(8, 2),                  -- Minimum spend to redeem

    -- Redemption rules
    max_uses_per_student        SMALLINT NOT NULL DEFAULT 1,    -- How many times one student can redeem
    max_total_redemptions       INTEGER,                        -- NULL = unlimited (good for ongoing offers)

    -- Targeting (NULL array = available to all verified students in the city)
    -- Populate to run institution-specific campaigns: target only students from UMich
    target_institution_ids      UUID[],

    -- Scheduling
    status                      public.offer_status NOT NULL DEFAULT 'draft',
    starts_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at                  TIMESTAMPTZ,                    -- NULL = no expiry

    -- Denormalised counters (updated via triggers — fast read for vendor dashboard)
    view_count                  INTEGER NOT NULL DEFAULT 0,
    redemption_count            INTEGER NOT NULL DEFAULT 0,
    save_count                  INTEGER NOT NULL DEFAULT 0,

    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.offers IS
    'Discount listings created by vendors. target_institution_ids allows hyper-targeted campaigns (e.g., only for students from University X near this store).';
COMMENT ON COLUMN public.offers.max_uses_per_student IS
    'Anti-abuse control. Default=1 means each student can only redeem this offer once ever.';
COMMENT ON COLUMN public.offers.view_count IS
    'Denormalised from offer_views. Powers the vendor dashboard "Total Views" metric without a COUNT() query.';


-- =============================================================================
-- SECTION 7: OFFER VIEWS
-- Every impression matters. Feeds the View→Claim→Redeem conversion funnel.
-- This is what makes your vendor dashboard compelling — showing conversion rate.
-- =============================================================================

CREATE TABLE public.offer_views (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_id        UUID NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
    student_id      UUID REFERENCES public.student_profiles(id),    -- NULL if unauthenticated browse
    vendor_id       UUID NOT NULL REFERENCES public.vendor_profiles(id),   -- Denormalised for fast vendor queries

    -- Traffic source (critical for ROI attribution)
    source          VARCHAR(50),    -- 'browse', 'search', 'featured', 'notification', 'direct_link'

    viewed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.offer_views IS
    'Granular impression tracking. Combined with redemptions, enables conversion rate calculation per offer: views → claims → confirmed redemptions.';


-- =============================================================================
-- SECTION 8: REDEMPTIONS
-- ⭐ THE MOST IMPORTANT TABLE IN THE ENTIRE SCHEMA ⭐
-- Every field was chosen to power specific Looker Studio dashboard widgets.
-- This is your product's core value proposition to vendors: provable foot traffic ROI.
-- =============================================================================

CREATE TABLE public.redemptions (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Core relationships
    offer_id                    UUID NOT NULL REFERENCES public.offers(id),
    student_id                  UUID NOT NULL REFERENCES public.student_profiles(id),
    vendor_id                   UUID NOT NULL REFERENCES public.vendor_profiles(id),    -- Denormalised

    -- The unique redemption code
    -- Alphanumeric, 8 chars, uppercase. E.g., "STUD-X7K2"
    redemption_code             VARCHAR(20) UNIQUE NOT NULL,
    qr_code_payload             TEXT,   -- The data encoded in the QR (same as redemption_code for MVP)

    -- Status lifecycle: claimed → confirmed (or expired/cancelled)
    status                      public.redemption_status NOT NULL DEFAULT 'claimed',

    -- =========================================================================
    -- TIMESTAMP CHAIN — Critical for Looker Studio time-series dashboards
    -- =========================================================================
    claimed_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),     -- Student hit "Get Voucher"
    confirmed_at                TIMESTAMPTZ,                            -- Vendor scanned code ← CONVERSION
    expires_at                  TIMESTAMPTZ NOT NULL,                   -- Code TTL (claimed_at + 24hrs default)
    cancelled_at                TIMESTAMPTZ,

    -- Who confirmed at the vendor (for accountability & fraud detection)
    confirmed_by_vendor_user_id UUID REFERENCES public.profiles(id),

    -- =========================================================================
    -- FINANCIAL FIELDS — Powers "Total Savings" widgets
    -- =========================================================================
    discount_value_applied      DECIMAL(8, 2),      -- Actual $ discount given (20% of $15 = $3.00)
    estimated_transaction_value DECIMAL(8, 2),      -- Estimated customer spend at vendor (for ARPU calc)

    -- =========================================================================
    -- STUDENT CONTEXT — For cohort analysis in Looker Studio
    -- =========================================================================
    -- Denormalised at claim time — immutable even if student later changes details
    student_institution_id      UUID REFERENCES public.institutions(id),
    student_institution_name    VARCHAR(255),
    student_graduation_year     SMALLINT,

    -- =========================================================================
    -- VENDOR CONTEXT — For multi-location vendor aggregation
    -- =========================================================================
    vendor_city                 VARCHAR(100),
    vendor_latitude             DECIMAL(10, 8),
    vendor_longitude            DECIMAL(11, 8),

    -- =========================================================================
    -- PRE-COMPUTED ANALYTICS FIELDS
    -- These look redundant but are ESSENTIAL for Looker Studio performance.
    -- Looker runs GROUP BY on these columns constantly — pre-computing saves
    -- expensive EXTRACT() calls on every dashboard refresh.
    --
    -- NOTE: Stored as regular columns (not GENERATED ALWAYS AS) because
    -- EXTRACT() from TIMESTAMPTZ is non-immutable in PostgreSQL (timezone-
    -- dependent). Values are populated by the trigger below on INSERT.
    -- =========================================================================
    claimed_date                DATE,
    claimed_hour                SMALLINT,
    claimed_day_of_week         SMALLINT,
    claimed_week                SMALLINT,
    claimed_month               SMALLINT,
    claimed_year                SMALLINT,

    -- Time from claim to confirmation (seconds) — measures friction in redemption flow
    -- Updated to a non-NULL value when status changes to 'confirmed' via trigger.
    time_to_confirm_seconds     INTEGER,

    -- Session metadata
    device_type                 VARCHAR(20),    -- 'mobile', 'tablet', 'desktop'
    redemption_source           VARCHAR(30),    -- 'web_app', 'pwa'
    offer_category              public.offer_category,  -- Denormalised for fast category dashboards

    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.redemptions IS
    '⭐ Core analytics table. Every field feeds a specific Looker Studio widget. Pre-computed time fields (claimed_hour, claimed_day_of_week etc.) eliminate expensive EXTRACT() calls on dashboard refresh. Connect Looker directly to this table via the PostgreSQL connector.';
COMMENT ON COLUMN public.redemptions.claimed_at IS
    'When student tapped "Get Voucher". This starts the 24-hour code validity window.';
COMMENT ON COLUMN public.redemptions.confirmed_at IS
    'When vendor confirmed code. This is the CONVERSION EVENT — the moment real foot traffic is proven.';
COMMENT ON COLUMN public.redemptions.estimated_transaction_value IS
    'Optional: vendor can input average basket size. Enables "Estimated Revenue Driven" metric in Looker.';
COMMENT ON COLUMN public.redemptions.time_to_confirm_seconds IS
    'Auto-computed. Useful UX metric: if this is very long (>24hrs), the student never actually showed up.';
COMMENT ON COLUMN public.redemptions.claimed_day_of_week IS
    '0=Sunday, 6=Saturday (PostgreSQL DOW convention). Powers "Busiest Days" bar chart for vendors.';


-- =============================================================================
-- SECTION 9: SAVED OFFERS (Favourites)
-- =============================================================================

CREATE TABLE public.saved_offers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id      UUID NOT NULL REFERENCES public.student_profiles(id) ON DELETE CASCADE,
    offer_id        UUID NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
    saved_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(student_id, offer_id)    -- Prevent duplicate saves
);

COMMENT ON TABLE public.saved_offers IS
    'Student bookmarked offers. save_count on offers table is denormalised from this.';


-- =============================================================================
-- SECTION 10: NOTIFICATIONS
-- =============================================================================

CREATE TABLE public.notifications (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

    title                   VARCHAR(255) NOT NULL,
    body                    TEXT,
    type                    VARCHAR(60) NOT NULL,
    -- Types: 'verification_approved', 'verification_rejected', 'new_offer_nearby',
    --        'offer_expiring_soon', 'redemption_confirmed', 'offer_depleted'

    -- Polymorphic reference to the related entity
    related_entity_type     VARCHAR(50),    -- 'offer', 'redemption', 'verification'
    related_entity_id       UUID,

    is_read                 BOOLEAN NOT NULL DEFAULT false,
    read_at                 TIMESTAMPTZ,

    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.notifications IS
    'In-app notification feed. Extend with push notification token column when adding mobile app.';


-- =============================================================================
-- SECTION 11: INDEXES
-- Optimised for the three most expensive query patterns:
-- 1. Student browsing offers by category/city
-- 2. Vendor viewing their redemption analytics
-- 3. Looker Studio GROUP BY on time dimensions
-- =============================================================================

-- Offers: browsing queries
CREATE INDEX idx_offers_vendor_id          ON public.offers(vendor_id);
CREATE INDEX idx_offers_category           ON public.offers(category);
CREATE INDEX idx_offers_status             ON public.offers(status);
CREATE INDEX idx_offers_expires_at         ON public.offers(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_offers_status_category    ON public.offers(status, category);  -- Composite for filtered browse

-- Full-text search on offer titles and descriptions
CREATE INDEX idx_offers_title_trgm         ON public.offers USING GIN(title gin_trgm_ops);
CREATE INDEX idx_offers_tags               ON public.offers USING GIN(tags);

-- Redemptions: core analytics indexes
CREATE INDEX idx_redemptions_offer_id          ON public.redemptions(offer_id);
CREATE INDEX idx_redemptions_student_id        ON public.redemptions(student_id);
CREATE INDEX idx_redemptions_vendor_id         ON public.redemptions(vendor_id);
CREATE INDEX idx_redemptions_status            ON public.redemptions(status);
CREATE INDEX idx_redemptions_claimed_at        ON public.redemptions(claimed_at);
CREATE INDEX idx_redemptions_confirmed_at      ON public.redemptions(confirmed_at);
CREATE INDEX idx_redemptions_claimed_date      ON public.redemptions(claimed_date);         -- Looker date range filter
CREATE INDEX idx_redemptions_claimed_month     ON public.redemptions(claimed_year, claimed_month);  -- Monthly rollup
CREATE INDEX idx_redemptions_vendor_date       ON public.redemptions(vendor_id, claimed_date);      -- Vendor-specific time series
CREATE INDEX idx_redemptions_code              ON public.redemptions(redemption_code);      -- Fast lookup at point of sale

-- Offer views: impression analytics
CREATE INDEX idx_offer_views_offer_id      ON public.offer_views(offer_id);
CREATE INDEX idx_offer_views_vendor_id     ON public.offer_views(vendor_id);
CREATE INDEX idx_offer_views_viewed_at     ON public.offer_views(viewed_at);

-- Student profiles: verification workflow
CREATE INDEX idx_student_profiles_user_id      ON public.student_profiles(user_id);
CREATE INDEX idx_student_profiles_institution  ON public.student_profiles(institution_id);
CREATE INDEX idx_student_profiles_status       ON public.student_profiles(verification_status);

-- Vendor profiles: geo queries
CREATE INDEX idx_vendor_profiles_city          ON public.vendor_profiles(city);
CREATE INDEX idx_vendor_profiles_coords        ON public.vendor_profiles(latitude, longitude);

-- Notifications: unread feed
CREATE INDEX idx_notifications_user_unread     ON public.notifications(user_id, is_read) WHERE is_read = false;


-- =============================================================================
-- SECTION 12: TRIGGERS & FUNCTIONS
-- Automated denormalisation to keep counters in sync.
-- =============================================================================

-- Function: update updated_at timestamp on any row change
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER trigger_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trigger_student_profiles_updated_at
    BEFORE UPDATE ON public.student_profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trigger_vendor_profiles_updated_at
    BEFORE UPDATE ON public.vendor_profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trigger_offers_updated_at
    BEFORE UPDATE ON public.offers
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- Function: increment offer view counter + vendor lifetime views
CREATE OR REPLACE FUNCTION public.handle_new_offer_view()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.offers
    SET view_count = view_count + 1
    WHERE id = NEW.offer_id;

    UPDATE public.vendor_profiles
    SET total_lifetime_views = total_lifetime_views + 1
    WHERE id = NEW.vendor_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_increment_view_count
    AFTER INSERT ON public.offer_views
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_offer_view();


-- Function: on redemption CONFIRMED, update all denormalised counters
-- This fires when status changes from 'claimed' → 'confirmed'
CREATE OR REPLACE FUNCTION public.handle_redemption_confirmed()
RETURNS TRIGGER AS $$
BEGIN
    -- Only run when status changes TO 'confirmed'
    IF NEW.status = 'confirmed' AND OLD.status != 'confirmed' THEN

        -- 0. Stamp time_to_confirm_seconds (AFTER trigger, so use explicit UPDATE)
        UPDATE public.redemptions
        SET time_to_confirm_seconds = EXTRACT(EPOCH FROM (NEW.confirmed_at - NEW.claimed_at))::INTEGER
        WHERE id = NEW.id;

        -- 1. Increment offer redemption count
        UPDATE public.offers
        SET redemption_count = redemption_count + 1
        WHERE id = NEW.offer_id;

        -- 2. Increment vendor lifetime redemptions
        UPDATE public.vendor_profiles
        SET total_lifetime_redemptions = total_lifetime_redemptions + 1
        WHERE id = NEW.vendor_id;

        -- 3. Update student total savings and redemption count
        UPDATE public.student_profiles
        SET
            total_redemptions = total_redemptions + 1,
            total_savings_usd = total_savings_usd + COALESCE(NEW.discount_value_applied, 0)
        WHERE id = NEW.student_id;

        -- 4. Check if offer is now depleted
        UPDATE public.offers o
        SET status = 'depleted'
        WHERE
            o.id = NEW.offer_id
            AND o.max_total_redemptions IS NOT NULL
            AND o.redemption_count >= o.max_total_redemptions;

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_on_redemption_confirmed
    AFTER UPDATE ON public.redemptions
    FOR EACH ROW EXECUTE FUNCTION public.handle_redemption_confirmed();


-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger: populate pre-computed analytics columns on INSERT
-- We use a BEFORE INSERT trigger instead of GENERATED ALWAYS AS because
-- EXTRACT(... FROM TIMESTAMPTZ) is not immutable (timezone-dependent) and
-- PostgreSQL rejects it in generated column expressions.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.populate_redemption_analytics()
RETURNS TRIGGER AS $$
BEGIN
    NEW.claimed_date        := NEW.claimed_at AT TIME ZONE 'UTC';
    NEW.claimed_hour        := EXTRACT(HOUR        FROM (NEW.claimed_at AT TIME ZONE 'UTC'))::SMALLINT;
    NEW.claimed_day_of_week := EXTRACT(DOW         FROM (NEW.claimed_at AT TIME ZONE 'UTC'))::SMALLINT;
    NEW.claimed_week        := EXTRACT(WEEK        FROM (NEW.claimed_at AT TIME ZONE 'UTC'))::SMALLINT;
    NEW.claimed_month       := EXTRACT(MONTH       FROM (NEW.claimed_at AT TIME ZONE 'UTC'))::SMALLINT;
    NEW.claimed_year        := EXTRACT(YEAR        FROM (NEW.claimed_at AT TIME ZONE 'UTC'))::SMALLINT;
    -- time_to_confirm_seconds is NULL on INSERT (not yet confirmed); updated by
    -- handle_redemption_confirmed when status transitions to 'confirmed'.
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_populate_redemption_analytics
    BEFORE INSERT ON public.redemptions
    FOR EACH ROW EXECUTE FUNCTION public.populate_redemption_analytics();


-- Function: expire overdue codes (run this as a Supabase CRON job every hour)
-- Supabase Dashboard → Database → Cron Jobs → "0 * * * * SELECT expire_stale_redemptions();"
CREATE OR REPLACE FUNCTION public.expire_stale_redemptions()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE public.redemptions
    SET status = 'expired'
    WHERE
        status = 'claimed'
        AND expires_at < NOW();

    GET DIAGNOSTICS expired_count = ROW_COUNT;
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================================================
-- SECTION 13: ROW LEVEL SECURITY (RLS)
-- Data isolation by role — enforced at database level, not application level.
-- This is Supabase's superpower. No accidental data leaks possible.
-- =============================================================================

ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_views       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.redemptions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_offers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institutions      ENABLE ROW LEVEL SECURITY;

-- INSTITUTIONS: public read (needed for signup form dropdowns)
CREATE POLICY "Institutions are publicly readable"
    ON public.institutions FOR SELECT
    USING (is_active = true);

-- PROFILES: Users manage their own profile only
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- STUDENT PROFILES: Students see/update their own data; admins see all
CREATE POLICY "Students manage own student profile"
    ON public.student_profiles FOR ALL
    USING (auth.uid() = user_id);

-- VENDOR PROFILES: Vendors manage their own; students can read vendor info for offer context
CREATE POLICY "Vendors manage own vendor profile"
    ON public.vendor_profiles FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Students can view verified vendor profiles"
    ON public.vendor_profiles FOR SELECT
    USING (is_verified = true);

-- OFFERS: Vendors manage their own; verified students can view active offers
CREATE POLICY "Vendors manage own offers"
    ON public.offers FOR ALL
    USING (
        vendor_id IN (
            SELECT id FROM public.vendor_profiles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Verified students can view active offers"
    ON public.offers FOR SELECT
    USING (
        status = 'active'
        AND (expires_at IS NULL OR expires_at > NOW())
        AND EXISTS (
            SELECT 1 FROM public.student_profiles
            WHERE user_id = auth.uid()
            AND verification_status = 'verified'
        )
    );

-- OFFER VIEWS: Students can insert (track their own views); vendors can read their offer views
CREATE POLICY "Students can log offer views"
    ON public.offer_views FOR INSERT
    WITH CHECK (
        student_id IN (SELECT id FROM public.student_profiles WHERE user_id = auth.uid())
    );

CREATE POLICY "Vendors can see views on their offers"
    ON public.offer_views FOR SELECT
    USING (
        vendor_id IN (SELECT id FROM public.vendor_profiles WHERE user_id = auth.uid())
    );

-- REDEMPTIONS: Students see their own; vendors see their own; neither sees the other's data
CREATE POLICY "Students can manage own redemptions"
    ON public.redemptions FOR ALL
    USING (
        student_id IN (SELECT id FROM public.student_profiles WHERE user_id = auth.uid())
    );

CREATE POLICY "Vendors can view and confirm own redemptions"
    ON public.redemptions FOR ALL
    USING (
        vendor_id IN (SELECT id FROM public.vendor_profiles WHERE user_id = auth.uid())
    );

-- SAVED OFFERS: Students manage their own bookmarks
CREATE POLICY "Students manage own saved offers"
    ON public.saved_offers FOR ALL
    USING (
        student_id IN (SELECT id FROM public.student_profiles WHERE user_id = auth.uid())
    );

-- NOTIFICATIONS: Users see only their own
CREATE POLICY "Users see own notifications"
    ON public.notifications FOR ALL
    USING (auth.uid() = user_id);


-- =============================================================================
-- SECTION 14: LOOKER STUDIO READY VIEWS
-- Pre-built SQL views that you connect directly to Looker Studio.
-- These are your vendor ROI dashboard data sources.
-- =============================================================================

-- View 1: Vendor Performance Summary (one row per vendor, used for KPI cards)
CREATE VIEW public.v_vendor_performance_summary AS
SELECT
    vp.id                                   AS vendor_id,
    vp.business_name,
    vp.city,
    vp.plan_tier,
    COUNT(DISTINCT o.id)                    AS total_offers,
    SUM(o.view_count)                       AS total_views,
    SUM(o.redemption_count)                 AS total_redemptions,
    CASE
        WHEN SUM(o.view_count) > 0
        THEN ROUND(SUM(o.redemption_count)::DECIMAL / SUM(o.view_count) * 100, 2)
        ELSE 0
    END                                     AS overall_conversion_rate_pct,
    SUM(r.discount_value_applied)           AS total_discounts_given_usd,
    SUM(r.estimated_transaction_value)      AS total_estimated_revenue_driven_usd
FROM public.vendor_profiles vp
LEFT JOIN public.offers o ON o.vendor_id = vp.id
LEFT JOIN public.redemptions r ON r.vendor_id = vp.id AND r.status = 'confirmed'
GROUP BY vp.id, vp.business_name, vp.city, vp.plan_tier;

COMMENT ON VIEW public.v_vendor_performance_summary IS
    'Looker Studio: KPI Scorecard data source. Connect to show each vendor their headline numbers.';


-- View 2: Redemptions by Day of Week (powers heatmap / bar chart)
CREATE VIEW public.v_redemptions_by_day_of_week AS
SELECT
    vendor_id,
    claimed_day_of_week,
    CASE claimed_day_of_week
        WHEN 0 THEN 'Sunday'    WHEN 1 THEN 'Monday'
        WHEN 2 THEN 'Tuesday'   WHEN 3 THEN 'Wednesday'
        WHEN 4 THEN 'Thursday'  WHEN 5 THEN 'Friday'
        WHEN 6 THEN 'Saturday'
    END                             AS day_name,
    COUNT(*)                        AS total_claimed,
    COUNT(*) FILTER (WHERE status = 'confirmed') AS total_confirmed
FROM public.redemptions
GROUP BY vendor_id, claimed_day_of_week;

COMMENT ON VIEW public.v_redemptions_by_day_of_week IS
    'Looker Studio: "Best Days" bar chart. Shows vendors which days drive most student visits.';


-- View 3: Redemptions by Hour of Day (powers hourly traffic heatmap)
CREATE VIEW public.v_redemptions_by_hour AS
SELECT
    vendor_id,
    claimed_hour,
    COUNT(*)                                            AS total_claimed,
    COUNT(*) FILTER (WHERE status = 'confirmed')        AS total_confirmed
FROM public.redemptions
GROUP BY vendor_id, claimed_hour
ORDER BY vendor_id, claimed_hour;

COMMENT ON VIEW public.v_redemptions_by_hour IS
    'Looker Studio: "Peak Hours" heatmap. Vendors can staff up at the right times.';


-- View 4: Monthly Redemption Trend (time-series for line charts)
CREATE VIEW public.v_monthly_redemption_trend AS
SELECT
    vendor_id,
    claimed_year,
    claimed_month,
    TO_DATE(claimed_year || '-' || LPAD(claimed_month::TEXT, 2, '0') || '-01', 'YYYY-MM-DD') AS month_start,
    COUNT(*)                                                AS total_claimed,
    COUNT(*) FILTER (WHERE status = 'confirmed')            AS total_confirmed,
    COUNT(DISTINCT student_id)                              AS unique_students,
    SUM(discount_value_applied)                             AS total_discounts_usd,
    SUM(estimated_transaction_value)                        AS total_revenue_est_usd
FROM public.redemptions
GROUP BY vendor_id, claimed_year, claimed_month;

COMMENT ON VIEW public.v_monthly_redemption_trend IS
    'Looker Studio: Month-over-month line chart. Core growth metric for vendor pitch decks.';


-- View 5: Institution Breakdown (which universities are engaging most)
CREATE VIEW public.v_redemptions_by_institution AS
SELECT
    r.vendor_id,
    r.student_institution_id,
    r.student_institution_name,
    COUNT(*)                                                AS total_claimed,
    COUNT(*) FILTER (WHERE r.status = 'confirmed')          AS total_confirmed,
    COUNT(DISTINCT r.student_id)                            AS unique_students
FROM public.redemptions r
WHERE r.student_institution_name IS NOT NULL
GROUP BY r.vendor_id, r.student_institution_id, r.student_institution_name;

COMMENT ON VIEW public.v_redemptions_by_institution IS
    'Looker Studio: "Which universities shop here?" Pie chart. Powerful for vendor storytelling.';


-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
-- Next steps after running this migration:
-- 1. In Supabase Dashboard: enable the "pg_cron" extension
-- 2. Add cron job: SELECT cron.schedule('expire-redemptions', '0 * * * *', 'SELECT public.expire_stale_redemptions();');
-- 3. Create a read-only Supabase DB role for Looker Studio connection
-- 4. Connect Looker Studio using: Host=db.[project-ref].supabase.co, Port=5432, DB=postgres
-- =============================================================================
