-- =============================================================================
-- 022_move_extensions_out_of_public.sql
--
-- Supabase security advisor 0014 (extension_in_public): pg_trgm and unaccent
-- were installed in `public`, which exposes their functions through the Data
-- API. Move them to the `extensions` schema.
--
-- Safe because nothing calls them by name: no function, view or generated
-- column uses unaccent()/similarity(), and the app never calls them. The one
-- dependent index (idx_offers_title_trgm, gin_trgm_ops) references its
-- operator class by OID, so it keeps working after the move. Roles that need
-- them unqualified (postgres, PostgREST) already have `extensions` on their
-- search_path.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS extensions;

ALTER EXTENSION pg_trgm  SET SCHEMA extensions;
ALTER EXTENSION unaccent SET SCHEMA extensions;
