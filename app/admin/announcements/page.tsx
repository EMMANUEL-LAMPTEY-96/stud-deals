'use client';

// =============================================================================
// /admin/announcements — Send platform-wide notifications
// Admin composes a message, picks a target audience, and sends.
// Messages appear as in-app notifications for each recipient.
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import AdminNav from '@/components/admin/AdminNav';
import {
  Megaphone, Send, Loader2, Users, GraduationCap, Store,
  CheckCircle, AlertTriangle,
} from 'lucide-react';

type Target = 'all' | 'student' | 'vendor';

const TARGET_OPTIONS: { value: Target; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'all',     label: 'Everyone',       icon: <Users        size={16} />, desc: 'All students and vendors' },
  { value: 'student', label: 'Students only',  icon: <GraduationCap size={16} />, desc: 'All verified and unverified students' },
  { value: 'vendor',  label: 'Vendors only',   icon: <Store        size={16} />, desc: 'All registered vendors' },
];

const MAX_TITLE   = 80;
const MAX_MESSAGE = 500;

export default function AdminAnnouncementsPage() {
  const router = useRouter();
  const [title, setTitle]       = useState('');
  const [message, setMessage]   = useState('');
  const [target, setTarget]     = useState<Target>('all');
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [sending, setSending]   = useState(false);
  const [success, setSuccess]   = useState<{ sent: number } | null>(null);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push('/sign-in');
    });
  }, [router]);

  const fetchCount = useCallback(async () => {
    const res  = await fetch(`/api/admin/announcements?target=${target}`);
    const data = await res.json();
    setRecipientCount(data.recipient_count ?? null);
  }, [target]);

  useEffect(() => { fetchCount(); }, [fetchCount]);

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) return;
    setSending(true);
    setError(null);
    setSuccess(null);
    try {
      const res  = await fetch('/api/admin/announcements', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ title: title.trim(), message: message.trim(), target }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to send announcement.');
      } else {
        setSuccess({ sent: data.sent });
        setTitle('');
        setMessage('');
      }
    } catch (e) {
      setError('Network error. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const ready = title.trim().length > 0 && message.trim().length > 0 && !sending;

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav active="/admin/announcements" />

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <Megaphone size={22} className="text-purple-600" />
            Announcements
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Send a platform-wide in-app notification to students and/or vendors.
          </p>
        </div>

        {/* Success */}
        {success && (
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl px-4 py-3 mb-5">
            <CheckCircle size={18} className="text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-800">Announcement sent!</p>
              <p className="text-xs text-green-600">{success.sent} notifications delivered.</p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-5">
            <AlertTriangle size={18} className="text-red-500 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">

          {/* Audience */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Audience
            </label>
            <div className="grid grid-cols-3 gap-2">
              {TARGET_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTarget(opt.value)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-center transition-colors ${
                    target === opt.value
                      ? 'border-purple-500 bg-purple-50 text-purple-700'
                      : 'border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {opt.icon}
                  <span className="text-xs font-semibold">{opt.label}</span>
                  <span className="text-xs text-gray-400">{opt.desc}</span>
                </button>
              ))}
            </div>
            {recipientCount !== null && (
              <p className="text-xs text-gray-400 mt-2">
                <strong className="text-gray-700">{recipientCount.toLocaleString()}</strong> recipient{recipientCount !== 1 ? 's' : ''} will receive this notification.
              </p>
            )}
          </div>

          {/* Title */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Title
              </label>
              <span className={`text-xs ${title.length > MAX_TITLE * 0.9 ? 'text-orange-500' : 'text-gray-300'}`}>
                {title.length}/{MAX_TITLE}
              </span>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE))}
              placeholder="e.g. Platform maintenance tonight at 23:00"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-300"
            />
          </div>

          {/* Message */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Message
              </label>
              <span className={`text-xs ${message.length > MAX_MESSAGE * 0.9 ? 'text-orange-500' : 'text-gray-300'}`}>
                {message.length}/{MAX_MESSAGE}
              </span>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE))}
              placeholder="Write the announcement body here…"
              rows={5}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-300 resize-none"
            />
          </div>

          {/* Preview */}
          {(title || message) && (
            <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
              <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Preview</p>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                  <Megaphone size={14} className="text-purple-600" />
                </div>
                <div>
                  {title && <p className="text-sm font-bold text-gray-900">{title}</p>}
                  {message && <p className="text-sm text-gray-600 mt-0.5 leading-relaxed">{message}</p>}
                  <p className="text-xs text-gray-400 mt-1">Just now</p>
                </div>
              </div>
            </div>
          )}

          {/* Send */}
          <button
            onClick={handleSend}
            disabled={!ready}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-purple-600 text-white font-bold text-sm hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending
              ? <><Loader2 size={16} className="animate-spin" /> Sending…</>
              : <><Send size={16} /> Send to {recipientCount != null ? recipientCount.toLocaleString() : '…'} {target === 'all' ? 'users' : target === 'student' ? 'students' : 'vendors'}</>
            }
          </button>

        </div>

        <p className="text-xs text-gray-400 text-center mt-4">
          Announcements appear as in-app notifications. Recipients cannot reply.
        </p>
      </div>
    </div>
  );
}
