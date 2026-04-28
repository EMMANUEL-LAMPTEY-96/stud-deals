'use client';

// =============================================================================
// app/sign-up/page.tsx — Role picker
// Clean white card layout. Student vs Business.
// =============================================================================

import Link from 'next/link';
import { GraduationCap, Store, ArrowRight, CheckCircle, Zap, BarChart2 } from 'lucide-react';

const STUDENT_PERKS = ['Free forever', 'QR code vouchers', 'Verified student badge', 'Save favourite deals'];
const VENDOR_PERKS  = ['Free to list', 'Real-time analytics', 'QR redemption tracking', 'Student audience insights'];

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">

      {/* Logo */}
      <Link href="/" className="inline-flex items-center gap-2.5 mb-10">
        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl flex items-center justify-center shadow-sm">
          <GraduationCap className="w-5 h-5 text-white" />
        </div>
        <span className="text-gray-900 font-bold text-xl">Stud<span className="text-purple-600">Deals</span></span>
      </Link>

      <div className="text-center mb-8">
        <h1 className="text-3xl font-black text-gray-900 mb-2">Create your account</h1>
        <p className="text-gray-500">Who are you signing up as?</p>
      </div>

      <div className="grid md:grid-cols-2 gap-5 w-full max-w-2xl">

        {/* Student card */}
        <Link href="/sign-up/student"
          className="group bg-white border-2 border-gray-100 hover:border-purple-400 rounded-2xl p-8 transition-all hover:shadow-lg hover:shadow-purple-100 flex flex-col">
          <div className="w-12 h-12 bg-purple-100 group-hover:bg-purple-600 rounded-2xl flex items-center justify-center mb-5 transition-colors">
            <GraduationCap className="w-6 h-6 text-purple-600 group-hover:text-white transition-colors" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">I&apos;m a Student</h2>
          <p className="text-gray-500 text-sm mb-5 leading-relaxed">
            Access exclusive verified student discounts from local businesses near you.
          </p>
          <ul className="space-y-2 mb-6 flex-1">
            {STUDENT_PERKS.map(item => (
              <li key={item} className="flex items-center gap-2 text-sm text-gray-600">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1 text-xs font-medium bg-green-100 text-green-700 px-2.5 py-1 rounded-full">
              <Zap className="w-3 h-3" /> Free forever
            </span>
            <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
          </div>
        </Link>

        {/* Business card */}
        <Link href="/sign-up/vendor"
          className="group bg-white border-2 border-gray-100 hover:border-blue-400 rounded-2xl p-8 transition-all hover:shadow-lg hover:shadow-blue-100 flex flex-col">
          <div className="w-12 h-12 bg-blue-100 group-hover:bg-blue-600 rounded-2xl flex items-center justify-center mb-5 transition-colors">
            <Store className="w-6 h-6 text-blue-600 group-hover:text-white transition-colors" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">I&apos;m a Business</h2>
          <p className="text-gray-500 text-sm mb-5 leading-relaxed">
            Reach thousands of verified students near your location with targeted discount offers.
          </p>
          <ul className="space-y-2 mb-6 flex-1">
            {VENDOR_PERKS.map(item => (
              <li key={item} className="flex items-center gap-2 text-sm text-gray-600">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1 text-xs font-medium bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full">
              <BarChart2 className="w-3 h-3" /> Real-time analytics
            </span>
            <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
          </div>
        </Link>
      </div>

      <p className="text-center text-sm text-gray-500 mt-8">
        Already have an account?{' '}
        <Link href="/login" className="text-purple-600 hover:text-purple-700 font-semibold">Sign in</Link>
      </p>
    </div>
  );
}
