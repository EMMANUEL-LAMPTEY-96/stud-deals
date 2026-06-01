// app/register/student/page.tsx
// Redirect — the Navbar links here; the real signup flow is at /sign-up/student.
import { redirect } from 'next/navigation';

export default function RegisterStudentRedirect() {
  redirect('/sign-up/student');
}
