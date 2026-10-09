-- 015b · Voucher (redemptions) rules + remove public access to internal functions
-- NOT YET APPLIED. Needs approval because it drops two old policies.

DROP POLICY IF EXISTS "Students can manage own redemptions" ON public.redemptions;
DROP POLICY IF EXISTS "Vendors can view and confirm own redemptions" ON public.redemptions;

CREATE POLICY "Students read own redemptions"
  ON public.redemptions FOR SELECT TO authenticated
  USING (student_id IN (
    SELECT sp.id FROM public.student_profiles sp
    WHERE sp.user_id = (SELECT auth.uid())
  ));

-- The claim route inserts with the student's own session.
CREATE POLICY "Students create own claims"
  ON public.redemptions FOR INSERT TO authenticated
  WITH CHECK (
    status = 'claimed'
    AND confirmed_at IS NULL
    AND student_id IN (
      SELECT sp.id FROM public.student_profiles sp
      WHERE sp.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Vendors read own redemptions"
  ON public.redemptions FOR SELECT TO authenticated
  USING (vendor_id IN (
    SELECT vp.id FROM public.vendor_profiles vp
    WHERE vp.user_id = (SELECT auth.uid())
  ));

-- Vendors confirm / expire codes at their own shop. No inserts or deletes.
CREATE POLICY "Vendors update own redemptions"
  ON public.redemptions FOR UPDATE TO authenticated
  USING (vendor_id IN (
    SELECT vp.id FROM public.vendor_profiles vp
    WHERE vp.user_id = (SELECT auth.uid())
  ))
  WITH CHECK (vendor_id IN (
    SELECT vp.id FROM public.vendor_profiles vp
    WHERE vp.user_id = (SELECT auth.uid())
  ));

-- Internal functions should not be callable through the public API.
REVOKE EXECUTE ON FUNCTION public.expire_stale_redemptions()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_offer_view()       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_redemption_confirmed() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable()             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_profiles()              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_student_profiles()      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_vendor_profiles()       FROM PUBLIC, anon, authenticated;
