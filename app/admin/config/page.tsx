'use client';

// =============================================================================
// /admin/config — Platform Configuration
// Toggle switches for city activation, maintenance mode, feature flags.
// =============================================================================

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import AdminNav from '@/components/admin/AdminNav';
import {
  Settings, Loader2, RefreshCw, CheckCircle, AlertTriangle,
  MapPin, Users, Store, Wrench, Tag,
} from 'lucide-react';

interface ConfigRow {
  key: string;
  value: unknown;
  updated_at: string;
}

const CONFIG_META: Record<string, {
  label: string;
  desc: string;
  type: 'toggle' | 'number';
  icon: React.ReactNode;
  group: string;
  danger?: boolean;
}> = {
  city_budapest_enabled:      { label: 'Budapest enabled',         desc: 'Allow students and vendors to register with Budapest as their city.',   type: 'toggle', icon: <MapPin   size={14} />, group: 'Cities' },
  city_szeged_enabled:        { label: 'Szeged enabled',           desc: 'Allow students and vendors to register with Szeged as their city.',     type: 'toggle', icon: <MapPin   size={14} />, group: 'Cities' },
  maintenance_mode:           { label: 'Maintenance mode',         desc: 'When ON, the platform shows a maintenance banner. Use before migrations.', type: 'toggle', icon: <Wrench   size={14} />, group: 'Platform', danger: true },
  new_registrations_open:     { label: 'New registrations open',   desc: 'Allow new students and vendors to create accounts.',                    type: 'toggle', icon: <Users    size={14} />, group: 'Platform' },
  vendor_self_signup_enabled: { label: 'Vendor self-signup',       desc: 'Allow vendors to sign up without an invite code.',                      type: 'toggle', icon: <Store    size={14} />, group: 'Platform' },
  max_offers_per_vendor:      { label: 'Max offers per vendor',    desc: 'Maximum number of active offers a vendor can have simultaneously.',     type: 'number', icon: <Tag      size={14} />, group: 'Limits' },
  stamp_cooldown_minutes:     { label: 'Stamp cooldown (minutes)', desc: 'Minimum minutes between stamps from the same student at the same vendor.', type: 'number', icon: <Settings size={14} />, group: 'Limits' },
};

const GROUPS = ['Cities', 'Platform', 'Limits'];

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${
        checked ? 'bg-purple-600' : 'bg-gray-200'
      } disabled:opacity-50`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

export default function AdminConfigPage() {
  const router = useRouter();
  const [config, setConfig]   = useState<ConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState<string | null>(null);
  const [flash, setFlash]     = useState<{ key: string; ok: boolean } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push('/sign-in');
    });
  }, [router]);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/admin/config');
      const data = await res.json();
      setConfig(data.rows ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConfig(); }, []);

  const updateConfig = async (key: string, value: unknown) => {
    setSaving(key);
    try {
      const res = await fetch('/api/admin/config', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ key, value }),
      });
      const ok = res.ok;
      setFlash({ key, ok });
      setTimeout(() => setFlash(null), 2000);
      if (ok) {
        setConfig((prev) =>
          prev.map((r) => r.key === key ? { ...r, value } : r)
        );
      }
    } finally {
      setSaving(null);
    }
  };

  const configMap = Object.fromEntries(config.map((r) => [r.key, r.value]));

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav active="/admin/config" />

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
              <Settings size={22} className="text-purple-600" />
              Platform Config
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Toggle features and limits. Changes take effect immediately.
            </p>
          </div>
          <button onClick={fetchConfig} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={28} className="animate-spin text-purple-400" />
          </div>
        ) : (
          <div className="space-y-6">
            {GROUPS.map((group) => {
              const keys = Object.entries(CONFIG_META)
                .filter(([, meta]) => meta.group === group)
                .map(([k]) => k);

              return (
                <div key={group} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                    <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide">{group}</h2>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {keys.map((key) => {
                      const meta = CONFIG_META[key];
                      const val  = configMap[key];
                      const isSaving = saving === key;
                      const isFlash  = flash?.key === key;

                      return (
                        <div key={key} className={`flex items-center gap-4 px-5 py-4 ${meta.danger && val === true ? 'bg-red-50' : ''}`}>
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            meta.danger ? 'bg-red-100 text-red-600' : 'bg-purple-100 text-purple-600'
                          }`}>
                            {meta.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-gray-800">{meta.label}</p>
                              {meta.danger && val === true && (
                                <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-semibold">Active</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">{meta.desc}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {isFlash && (
                              flash.ok
                                ? <CheckCircle size={14} className="text-green-500" />
                                : <AlertTriangle size={14} className="text-red-500" />
                            )}
                            {isSaving && <Loader2 size={14} className="animate-spin text-gray-400" />}
                            {meta.type === 'toggle' ? (
                              <Toggle
                                checked={val === true}
                                onChange={(v) => updateConfig(key, v)}
                                disabled={isSaving}
                              />
                            ) : (
                              <input
                                type="number"
                                value={typeof val === 'number' ? val : Number(val)}
                                min={1}
                                onBlur={(e) => {
                                  const n = parseInt(e.target.value, 10);
                                  if (!isNaN(n) && n > 0) updateConfig(key, n);
                                }}
                                onChange={(e) => {
                                  const n = parseInt(e.target.value, 10);
                                  if (!isNaN(n)) setConfig((prev) => prev.map((r) => r.key === key ? { ...r, value: n } : r));
                                }}
                                className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-purple-200"
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Unknown / custom keys from DB */}
            {config.filter((r) => !CONFIG_META[r.key]).length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                  <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Other</h2>
                </div>
                <div className="divide-y divide-gray-50">
                  {config.filter((r) => !CONFIG_META[r.key]).map((r) => (
                    <div key={r.key} className="flex items-center justify-between px-5 py-3">
                      <span className="text-sm font-mono text-gray-600">{r.key}</span>
                      <span className="text-xs text-gray-400 bg-gray-50 rounded px-2 py-1">{JSON.stringify(r.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
