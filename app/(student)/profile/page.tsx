'use client';

// =============================================================================
// app/(student)/profile/page.tsx — Student Profile & Settings
//
// Sections:
//   1. Verification status — big CTA if unverified, badge if verified
//   2. Personal info       — first name, last name, display name (editable)
//   3. Account info        — email (read-only), member since
//   4. Privacy & consent   — share_with_vendors marketing toggle
//   5. Security            — change password via Supabase magic link
//   6. Danger zone         — sign out
// =============================================================================

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/shared/Navbar';
import {
  User, Mail, Shield, CheckCircle, AlertTriangle, Clock,
  Lock, LogOut, ChevronRight, Loader2, Save, Eye, EyeOff,
  GraduationCap, ArrowRight, Bell, Building2, XCircle,
  ToggleLeft, ToggleRight, MapPin,
} from 'lucide-react';

const LAUNCH_CITIES = ['Budapest', 'Szeged'];

// ── Types ─────────────────────────────────────────────────────────────────────
interface StudentData {
  profile: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    display_name: string | null;
    created_at: string;
  } | null;
  student_profile: {
    id: string;
    verification_status: string;
    verification_method: string | null;
    verified_at: string | null;
    student_email: string | null;
    institution_name_manual: string | null;
  } | null;
  email: string;
  share_with_vendors: boolean;
}

// ── Section wrapper ────────────────────────────────────────────────────────────
function Section({ title, icon, children, danger }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; danger?: boolean;
}) {
  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-5 sm:p-6 ${danger ? 'border-red-200' : 'border-gray-100'}`}>
      <div className={`flex items-center gap-2 mb-5 pb-4 border-b ${danger ? 'border-red-100' : 'border-gray-100'}`}>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${danger ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-500'}`}>
          {icon}
        </div>
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 last:mb-0">
      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-1.5">{hint}</p>}
      {children}
    </div>
  );
}

const INPUT = 'w-full px-3.5 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-colors placeholder:text-gray-300';
const INPUT_RO = 'w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl text-gray-500 cursor-not-allowed';

// ── Verification status card ───────────────────────────────────────────────────
function VerificationCard({ studentProfile }: { studentProfile: StudentData['student_profile'] }) {
  const status = studentProfile?.verification_status ?? 'unverified';

  if (status === 'verified') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-5 flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
          <CheckCircle size={22} className="text-green-600" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-green-800">Verified Student</h3>
            <span className="text-xs bg-green-600 text-white font-bold px-2 py-0.5 rounded-full">✓ Verified</span>
          </div>
          <p className="text-sm text-green-700">
            Your student status is confirmed
            {studentProfile?.verification_method === 'edu_email' && ' via university email'}
            {studentProfile?.verification_method === 'id_upload' && ' via student ID'}
            {studentProfile?.verified_at && ` on ${new Date(studentProfile.verified_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}.
          </p>
          {studentProfile?.student_email && (
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <GraduationCap size={12} />
              {studentProfile.student_email}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (status === 'pending_review') {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
          <Clock size={22} className="text-amber-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-amber-800 mb-1">Under Review</h3>
          <p className="text-sm text-amber-700">
            Your student ID has been submitted and is being reviewed by our team. This usually takes under 24 hours.
          </p>
        </div>
      </div>
    );
  }

  if (status === 'pending_email') {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
          <Mail size={22} className="text-blue-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-blue-800 mb-1">Email Verification Pending</h3>
          <p className="text-sm text-blue-700 mb-3">
            We sent a verification code to your university email. Check your inbox and enter the code to complete verification.
          </p>
          <Link
            href="/verification"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-blue-700 hover:underline"
          >
            Complete verification <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    );
  }

  if (status === 'rejected') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
          <XCircle size={22} className="text-red-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-red-800 mb-1">Verification Rejected</h3>
          <p className="text-sm text-red-700 mb-3">
            Your previous verification attempt was rejected. Please re-submit with a clear student ID photo or use a university email address.
          </p>
          <Link
            href="/verification"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 transition-colors"
          >
            Try again <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    );
  }

  // Unverified — strongest CTA
  return (
    <div className="bg-gradient-to-br from-brand-50 to-purple-50 border border-brand-200 rounded-2xl p-5">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-brand-100 flex items-center justify-center flex-shrink-0">
          <Shield size={22} className="text-brand-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-gray-900 mb-1">Verify your student status</h3>
          <p className="text-sm text-gray-600 mb-4">
            Verified students get full access to all loyalty programs and vendor deals. It takes less than 2 minutes — use your university email or upload your student ID.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/verification"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white text-sm font-bold rounded-xl hover:bg-brand-700 transition-colors"
            >
              <GraduationCap size={15} />
              Verify now — it's free
            </Link>
            <span className="text-xs text-gray-400">Takes ~2 minutes</span>
          </div>
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-brand-100 flex flex-wrap gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><CheckCircle size={12} className="text-green-500" /> University email (instant)</span>
        <span className="flex items-center gap-1.5"><CheckCircle size={12} className="text-green-500" /> Student ID upload (24h review)</span>
        <span className="flex items-center gap-1.5"><CheckCircle size={12} className="text-green-500" /> 100% free</span>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function StudentProfilePage() {
  const router = useRouter();
  const supabase = createClient();

  const [data, setData] = useState<StudentData | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [firstName, setFirstName]         = useState('');
  const [lastName, setLastName]           = useState('');
  const [displayName, setDisplayName]     = useState('');
  const [userCity, setUserCity]           = useState('Budapest');
  const [shareConsent, setShareConsent]   = useState(false);

  // Save state
  const [saving, setSaving]       = useState(false);
  const [saveOk, setSaveOk]       = useState(false);
  const [saveErr, setSaveErr]     = useState('');
  const [passwordSent, setPasswordSent] = useState(false);

  // Auth guard + load data
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      try {
        const res = await fetch('/api/student/profile');
        if (res.ok) {
          const d: StudentData = await res.json();
          setData(d);
          setFirstName(d.profile?.first_name ?? '');
          setLastName(d.profile?.last_name ?? '');
          setDisplayName(d.profile?.display_name ?? '');
          setShareConsent(d.share_with_vendors);
          if (d.profile && 'city' in d.profile && LAUNCH_CITIES.includes((d.profile as { city?: string }).city ?? '')) {
            setUserCity((d.profile as { city?: string }).city ?? 'Budapest');
          }
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveOk(false);
    setSaveErr('');
    try {
      const res = await fetch('/api/student/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          display_name: displayName || `${firstName} ${lastName}`.trim(),
          city: userCity,
          share_with_vendors: shareConsent,
        }),
      });
      if (res.ok) {
        setSaveOk(true);
        setTimeout(() => setSaveOk(false), 3000);
      } else {
        const d = await res.json();
        setSaveErr(d.error ?? 'Failed to save.');
      }
    } catch (_) {
      setSaveErr('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!data?.email) return;
    await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setPasswordSent(true);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-brand-400" />
      </div>
    );
  }

  const memberSince = data?.profile?.created_at
    ? new Date(data.profile.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-brand-600 flex items-center justify-center text-white text-xl font-black">
            {(firstName?.[0] ?? data?.profile?.display_name?.[0] ?? 'S').toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900">
              {firstName ? `${firstName} ${lastName}`.trim() : data?.profile?.display_name ?? 'Your Profile'}
            </h1>
            <p className="text-sm text-gray-500">
              {data?.email}
              {memberSince && <span className="ml-2 text-gray-400">· Member since {memberSince}</span>}
            </p>
          </div>
        </div>

        <div className="space-y-5">

          {/* ── 1. Verification status ── */}
          <VerificationCard studentProfile={data?.student_profile ?? null} />

          {/* ── 2. Personal info ── */}
          <Section title="Personal information" icon={<User size={15} />}>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <Field label="First name">
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. Bence"
                  className={INPUT}
                />
              </Field>
              <Field label="Last name">
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Kovács"
                  className={INPUT}
                />
              </Field>
            </div>
            <Field label="Display name" hint="This is shown to vendors when you use your loyalty card.">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="How you'd like to be known"
                className={INPUT}
              />
            </Field>
            <Field label="Your city" hint="We currently operate in Budapest and Szeged. Select where you study.">
              <div className="flex gap-2">
                {LAUNCH_CITIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setUserCity(c)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-bold transition-all ${
                      userCity === c
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <MapPin size={13} />
                    {c}
                  </button>
                ))}
              </div>
            </Field>
          </Section>

          {/* ── 3. Account info ── */}
          <Section title="Account" icon={<Mail size={15} />}>
            <Field label="Email address" hint="Your login email. To change it, contact support.">
              <input type="email" value={data?.email ?? ''} readOnly className={INPUT_RO} />
            </Field>
            {data?.student_profile?.student_email && data.student_profile.student_email !== data.email && (
              <Field label="Verified university email">
                <div className="flex items-center gap-2">
                  <input type="email" value={data.student_profile.student_email} readOnly className={INPUT_RO + ' flex-1'} />
                  <span className="flex items-center gap-1 text-xs text-green-600 font-semibold bg-green-50 px-2.5 py-1.5 rounded-lg border border-green-200 whitespace-nowrap">
                    <CheckCircle size={11} /> Verified
                  </span>
                </div>
              </Field>
            )}
          </Section>

          {/* ── 4. Privacy & consent ── */}
          <Section title="Privacy & marketing" icon={<Bell size={15} />}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900 mb-1">Share contact details with venues</p>
                <p className="text-xs text-gray-500">
                  Allow businesses you've visited to see your name and email for sending promotions and offers. You can turn this off at any time. This setting is governed by EU GDPR.
                </p>
              </div>
              <button
                onClick={() => setShareConsent(!shareConsent)}
                className="flex-shrink-0 mt-0.5"
              >
                {shareConsent
                  ? <ToggleRight size={32} className="text-brand-600" />
                  : <ToggleLeft size={32} className="text-gray-300" />
                }
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-100">
              {shareConsent
                ? 'Venues you stamp with can see your email and may send you promotions.'
                : 'Your email is hidden from venues. You will still receive in-app notifications.'}
            </p>
          </Section>

          {/* ── 5. Save button ── */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-brand-600 text-white text-sm font-bold rounded-xl hover:bg-brand-700 transition-colors disabled:opacity-60"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              Save changes
            </button>
            {saveOk && (
              <span className="flex items-center gap-1.5 text-sm text-green-600 font-semibold">
                <CheckCircle size={14} /> Saved!
              </span>
            )}
            {saveErr && (
              <span className="text-sm text-red-600">{saveErr}</span>
            )}
          </div>

          {/* ── 6. Security ── */}
          <Section title="Security" icon={<Lock size={15} />}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-0.5">Change password</p>
                <p className="text-xs text-gray-500">We'll email you a secure link to reset your password.</p>
              </div>
              {passwordSent ? (
                <span className="text-sm text-green-600 font-semibold flex items-center gap-1.5">
                  <CheckCircle size={14} /> Email sent!
                </span>
              ) : (
                <button
                  onClick={handlePasswordReset}
                  className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Send reset link <ChevronRight size={13} />
                </button>
              )}
            </div>
          </Section>

          {/* ── 7. Sign out / danger ── */}
          <Section title="Account actions" icon={<LogOut size={15} />} danger>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-0.5">Sign out</p>
                <p className="text-xs text-gray-500">You will be logged out of this device.</p>
              </div>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm font-semibold hover:bg-red-100 transition-colors"
              >
                <LogOut size={14} />
                Sign out
              </button>
            </div>
          </Section>

        </div>
      </div>
    </div>
  );
}
