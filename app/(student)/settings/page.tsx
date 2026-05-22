'use client';

// =============================================================================
// app/(student)/settings/page.tsx — Student Account Settings
//
// Lets students manage:
//   • Marketing consent (share_with_vendors) — GDPR opt-in / opt-out
//   • Account info display (name, email, verification status)
//   • Link to /verify for document re-upload
//   • Link to /api/account/delete for GDPR deletion
// =============================================================================

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  GraduationCap, Shield, Bell, Trash2, ArrowLeft,
  CheckCircle, Loader2, AlertCircle, User, Mail,
  ChevronRight, RefreshCw, Lock, Cake,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ProfileData = {
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type StudentProfileData = {
  verification_status: string;
  share_with_vendors: boolean;
  consent_updated_at: string | null;
  institution_id: string | null;
  institution_name_manual: string | null;
  date_of_birth: string | null;
};

// ---------------------------------------------------------------------------
// Toggle switch component
// ---------------------------------------------------------------------------

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-[#0f0b2e] disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? 'bg-purple-600' : 'bg-white/20'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_BADGES: Record<string, { label: string; colour: string; bg: string }> = {
  verified:       { label: 'Verified',       colour: 'text-green-400',  bg: 'bg-green-500/10'  },
  pending_review: { label: 'Under review',   colour: 'text-amber-400',  bg: 'bg-amber-500/10'  },
  pending_email:  { label: 'Confirm email',  colour: 'text-amber-400',  bg: 'bg-amber-500/10'  },
  unverified:     { label: 'Not verified',   colour: 'text-red-400',    bg: 'bg-red-500/10'    },
  rejected:       { label: 'Rejected',       colour: 'text-red-400',    bg: 'bg-red-500/10'    },
  expired:        { label: 'Expired',        colour: 'text-orange-400', bg: 'bg-orange-500/10' },
};

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function StudentSettingsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [studentProfile, setStudentProfile] = useState<StudentProfileData | null>(null);
  const [shareWithVendors, setShareWithVendors] = useState(false);
  const [savingConsent, setSavingConsent] = useState(false);
  const [consentSaved, setConsentSaved] = useState(false);
  const [consentError, setConsentError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [savingBirthday, setSavingBirthday] = useState(false);

  // ── Load data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/sign-in'); return; }

      const [{ data: pRaw }, { data: spRaw }] = await Promise.all([
        supabase
          .from('profiles')
          .select('display_name, first_name, last_name')
          .eq('id', user.id as string)
          .maybeSingle(),
        supabase
          .from('student_profiles')
          .select('verification_status, share_with_vendors, consent_updated_at, institution_id, institution_name_manual, date_of_birth')
          .eq('user_id', user.id as string)
          .maybeSingle(),
      ]);
      const p = (pRaw as unknown) as { display_name: string | null; first_name: string | null; last_name: string | null } | null;

      // Cast required: share_with_vendors / date_of_birth were added in SQL migrations
      // after the last Supabase type regeneration. Safe cast — columns exist in DB.
      const spTyped = (spRaw as unknown) as StudentProfileData | null;
      setProfile({ ...(p ?? {}), email: user.email ?? null } as ProfileData);
      setStudentProfile(spTyped);
      setShareWithVendors(spTyped?.share_with_vendors ?? false);
      setDateOfBirth(spTyped?.date_of_birth ?? '');
      setLoading(false);
    })();
  }, [router]);

  // ── Save marketing consent ─────────────────────────────────────────────────
  async function handleConsentChange(newValue: boolean) {
    setShareWithVendors(newValue);
    setSavingConsent(true);
    setConsentError('');
    setConsentSaved(false);

    try {
      const res = await fetch('/api/student/consent', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ share_with_vendors: newValue }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to save.');
      setConsentSaved(true);
      setStudentProfile(prev =>
        prev ? { ...prev, share_with_vendors: newValue, consent_updated_at: new Date().toISOString() } : prev
      );
      setTimeout(() => setConsentSaved(false), 3000);
    } catch (err) {
      setConsentError((err as Error).message);
      setShareWithVendors(!newValue); // revert
    } finally {
      setSavingConsent(false);
    }
  }

  // ── Delete account ────────────────────────────────────────────────────────
  async function handleDeleteAccount() {
    setDeletingAccount(true);
    try {
      const res = await fetch('/api/account/delete', { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? 'Failed to delete account.');
      }
      router.push('/?deleted=true');
    } catch (err) {
      showToast((err as Error).message, 'error');
      setDeletingAccount(false);
    }
  }

  // ── Save birthday ─────────────────────────────────────────────────────────
  async function handleSaveBirthday() {
    setSavingBirthday(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('student_profiles')
        .update({ date_of_birth: dateOfBirth || null })
        .eq('user_id', user.id);
      if (error) throw new Error(error.message);
      showToast('Birthday saved! 🎂 You\'ll get 3 bonus stamps every year.', 'success');
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setSavingBirthday(false);
    }
  }

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0b2e] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  const displayName = (
    profile?.display_name
    ?? [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
  ) || 'Student';

  const statusKey = studentProfile?.verification_status ?? 'unverified';
  const statusBadge = STATUS_BADGES[statusKey] ?? STATUS_BADGES.unverified;
  const consentDate = studentProfile?.consent_updated_at
    ? new Date(studentProfile.consent_updated_at).toLocaleDateString('hu-HU', {
        year: 'numeric', month: 'long', day: 'numeric',
      })
    : null;

  return (
    <div className="min-h-screen bg-[#0f0b2e] text-white px-4 py-10">
      <div className="max-w-xl mx-auto">

        {/* ── Header ── */}
        <div className="flex items-center gap-3 mb-8">
          <Link
            href="/dashboard"
            className="p-2 text-purple-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">Account settings</h1>
            <p className="text-sm text-purple-400">Manage your preferences and privacy</p>
          </div>
        </div>

        {/* ── Profile card ── */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-purple-600/30 rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-6 h-6 text-purple-300" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-white truncate">{displayName}</p>
              <p className="text-sm text-purple-400 truncate">{profile?.email}</p>
            </div>
          </div>

          {/* Verification status */}
          <div className={`flex items-center justify-between rounded-xl px-4 py-3 ${statusBadge.bg} border border-white/5`}>
            <div className="flex items-center gap-2">
              <Shield className={`w-4 h-4 ${statusBadge.colour}`} />
              <span className={`text-sm font-medium ${statusBadge.colour}`}>
                {statusBadge.label}
              </span>
            </div>
            {['unverified', 'rejected', 'expired'].includes(statusKey) && (
              <Link
                href="/verify"
                className="text-xs text-purple-400 hover:text-white flex items-center gap-1 transition-colors"
              >
                Verify now <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            )}
            {statusKey === 'pending_review' && (
              <span className="text-xs text-amber-400 flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Reviewing
              </span>
            )}
            {statusKey === 'verified' && (
              <CheckCircle className="w-4 h-4 text-green-400" />
            )}
          </div>
        </div>

        {/* ── Birthday reward ── */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-4">
          <div className="flex items-start gap-3 mb-4">
            <Cake className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="font-semibold text-white">Birthday reward</h2>
              <p className="text-sm text-purple-300 mt-1">
                Set your birthday and we&apos;ll credit you <strong>3 bonus stamps</strong> on your punch card every year as a birthday treat.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="relative">
              <Cake className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" />
              <input
                type="date"
                value={dateOfBirth}
                onChange={e => setDateOfBirth(e.target.value)}
                max={new Date(Date.now() - 16 * 365.25 * 24 * 3600 * 1000).toISOString().split('T')[0]}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 [color-scheme:dark]"
              />
            </div>

            <button
              onClick={handleSaveBirthday}
              disabled={savingBirthday}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
            >
              {savingBirthday ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
              ) : (
                <><Cake className="w-4 h-4" /> Save birthday</>
              )}
            </button>

            {dateOfBirth && (
              <p className="text-xs text-purple-400 text-center">
                🎂 We&apos;ll surprise you on{' '}
                {new Date(dateOfBirth + 'T00:00:00').toLocaleDateString('hu-HU', { day: 'numeric', month: 'long' })}
                {' '}each year
              </p>
            )}
          </div>
        </div>

        {/* ── Marketing consent ── */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-4">
          <div className="flex items-start gap-3 mb-4">
            <Bell className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="font-semibold text-white">Personalised offers</h2>
              <p className="text-sm text-purple-400 mt-0.5">
                Control whether vendors can see your anonymised deal activity to personalise offers.
              </p>
            </div>
          </div>

          {/* Toggle row */}
          <div className="flex items-start justify-between gap-4 bg-white/5 rounded-xl px-4 py-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white mb-0.5">
                Share activity with participating vendors
              </p>
              <p className="text-xs text-purple-400 leading-relaxed">
                Vendors you've visited can see your stamp counts and deal history (never your name or contact details).
                This helps them send you targeted rewards and flash deals.
              </p>
              {consentDate && (
                <p className="text-xs text-purple-500 mt-2">
                  Last changed: {consentDate}
                </p>
              )}
            </div>
            <div className="flex-shrink-0 pt-0.5">
              <Toggle
                checked={shareWithVendors}
                onChange={handleConsentChange}
                disabled={savingConsent}
              />
            </div>
          </div>

          {/* Feedback */}
          {savingConsent && (
            <p className="text-xs text-purple-400 flex items-center gap-1.5 mt-3">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving preference…
            </p>
          )}
          {consentSaved && (
            <p className="text-xs text-green-400 flex items-center gap-1.5 mt-3">
              <CheckCircle className="w-3.5 h-3.5" /> Saved
            </p>
          )}
          {consentError && (
            <p className="text-xs text-red-400 flex items-center gap-1.5 mt-3">
              <AlertCircle className="w-3.5 h-3.5" /> {consentError}
            </p>
          )}

          {/* GDPR note */}
          <p className="text-xs text-purple-500 mt-4 border-t border-white/5 pt-4">
            <Shield className="inline w-3 h-3 mr-1" />
            You can withdraw this consent at any time. Vendors never receive your name, email, or contact information.
            See our{' '}
            <a href="/privacy" className="text-purple-400 hover:text-white transition-colors">
              Privacy Policy
            </a>{' '}
            for full details.
          </p>
        </div>

        {/* ── Security section ── */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-4">
          <div className="flex items-center gap-3 mb-4">
            <Lock className="w-5 h-5 text-purple-400" />
            <h2 className="font-semibold text-white">Security</h2>
          </div>
          <Link
            href="/verify"
            className="flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors group"
          >
            <div>
              <p className="text-sm font-medium text-white">Student verification</p>
              <p className="text-xs text-purple-400 mt-0.5">
                {statusKey === 'verified' ? 'Your student status is confirmed' : 'Upload your student ID to verify'}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-purple-400 group-hover:text-white transition-colors" />
          </Link>
        </div>

        {/* ── Danger zone ── */}
        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Trash2 className="w-5 h-5 text-red-400" />
            <h2 className="font-semibold text-white">Danger zone</h2>
          </div>

          {!showDeleteConfirm ? (
            <div>
              <p className="text-sm text-purple-300 mb-4">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 hover:text-red-300 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete my account
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                <p className="text-sm font-semibold text-red-300 mb-1">Are you absolutely sure?</p>
                <p className="text-xs text-red-400">
                  This will permanently delete your account, all stamps, saved offers, and redemption history.
                  Your data will be erased in line with GDPR right-to-erasure requirements.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleDeleteAccount}
                  disabled={deletingAccount}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
                >
                  {deletingAccount
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Deleting…</>
                    : <><Trash2 className="w-4 h-4" /> Yes, delete everything</>}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="text-sm text-purple-400 hover:text-white px-5 py-2.5 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Back link ── */}
        <p className="text-center mt-6">
          <Link href="/dashboard" className="text-sm text-purple-400 hover:text-white transition-colors">
            ← Back to dashboard
          </Link>
        </p>
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed bottom-6 right-6 flex items-center gap-3 px-5 py-4 rounded-xl shadow-xl text-sm font-medium z-50 ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success'
            ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
            : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
