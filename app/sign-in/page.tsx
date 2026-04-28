// app/sign-in/page.tsx — canonical login is at /login
import { redirect } from 'next/navigation';
export default function SignInPage() {
  redirect('/login');
}
