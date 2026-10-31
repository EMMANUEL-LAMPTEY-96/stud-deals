-- =============================================================================
-- 023 · Lock down vendor_reviews writes
--
-- Bug 1: "Students insert own reviews" compared r.student_id = r.student_id
--   and r.vendor_id = r.vendor_id. The unqualified names in 007 resolved to the
--   subquery's own alias, so the visit check was always true: any student with
--   one confirmed redemption anywhere could review every vendor.
--
-- Bug 2: the UPDATE policies have no column limits. A vendor could rewrite a
--   student's rating/body or hide the review (is_visible); a student could
--   write the vendor_reply or move the review to another vendor.
--
-- Fix: correctly qualified insert policy + a guard trigger in the same style as
-- guard_profiles / guard_student_profiles / guard_vendor_profiles (015a).
-- Service-role (admin client) writes are not affected.
-- =============================================================================

DROP POLICY IF EXISTS "Students insert own reviews" ON public.vendor_reviews;
CREATE POLICY "Students insert own reviews" ON public.vendor_reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    vendor_reviews.student_id IN (
      SELECT sp.id FROM public.student_profiles sp
      WHERE sp.user_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM public.redemptions r
      WHERE r.student_id = vendor_reviews.student_id
        AND r.vendor_id  = vendor_reviews.vendor_id
        AND r.status     = 'confirmed'
    )
  );

CREATE OR REPLACE FUNCTION public.guard_vendor_reviews()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  is_author boolean;
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.vendor_reply      := NULL;
      NEW.vendor_replied_at := NULL;
      NEW.is_visible        := true;
      NEW.created_at        := now();
    ELSE
      -- Nobody moves, re-dates or un-hides a review with a user session.
      NEW.id         := OLD.id;
      NEW.vendor_id  := OLD.vendor_id;
      NEW.student_id := OLD.student_id;
      NEW.created_at := OLD.created_at;
      NEW.is_visible := OLD.is_visible;

      SELECT EXISTS (
        SELECT 1 FROM public.student_profiles sp
        WHERE sp.id = OLD.student_id AND sp.user_id = auth.uid()
      ) INTO is_author;

      IF is_author THEN
        -- Student edits their own words only.
        NEW.vendor_reply      := OLD.vendor_reply;
        NEW.vendor_replied_at := OLD.vendor_replied_at;
      ELSE
        -- Vendor may only reply.
        NEW.rating := OLD.rating;
        NEW.title  := OLD.title;
        NEW.body   := OLD.body;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_vendor_reviews() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_vendor_reviews ON public.vendor_reviews;
CREATE TRIGGER trg_guard_vendor_reviews
  BEFORE INSERT OR UPDATE ON public.vendor_reviews
  FOR EACH ROW EXECUTE FUNCTION public.guard_vendor_reviews();

-- Performance advisor: identical duplicate index.
DROP INDEX IF EXISTS public.vendor_reviews_vendor_id_idx1;
