'use client';

// =============================================================================
// app/sign-up/student/page.tsx — Student Registration
// Split layout: left = perks panel, right = form.
// Real-time .ac.uk / .edu domain detection for instant verification badge.
// =============================================================================

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  GraduationCap, Mail, Lock, User, CheckCircle, AlertCircle,
  Loader2, Upload, Shield, ArrowLeft, Eye, EyeOff, Zap, Tag, MapPin,
} from 'lucide-react';

const UNI_DOMAINS = [
  '.ac.uk', '.edu', '.edu.au', '.edu.ca', '.ac.nz', '.ac.za',
  '.edu.ng', '.ac.gh', '.edu.gh', '.ac.in', '.edu.sg', '.ac.jp', '.edu.hk',
];

const PERKS = [
  { icon: Zap,      label: 'Instant access',        desc: 'Browse deals the moment you sign up' },
  { icon: Tag,      label: '2,400+ deals',           desc: 'Food, tech, fitness, fashion & more' },
  { icon: MapPin,   label: 'Hyper-local',            desc: 'Only deals near your campus shown' },
  { icon: Shield,   label: 'Verified & private',     desc: 'Your data is never sold or shared' },
];

function isUniEmail(email: string) {
  return UNI_DOMAINS.some(d => email.toLowerCase().endsWith(d));
}

export default function StudentSignUpPage() {
  const router = useRouter();
  const [fullName, setFullName]           = useState('');
  const [email, setEmail]                 = useState('');
  const [password, setPassword]           = useState('');
  const [showPw, setShowPw]               = useState(false);
  const [studentIdFile, setStudentIdFile] = useState<File | null>(null);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState('');
  const [emailTouched, setEmailTouched]   = useState(false);
  const [uniDetected, setUniDetected]     = useState(false);

  useEffect(() => {
    if (emailTouched) setUniDetected(isUniEmail(email));
  }, [email, emailTouched]);

  const showIdUpload = emailTouched && email.includes('@') && !uniDetected;
  const pwStrength   = password.length >= 12 ? 3 : password.length >= 8 ? 2 : password.length >= 4 ? 1 : 0;
  const pwColors     = ['bg-gray-200', 'bg-red-400', 'bg-amber-400', 'bg-green-500'];
  const pwLabels     = ['', 'Weak', 'Fair', 'Strong'];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { data, error: err } = await supabase.auth.signUp({
      email, password,
      options: {
        data: { full_name: fullName, role: 'student', verification_method: uniDetected ? 'email_domain' : 'student_id' },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (err) { setError(err.message); setLoading(false); return; }

    if (studentIdFile && data.user) {
      const ext      = studentIdFile.name.split('.').pop();
      const filePath = `${data.user.id}/student-id.${ext}`;
      await supabase.storage.from('student-ids').upload(filePath, studentIdFile, { upsert: true }).catch(() => {});
    }

    router.push(`/verify-email?email=${encodeURIComponent(email)}`);
  }

  return (
    <div className="min-h-screen flex">

      {/* ── LEFT PANEL ─────────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[46%] bg-gradient-to-br from-purple-700 via-purple-600 to-indigo-700 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-5 pointer-events-none" />
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-white/10 rounded-full blur-3xl" />

        {/* Logo */}
        <Link href="/" className="inline-flex items-center gap-2.5 relative z-10">
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-bold text-lg">Stud<span className="text-purple-200">Deals</span></span>
        </Link>

        {/* Hero text */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/15 border border-white/20 rounded-full px-3 py-1.5 text-xs text-white font-medium mb-4">
            <Zap className="w-3 h-3" /> Free for students, always
          </div>
          <h2 className="text-3xl font-black text-white leading-tight mb-3">
            Student deals that<br />actually save you money
          </h2>
          <p className="text-purple-100 text-sm leading-relaxed mb-8">
            Join 47,000+ students getting exclusive discounts from local businesses right on their doorstep.
          </p>

          {/* Perks */}
          <div className="space-y-3">
            {PERKS.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-3">
                <div className="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-white text-sm font-semibold">{label}</p>
                  <p className="text-purple-200 text-xs">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-purple-300 text-xs relative z-10">
          Already have 380+ partner businesses in the UK
        </p>
      </div>

      {/* ── RIGHT PANEL ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 bg-white overflow-y-auto">

        {/* Back + mobile logo */}
        <div className="w-full max-w-[420px] mb-6 flex items-center justify-between">
          <Link href="/sign-up" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <Link href="/" className="inline-flex items-center gap-2 lg:hidden">
            <div className="w-7 h-7 bg-purple-600 rounded-lg flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            <span className="text-gray-900 font-bold text-base">Stud<span className="text-purple-600">Deals</span></span>
          </Link>
        </div>

        <div className="w-full max-w-[420px]">
          <h1 className="text-2xl font-black text-gray-900 mb-1">Create student account</h1>
          <p className="text-gray-500 text-sm mb-6">Free forever — no credit card needed</p>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm mb-4">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full name */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} required autoComplete="name" placeholder="Your full name"
                  className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all" />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} onBlur={() => setEmailTouched(true)} required autoComplete="email" placeholder="you@university.ac.uk"
                  className={`w-full border rounded-xl pl-10 pr-10 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 transition-all ${
                    emailTouched && uniDetected
                      ? 'border-green-400 focus:border-green-500 focus:ring-green-100'
                      : 'border-gray-200 focus:border-purple-500 focus:ring-purple-100'
                  }`} />
                {emailTouched && uniDetected && (
                  <CheckCircle className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                )}
              </div>
              {emailTouched && uniDetected && (
                <p className="mt-1.5 text-xs text-green-600 flex items-center gap-1">
                  <Shield className="w-3 h-3" /> University email — you&apos;ll be instantly verified
                </p>
              )}
              {showIdUpload && (
                <p className="mt-1.5 text-xs text-amber-600 flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Personal email — upload your student ID for verification
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" placeholder="Min. 8 characters"
                  className="w-full border border-gray-200 rounded-xl pl-10 pr-10 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all" />
                <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {password.length > 0 && (
                <div className="mt-2 flex gap-1">
                  {[0,1,2].map(i => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < pwStrength ? pwColors[pwStrength] : 'bg-gray-200'}`} />
                  ))}
                  <span className={`text-xs ml-1 font-medium ${pwStrength===3?'text-green-600':pwStrength===2?'text-amber-600':'text-red-500'}`}>{pwLabels[pwStrength]}</span>
                </div>
              )}
            </div>

            {/* Student ID upload */}
            {showIdUpload && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Student ID <span className="font-normal text-gray-400">(optional)</span>
                </label>
                <label className={`flex items-center gap-3 border-2 border-dashed rounded-xl px-4 py-3.5 cursor-pointer transition-all ${
                  studentIdFile ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-purple-300 hover:bg-purple-50'
                }`}>
                  {studentIdFile ? <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" /> : <Upload className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                  <span className={`text-sm truncate ${studentIdFile ? 'text-green-700 font-medium' : 'text-gray-500'}`}>
                    {studentIdFile ? studentIdFile.name : 'Upload photo of student ID card'}
                  </span>
                  <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => setStudentIdFile(e.target.files?.[0] ?? null)} />
                </label>
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm shadow-sm shadow-purple-200 mt-2">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating account...</> : 'Create student account →'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-purple-600 hover:text-purple-700 font-semibold">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
