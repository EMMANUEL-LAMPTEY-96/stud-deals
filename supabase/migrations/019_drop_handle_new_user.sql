-- =============================================================================
-- 019 · Drop the broken on_auth_user_created trigger
-- NOT YET APPLIED. Apply after 015b (which revokes EXECUTE on the function).
--
-- public.handle_new_user() inserts profiles(email, full_name,
-- verification_status), none of which exist, so it has always failed — and
-- its EXCEPTION WHEN OTHERS handler hid that. Profiles are created by
-- app/auth/callback/route.ts instead.
--
-- It's dangerous to leave around: it is SECURITY DEFINER, so the 015a
-- guard_profiles trigger doesn't apply to it, and it takes the role straight
-- from user-controlled sign-up metadata — "fixing" its column list would let
-- anyone sign up as admin. A working copy would also create the profile
-- before the callback runs, so the callback would skip creating the
-- student_profiles row.
-- =============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
