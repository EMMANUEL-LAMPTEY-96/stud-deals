// Redirect /sign-in → /login (the proper role-aware login page)
import { redirect } from 'next/navigation';

export default function SignInRedirect({
  searchParams,
}: {
  searchParams: { redirect?: string };
}) {
  const dest = searchParams.redirect
    ? `/login?redirect=${encodeURIComponent(searchParams.redirect)}`
    : '/login';
  redirect(dest);
}
