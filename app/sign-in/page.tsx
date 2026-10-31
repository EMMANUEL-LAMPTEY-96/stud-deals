// Redirect /sign-in → /login (the proper role-aware login page)
import { redirect } from 'next/navigation';

export default async function SignInRedirect(
  props: {
    searchParams: Promise<{ redirect?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const dest = searchParams.redirect
    ? `/login?redirect=${encodeURIComponent(searchParams.redirect)}`
    : '/login';
  redirect(dest);
}
