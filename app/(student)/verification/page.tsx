'use client';

// =============================================================================
// app/(student)/verification/page.tsx — Student Verification Flow
//
// A clean 3-step wizard:
//
//   STEP 1 — Choose method
//     ┌─────────────────────┐   ┌─────────────────────┐
//     │  📧 University      │   │  🪪 Student ID      │
//     │  Email              │   │  Card               │
//     │  Instant approval   │   │  24h review         │
//     └─────────────────────┘   └─────────────────────┘
//
//   STEP 2a — Email OTP
//     - Enter university email (.hu domain)
//     - Live domain check (shows matched institution)
//     - Send code → enter 6-digit OTP
//
//   STEP 2b — ID Upload
//     - Drag & drop or click to upload
//     - Preview thumbnail
//     - Submit → pending_review
//
//   STEP 3 — Success / Pending
//     - Verified: confetti + CTA to dashboard
//     - Pending: timeline showing review steps
// =============================================================================

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/shared/Navbar';
import {
  Mail, Upload, CheckCircle, ArrowRight, ArrowLeft,
  GraduationCap, Loader2, XCircle, Eye, EyeOff,
  Clock, Shield, Sparkles, Camera, FileImage, X,
  Building2, AlertCircle, RefreshCw,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
type Method = 'email' | 'id_upload';
type Step = 'choose' | 'email_enter' | 'email_otp' | 'id_upload' | 'success_verified' | 'success_pending';

// ── Step indicator ────────────────────────────────────────────────────────────
function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all duration-300 ${
            i < current ? 'w-2 h-2 bg-brand-500' :
            i === current ? 'w-6 h-2 bg-brand-600' :
            'w-2 h-2 bg-gray-200'
          }`}
        />
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function VerificationPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<Step>('choose');
  const [method, setMethod] = useState<Method | null>(null);

  // Email track state
  const [uniEmail, setUniEmail] = useState('');
  const [emailChecking, setEmailChecking] = useState(false);
  const [matchedInstitution, setMatchedInstitution] = useState<string | null>(null);
  const [emailError, setEmailError] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpResending, setOtpResending] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ID upload state
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if student is already verified
  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const { data: sp } = await supabase
        .from('student_profiles')
        .select('verification_status, student_email')
        .eq('user_id', user.id)
        .maybeSingle();
      if (sp?.verification_status === 'verified') {
        setStep('success_verified');
      } else if (sp?.verification_status === 'pending_review') {
        setStep('success_pending');
      } else if (sp?.verification_status === 'pending_email' && sp.student_email) {
        setUniEmail(sp.student_email);
        setStep('email_otp');
      }
    };
    check();
  }, []);

  // ── Live domain check as user types ──────────────────────────────────────
  useEffect(() => {
    if (!uniEmail.includes('@')) { setMatchedInstitution(null); setEmailError(''); return; }
    const timer = setTimeout(async () => {
      const domain = uniEmail.split('@')[1];
      if (!domain || domain.length < 3) return;
      setEmailChecking(true);
      try {
        const res = await fetch('/api/verification/check-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: uniEmail }),
        });
        const data = await res.json();
        if (data.is_valid_edu_email && data.institution) {
          setMatchedInstitution(data.institution.name);
          setEmailError('');
        } else if (data.is_valid_edu_email) {
          setMatchedInstitution(null);
          setEmailError('');
        } else {
          setMatchedInstitution(null);
          setEmailError(data.message ?? 'Please use your official university email.');
        }
      } catch (_) { /* silent */ } finally {
        setEmailChecking(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [uniEmail]);

  // ── Send OTP ──────────────────────────────────────────────────────────────
  const handleSendOtp = async () => {
    if (!uniEmail) return;
    setSendingOtp(true);
    setEmailError('');
    try {
      const res = await fetch('/api/verification/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ university_email: uniEmail }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setEmailError(data.error ?? 'Failed to send code. Please try again.');
        return;
      }
      setStep('email_otp');
    } finally {
      setSendingOtp(false);
    }
  };

  // ── OTP input handling ────────────────────────────────────────────────────
  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newCode = [...otpCode];
    newCode[index] = digit;
    setOtpCode(newCode);
    setOtpError('');
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtpCode(pasted.split(''));
      otpRefs.current[5]?.focus();
    }
  };

  // ── Verify OTP ────────────────────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    const code = otpCode.join('');
    if (code.length !== 6) { setOtpError('Please enter all 6 digits.'); return; }
    setVerifyingOtp(true);
    setOtpError('');
    try {
      const res = await fetch('/api/verification/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp_code: code }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setOtpError(data.error ?? 'Incorrect code. Please try again.');
        setOtpCode(['', '', '', '', '', '']);
        otpRefs.current[0]?.focus();
        return;
      }
      setStep('success_verified');
    } finally {
      setVerifyingOtp(false);
    }
  };

  // ── File handling ─────────────────────────────────────────────────────────
  const handleFile = useCallback((file: File) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic'];
    if (!allowed.includes(file.type)) {
      setUploadError('Please upload a JPEG, PNG, or WEBP image.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File too large. Maximum 10 MB.');
      return;
    }
    setSelectedFile(file);
    setUploadError('');
    const reader = new FileReader();
    reader.onload = (e) => setFilePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // ── Upload ID ──────────────────────────────────────────────────────────────
  const handleUploadId = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setUploadError('');
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const res = await fetch('/api/verification/upload-id', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setUploadError(data.error ?? 'Upload failed. Please try again.');
        return;
      }
      setStep('success_pending');
    } finally {
      setUploading(false);
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-lg mx-auto px-4 py-8">

          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex w-14 h-14 rounded-2xl bg-brand-100 items-center justify-center mb-4">
              <Shield size={26} className="text-brand-600" />
            </div>
            <h1 className="text-2xl font-black text-gray-900">Verify Student Status</h1>
            <p className="text-gray-500 text-sm mt-2">
              Unlock loyalty rewards from partner businesses near your campus.
            </p>
          </div>

          {/* ── STEP: CHOOSE ─────────────────────────────────────────────── */}
          {step === 'choose' && (
            <div className="space-y-4 animate-fade-in">
              <StepDots current={0} total={3} />

              <div
                onClick={() => { setMethod('email'); setStep('email_enter'); }}
                className="card p-5 cursor-pointer hover:border-brand-300 hover:shadow-md transition-all border-2 border-transparent group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-brand-100 flex items-center justify-center flex-shrink-0 group-hover:bg-brand-200 transition-colors">
                    <Mail size={22} className="text-brand-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-gray-900">University Email</h3>
                      <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">
                        Instant
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      Use your official university email address. We'll send a 6-digit code to confirm.
                    </p>
                    <p className="text-xs text-brand-600 font-medium mt-2">
                      Works with all Hungarian universities (ELTE, BME, Corvinus, etc.)
                    </p>
                  </div>
                  <ArrowRight size={18} className="text-gray-300 group-hover:text-brand-500 transition-colors flex-shrink-0 mt-1" />
                </div>
              </div>

              <div
                onClick={() => { setMethod('id_upload'); setStep('id_upload'); }}
                className="card p-5 cursor-pointer hover:border-brand-300 hover:shadow-md transition-all border-2 border-transparent group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-200 transition-colors">
                    <FileImage size={22} className="text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-gray-900">Student ID Card</h3>
                      <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">
                        24h review
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      Upload a photo of your diákigazolvány or student ID card. Our team reviews it within 24 hours.
                    </p>
                  </div>
                  <ArrowRight size={18} className="text-gray-300 group-hover:text-brand-500 transition-colors flex-shrink-0 mt-1" />
                </div>
              </div>
            </div>
          )}

          {/* ── STEP: EMAIL ENTER ─────────────────────────────────────────── */}
          {step === 'email_enter' && (
            <div className="space-y-5 animate-fade-in">
              <StepDots current={1} total={3} />

              <button onClick={() => setStep('choose')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-2">
                <ArrowLeft size={15} /> Back
              </button>

              <div className="card p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center">
                    <Mail size={20} className="text-brand-600" />
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-900">Enter your university email</h2>
                    <p className="text-xs text-gray-500">We'll send a 6-digit verification code</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                      University email address
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        value={uniEmail}
                        onChange={(e) => setUniEmail(e.target.value)}
                        placeholder="yourname@hallgato.elte.hu"
                        autoComplete="email"
                        className={`w-full border-2 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none transition-colors ${
                          emailError
                            ? 'border-red-300 bg-red-50 focus:border-red-400'
                            : matchedInstitution
                              ? 'border-green-300 bg-green-50 focus:border-green-400'
                              : 'border-gray-200 bg-gray-50 focus:border-brand-400 focus:bg-white'
                        }`}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {emailChecking && <Loader2 size={16} className="animate-spin text-gray-400" />}
                        {!emailChecking && matchedInstitution && <CheckCircle size={16} className="text-green-500" />}
                        {!emailChecking && emailError && <XCircle size={16} className="text-red-400" />}
                      </div>
                    </div>

                    {/* Institution match */}
                    {matchedInstitution && (
                      <div className="flex items-center gap-2 mt-2 text-green-700 text-xs font-semibold animate-fade-in">
                        <Building2 size={13} />
                        {matchedInstitution} — recognised ✓
                      </div>
                    )}

                    {emailError && (
                      <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
                        <AlertCircle size={12} />
                        {emailError}
                      </p>
                    )}

                    {!emailError && !matchedInstitution && uniEmail.includes('@') && !emailChecking && (
                      <p className="mt-2 text-xs text-amber-600 flex items-start gap-1">
                        <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
                        Domain not recognised — we'll still send you a code, but manual review may be needed.
                      </p>
                    )}
                  </div>

                  <button
                    onClick={handleSendOtp}
                    disabled={!uniEmail.includes('@') || !!emailError || sendingOtp}
                    className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                      !uniEmail.includes('@') || !!emailError || sendingOtp
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm hover:shadow-md active:scale-[0.98]'
                    }`}
                  >
                    {sendingOtp ? <><Loader2 size={16} className="animate-spin" /> Sending code…</> : <><Mail size={16} /> Send verification code</>}
                  </button>
                </div>
              </div>

              {/* Supported universities */}
              <div className="card p-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Supported universities</p>
                <div className="flex flex-wrap gap-2">
                  {['ELTE', 'BME', 'Corvinus', 'SZTE', 'UD', 'PTE', 'SE', 'SZE', 'ÓE', 'PPKE', 'MATE', 'ME'].map((uni) => (
                    <span key={uni} className="text-xs bg-brand-50 text-brand-700 font-semibold px-2.5 py-1 rounded-lg">
                      {uni}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── STEP: EMAIL OTP ──────────────────────────────────────────── */}
          {step === 'email_otp' && (
            <div className="space-y-5 animate-fade-in">
              <StepDots current={2} total={3} />

              <div className="card p-6">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 rounded-full bg-brand-100 flex items-center justify-center mx-auto mb-4">
                    <Mail size={28} className="text-brand-600" />
                  </div>
                  <h2 className="font-bold text-gray-900 text-lg mb-1">Check your inbox</h2>
                  <p className="text-sm text-gray-500">
                    We sent a 6-digit code to
                  </p>
                  <p className="text-sm font-bold text-gray-900 break-all mt-1">{uniEmail}</p>
                </div>

                {/* OTP input boxes */}
                <div className="flex gap-2 justify-center mb-5" onPaste={handleOtpPaste}>
                  {otpCode.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { otpRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      className={`w-11 h-14 text-center text-2xl font-black rounded-xl border-2 focus:outline-none transition-colors ${
                        otpError
                          ? 'border-red-300 bg-red-50 text-red-700'
                          : digit
                            ? 'border-brand-400 bg-brand-50 text-brand-800'
                            : 'border-gray-200 bg-gray-50 text-gray-900 focus:border-brand-400 focus:bg-white'
                      }`}
                    />
                  ))}
                </div>

                {otpError && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4 animate-fade-in">
                    <XCircle size={15} className="flex-shrink-0" />
                    {otpError}
                  </div>
                )}

                <button
                  onClick={handleVerifyOtp}
                  disabled={otpCode.join('').length !== 6 || verifyingOtp}
                  className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all mb-4 ${
                    otpCode.join('').length !== 6 || verifyingOtp
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm active:scale-[0.98]'
                  }`}
                >
                  {verifyingOtp ? <><Loader2 size={16} className="animate-spin" /> Verifying…</> : <><CheckCircle size={16} /> Confirm code</>}
                </button>

                <div className="flex items-center justify-between text-xs text-gray-400">
                  <button
                    onClick={() => { setStep('email_enter'); setOtpCode(['','','','','','']); setOtpError(''); }}
                    className="hover:text-gray-600 flex items-center gap-1"
                  >
                    <ArrowLeft size={12} /> Change email
                  </button>
                  <button
                    onClick={async () => {
                      setOtpResending(true);
                      await handleSendOtp();
                      setOtpResending(false);
                      setOtpCode(['','','','','','']);
                    }}
                    disabled={otpResending}
                    className="hover:text-gray-600 flex items-center gap-1"
                  >
                    <RefreshCw size={12} className={otpResending ? 'animate-spin' : ''} />
                    Resend code
                  </button>
                </div>
              </div>

              <p className="text-center text-xs text-gray-400">
                Check your spam folder if you don't see it. Code expires in 15 minutes.
              </p>
            </div>
          )}

          {/* ── STEP: ID UPLOAD ───────────────────────────────────────────── */}
          {step === 'id_upload' && (
            <div className="space-y-5 animate-fade-in">
              <StepDots current={1} total={3} />

              <button onClick={() => setStep('choose')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
                <ArrowLeft size={15} /> Back
              </button>

              <div className="card p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                    <FileImage size={20} className="text-purple-600" />
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-900">Upload your student ID</h2>
                    <p className="text-xs text-gray-500">Diákigazolvány or university-issued card</p>
                  </div>
                </div>

                {/* Drop zone */}
                {!filePreview ? (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                      dragOver
                        ? 'border-brand-400 bg-brand-50'
                        : 'border-gray-200 bg-gray-50 hover:border-brand-300 hover:bg-brand-50/50'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp,image/heic"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                    />
                    <div className="w-14 h-14 rounded-2xl bg-white border border-gray-100 flex items-center justify-center mx-auto mb-3 shadow-sm">
                      <Camera size={24} className="text-gray-400" />
                    </div>
                    <p className="font-semibold text-gray-700 text-sm mb-1">
                      {dragOver ? 'Drop it here!' : 'Drag & drop or click to upload'}
                    </p>
                    <p className="text-xs text-gray-400">JPEG, PNG or WEBP · Max 10 MB</p>
                  </div>
                ) : (
                  <div className="relative rounded-2xl overflow-hidden border-2 border-green-200 bg-green-50">
                    <img src={filePreview} alt="ID preview" className="w-full max-h-48 object-cover" />
                    <button
                      onClick={() => { setSelectedFile(null); setFilePreview(null); }}
                      className="absolute top-2 right-2 w-8 h-8 bg-white rounded-full shadow flex items-center justify-center hover:bg-red-50"
                    >
                      <X size={15} className="text-gray-500" />
                    </button>
                    <div className="px-4 py-3 flex items-center gap-2">
                      <CheckCircle size={15} className="text-green-600" />
                      <span className="text-sm text-green-700 font-medium truncate">{selectedFile?.name}</span>
                    </div>
                  </div>
                )}

                {uploadError && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mt-3 animate-fade-in">
                    <XCircle size={15} className="flex-shrink-0" />
                    {uploadError}
                  </div>
                )}

                <button
                  onClick={handleUploadId}
                  disabled={!selectedFile || uploading}
                  className={`w-full mt-5 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                    !selectedFile || uploading
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm active:scale-[0.98]'
                  }`}
                >
                  {uploading ? <><Loader2 size={16} className="animate-spin" /> Uploading…</> : <><Upload size={16} /> Submit for review</>}
                </button>

                {/* Privacy note */}
                <div className="mt-4 flex items-start gap-2 bg-gray-50 rounded-xl p-3">
                  <Shield size={14} className="text-gray-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Your ID is encrypted and only viewed by our verification team. It's deleted automatically after approval.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP: SUCCESS VERIFIED ────────────────────────────────────── */}
          {step === 'success_verified' && (
            <div className="text-center animate-fade-in">
              <div className="text-5xl mb-5">🎉</div>
              <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
                <CheckCircle size={40} className="text-green-600" />
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-2">You're verified!</h2>
              <p className="text-gray-500 text-sm mb-8 max-w-xs mx-auto">
                Your student status is confirmed. You now have full access to loyalty rewards at all partner businesses.
              </p>

              <div className="card p-5 mb-6 text-left">
                {[
                  { icon: <Sparkles size={16} className="text-brand-600" />, text: 'Earn stamps at participating businesses' },
                  { icon: <CheckCircle size={16} className="text-green-600" />, text: 'Your QR card is ready to use' },
                  { icon: <GraduationCap size={16} className="text-purple-600" />, text: 'Exclusive student rewards unlocked' },
                ].map((item, i) => (
                  <div key={i} className={`flex items-center gap-3 ${i > 0 ? 'mt-3 pt-3 border-t border-gray-100' : ''}`}>
                    {item.icon}
                    <span className="text-sm text-gray-700 font-medium">{item.text}</span>
                  </div>
                ))}
              </div>

              <Link href="/dashboard" className="btn-primary w-full justify-center">
                <Sparkles size={16} />
                Explore partner businesses
              </Link>
              <Link href="/my-loyalty" className="mt-3 block text-sm text-brand-600 font-semibold hover:text-brand-700">
                View my loyalty QR card →
              </Link>
            </div>
          )}

          {/* ── STEP: SUCCESS PENDING ─────────────────────────────────────── */}
          {step === 'success_pending' && (
            <div className="animate-fade-in">
              <div className="text-center mb-6">
                <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                  <Clock size={36} className="text-amber-600" />
                </div>
                <h2 className="text-2xl font-black text-gray-900 mb-2">Under review</h2>
                <p className="text-gray-500 text-sm max-w-xs mx-auto">
                  We've received your student ID. Our team will verify it within 24 hours.
                </p>
              </div>

              {/* Timeline */}
              <div className="card p-5 mb-6">
                {[
                  { icon: <CheckCircle size={16} />, label: 'ID submitted', done: true, color: 'text-green-600 bg-green-100' },
                  { icon: <Clock size={16} />, label: 'Under review (up to 24h)', done: false, color: 'text-amber-600 bg-amber-100' },
                  { icon: <Sparkles size={16} />, label: 'Full access unlocked', done: false, color: 'text-gray-400 bg-gray-100' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${item.color}`}>
                      {item.icon}
                    </div>
                    <span className={`text-sm font-medium ${item.done ? 'text-gray-900' : 'text-gray-400'}`}>
                      {item.label}
                    </span>
                    {i < 2 && (
                      <div className="absolute ml-4 mt-8 w-0.5 h-4 bg-gray-200 translate-y-2" />
                    )}
                  </div>
                ))}
              </div>

              <div className="bg-brand-50 border border-brand-100 rounded-2xl p-4 text-sm text-brand-700 mb-6">
                <p className="font-semibold mb-1">Meanwhile, you can still browse</p>
                <p className="text-xs text-brand-600">
                  Explore partner businesses and see available loyalty programs. Stamps will activate once you're verified.
                </p>
              </div>

              <Link href="/dashboard" className="btn-primary w-full justify-center">
                Browse partner businesses
              </Link>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
