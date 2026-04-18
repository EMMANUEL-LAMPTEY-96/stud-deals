'use client';

// =============================================================================
// app/sign-up/page.tsx — Role picker
// =============================================================================

import Link from 'next/link';
import { GraduationCap, Store, ArrowRight, CheckCircle } from 'lucide-react';

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-[#0f0b2e] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <span className="text-white font-bold text-xl">Stud-deals</span>
          </Link>
          <h1 className="text-3xl font-bold text-white">Create your account</h1>
          <p className="text-purple-300 mt-2">Who are you joining as?</p>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          {/* Student card */}
          <Link
            href="/sign-up/student"
            className="group bg-white/5 hover:bg-purple-600/20 border border-white/10 hover:border-purple-500 rounded-2xl p-8 transition-all"
          >
            <div className="w-14 h-14 bg-purple-600/30 group-hover:bg-purple-600 rounded-2xl flex items-center justify-center mb-5 transition-colors">
              <GraduationCap className="w-8 h-8 text-purple-300 group-hover:text-white" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">I&apos;m a Student</h2>
            <p className="text-purple-300 text-sm mb-5">
              Access exclusive verified student discounts from local businesses near your campus.
            </p>
            <ul className="space-y-2 mb-6">
              {['Free to join', 'QR voucher redemptions', 'Verified student badge', 'Save your favourite deals'].map(item => (
                <li key={item} className="flex items-center gap-2 text-sm text-purple-200">
                  <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-2 text-purple-400 group-hover:text-white font-medium transition-colors">
              Join as a student <ArrowRight className="w-4 h-4" />
            </div>
          </Link>

          {/* Vendor card */}
          <Link
            href="/sign-up/vendor"
            className="group bg-white/5 hover:bg-blue-600/20 border border-white/10 hover:border-blue-500 rounded-2xl p-8 transition-all"
          >
            <div className="w-14 h-14 bg-blue-600/30 group-hover:bg-blue-600 rounded-2xl flex items-center justify-center mb-5 transition-colors">
              <Store className="w-8 h-8 text-blue-300 group-hover:text-white" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">I&apos;m a Business</h2>
            <p className="text-purple-300 text-sm mb-5">
              Reach thousands of verified students near your location with targeted discount offers.
            </p>
            <ul className="space-y-2 mb-6">
              {['Free to list', 'QR code verification', 'Real-time analytics', 'Student audience insights'].map(item => (
                <li key={item} className="flex items-center gap-2 text-sm text-purple-200">
                  <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-2 text-blue-400 group-hover:text-white font-medium transition-colors">
              Join as a business <ArrowRight className="w-4 h-4" />
            </div>
          </Link>
        </div>

        <p className="text-center text-purple-300 mt-8">
          Already have an account?{' '}
          <Link href="/sign-in" className="text-purple-400 hover:text-white font-medium transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
