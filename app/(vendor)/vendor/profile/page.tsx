'use client';

// =============================================================================
// app/(vendor)/vendor/profile/page.tsx — Vendor Profile & Settings
//
// Sections:
//   1. Business identity — name, type, description
//   2. Contact & web    — phone, business email, website URL
//   3. Location         — address, city, state, postal code, country
//   4. Brand media      — logo upload, cover image upload (Supabase Storage)
//   5. Business hours   — 7-day grid with open/closed toggle + time pickers
//   6. Photo gallery    — up to 8 photos uploaded to Supabase Storage
//   7. Plan & billing   — current plan info, upgrade CTA
//   8. Danger zone      — deactivate account
//
// Business hours + gallery stored in vendor_profiles.business_hours (JSONB)
// and vendor_profiles.gallery_photos (text[]).
//
// Schema migration required (run once in Supabase SQL editor):
//   ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS business_hours jsonb;
//   ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS gallery_photos  text[];
// =============================================================================

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/shared/Navbar';
import VendorNav from '@/components/vendor/VendorNav';
import {
  Building2, Phone, Globe, MapPin, Camera, CheckCircle,
  AlertCircle, Loader2, Shield, ArrowUpRight, AlertTriangle,
  Upload, X, Zap, Star, User, Clock, Image as ImageIcon,
  Plus, Trash2,
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

const DAYS_OF_WEEK = [
  { key: 'monday',    label: 'Monday' },
  { key: 'tuesday',   label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday',  label: 'Thursday' },
  { key: 'friday',    label: 'Friday' },
  { key: 'saturday',  label: 'Saturday' },
  { key: 'sunday',    label: 'Sunday' },
];

interface DayHours { open: boolean; from: string; to: string; }
type BusinessHours = Record<string, DayHours>;

const DEFAULT_HOURS: BusinessHours = {
  monday:    { open: true,  from: '09:00', to: '18:00' },
  tuesday:   { open: true,  from: '09:00', to: '18:00' },
  wednesday: { open: true,  from: '09:00', to: '18:00' },
  thursday:  { open: true,  from: '09:00', to: '18:00' },
  friday:    { open: true,  from: '09:00', to: '17:00' },
  saturday:  { open: false, from: '10:00', to: '16:00' },
  sunday:    { open: false, from: '10:00', to: '16:00' },
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

// ── Gallery photo uploader ────────────────────────────────────────────────────

function GalleryUploader({
  photos, vendorId, onPhotosChange,
}: {
  photos: string[]; vendorId: string | null; onPhotosChange: (urls: string[]) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const MAX_PHOTOS = 8;

  const handleFiles = async (files: FileList) => {
    if (!vendorId) return;
    const remaining = MAX_PHOTOS - photos.length;
    const toUpload = Array.from(files).slice(0, remaining);
    setUploading(true);

    const newUrls = [...photos];
    for (let i = 0; i < toUpload.length; i++) {
      const file = toUpload[i];
      if (!file.type.startsWith('image/')) continue;
      setUploadingIdx(i);
      const ext = file.name.split('.').pop();
      const slot = newUrls.length;
      const filePath = `${vendorId}/gallery/${slot}.${ext}`;
      const { error } = await supabase.storage.from('vendor-assets').upload(filePath, file, { upsert: true });
      if (!error) {
        const { data } = supabase.storage.from('vendor-assets').getPublicUrl(filePath);
        newUrls.push(data.publicUrl);
      }
    }

    setUploading(false);
    setUploadingIdx(null);
    onPhotosChange(newUrls);
  };

  const removePhoto = async (idx: number) => {
    const url = photos[idx];
    const updated = photos.filter((_, i) => i !== idx);
    // Optimistically update UI
    onPhotosChange(updated);
    // Remove from Storage (best-effort — don't block UI on failure)
    if (vendorId && url) {
      try {
        // Extract storage path from the public URL
        const match = url.match(/vendor-assets\/(.+)$/);
        if (match) {
          await supabase.storage.from('vendor-assets').remove([match[1]]);
        }
      } catch { /* ignore storage errors */ }
    }
    // Immediately persist the updated gallery to DB so removal survives without clicking Save
    if (vendorId) {
      await supabase
        .from('vendor_profiles')
        .update({ gallery_photos: updated })
        .eq('id', vendorId);
    }
  };

  return (
    <div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {photos.map((url, idx) => (
          <div key={idx} className="relative aspect-square rounded-xl overflow-hidden group border border-gray-100">
            <img src={url} alt={`Gallery ${idx + 1}`} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <button
                onClick={() => removePhoto(idx)}
                className="p-1.5 bg-red-500 rounded-lg text-white hover:bg-red-600 transition-colors"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}

        {photos.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="relative aspect-square rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1.5 text-gray-400 hover:border-brand-300 hover:text-brand-400 transition-colors cursor-pointer"
          >
            {uploading ? (
              <Loader2 size={20} className="animate-spin text-brand-500" />
            ) : (
              <>
                <Plus size={20} />
                <span className="text-[10px] font-medium">Add photo</span>
              </>
            )}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); }}
      />

      <p className="text-xs text-gray-400 mt-3">
        Up to {MAX_PHOTOS} photos · {photos.length}/{MAX_PHOTOS} uploaded.
        Show students what your space looks like — interior, food, atmosphere.
      </p>
    </div>
  );
}

// ── Business Hours Editor ──────────────────────────────────────────────────────

function HoursEditor({ hours, onChange }: { hours: BusinessHours; onChange: (h: BusinessHours) => void }) {
  const setDay = (key: string, patch: Partial<DayHours>) => {
    onChange({ ...hours, [key]: { ...hours[key], ...patch } });
  };

  const copyToAll = (srcKey: string) => {
    const src = hours[srcKey];
    const updated: BusinessHours = {};
    for (const d of DAYS_OF_WEEK) {
      updated[d.key] = { ...hours[d.key], from: src.from, to: src.to };
    }
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      {DAYS_OF_WEEK.map(({ key, label }) => {
        const day = hours[key] ?? { open: false, from: '09:00', to: '18:00' };
        return (
          <div
            key={key}
            className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
              day.open ? 'bg-vendor-50 border border-vendor-100' : 'bg-gray-50 border border-gray-100'
            }`}
          >
            {/* Toggle */}
            <button
              type="button"
              onClick={() => setDay(key, { open: !day.open })}
              className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
                day.open ? 'bg-vendor-600' : 'bg-gray-300'
              }`}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                day.open ? 'translate-x-5' : 'translate-x-0.5'
              }`} />
            </button>

            {/* Day label */}
            <span className={`text-sm font-semibold w-24 flex-shrink-0 ${day.open ? 'text-vendor-800' : 'text-gray-400'}`}>
              {label}
            </span>

            {/* Hours */}
            {day.open ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="time"
                  value={day.from}
                  onChange={(e) => setDay(key, { from: e.target.value })}
                  className="px-2.5 py-1.5 text-xs font-semibold border border-vendor-200 rounded-lg bg-white focus:outline-none focus:border-vendor-400 text-gray-800"
                />
                <span className="text-xs text-gray-400 font-medium">to</span>
                <input
                  type="time"
                  value={day.to}
                  onChange={(e) => setDay(key, { to: e.target.value })}
                  className="px-2.5 py-1.5 text-xs font-semibold border border-vendor-200 rounded-lg bg-white focus:outline-none focus:border-vendor-400 text-gray-800"
                />
                <button
                  type="button"
                  onClick={() => copyToAll(key)}
                  className="ml-auto text-[10px] text-vendor-600 font-semibold hover:underline whitespace-nowrap"
                  title="Copy these hours to all days"
                >
                  Copy to all
                </button>
              </div>
            ) : (
              <span className="text-xs text-gray-400 font-medium flex-1">Closed</span>
            )}
          </div>
        );
      })}
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

  // Core profile fields
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

  // Extended fields
  const [businessHours, setBusinessHours] = useState<BusinessHours>(DEFAULT_HOURS);
  const [galleryPhotos, setGalleryPhotos] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setUserId(user.id);

      const { data } = await supabase
        .from('vendor_profiles').select('*').eq('user_id', user.id).maybeSingle();

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

      // Load extended fields (graceful if columns don't exist yet)
      const anyData = data as any;
      if (anyData.business_hours && typeof anyData.business_hours === 'object') {
        setBusinessHours({ ...DEFAULT_HOURS, ...anyData.business_hours });
      }
      if (Array.isArray(anyData.gallery_photos)) {
        setGalleryPhotos(anyData.gallery_photos);
      }

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
    const payload: any = {
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
      country: country || 'HU',
      logo_url: logoUrl,
      cover_image_url: coverUrl,
      business_hours: businessHours,
      gallery_photos: galleryPhotos,
    };

    const { data: savedData, error } = await supabase
      .from('vendor_profiles')
      .upsert(payload, { onConflict: 'user_id' })
      .select()
      .maybeSingle();

    setSaving(false);
    if (error) { showFlash('error', error.message); return; }
    if (savedData) setVp(savedData as VendorProfile);
    showFlash('success', isNew ? 'Business profile created! You can now create offers.' : 'Profile updated successfully.');

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

  const plan = PLAN_INFO[(vp as any)?.plan_tier ?? 'free'] ?? PLAN_INFO.free;

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
                {(vp as any)?.is_verified ? (
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
                  <input type="tel" className={INPUT_CLS} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+36 1 234 5678" />
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
                  <input type="text" className={INPUT_CLS} value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} placeholder="Váci utca 1" />
                </Field>
                <Field label="Address line 2 (optional)">
                  <input type="text" className={INPUT_CLS} value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} placeholder="Ground floor" />
                </Field>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="City" hint="Stud Deals currently operates in Budapest and Szeged.">
                    <select className={INPUT_CLS} value={city} onChange={(e) => setCity(e.target.value)}>
                      <option value="">Select city…</option>
                      <option value="Budapest">Budapest</option>
                      <option value="Szeged">Szeged</option>
                    </select>
                  </Field>
                  <Field label="District / Area">
                    <input type="text" className={INPUT_CLS} value={state} onChange={(e) => setState(e.target.value)} placeholder="e.g. District V" />
                  </Field>
                  <Field label="Postal code">
                    <input type="text" className={INPUT_CLS} value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="1051" />
                  </Field>
                  <Field label="Country">
                    <select className={INPUT_CLS} value={country} onChange={(e) => setCountry(e.target.value)}>
                      <option value="HU">🇭🇺 Hungary</option>
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

            {/* 4. Brand media */}
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

            {/* 5. Business hours */}
            <Section title="Business hours" icon={<Clock size={14} />}>
              <p className="text-xs text-gray-500 mb-4">
                Students see your opening hours on your business profile. Toggle each day open/closed and set your hours.
              </p>
              <HoursEditor hours={businessHours} onChange={setBusinessHours} />
              <div className="mt-4 flex items-center gap-2 p-3 bg-blue-50 rounded-xl border border-blue-100">
                <CheckCircle size={13} className="text-blue-500 flex-shrink-0" />
                <p className="text-xs text-blue-700">
                  Open today:{' '}
                  <strong>
                    {(() => {
                      const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
                      const d = businessHours[today];
                      if (!d?.open) return 'Closed';
                      return `${d.from} – ${d.to}`;
                    })()}
                  </strong>
                </p>
              </div>
            </Section>

            {/* 6. Photo gallery */}
            <Section title="Photo gallery" icon={<ImageIcon size={14} />}>
              <p className="text-xs text-gray-500 mb-4">
                Showcase your space, food, and atmosphere. Photos are shown on your public business profile to attract students.
              </p>
              <GalleryUploader
                photos={galleryPhotos}
                vendorId={vp?.id ?? null}
                onPhotosChange={setGalleryPhotos}
              />
            </Section>

            {/* 7. Plan & billing */}
            <Section title="Plan & billing" icon={<Star size={14} />}>
              <div className="flex items-start justify-between gap-4 mb-5">
                <div>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${plan.color}`}>
                    {plan.label} plan
                  </span>
                  {(vp as any)?.plan_expires_at && (
                    <p className="text-xs text-gray-400 mt-1.5">
                      Renews {new Date((vp as any).plan_expires_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
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

            {/* 8. Danger zone */}
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
