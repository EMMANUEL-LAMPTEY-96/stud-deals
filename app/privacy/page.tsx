'use client';

// =============================================================================
// app/privacy/page.tsx — Privacy Policy
//
// GDPR-compliant privacy policy page linked from the cookie consent banner.
// Legal basis: GDPR (EU) 2016/679 · ePrivacy Directive
// Data residency: Supabase eu-west-1 (Ireland)
// =============================================================================

import Link from 'next/link';
import { Shield, ArrowLeft, Mail, Database, Lock, Trash2, Eye, FileText } from 'lucide-react';

export default function PrivacyPage() {
  const sections = [
    {
      icon: Database,
      title: '1. Who We Are',
      content: (
        <>
          <p>
            Studeals ("we", "us", "our") is a student discount marketplace operated as a service
            for verified university students and local businesses. Our live platform is available at{' '}
            <a href="https://studeals.vercel.app" className="text-brand-600 underline">
              studeals.vercel.app
            </a>
            .
          </p>
          <p className="mt-3">
            For privacy-related enquiries, contact us at:{' '}
            <a href="mailto:privacy@studeals.app" className="text-brand-600 underline">
              privacy@studeals.app
            </a>
          </p>
        </>
      ),
    },
    {
      icon: FileText,
      title: '2. What Data We Collect',
      content: (
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-gray-800 mb-1">Account Data</h3>
            <ul className="list-disc ml-5 space-y-1 text-gray-600">
              <li>Email address (required for authentication)</li>
              <li>First name, last name, display name (optional)</li>
              <li>Profile photo (optional)</li>
              <li>Phone number and location (optional)</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 mb-1">Student Verification Data</h3>
            <ul className="list-disc ml-5 space-y-1 text-gray-600">
              <li>Student email address (for .edu / university domain verification)</li>
              <li>Student ID number (optional, for document-based verification)</li>
              <li>Photo of student ID card (uploaded only for document review; reviewed by admin and not shared)</li>
              <li>Graduation year and major (optional)</li>
              <li>University / institution affiliation</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 mb-1">Usage Data</h3>
            <ul className="list-disc ml-5 space-y-1 text-gray-600">
              <li>Offers viewed, saved, and redeemed</li>
              <li>QR voucher redemption records (vendor-side confirmation)</li>
              <li>Loyalty stamp history</li>
              <li>Savings accumulated (estimated transaction values)</li>
              <li>Device type (mobile / tablet / desktop) — collected at voucher claim time</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 mb-1">Cookies & Technical Data</h3>
            <ul className="list-disc ml-5 space-y-1 text-gray-600">
              <li>Session cookies (required to keep you logged in)</li>
              <li>Cookie consent preference (stored in your browser)</li>
              <li>Anonymous page-view counts (analytics only, if you accept optional cookies)</li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      icon: Lock,
      title: '3. Legal Basis & How We Use Your Data',
      content: (
        <div className="space-y-3">
          {[
            {
              basis: 'Contract performance (Art. 6(1)(b))',
              uses: 'Account creation, authentication, displaying offers relevant to your institution, processing voucher redemptions.',
            },
            {
              basis: 'Legitimate interests (Art. 6(1)(f))',
              uses: 'Platform security, fraud prevention, abuse detection, aggregate analytics to improve the service.',
            },
            {
              basis: 'Consent (Art. 6(1)(a))',
              uses: 'Optional analytics cookies, marketing notifications (only if you opt in). You may withdraw consent at any time.',
            },
            {
              basis: 'Legal obligation (Art. 6(1)(c))',
              uses: 'Retaining transaction records as required by applicable tax and consumer-protection law.',
            },
          ].map(({ basis, uses }) => (
            <div key={basis} className="bg-gray-50 rounded-xl p-4">
              <p className="font-semibold text-gray-800 text-sm">{basis}</p>
              <p className="text-gray-600 text-sm mt-1">{uses}</p>
            </div>
          ))}
        </div>
      ),
    },
    {
      icon: Database,
      title: '4. Where Your Data Is Stored',
      content: (
        <>
          <p>
            All personal data is stored on{' '}
            <strong>Supabase servers located in Ireland (eu-west-1)</strong>, within the European
            Union. This means your data is subject to GDPR protections at all times and is never
            transferred outside the EU/EEA without appropriate safeguards.
          </p>
          <p className="mt-3">
            Supabase acts as our data processor under a Data Processing Agreement (DPA). Their
            security practices, including encryption at rest and in transit, are described at{' '}
            <a
              href="https://supabase.com/security"
              className="text-brand-600 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              supabase.com/security
            </a>
            .
          </p>
          <p className="mt-3">
            The platform is hosted on <strong>Vercel</strong> (edge functions and CDN). Vercel
            stores no personal data — only your browser communicates with our Supabase database for
            any data that identifies you.
          </p>
        </>
      ),
    },
    {
      icon: Eye,
      title: '5. Who We Share Your Data With',
      content: (
        <>
          <p>We <strong>do not sell your personal data</strong>. We do not run advertising trackers.</p>
          <div className="mt-3 space-y-2">
            {[
              { party: 'Vendors (businesses on the platform)', scope: 'When you redeem a voucher, the vendor sees your display name only (e.g., "Emmanuel A.") — not your full name, email, or ID.' },
              { party: 'Supabase (data processor)', scope: 'Database storage and authentication. EU/Ireland servers only.' },
              { party: 'Vercel (infrastructure processor)', scope: 'Web hosting and serverless function execution. No personal data stored.' },
              { party: 'Admins', scope: 'Studeals staff may access your data to resolve support issues or review student ID documents for verification.' },
            ].map(({ party, scope }) => (
              <div key={party} className="flex gap-3">
                <span className="text-brand-600 font-bold text-sm min-w-fit">•</span>
                <span className="text-gray-600 text-sm">
                  <strong>{party}:</strong> {scope}
                </span>
              </div>
            ))}
          </div>
        </>
      ),
    },
    {
      icon: Shield,
      title: '6. Your Rights Under GDPR',
      content: (
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { right: 'Right of Access (Art. 15)', desc: 'Request a copy of all personal data we hold about you.' },
            { right: 'Right to Rectification (Art. 16)', desc: 'Correct inaccurate or incomplete data in your Account Settings.' },
            { right: 'Right to Erasure (Art. 17)', desc: 'Delete your account and all associated data from Account Settings → Delete Account.' },
            { right: 'Right to Portability (Art. 20)', desc: 'Export your redemption history and savings data from Account Settings.' },
            { right: 'Right to Restriction (Art. 18)', desc: 'Ask us to pause processing your data in certain circumstances.' },
            { right: 'Right to Object (Art. 21)', desc: 'Object to processing based on legitimate interests at any time.' },
            { right: 'Right to Withdraw Consent', desc: 'Decline or withdraw optional cookie consent at any time via the cookie banner.' },
            { right: 'Right to Lodge a Complaint', desc: 'You may lodge a complaint with the Hungarian NAIH (naih.hu) or your local DPA.' },
          ].map(({ right, desc }) => (
            <div key={right} className="bg-blue-50 rounded-xl p-3">
              <p className="font-semibold text-blue-800 text-sm">{right}</p>
              <p className="text-gray-600 text-xs mt-1">{desc}</p>
            </div>
          ))}
        </div>
      ),
    },
    {
      icon: Trash2,
      title: '7. Data Retention',
      content: (
        <div className="space-y-2">
          {[
            { type: 'Active account data', period: 'Retained while your account exists.' },
            { type: 'Redemption & stamp records', period: 'Retained for 3 years after the transaction date (financial records requirement).' },
            { type: 'Student verification documents (ID photos)', period: 'Deleted within 30 days of verification decision (approved or rejected).' },
            { type: 'Deleted account data', period: 'Permanently erased within 30 days of account deletion request.' },
            { type: 'Analytics data', period: 'Aggregated and anonymised after 12 months. No individual-level retention beyond that.' },
          ].map(({ type, period }) => (
            <div key={type} className="flex gap-3 py-2 border-b border-gray-100 last:border-0">
              <span className="font-semibold text-gray-800 text-sm w-56 shrink-0">{type}</span>
              <span className="text-gray-600 text-sm">{period}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      icon: Lock,
      title: '8. Cookies',
      content: (
        <div className="space-y-3">
          <p>We use three categories of cookies:</p>
          {[
            {
              name: '✅ Essential cookies (always active)',
              desc: 'Required for the platform to function. Includes your login session token and security tokens. These cannot be declined — without them the app cannot identify you.',
            },
            {
              name: '📊 Analytics cookies (optional)',
              desc: 'Anonymous page-view counts to help us understand which features students use. No personal data is included. You can accept or decline these via the cookie banner.',
            },
            {
              name: '🔔 Preference cookies (optional)',
              desc: 'Stores your UI preferences (e.g., HUF vs EUR toggle). Purely local to your browser.',
            },
          ].map(({ name, desc }) => (
            <div key={name} className="bg-gray-50 rounded-xl p-4">
              <p className="font-semibold text-gray-800 text-sm">{name}</p>
              <p className="text-gray-600 text-sm mt-1">{desc}</p>
            </div>
          ))}
        </div>
      ),
    },
    {
      icon: FileText,
      title: '9. Changes to This Policy',
      content: (
        <p>
          We may update this Privacy Policy from time to time. When we make material changes, we
          will notify you via an in-app notification and update the "Last updated" date below. Your
          continued use of the platform after changes are posted constitutes acceptance of the
          updated policy.
        </p>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft size={16} />
            Back
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-medium text-gray-800">Privacy Policy</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        {/* Title block */}
        <div className="flex items-start gap-4 mb-8">
          <div className="w-12 h-12 bg-brand-50 rounded-2xl flex items-center justify-center shrink-0">
            <Shield size={22} className="text-brand-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Privacy Policy</h1>
            <p className="text-gray-500 text-sm mt-1">
              Last updated: <strong>May 2025</strong> · Applies to studeals.vercel.app
            </p>
          </div>
        </div>

        {/* GDPR badge */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-8 flex items-start gap-3">
          <Shield size={18} className="text-blue-600 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800">
            <strong>Your data stays in the EU.</strong> All personal data is stored on Supabase
            servers in <strong>Ireland (eu-west-1)</strong> and is protected under the{' '}
            <strong>General Data Protection Regulation (GDPR)</strong>. We do not sell your data or
            run advertising trackers.
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-8">
          {sections.map(({ icon: Icon, title, content }) => (
            <div key={title} className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-brand-50 rounded-xl flex items-center justify-center shrink-0">
                  <Icon size={15} className="text-brand-600" />
                </div>
                <h2 className="text-base font-bold text-gray-900">{title}</h2>
              </div>
              <div className="text-sm text-gray-600 leading-relaxed">{content}</div>
            </div>
          ))}
        </div>

        {/* Contact CTA */}
        <div className="mt-8 bg-brand-600 rounded-2xl p-6 text-center text-white">
          <Mail size={20} className="mx-auto mb-2 opacity-80" />
          <h3 className="font-bold text-base mb-1">Exercise Your Rights</h3>
          <p className="text-blue-100 text-sm mb-3">
            To access, correct, export, or delete your data — or for any privacy enquiry — contact
            us at:
          </p>
          <a
            href="mailto:privacy@studeals.app"
            className="inline-block bg-white text-brand-600 font-bold text-sm px-5 py-2 rounded-xl hover:bg-blue-50 transition-colors"
          >
            privacy@studeals.app
          </a>
          <p className="text-blue-200 text-xs mt-3">
            You can also delete your account instantly from Account Settings → Delete Account.
          </p>
        </div>
      </div>
    </div>
  );
}
