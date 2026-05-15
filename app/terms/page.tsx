'use client';

// =============================================================================
// app/terms/page.tsx — Terms of Service
//
// Legal terms covering student eligibility, vendor responsibilities,
// voucher policy, acceptable use, and liability.
// Jurisdiction: Hungary · Governing law: Hungarian Civil Code (Ptk.)
// Last updated: May 2026
// =============================================================================

import Link from 'next/link';
import { FileText, ArrowLeft, Mail, ShieldCheck, Users, Store, QrCode, AlertTriangle, Gavel, Scale } from 'lucide-react';

export default function TermsPage() {
  const sections = [
    {
      icon: FileText,
      title: '1. Acceptance of Terms',
      content: (
        <p>
          By creating an account on Unideals (available at{' '}
          <a href="https://studeals.vercel.app" className="text-brand-600 underline">studeals.vercel.app</a>),
          accessing the platform, or using any of its features, you agree to be bound by these Terms of
          Service ("Terms") and our{' '}
          <Link href="/privacy" className="text-brand-600 underline">Privacy Policy</Link>. If you do not
          agree to these Terms, you may not use the platform. We may update these Terms from time to
          time; continued use after changes are posted constitutes acceptance. Material changes will be
          notified via in-app notification.
        </p>
      ),
    },
    {
      icon: Users,
      title: '2. Student Eligibility & Verification',
      content: (
        <div className="space-y-3">
          <p>To access student-exclusive discounts, you must:</p>
          <ul className="list-disc ml-5 space-y-1.5 text-gray-600">
            <li>Be currently enrolled at a recognised university or higher-education institution.</li>
            <li>Complete the verification process by confirming a valid institutional email address (<code className="bg-gray-100 px-1 rounded text-xs">.edu</code> or Hungarian university domain), or by uploading a valid student ID document for admin review.</li>
            <li>Maintain active student status. If your enrolment ends, you must stop using student-exclusive features.</li>
            <li>Be at least 16 years of age.</li>
          </ul>
          <p className="mt-2">
            Providing false verification documents is a violation of these Terms and may result in
            immediate account suspension and referral to the relevant institution. Unideals reserves the
            right to re-verify your status at any time.
          </p>
        </div>
      ),
    },
    {
      icon: Store,
      title: '3. Vendor Responsibilities',
      content: (
        <div className="space-y-3">
          <p>Vendors ("businesses") who list offers on the platform agree to:</p>
          <ul className="list-disc ml-5 space-y-1.5 text-gray-600">
            <li>Honour all published discounts and promotions when presented with a valid, unexpired Unideals voucher or QR stamp.</li>
            <li>Ensure offer descriptions, discount values, and expiry dates are accurate at the time of publication.</li>
            <li>Not discriminate against students presenting Unideals vouchers in a manner inconsistent with the advertised offer.</li>
            <li>Use the platform's QR scanner to confirm redemptions — off-platform redemption confirmation may not be recorded in analytics.</li>
            <li>Comply with all applicable Hungarian consumer protection laws and advertising standards.</li>
            <li>Not use student data obtained through the platform for any purpose other than confirming the specific redemption at hand.</li>
          </ul>
          <p className="mt-2">
            Unideals reserves the right to remove vendor listings, suspend accounts, or terminate vendor
            access for repeated non-fulfilment of advertised offers or breach of these Terms.
          </p>
        </div>
      ),
    },
    {
      icon: QrCode,
      title: '4. Voucher & Stamp Policy',
      content: (
        <div className="space-y-2">
          {[
            { term: 'Expiry', detail: 'QR vouchers expire 24 hours after generation. Loyalty stamps expire per the vendor\'s configured stamp expiry window (default: no expiry unless the vendor sets one).' },
            { term: 'Single use', detail: 'Each claimed voucher is valid for a single redemption at the issuing vendor. Voucher codes must not be shared, screenshotted, or transferred to another person.' },
            { term: 'Non-transferable', detail: 'Vouchers and stamp cards are tied to your verified student account. They have no monetary or exchange value and cannot be sold or transferred.' },
            { term: 'No cash equivalent', detail: 'Discounts are applied at the point of sale by the vendor. Unideals does not process any financial transaction and is not a party to the sale.' },
            { term: 'Fraudulent use', detail: 'Attempting to forge, reuse, or alter vouchers or stamps is a breach of these Terms and may constitute fraud under Hungarian law.' },
            { term: 'Loyalty rewards', detail: 'Reward thresholds (e.g., "free coffee after 10 stamps") are set by the vendor and may change at the vendor\'s discretion with reasonable notice.' },
          ].map(({ term, detail }) => (
            <div key={term} className="flex gap-3 py-2 border-b border-gray-100 last:border-0">
              <span className="font-semibold text-gray-800 text-sm w-36 shrink-0">{term}</span>
              <span className="text-gray-600 text-sm">{detail}</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      icon: ShieldCheck,
      title: '5. Acceptable Use',
      content: (
        <div className="space-y-3">
          <p>You agree <strong>not</strong> to:</p>
          <ul className="list-disc ml-5 space-y-1.5 text-gray-600">
            <li>Create multiple accounts to circumvent verification or claim additional vouchers.</li>
            <li>Use automated scripts, bots, or scrapers on the platform.</li>
            <li>Attempt to reverse-engineer, decompile, or exploit platform security vulnerabilities.</li>
            <li>Post false, misleading, or defamatory reviews about vendors.</li>
            <li>Harass, threaten, or impersonate other users or staff.</li>
            <li>Use the platform for any unlawful purpose under Hungarian or EU law.</li>
            <li>Attempt to circumvent QR voucher expiry, single-use enforcement, or student verification checks.</li>
          </ul>
          <p className="mt-2">
            Violations of this section may result in immediate account suspension without notice.
          </p>
        </div>
      ),
    },
    {
      icon: AlertTriangle,
      title: '6. Disclaimers & Limitation of Liability',
      content: (
        <div className="space-y-3">
          <p>
            <strong>Unideals is a marketplace intermediary.</strong> We connect students with vendors but
            are not a party to any transaction between them. We make no warranty that:
          </p>
          <ul className="list-disc ml-5 space-y-1.5 text-gray-600">
            <li>Any specific offer will remain available or be fulfilled by the vendor.</li>
            <li>The platform will be free of interruptions, errors, or security breaches.</li>
            <li>Savings figures displayed are guaranteed or represent actual cash savings.</li>
          </ul>
          <p className="mt-3">
            To the maximum extent permitted by Hungarian law, Unideals shall not be liable for indirect,
            incidental, or consequential damages arising from your use of the platform, including losses
            resulting from a vendor's failure to honour a voucher.
          </p>
          <p className="mt-3">
            Nothing in these Terms limits Unideals' liability for death or personal injury caused by
            negligence, fraud, or fraudulent misrepresentation, or any other liability that cannot be
            excluded by law.
          </p>
        </div>
      ),
    },
    {
      icon: Gavel,
      title: '7. Intellectual Property',
      content: (
        <p>
          All platform content, branding, code, and design belonging to Unideals is protected by copyright
          and intellectual property law. Vendors retain ownership of their business information and offer
          content, but grant Unideals a licence to display it on the platform. You may not reproduce,
          redistribute, or create derivative works from Unideals content without express written permission.
        </p>
      ),
    },
    {
      icon: FileText,
      title: '8. Account Termination',
      content: (
        <div className="space-y-2">
          <p>
            <strong>You</strong> may delete your account at any time from Account Settings → Delete Account.
            Your personal data will be permanently erased within 30 days, subject to our data retention
            obligations under applicable law (see our{' '}
            <Link href="/privacy" className="text-brand-600 underline">Privacy Policy</Link>).
          </p>
          <p className="mt-2">
            <strong>Unideals</strong> may suspend or terminate your account immediately and without notice if
            you breach these Terms, engage in fraudulent activity, or if we are required to do so by law.
            Termination does not affect any accrued rights or obligations.
          </p>
        </div>
      ),
    },
    {
      icon: Scale,
      title: '9. Governing Law & Disputes',
      content: (
        <p>
          These Terms are governed by the laws of Hungary. Any dispute arising out of or relating to these
          Terms or the platform shall first be subject to good-faith negotiation. If unresolved, disputes shall
          be referred to the competent courts of Hungary. EU consumers retain the right to pursue
          alternative dispute resolution (ADR) in their country of residence. You may also contact the{' '}
          <a href="https://bfkh.gov.hu/" className="text-brand-600 underline" target="_blank" rel="noopener noreferrer">
            Hungarian Consumer Protection Authority (BFKH)
          </a>{' '}
          for consumer rights matters.
        </p>
      ),
    },
    {
      icon: Mail,
      title: '10. Contact',
      content: (
        <p>
          For questions about these Terms, contact us at{' '}
          <a href="mailto:legal@unideals.app" className="text-brand-600 underline">legal@unideals.app</a>.
          For privacy-related enquiries, see our{' '}
          <Link href="/privacy" className="text-brand-600 underline">Privacy Policy</Link> or contact{' '}
          <a href="mailto:privacy@unideals.app" className="text-brand-600 underline">privacy@unideals.app</a>.
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
          <span className="text-sm font-medium text-gray-800">Terms of Service</span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        {/* Title block */}
        <div className="flex items-start gap-4 mb-8">
          <div className="w-12 h-12 bg-brand-50 rounded-2xl flex items-center justify-center shrink-0">
            <Scale size={22} className="text-brand-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Terms of Service</h1>
            <p className="text-gray-500 text-sm mt-1">
              Last updated: <strong>May 2026</strong> · Applies to studeals.vercel.app
            </p>
          </div>
        </div>

        {/* Jurisdiction badge */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-8 flex items-start gap-3">
          <Gavel size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            <strong>Jurisdiction: Hungary.</strong> These Terms are governed by Hungarian law (Civil Code,
            Ptk.) and applicable EU consumer protection regulations. These Terms form a binding agreement
            between you and Unideals when you use the platform.
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
          <h3 className="font-bold text-base mb-1">Questions about these Terms?</h3>
          <p className="text-blue-100 text-sm mb-3">
            Our legal team is happy to help with any questions about your rights or obligations.
          </p>
          <a
            href="mailto:legal@unideals.app"
            className="inline-block bg-white text-brand-600 font-bold text-sm px-5 py-2 rounded-xl hover:bg-blue-50 transition-colors"
          >
            legal@unideals.app
          </a>
          <p className="text-blue-200 text-xs mt-3">
            Also see our <Link href="/privacy" className="underline">Privacy Policy</Link> for data rights.
          </p>
        </div>
      </div>
    </div>
  );
}
