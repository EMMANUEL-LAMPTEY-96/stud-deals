'use client';

// =============================================================================
// app/(vendor)/vendor/profile/page.tsx — Vendor Profile & Settings
//
// Sections:
//   1. Business identity — name, type, description
//   2. Contact & web    — phone, business email, website URL
//   3. Location         — address, city, state, postal code, country
//   4. Media            — logo upload, cover image upload (Supabase Storage)
//   5. Plan & billing   — current plan info, upgrade CTA
//   6. Danger zone      — deactivate account
//
// Uses Supabase storage bucket "vendor-assets" for logo/cover uploads.
// Displays a verification badge if the business is verified.
// =============================================================================

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/shared/Navbar';
import VendorNav from '@/components/vendor/VendorNav';
import {
  Building2, Phone, Globe, MapPin, Camera, CheckCircle,
  AlertCircle, Loader2, Shield, ArrowUpRight, AlertTriangle,
  Upload, X, Zap, Star, User,
} from 'lucide-react';
import type { VendorProfile } from '@/lib/types/database.types';

// ── Constants ─────────────────────────────────────────────────────────────────

const BUSINESS_TYPES = [
  'Restaurant', 'Café / Coffee Shop', 'Bar & Pub', 'Fast Food', 'Bakery',
  'Grocery / Convenience', 'Fashion Retail', 'Electronics', 'Bookshop',
  'Gym / Fitness', 'Salon / Beauty', 'Pharmacy', 'Entertainment / Cinema',
  'Transport / Taxi', 'Online Business', 'Other',
];

const PLAN_INFO = {
  free: {
    label: 'Free',
    color: 'text-gray-600 bg-gray-100',
    features: ['Up to 2 active offers', 'Basic analytics (30 days)', 'QR scanner', 'Email support'],
    cta: true,
  },
  starter: {
    label: 'Starter',
    color: 'text-blue-700 bg-blue-50 border border-blue-200',
    features: ['Up to 10 active offers', 'Full analytics history', 'Peak-hours chart', 'Priority support'],
    cta: false,
  },
  growth: {
    label: 'Growth',
    color: 'text-brand-700 bg-brand-50 border border-brand-200',
    features: ['Unlimited offers', 'University breakdown', 'Looker Studio export', 'Dedicated account manager'],
    cta: false,
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const INPUT_CLS = 'w-full px-3.5 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-colors placeholder:text-gray-300';

function Section({ title, icon, children, noBorder }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; noBorder?: boolean;
}) {
  return (
    <div className={`card p-5 sm:p-6 ${noBorder ? 'border-red-200' : ''}`}>
      <div className="flex items-center gap-2 mb-5 pb-4 border-b border-gray-100">
        <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500">
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
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold text-gray-700">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

// ── Image uploader ────────────────────────────────────────────────────────────
function ImageUploader({
  label, hint, currentUrl, bucket, path, onUploaded,
}: {
  label: string; hint: string; currentUrl: string | null;
  bucket: string; path: string; onUploaded: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setUploading(true);
    const ext = file.name.split('.').pop();
    const filePath = `${path}.${ext}`;

    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);

    const { error } = await supabase.storage.from(bucket).upload(filePath, file, { upsert: true });
    if (!error) {
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
      onUploaded(urlData.publicUrl);
    }
    setUploading(false);
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-gray-700">{label}</label>
      <div
        className="relative border-2 border-dashed border-gray-200 rounded-2xl overflow-hidden cursor-pointer hover:border-brand-300 transition-colors group"
        style={{ height: 120 }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
      >
        {preview ? (
          <>
            <img src={preview} alt="Upload preview" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera size={22} className="text-white" />
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-gray-400">
            <Upload size={22} />
            <p className="text-xs font-medium">Click or drag to upload</p>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
            <Loader2 size={22} className="animate-spin text-brand-600" />
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      <p className="text-xs text-gray-400">{hint}</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function VendorProfilePage() {
  const router = useRouter();
  const supabase = createClient();

  const [vp, setVp] = useState<VendorProfile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [deactivateConfirm, setDeactivateConfirm] = useState(false);

  // Form fields
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('GB');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setUserId(user.id);

      const { data } = await supabase
        .from('vendor_profiles').select('*').eq('user_id', user.id).maybeSingle();

      // New vendor — no profile yet. Pre-fill from auth metadata and show the form in "create" mode
      if (!data) {
        const { data: { user: freshUser } } = await supabase.auth.getUser();
        const meta = freshUser?.user_metadata ?? {};
        setBusinessName((meta.business_name as string) ?? '');
        setBusinessEmail(freshUser?.email ?? '');
        setLoading(false);
        return;
      }

      setVp(data);
      setBusinessName(data.business_name);
      setBusinessType(data.business_type ?? '');
      setDescription(data.description ?? '');
      setPhone(data.business_phone ?? '');
      setBusinessEmail(data.business_email ?? '');
      setWebsite(data.website_url ?? '');
      setAddressLine1(data.address_line1 ?? '');
      setAddressLine2(data.address_line2 ?? '');
      setCity(data.city);
      setState(data.state ?? '');
      setPostalCode(data.postal_code ?? '');
      setCountry(data.country ?? 'GB');
      setLogoUrl(data.logo_url);
      setCoverUrl(data.cover_image_url);

      setLoading(false);
    })();
  }, []);

  const showFlash = (type: 'success' | 'error', msg: string) => {
    setFlash({ type, msg });
    setTimeout(() => setFlash(null), 4000);
  };

  const handleSave = async () => {
    if (!businessName.trim() || !city.trim()) {
      showFlash('error', 'Business name and city are required.');
      return;
    }
    setSaving(true);

    const isNew = !vp;
    const payload = {
      user_id: userId!,
      business_name: businessName.trim(),
      business_type: businessType || null,
      description: description.trim() || null,
      business_phone: phone.trim() || null,
      business_email: businessEmail.trim() || null,
      website_url: website.trim() || null,
      address_line1: addressLine1.trim() || null,
      address_line2: addressLine2.trim() || null,
      city: city.trim(),
      state: state.trim() || null,
      postal_code: postalCode.trim() || null,
      country: country || 'United States',
      logo_url: logoUrl,
      cover_image_url: coverUrl,
    };

    // Use upsert so this works for both new vendors (INSERT) and existing (UPDATE)
    const { data: savedData, error } = await supabase
      .from('vendor_profiles')
      .upsert(payload, { onConflict: 'user_id' })
      .select()
      .single();

    setSaving(false);
    if (error) { showFlash('error', error.message); return; }
    if (savedData) setVp(savedData as VendorProfile);
    showFlash('success', isNew ? 'Business profile created! You can now create offers.' : 'Profile updated successfully.');

    // If this was the first save, redirect to dashboard
    if (isNew) {
      setTimeout(() => router.push('/vendor'), 1500);
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <VendorNav />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <Loader2 size={32} className="animate-spin text-vendor-500" />
        </div>
      </>
    );
  }

  const plan = PLAN_INFO[vp?.plan_tier ?? 'free'] ?? PLAN_INFO.free;

  return (
    <>
      <Navbar />
      <VendorNav />

      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-7">
            <div>
              <h1 className="text-2xl font-black text-gray-900">Business settings</h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-gray-500 text-sm">{vp?.business_name}</p>
                {vp?.is_verified ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-vendor-700 bg-vendor-50 px-2 py-0.5 rounded-full border border-vendor-200">
                    <CheckCircle size={11} />
                    Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    <AlertCircle size={11} />
                    Pending verification
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-vendor flex-shrink-0"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
              Save changes
            </button>
          </div>

          {/* Flash */}
          {flash && (
            <div className={`flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm font-medium mb-5 animate-fade-in ${
              flash.type === 'success'
                ? 'bg-vendor-50 border border-vendor-200 text-vendor-800'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}>
              {flash.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
              {flash.msg}
            </div>
          )}

          <div className="space-y-5">

            {/* 1. Business identity */}
            <Section title="Business identity" icon={<Building2 size={14} />}>
              <div className="space-y-4">
                <Field label="Business name">
                  <input type="text" className={INPUT_CLS} value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
                </Field>
                <Field label="Business type">
                  <select className={INPUT_CLS} value={businessType} onChange={(e) => setBusinessType(e.target.value)}>
                    <option value="">Select a type…</option>
                    {BUSINESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Description" hint="Shown on your business profile page. Max 300 characters.">
                  <textarea
                    className={`${INPUT_CLS} resize-none h-24`}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Tell students what makes your business great for them…"
                    maxLength={300}
                  />
                  <p className="text-xs text-gray-400 text-right">{description.length}/300</p>
                </Field>
              </div>
            </Section>

            {/* 2. Contact & web */}
            <Section title="Contact & web" icon={<Phone size={14} />}>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Business phone">
                  <input type="tel" className={INPUT_CLS} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+44 7xxx xxxxxx" />
                </Field>
                <Field label="Business email">
                  <input type="email" className={INPUT_CLS} value={businessEmail} onChange={(e) => setBusinessEmail(e.target.value)} placeholder="hello@yourbusiness.com" />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Website" hint="Include https://">
                    <div className="relative">
                      <Globe size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      <input type="url" className={`${INPUT_CLS} pl-8`} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://yourbusiness.com" />
                    </div>
                  </Field>
                </div>
              </div>
            </Section>

            {/* 3. Location */}
            <Section title="Location" icon={<MapPin size={14} />}>
              <div className="space-y-4">
                <Field label="Address line 1">
                  <input type="text" className={INPUT_CLS} value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} placeholder="123 High Street" />
                </Field>
                <Field label="Address line 2 (optional)">
                  <input type="text" className={INPUT_CLS} value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} placeholder="Suite 2B" />
                </Field>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="City" hint="Stud Deals currently operates in Budapest and Szeged only.">
                    <select className={INPUT_CLS} value={city} onChange={(e) => setCity(e.target.value)}>
                      <option value="">Select city…</option>
                      <option value="Budapest">Budapest</option>
                      <option value="Szeged">Szeged</option>
                    </select>
                  </Field>
                  <Field label="State / County">
                    <input type="text" className={INPUT_CLS} value={state} onChange={(e) => setState(e.target.value)} placeholder="Greater London" />
                  </Field>
                  <Field label="Postal code">
                    <input type="text" className={INPUT_CLS} value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="EC1A 1BB" />
                  </Field>
                  <Field label="Country">
                    <select className={INPUT_CLS} value={country} onChange={(e) => setCountry(e.target.value)}>
                      <option value="GB">🇬🇧 United Kingdom</option>
                      <option value="US">🇺🇸 United States</option>
                      <option value="GH">🇬🇭 Ghana</option>
                      <option value="NG">🇳🇬 Nigeria</option>
                      <option value="CA">🇨🇦 Canada</option>
                      <option value="AU">🇦🇺 Australia</option>
                      <option value="ZA">🇿🇦 South Africa</option>
                      <option value="KE">🇰🇪 Kenya</option>
                    </select>
                  </Field>
                </div>
              </div>
            </Section>

            {/* 4. Media */}
            <Section title="Brand media" icon={<Camera size={14} />}>
              <div className="grid sm:grid-cols-2 gap-5">
                <ImageUploader
                  label="Logo"
                  hint="Square image, at least 400×400px. PNG or JPG."
                  currentUrl={logoUrl}
                  bucket="vendor-assets"
                  path={`${vp?.id}/logo`}
                  onUploaded={setLogoUrl}
                />
                <ImageUploader
                  label="Cover image"
                  hint="Wide banner image, 1200×400px recommended."
                  currentUrl={coverUrl}
                  bucket="vendor-assets"
                  path={`${vp?.id}/cover`}
                  onUploaded={setCoverUrl}
                />
              </div>
            </Section>

            {/* 5. Plan & billing */}
            <Section title="Plan & billing" icon={<Star size={14} />}>
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${plan.color}`}>
                    {plan.label} plan
                  </span>
                  {vp?.plan_expires_at && (
                    <p className="text-xs text-gray-400 mt-1.5">
                      Renews {new Date(vp.plan_expires_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  )}
                </div>
                {plan.cta && (
                  <a href="/vendor/upgrade" className="btn-vendor text-xs px-4 py-2 flex items-center gap-1.5">
                    <Zap size={13} />
                    Upgrade
                    <ArrowUpRight size={12} />
                  </a>
                )}
              </div>

              <ul className="space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-gray-600">
                    <CheckCircle size={14} className="text-vendor-500 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              {plan.cta && (
                <div className="mt-5 p-4 bg-brand-50 border border-brand-100 rounded-2xl">
                  <p className="text-sm font-bold text-brand-900 mb-1">Ready to scale?</p>
                  <p className="text-xs text-brand-700 leading-relaxed">
                    Starter gives you up to 10 live offers and full analytics history.
                    Growth unlocks university insights and Looker Studio export.
                  </p>
                </div>
              )}
            </Section>

            {/* 6. Danger zone */}
            <div className="card border-red-200 p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-5 pb-4 border-b border-red-100">
                <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center text-red-500">
                  <AlertTriangle size={14} />
                </div>
                <h2 className="text-sm font-bold text-red-700">Danger zone</h2>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800">Deactivate account</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Hides your business profile and pauses all active offers. You can reactivate at any time.
                  </p>
                </div>
                {!deactivateConfirm ? (
                  <button
                    onClick={() => setDeactivateConfirm(true)}
                    className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors"
                  >
                    <X size={14} />
                    Deactivate
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button onClick={() => setDeactivateConfirm(false)} className="btn-secondary text-sm px-4 py-2">Cancel</button>
                    <button
                      onClick={async () => {
                        if (!vp) return;
                        await supabase.from('vendor_profiles').update({ is_verified: false } as Partial<VendorProfile>).eq('id', vp.id);
                        router.push('/sign-in');
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors"
                    >
                      <AlertTriangle size={13} />
                      Confirm
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom save */}
          <div className="mt-6 pb-8 flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-vendor"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
              Save all changes
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
