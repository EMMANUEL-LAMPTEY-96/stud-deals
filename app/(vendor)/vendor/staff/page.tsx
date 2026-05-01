'use client';

// =============================================================================
// app/(vendor)/vendor/staff/page.tsx — Staff Account Manager
//
// Lets vendors manage staff PIN codes for the scan-only interface.
// Staff PINs stored in vendor_profiles.staff_pins JSONB array:
//   [{ id: uuid, name: string, pin: string, role: "scanner", active: boolean, created_at: string }]
//
// Schema migration (run once):
//   ALTER TABLE vendor_profiles ADD COLUMN IF NOT EXISTS staff_pins jsonb DEFAULT '[]';
//
// The /vendor/scan page uses these PINs to grant scan-only access.
// Staff see only: QR scanner + reward claim UI — no analytics, offers, customers.
// =============================================================================

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/shared/Navbar';
import VendorNav from '@/components/vendor/VendorNav';
import {
  Users, Plus, Trash2, Eye, EyeOff, CheckCircle, AlertCircle,
  Loader2, Shield, QrCode, X, Copy, RefreshCw, User,
  ArrowRight, Lock,
} from 'lucide-react';

interface StaffMember {
  id: string;
  name: string;
  pin: string;
  role: string;
  active: boolean;
  created_at: string;
}

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

function StaffRow({
  member,
  onDelete,
  onToggle,
}: {
  member: StaffMember;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  const [showPin, setShowPin] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyPin = () => {
    navigator.clipboard.writeText(member.pin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${
      member.active ? 'bg-white border-gray-100' : 'bg-gray-50 border-gray-100 opacity-60'
    }`}>
      {/* Avatar */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm ${
        member.active ? 'bg-vendor-100 text-vendor-700' : 'bg-gray-200 text-gray-500'
      }`}>
        {member.name.slice(0, 2).toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-gray-900">{member.name}</p>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            member.active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
          }`}>
            {member.active ? 'Active' : 'Inactive'}
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">
          Scanner · Added {new Date(member.created_at).toLocaleDateString('hu-HU', { day: 'numeric', month: 'short' })}
        </p>
      </div>

      {/* PIN display */}
      <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
        <Lock size={12} className="text-gray-400" />
        <span className="text-sm font-mono font-bold text-gray-800 tracking-widest min-w-[40px]">
          {showPin ? member.pin : '••••'}
        </span>
        <button onClick={() => setShowPin(v => !v)} className="text-gray-400 hover:text-gray-600">
          {showPin ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
        <button onClick={copyPin} className={`text-gray-400 hover:text-gray-600 transition-colors ${copied ? 'text-green-500' : ''}`}>
          {copied ? <CheckCircle size={13} /> : <Copy size={13} />}
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => onToggle(member.id)}
          className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors text-xs font-semibold"
          title={member.active ? 'Deactivate' : 'Activate'}
        >
          {member.active ? <X size={14} /> : <CheckCircle size={14} />}
        </button>
        <button
          onClick={() => onDelete(member.id)}
          className="p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
          title="Remove staff member"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

export default function StaffPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [vendorId, setVendorId]   = useState<string | null>(null);
  const [businessName, setBN]     = useState('');
  const [staff, setStaff]         = useState<StaffMember[]>([]);
  const [toast, setToast]         = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  // Add form
  const [showForm, setShowForm]   = useState(false);
  const [newName, setNewName]     = useState('');
  const [newPin, setNewPin]       = useState('');
  const [pinError, setPinError]   = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login?role=vendor'); return; }
      const { data: vp } = await supabase
        .from('vendor_profiles')
        .select('id, business_name, staff_pins')
        .eq('user_id', user.id)
        .single();
      if (!vp) { router.push('/vendor/profile'); return; }

      setVendorId(vp.id);
      setBN(vp.business_name);
      const pins = (vp as any).staff_pins;
      setStaff(Array.isArray(pins) ? pins : []);
      setLoading(false);
    })();
  }, []);

  const showToast = (type: 'ok' | 'err', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const persist = async (updated: StaffMember[]) => {
    if (!vendorId) return;
    setSaving(true);
    const { error } = await supabase
      .from('vendor_profiles')
      .update({ staff_pins: updated } as any)
      .eq('id', vendorId);
    setSaving(false);
    if (error) showToast('err', error.message);
    else setStaff(updated);
  };

  const handleAdd = async () => {
    setPinError('');
    if (!newName.trim()) { setPinError('Staff name is required.'); return; }
    if (!/^\d{4}$/.test(newPin)) { setPinError('PIN must be exactly 4 digits.'); return; }
    if (staff.some(s => s.pin === newPin)) { setPinError('That PIN is already in use. Choose another.'); return; }

    const member: StaffMember = {
      id: randomId(),
      name: newName.trim(),
      pin: newPin,
      role: 'scanner',
      active: true,
      created_at: new Date().toISOString(),
    };

    await persist([...staff, member]);
    setNewName('');
    setNewPin('');
    setShowForm(false);
    showToast('ok', `${member.name} added. Share PIN: ${member.pin}`);
  };

  const handleDelete = async (id: string) => {
    const name = staff.find(s => s.id === id)?.name ?? 'Staff member';
    if (!confirm(`Remove ${name}? They will immediately lose scan access.`)) return;
    await persist(staff.filter(s => s.id !== id));
    showToast('ok', `${name} removed.`);
  };

  const handleToggle = async (id: string) => {
    await persist(staff.map(s => s.id === id ? { ...s, active: !s.active } : s));
  };

  const generatePin = () => {
    const pin = String(Math.floor(1000 + Math.random() * 9000));
    setNewPin(pin);
    setPinError('');
  };

  const scanUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/vendor/scan`
    : '/vendor/scan';

  if (loading) return (
    <><Navbar /><VendorNav />
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-vendor-600" />
      </div>
    </>
  );

  const activeCount = staff.filter(s => s.active).length;

  return (
    <>
      <Navbar />
      <VendorNav />

      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold ${
          toast.type === 'ok' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'ok' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-7">
            <div>
              <h1 className="text-2xl font-black text-gray-900">Staff Access</h1>
              <p className="text-gray-500 text-sm mt-0.5">
                {businessName} · {activeCount} active staff member{activeCount !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={() => setShowForm(v => !v)}
              className="btn-vendor flex-shrink-0"
            >
              <Plus size={15} />
              Add staff
            </button>
          </div>

          {/* How it works banner */}
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3 mb-6">
            <Shield size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-blue-900 mb-1">How staff access works</p>
              <p className="text-xs text-blue-700 leading-relaxed">
                Staff open <strong className="font-bold">/vendor/scan</strong> on any device and enter their 4-digit PIN.
                They get access to the QR scanner and reward claim — but not analytics, offers, or customer data.
                The owner account is always separate and fully protected.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="text-xs bg-white border border-blue-200 rounded px-2 py-1 text-blue-800 font-mono">
                  {scanUrl}
                </code>
                <button
                  onClick={() => { navigator.clipboard.writeText(scanUrl); showToast('ok', 'Scan URL copied!'); }}
                  className="text-blue-500 hover:text-blue-700"
                >
                  <Copy size={13} />
                </button>
              </div>
            </div>
          </div>

          {/* Add staff form */}
          {showForm && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5">
              <h2 className="text-sm font-bold text-gray-900 mb-4">Add new staff member</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Staff name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="e.g. Alice, Counter Staff"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-vendor-400 focus:ring-2 focus:ring-vendor-100 transition-colors"
                    maxLength={40}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">4-digit PIN</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newPin}
                      onChange={e => {
                        const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                        setNewPin(v);
                        setPinError('');
                      }}
                      placeholder="1234"
                      maxLength={4}
                      className="flex-1 px-3.5 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-vendor-400 focus:ring-2 focus:ring-vendor-100 transition-colors font-mono tracking-widest text-center text-lg"
                    />
                    <button
                      type="button"
                      onClick={generatePin}
                      className="px-3.5 py-2.5 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 text-sm font-semibold flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <RefreshCw size={13} />
                      Generate
                    </button>
                  </div>
                  {pinError && (
                    <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                      <AlertCircle size={11} /> {pinError}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">Share this PIN with your staff member. They use it on the scan page.</p>
                </div>
              </div>

              <div className="flex gap-2 mt-5">
                <button
                  onClick={handleAdd}
                  disabled={saving}
                  className="btn-vendor flex-1"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Add staff member
                </button>
                <button
                  onClick={() => { setShowForm(false); setNewName(''); setNewPin(''); setPinError(''); }}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Staff list */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {staff.length === 0 ? (
              <div className="p-10 text-center">
                <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <Users size={24} className="text-gray-400" />
                </div>
                <p className="text-sm font-bold text-gray-700 mb-1">No staff yet</p>
                <p className="text-xs text-gray-400 mb-4">
                  Add staff members so they can scan student QR codes without needing your login.
                </p>
                <button onClick={() => setShowForm(true)} className="btn-vendor text-sm">
                  <Plus size={14} /> Add first staff member
                </button>
              </div>
            ) : (
              <div className="p-4 space-y-2">
                {staff.map(m => (
                  <StaffRow
                    key={m.id}
                    member={m}
                    onDelete={handleDelete}
                    onToggle={handleToggle}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Go to scan page */}
          {staff.length > 0 && (
            <a
              href="/vendor/scan"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 flex items-center justify-between p-4 bg-vendor-600 text-white rounded-2xl hover:bg-vendor-700 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <QrCode size={20} className="opacity-80" />
                <div>
                  <p className="text-sm font-bold">Open scan page</p>
                  <p className="text-xs text-white/70">Share this URL with counter staff</p>
                </div>
              </div>
              <ArrowRight size={18} className="opacity-70 group-hover:translate-x-1 transition-transform" />
            </a>
          )}

        </div>
      </div>
    </>
  );
}
