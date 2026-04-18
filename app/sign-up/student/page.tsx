'use client';

// =============================================================================
// app/sign-up/student/page.tsx — Student Registration
// Detects university emails (.ac.uk, .edu, etc.) in real-time.
// If uni email → instant verification badge shown.
// If personal email → student ID upload option appears.
// =============================================================================

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  GraduationCap, Mail, Lock, User, CheckCircle,
  AlertCircle, Loader2, Upload, Shield, ArrowLeft, Eye, EyeOff
} from 'lucide-react';

const UNIVERSITY_DOMAINS = [
  '.ac.uk', '.edu', '.edu.au', '.edu.ca', '.ac.nz',
  '.ac.za', '.edu.ng', '.ac.gh', '.edu.gh', '.ac.in',
  '.edu.sg', '.ac.jp', '.edu.hk',
];

function isUniversityEmail(email: string): boolean {
  return UNIVERSITY_DOMAINS.some(domain => email.toLowerCase().endsWith(domain));
}

export default function StudentSignUpPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [studentIdFile, setStudentIdFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isUniEmail, setIsUniEmail] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);

  useEffect(() => {
    if (emailTouched) setIsUniEmail(isUniversityEmail(email));
  }, [email, emailTouched]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      setLoading(false);
      return;
    }

    const supabase = createClient();

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: 'student',
          verification_method: isUniEmail ? 'email_domain' : 'student_id',
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // Upload student ID if provided
    if (studentIdFile && data.user) {
      try {
        const ext = studentIdFile.name.split('.').pop();
        const filePath = `${data.user.id}/student-id.${ext}`;
        await supabase.storage
          .from('student-ids')
          .upload(filePath, studentIdFile, { upsert: true });
      } catch {
        // Non-fatal — verification can still happen manually
      }
    }

    router.push(`/verify-email?email=${encodeURIComponent(email)}`);
  }

  const showIdUpload = emailTouched && email.includes('@') && !isUniEmail;

  return (
    <div className="min-h-screen bg-[#0f0b2e] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <Link href="/sign-up" className="inline-flex items-center gap-2 text-purple-400 hover:text-white transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
        </div>

        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <span className="text-white font-bold text-xl">Stud-deals</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Student sign up</h1>
          <p className="text-purple-300 mt-1">Free access to exclusive student deals</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Full name */}
            <div>
              <label className="block text-sm font-medium text-purple-200 mb-1.5">Full name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" />
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  required
                  autoComplete="name"
                  placeholder="Emmanuel Lamptey"
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white placeholder-purple-400/50 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-purple-200 mb-1.5">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onBlur={() => setEmailTouched(true)}
                  required
                  autoComplete="email"
                  placeholder="you@university.ac.uk"
                  className={`w-full bg-white/5 border rounded-lg pl-10 pr-10 py-3 text-white placeholder-purple-400/50 focus:outline-none focus:ring-1 transition-colors ${
                    emailTouched && isUniEmail
                      ? 'border-green-500 focus:border-green-500 focus:ring-green-500'
                      : 'border-white/10 focus:border-purple-500 focus:ring-purple-500'
                  }`}
                />
                {emailTouched && isUniEmail && (
                  <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400" />
                )}
              </div>
              {emailTouched && isUniEmail && (
                <p className="mt-1.5 text-xs text-green-400 flex items-center gap-1.5">
                  <Shield className="w-3 h-3" />
                  University email detected — you&apos;ll be instantly verified
                </p>
              )}
              {showIdUpload && (
                <p className="mt-1.5 text-xs text-amber-400">
                  Not a university email — you can upload your student ID below for verification.
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-purple-200 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Min. 8 characters"
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-10 py-3 text-white placeholder-purple-400/50 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {password.length > 0 && password.length < 8 && (
                <p className="mt-1 text-xs text-amber-400">{8 - password.length} more characters needed</p>
              )}
            </div>

            {/* Student ID upload — only shown for non-university emails */}
            {showIdUpload && (
              <div>
                <label className="block text-sm font-medium text-purple-200 mb-1.5">
                  Student ID{' '}
                  <span className="text-purple-400 font-normal">(optional — speeds up verification)</span>
                </label>
                <label className="flex items-center gap-3 bg-white/5 border border-dashed border-white/20 hover:border-purple-500 rounded-lg px-4 py-3.5 cursor-pointer transition-colors group">
                  <Upload className="w-4 h-4 text-purple-400 group-hover:text-purple-300 flex-shrink-0" />
                  <span className="text-sm text-purple-300 truncate">
                    {studentIdFile ? studentIdFile.name : 'Upload photo of student ID card'}
                  </span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={e => setStudentIdFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                {studentIdFile && (
                  <p className="mt-1 text-xs text-green-400 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> File selected
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Creating account...</>
              ) : (
                'Create student account'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-purple-300 mt-6 text-sm">
          Already have an account?{' '}
          <Link href="/sign-in" className="text-purple-400 hover:text-white font-medium transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
