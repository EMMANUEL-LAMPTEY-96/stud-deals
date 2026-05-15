'use client';
// Small client component for the copy-URL share button on the public vendor profile.
import { useState } from 'react';
import { Share2, Copy, Check } from 'lucide-react';

export default function ShareButton() {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard not available — silently ignore
    }
  };

  return (
    <button
      onClick={handleShare}
      className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
    >
      {copied ? <Check size={15} className="text-green-500" /> : <Share2 size={15} />}
      {copied ? 'Copied!' : 'Share'}
    </button>
  );
}
