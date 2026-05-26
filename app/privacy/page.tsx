'use client';

// =============================================================================
// app/privacy/page.tsx — Privacy Policy (EN + HU bilingual)
//
// Renders English by default; ?lang=hu serves the Hungarian version.
// Required by:
//   - GDPR (EU) 2016/679
//   - ePrivacy Directive 2002/58/EC
//   - 2011. évi CXII. törvény (Hungarian Information Self-Determination Act)
//   - 2001. évi CVIII. törvény §4 (Hungarian Electronic Commerce Act)
//
// Data residency: Supabase eu-west-1 (Ireland)
// Last updated: May 2026
//
// IMPORTANT — Data accuracy notes:
//   ✓ Profile photo    — NOT collected (removed from data list)
//   ✓ Phone number     — NOT collected (removed from data list)
//   ✓ Location         — NOT collected (removed from data list)
//   ✓ "Last updated"   — corrected to May 2026
//   ✓ ODR link         — added in GDPR rights section and contact CTA
// =============================================================================

import { Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Shield, ArrowLeft, Mail, Database, Lock,
  Trash2, Eye, FileText, Globe, ExternalLink,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Hungarian content
// ---------------------------------------------------------------------------

const HU = {
  pageTitle: 'Adatvédelmi tájékoztató',
  langLabel: 'Magyar',
  otherLang: 'English',
  lastUpdated: 'Utoljára frissítve: 2026. május · Hatályos: studeals.vercel.app',
  gdprBadge: (
    <>
      <strong>Az adatai az EU-ban maradnak.</strong> Minden személyes adatot az{' '}
      <strong>írországi (eu-west-1) Supabase</strong> szervereken tárolunk az Európai Unión belül,
      így azokra minden esetben a GDPR védelme vonatkozik. Az adatait nem adjuk el, és nem
      alkalmazunk hirdetési nyomkövetőket.
    </>
  ),
  ctaTitle: 'Gyakorolja jogait',
  ctaBody: 'Adataihoz való hozzáféréshez, azok javításához, exportálásához vagy törléséhez — illetve bármely adatvédelmi kérdéssel — lépjen kapcsolatba velünk:',
  ctaFooter: 'Fiókja azonnali törlése a Fiókbeállítások → Fiók törlése menüpontban is lehetséges.',
  backLabel: 'Vissza',
  sections: [
    {
      icon: Database,
      title: '1. Kik vagyunk',
      content: (
        <>
          <p>
            A Studeals („mi") egy diákkedvezmény-piactér, amelyet ellenőrzött egyetemi hallgatók és
            helyi vállalkozások számára működtetünk. Az élő platform elérhető:{' '}
            <a href="https://studeals.vercel.app" className="text-brand-600 underline">
              studeals.vercel.app
            </a>
            .
          </p>
          <p className="mt-3">
            Adatvédelmi kérdésekkel forduljon hozzánk:{' '}
            <a href="mailto:privacy@studeals.app" className="text-brand-600 underline">
              privacy@studeals.app
            </a>
          </p>
          <p className="mt-3">
            Felügyeleti hatóság:{' '}
            <a
              href="https://naih.hu"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-600 underline"
            >
              NAIH — Nemzeti Adatvédelmi és Információszabadság Hatóság (naih.hu)
            </a>
          </p>
        </>
      ),
    },
    {
      icon: FileText,
      title: '2. Milyen adatokat gyűjtünk',
      content: (
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-gray-800 mb-1">Fiókadatok</h3>
            <ul className="list-disc ml-5 space-y-1 text-gray-600">
              <li>E-mail cím (hitelesítéshez szükséges)</li>
              <li>Keresztnév, vezetéknév, megjelenítési név (nem kötelező)</li>
              <li>Végzési év (nem kötelező, hallgatói profil)</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 mb-1">Hallgatói ellenőrzési adatok</h3>
            <ul className="list-disc ml-5 space-y-1 text-gray-600">
              <li>Intézményi e-mail cím (.edu / magyar egyetemi domain ellenőrzéshez)</li>
              <li>Hallgatói igazolvány száma (nem kötelező, dokumentum-alapú ellenőrzés esetén)</li>
              <li>Hallgatói igazolvány fényképe (kizárólag feltöltve admin általi felülvizsgálatra; nem kerül megosztásra)</li>
              <li>Végzési év és szak (nem kötelező)</li>
              <li>Intézményi hovatartozás</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 mb-1">Felhasználási adatok</h3>
            <ul className="list-disc ml-5 space-y-1 text-gray-600">
              <li>Megtekintett, mentett és beváltott ajánlatok</li>
              <li>QR-utalvány beváltási rekordok (kereskedő oldali megerősítéssel)</li>
              <li>Hűségbélyegzők előzménye</li>
              <li>Felhalmozott megtakarítások (becsült tranzakciós értékek)</li>
              <li>Eszköztípus (mobil / tablet / asztali) — utalvány igénylésekor rögzítve</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 mb-1">Sütik és technikai adatok</h3>
            <ul className="list-disc ml-5 space-y-1 text-gray-600">
              <li>Munkamenet-sütik (a bejelentkezés fenntartásához szükségesek)</li>
              <li>Süti-hozzájárulási beállítás (böngészőjében tárolva)</li>
              <li>Névtelen oldalmegtekintés-számlálók (analitika, ha elfogadja a választható sütiket)</li>
            </ul>
          </div>
          <p className="text-xs text-gray-400 italic mt-2">
            ℹ Telefonszámot, tartózkodási helyet és profilképet nem gyűjtünk.
          </p>
        </div>
      ),
    },
    {
      icon: Lock,
      title: '3. Jogi alap és adatfelhasználás',
      content: (
        <div className="space-y-3">
          {[
            {
              basis: 'Szerződés teljesítése (6. cikk (1) b) pont)',
              uses: 'Fiók létrehozása, hitelesítés, az intézményéhez kapcsolódó ajánlatok megjelenítése, utalvány-beváltások feldolgozása.',
            },
            {
              basis: 'Jogos érdek (6. cikk (1) f) pont)',
              uses: 'Platformbiztonság, csalásmegelőzés, visszaélés-felderítés, összesített analitika a szolgáltatás fejlesztéséhez.',
            },
            {
              basis: 'Hozzájárulás (6. cikk (1) a) pont)',
              uses: 'Választható analitikai sütik, marketing értesítések (csak hozzájárulás esetén). A hozzájárulás bármikor visszavonható.',
            },
            {
              basis: 'Jogi kötelezettség (6. cikk (1) c) pont)',
              uses: 'Tranzakciós rekordok megőrzése az alkalmazandó adó- és fogyasztóvédelmi jogszabályok szerint.',
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
      title: '4. Az adatok tárolási helye',
      content: (
        <>
          <p>
            Minden személyes adatot az{' '}
            <strong>írországi (eu-west-1) Supabase szervereken</strong> tárolunk az Európai Unión
            belül. Ez azt jelenti, hogy adataira minden esetben a GDPR védelme vonatkozik, és azok
            megfelelő biztosítékok nélkül nem kerülnek az EU/EGT-n kívülre.
          </p>
          <p className="mt-3">
            A Supabase adatfeldolgozóként jár el az adatkezelési megállapodásunk (DPA) alapján.
            Biztonsági gyakorlataikról — beleértve az inaktív és átvitel közbeni titkosítást — a{' '}
            <a
              href="https://supabase.com/security"
              className="text-brand-600 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              supabase.com/security
            </a>{' '}
            oldalon tájékozódhat.
          </p>
          <p className="mt-3">
            A platform a <strong>Vercel</strong> CDN-jén fut. A Vercel nem tárol személyes adatokat.
          </p>
        </>
      ),
    },
    {
      icon: Eye,
      title: '5. Kivel osztjuk meg az adatokat',
      content: (
        <>
          <p>
            <strong>Személyes adatait nem adjuk el.</strong> Hirdetési nyomkövetőket nem alkalmazunk.
          </p>
          <div className="mt-3 space-y-2">
            {[
              {
                party: 'Kereskedők (a platform vállalkozásai)',
                scope: 'Utalvány beváltásakor a kereskedő csak a megjelenítési nevét látja (pl. „Emmanuel A.") — nem a teljes nevét, e-mail címét vagy igazolványát.',
              },
              {
                party: 'Supabase (adatfeldolgozó)',
                scope: 'Adatbázis-tárolás és hitelesítés. Kizárólag EU/írországi szerverek.',
              },
              {
                party: 'Vercel (infrastruktúra-feldolgozó)',
                scope: 'Webhosting és szerver nélküli funkcióvégrehajtás. Személyes adat nem kerül tárolásra.',
              },
              {
                party: 'Adminisztrátorok',
                scope: 'A Studeals munkatársai hozzáférhetnek adataihoz a támogatási problémák megoldása vagy a hallgatói igazolvány-dokumentumok ellenőrzése céljából.',
              },
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
      title: '6. Az Ön GDPR szerinti jogai',
      content: (
        <>
          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            {[
              {
                right: 'Hozzáférési jog (15. cikk)',
                desc: 'Másolatot kérhet az összes Önre vonatkozó személyes adatról.',
              },
              {
                right: 'Helyesbítési jog (16. cikk)',
                desc: 'A Fiókbeállításokban javíthatja a pontatlan vagy hiányos adatokat.',
              },
              {
                right: 'Törlési jog (17. cikk)',
                desc: 'A Fiókbeállítások → Fiók törlése menüpontban törölheti fiókját és összes adatát.',
              },
              {
                right: 'Adathordozhatóság (20. cikk)',
                desc: 'A Fiókbeállításokban exportálhatja beváltási előzményeit és megtakarítási adatait.',
              },
              {
                right: 'Korlátozási jog (18. cikk)',
                desc: 'Bizonyos körülmények között kérheti adatainak kezelésének szüneteltetését.',
              },
              {
                right: 'Tiltakozási jog (21. cikk)',
                desc: 'Bármikor tiltakozhat a jogos érdeken alapuló adatkezelés ellen.',
              },
              {
                right: 'Hozzájárulás visszavonása',
                desc: 'A választható sütikhez adott hozzájárulást bármikor visszavonhatja a süti-banneren keresztül.',
              },
              {
                right: 'Panasztételi jog',
                desc: 'Panaszt nyújthat be a NAIH-hoz (naih.hu) vagy a tartózkodási helye szerinti adatvédelmi hatósághoz.',
              },
            ].map(({ right, desc }) => (
              <div key={right} className="bg-blue-50 rounded-xl p-3">
                <p className="font-semibold text-blue-800 text-sm">{right}</p>
                <p className="text-gray-600 text-xs mt-1">{desc}</p>
              </div>
            ))}
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-gray-700">Hatóságok elérhetősége:</p>
            <a
              href="https://naih.hu"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-blue-700 hover:underline"
            >
              <ExternalLink size={11} />
              NAIH — Nemzeti Adatvédelmi és Információszabadság Hatóság (naih.hu)
            </a>
            <a
              href="https://ec.europa.eu/consumers/odr/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-blue-700 hover:underline"
            >
              <ExternalLink size={11} />
              EU online vitarendezési platform — ec.europa.eu/consumers/odr
            </a>
          </div>
        </>
      ),
    },
    {
      icon: Trash2,
      title: '7. Adatmegőrzés',
      content: (
        <div className="space-y-2">
          {[
            {
              type: 'Aktív fiók adatai',
              period: 'A fiók fennállásáig megőrizve.',
            },
            {
              type: 'Beváltási és bélyegző rekordok',
              period: 'A tranzakció dátumától számított 3 évig megőrizve (pénzügyi nyilvántartási kötelezettség).',
            },
            {
              type: 'Hallgatói ellenőrzési dokumentumok (igazolványfotók)',
              period: 'Az ellenőrzési döntés (elfogadás vagy elutasítás) után 30 napon belül törölve.',
            },
            {
              type: 'Törölt fiók adatai',
              period: 'A törlési kérelem után 30 napon belül véglegesen törölve.',
            },
            {
              type: 'Analitikai adatok',
              period: '12 hónap után összesítve és anonimizálva. Ezt követően egyéni szintű megőrzés nem történik.',
            },
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
      title: '8. Sütik',
      content: (
        <div className="space-y-3">
          <p>Három kategóriájú sütit alkalmazunk:</p>
          {[
            {
              name: '✅ Szükséges sütik (mindig aktív)',
              desc: 'A platform működéséhez szükségesek. Tartalmazza a bejelentkezési munkamenet-tokent és a biztonsági tokeneket. Nem utasíthatók el — nélkülük az alkalmazás nem képes azonosítani Önt.',
            },
            {
              name: '📊 Analitikai sütik (választható)',
              desc: 'Névtelen oldalmegtekintés-számlálók, amelyek segítenek megérteni, mely funkciókat használják a hallgatók. Személyes adat nem szerepel bennük. A süti-banneren elfogadhatja vagy elutasíthatja ezeket.',
            },
            {
              name: '📢 Marketing sütik (választható, jelenleg nem aktív)',
              desc: 'Jelenleg nem alkalmazzuk. Aktiválás előtt értesítést küldünk, és ismételt hozzájárulást kérünk.',
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
      title: '9. A tájékoztató változásai',
      content: (
        <p>
          Ezt az adatvédelmi tájékoztatót időről időre frissíthetjük. Lényeges változások esetén
          in-app értesítést küldünk, és frissítjük az alábbi „Utoljára frissítve" dátumot. A
          módosítások közzétételét követő folyamatos platformhasználat a frissített tájékoztató
          elfogadásának minősül.
        </p>
      ),
    },
  ],
};

// ---------------------------------------------------------------------------
// English content
// ---------------------------------------------------------------------------

const EN = {
  pageTitle: 'Privacy Policy',
  langLabel: 'English',
  otherLang: 'Magyar',
  lastUpdated: 'Last updated: May 2026 · Applies to studeals.vercel.app',
  gdprBadge: (
    <>
      <strong>Your data stays in the EU.</strong> All personal data is stored on Supabase servers in{' '}
      <strong>Ireland (eu-west-1)</strong> and is protected under the{' '}
      <strong>General Data Protection Regulation (GDPR)</strong>. We do not sell your data or run
      advertising trackers.
    </>
  ),
  ctaTitle: 'Exercise Your Rights',
  ctaBody: 'To access, correct, export, or delete your data — or for any privacy enquiry — contact us at:',
  ctaFooter: 'You can also delete your account instantly from Account Settings → Delete Account.',
  backLabel: 'Back',
  sections: [
    {
      icon: Database,
      title: '1. Who We Are',
      content: (
        <>
          <p>
            Studeals ("we", "us", "our") is a student discount marketplace operated as a service for
            verified university students and local businesses. Our live platform is available at{' '}
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
          <p className="mt-3">
            Supervisory authority:{' '}
            <a
              href="https://naih.hu"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-600 underline"
            >
              NAIH — Hungarian National Authority for Data Protection and Freedom of Information (naih.hu)
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
              <li>Graduation year (optional, student profile)</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-gray-800 mb-1">Student Verification Data</h3>
            <ul className="list-disc ml-5 space-y-1 text-gray-600">
              <li>Student email address (for .edu / university domain verification)</li>
              <li>Student ID number (optional, for document-based verification)</li>
              <li>Photo of student ID card (uploaded only for admin review; not shared)</li>
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
          <p className="text-xs text-gray-400 italic mt-2">
            ℹ We do not collect phone numbers, location data, or profile photos.
          </p>
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
            stores no personal data.
          </p>
        </>
      ),
    },
    {
      icon: Eye,
      title: '5. Who We Share Your Data With',
      content: (
        <>
          <p>
            We <strong>do not sell your personal data</strong>. We do not run advertising trackers.
          </p>
          <div className="mt-3 space-y-2">
            {[
              {
                party: 'Vendors (businesses on the platform)',
                scope: "When you redeem a voucher, the vendor sees your display name only (e.g., \"Emmanuel A.\") — not your full name, email, or ID.",
              },
              {
                party: 'Supabase (data processor)',
                scope: 'Database storage and authentication. EU/Ireland servers only.',
              },
              {
                party: 'Vercel (infrastructure processor)',
                scope: 'Web hosting and serverless function execution. No personal data stored.',
              },
              {
                party: 'Admins',
                scope: "Studeals staff may access your data to resolve support issues or review student ID documents for verification.",
              },
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
        <>
          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            {[
              {
                right: 'Right of Access (Art. 15)',
                desc: 'Request a copy of all personal data we hold about you.',
              },
              {
                right: 'Right to Rectification (Art. 16)',
                desc: 'Correct inaccurate or incomplete data in your Account Settings.',
              },
              {
                right: 'Right to Erasure (Art. 17)',
                desc: 'Delete your account and all associated data from Account Settings → Delete Account.',
              },
              {
                right: 'Right to Portability (Art. 20)',
                desc: 'Export your redemption history and savings data from Account Settings.',
              },
              {
                right: 'Right to Restriction (Art. 18)',
                desc: 'Ask us to pause processing your data in certain circumstances.',
              },
              {
                right: 'Right to Object (Art. 21)',
                desc: 'Object to processing based on legitimate interests at any time.',
              },
              {
                right: 'Right to Withdraw Consent',
                desc: 'Decline or withdraw optional cookie consent at any time via the cookie banner.',
              },
              {
                right: 'Right to Lodge a Complaint',
                desc: 'You may lodge a complaint with the Hungarian NAIH (naih.hu) or your local DPA.',
              },
            ].map(({ right, desc }) => (
              <div key={right} className="bg-blue-50 rounded-xl p-3">
                <p className="font-semibold text-blue-800 text-sm">{right}</p>
                <p className="text-gray-600 text-xs mt-1">{desc}</p>
              </div>
            ))}
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-gray-700">Supervisory authorities:</p>
            <a
              href="https://naih.hu"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-blue-700 hover:underline"
            >
              <ExternalLink size={11} />
              NAIH — Hungarian National Authority for Data Protection (naih.hu)
            </a>
            <a
              href="https://ec.europa.eu/consumers/odr/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-blue-700 hover:underline"
            >
              <ExternalLink size={11} />
              EU Online Dispute Resolution Platform — ec.europa.eu/consumers/odr
            </a>
          </div>
        </>
      ),
    },
    {
      icon: Trash2,
      title: '7. Data Retention',
      content: (
        <div className="space-y-2">
          {[
            {
              type: 'Active account data',
              period: 'Retained while your account exists.',
            },
            {
              type: 'Redemption & stamp records',
              period: 'Retained for 3 years after the transaction date (financial records requirement).',
            },
            {
              type: 'Student verification documents (ID photos)',
              period: 'Deleted within 30 days of verification decision (approved or rejected).',
            },
            {
              type: 'Deleted account data',
              period: 'Permanently erased within 30 days of account deletion request.',
            },
            {
              type: 'Analytics data',
              period: 'Aggregated and anonymised after 12 months. No individual-level retention beyond that.',
            },
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
              name: '📢 Marketing cookies (optional, currently inactive)',
              desc: 'Currently unused. We will notify you and request fresh consent before activating this category.',
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
          will notify you via an in-app notification and update the "Last updated" date above. Your
          continued use of the platform after changes are posted constitutes acceptance of the
          updated policy.
        </p>
      ),
    },
  ],
};

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

function PrivacyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const isHU = searchParams.get('lang') === 'hu';
  const t = isHU ? HU : EN;

  function toggleLang() {
    const params = new URLSearchParams(searchParams.toString());
    if (isHU) {
      params.delete('lang');
    } else {
      params.set('lang', 'hu');
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
            >
              <ArrowLeft size={16} />
              {t.backLabel}
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm font-medium text-gray-800">{t.pageTitle}</span>
          </div>
          {/* Language toggle */}
          <button
            onClick={toggleLang}
            className="flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 border border-brand-200 rounded-xl px-3 py-1.5 transition-colors hover:bg-brand-50"
          >
            <Globe size={13} />
            {t.otherLang}
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        {/* Title block */}
        <div className="flex items-start gap-4 mb-8">
          <div className="w-12 h-12 bg-brand-50 rounded-2xl flex items-center justify-center shrink-0">
            <Shield size={22} className="text-brand-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t.pageTitle}</h1>
            <p className="text-gray-500 text-sm mt-1">{t.lastUpdated}</p>
          </div>
        </div>

        {/* GDPR badge */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-8 flex items-start gap-3">
          <Shield size={18} className="text-blue-600 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800">{t.gdprBadge}</p>
        </div>

        {/* Sections */}
        <div className="space-y-6">
          {t.sections.map(({ icon: Icon, title, content }) => (
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
          <h3 className="font-bold text-base mb-1">{t.ctaTitle}</h3>
          <p className="text-blue-100 text-sm mb-3">{t.ctaBody}</p>
          <a
            href="mailto:privacy@studeals.app"
            className="inline-block bg-white text-brand-600 font-bold text-sm px-5 py-2 rounded-xl hover:bg-blue-50 transition-colors"
          >
            privacy@studeals.app
          </a>
          <p className="text-blue-200 text-xs mt-3">{t.ctaFooter}</p>
          <p className="text-blue-200 text-xs mt-1">
            {isHU ? 'Felügyeleti hatóság: ' : 'Supervisory authority: '}
            <a href="https://naih.hu" target="_blank" rel="noopener noreferrer" className="underline">
              naih.hu
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <Suspense>
      <PrivacyContent />
    </Suspense>
  );
}
