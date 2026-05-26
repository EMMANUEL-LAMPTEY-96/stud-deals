'use client';

// =============================================================================
// app/terms/page.tsx — Terms of Service (EN + HU bilingual)
//
// Renders English by default; adds ?lang=hu for the Hungarian version.
// Required by:
//   - 2001. évi CVIII. törvény §4 (Hungarian Electronic Commerce Act)
//   - EU Consumer Rights Directive 2011/83/EU
//   - EU Regulation 524/2013 (ODR platform link)
//
// Jurisdiction: Hungary · Governing law: Hungarian Civil Code (Ptk.)
// Last updated: May 2026
// =============================================================================

import { Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  FileText, ArrowLeft, Mail, ShieldCheck, Users, Store,
  QrCode, AlertTriangle, Gavel, Scale, Globe, ExternalLink,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Hungarian content
// ---------------------------------------------------------------------------

const HU = {
  pageTitle: 'Felhasználási feltételek',
  langLabel: 'Magyar',
  otherLang: 'English',
  lastUpdated: 'Utoljára frissítve: 2026. május · Hatályos: studeals.vercel.app',
  jurisdictionBadge: (
    <>
      <strong>Joghatóság: Magyarország.</strong> Ezek a feltételek a magyar jog (Ptk.) és az EU
      fogyasztóvédelmi szabályok szerint értelmezendők. A platform használatával Ön elfogadja az
      alábbi feltételeket.
    </>
  ),
  odrBanner: (
    <>
      <strong>EU vitarendezés:</strong> Fogyasztói panaszát benyújthatja az EU online vitarendezési
      platformján:{' '}
      <a
        href="https://ec.europa.eu/consumers/odr/"
        target="_blank"
        rel="noopener noreferrer"
        className="underline"
      >
        ec.europa.eu/consumers/odr
      </a>
      . Fogyasztóvédelmi ügyekben forduljon a{' '}
      <a
        href="https://bfkh.gov.hu/"
        target="_blank"
        rel="noopener noreferrer"
        className="underline"
      >
        Fogyasztóvédelmi Hatósághoz (BFKH)
      </a>
      .
    </>
  ),
  ctaTitle: 'Kérdése van a feltételekkel kapcsolatban?',
  ctaBody: 'Jogi csapatunk szívesen segít jogaival és kötelezettségeivel kapcsolatos kérdésekben.',
  ctaFooter: 'Adatvédelemről lásd az',
  ctaFooterLink: 'Adatvédelmi tájékoztatót',
  backLabel: 'Vissza',
  sections: [
    {
      icon: FileText,
      title: '1. A feltételek elfogadása',
      content: (
        <p>
          A Studeals platformon (elérhető:{' '}
          <a href="https://studeals.vercel.app" className="text-brand-600 underline">
            studeals.vercel.app
          </a>
          ) fiók létrehozásával, a platform elérésével vagy bármely funkciójának használatával Ön elfogadja
          ezeket a Felhasználási feltételeket és{' '}
          <Link href="/privacy?lang=hu" className="text-brand-600 underline">Adatvédelmi tájékoztatónkat</Link>.
          Ha nem ért egyet a feltételekkel, kérjük, ne használja a platformot. A feltételeket
          időről időre frissíthetjük; a módosítások közzétételét követő folyamatos használat azok
          elfogadásának minősül. Lényeges változásokról in-app értesítést küldünk.
        </p>
      ),
    },
    {
      icon: Users,
      title: '2. Hallgatói jogosultság és ellenőrzés',
      content: (
        <div className="space-y-3">
          <p>A hallgatói kedvezmények igénybevételéhez szükséges:</p>
          <ul className="list-disc ml-5 space-y-1.5 text-gray-600">
            <li>Jelenleg aktív hallgatói státusz elismert magyarországi vagy külföldi felsőoktatási intézménynél.</li>
            <li>Az ellenőrzési folyamat elvégzése: intézményi e-mail cím megerősítése (<code className="bg-gray-100 px-1 rounded text-xs">.edu</code> vagy magyar egyetemi domain), vagy hallgatói igazolvány feltöltése admin általi felülvizsgálatra.</li>
            <li>Aktív hallgatói státusz fenntartása. Ha hallgatói jogviszonya megszűnik, a hallgatóknak fenntartott funkciókat nem veheti tovább igénybe.</li>
            <li>Legalább 16 éves kor betöltése (GDPR 8. cikk).</li>
          </ul>
          <p className="mt-2">
            Hamis igazolás benyújtása a jelen feltételek megsértésének minősül, és azonnali fiók-felfüggesztéshez,
            valamint az illetékes intézmény értesítéséhez vezethet. A Studeals fenntartja a jogot az
            ellenőrzés bármikori megismétlésére.
          </p>
        </div>
      ),
    },
    {
      icon: Store,
      title: '3. Kereskedői kötelezettségek',
      content: (
        <div className="space-y-3">
          <p>A platformon ajánlatot hirdető kereskedők vállalják, hogy:</p>
          <ul className="list-disc ml-5 space-y-1.5 text-gray-600">
            <li>Minden közzétett kedvezményt és akciót teljesítenek érvényes, nem lejárt Studeals utalvány vagy QR-bélyegző bemutatásakor.</li>
            <li>Az ajánlatok leírása, a kedvezmény mértéke és a lejárati dátum a közzétételkor pontos.</li>
            <li>Nem teszik hátrányos megkülönböztetés tárgyává a Studeals utalványt bemutató hallgatókat.</li>
            <li>A beváltások megerősítéséhez a platform QR-leolvasóját használják.</li>
            <li>Betartják az alkalmazandó magyar fogyasztóvédelmi jogszabályokat és reklámstandardokat.</li>
            <li>A platform révén megismert hallgatói adatokat kizárólag az adott beváltás megerősítéséhez használják fel.</li>
          </ul>
          <p className="mt-2">
            A Studeals fenntartja a jogot a kereskedői hirdetések eltávolítására, a fiókok felfüggesztésére
            vagy a hozzáférés megszüntetésére az ajánlatok ismételt nem teljesítése vagy a feltételek megsértése esetén.
          </p>
        </div>
      ),
    },
    {
      icon: QrCode,
      title: '4. Utalvány- és bélyegzési szabályzat',
      content: (
        <div className="space-y-2">
          {[
            { term: 'Lejárat', detail: 'A QR-utalványok a generálástól számított 24 óra elteltével érvényüket vesztik. A hűségbélyegzők a kereskedő által beállított lejárati ablak szerint járnak le (alapértelmezés: nincs lejárat, hacsak a kereskedő nem állít be ilyet).' },
            { term: 'Egyszeri felhasználás', detail: 'Minden igényelt utalvány egyetlen beváltásra érvényes a kibocsátó kereskedőnél. Az utalványkódokat tilos megosztani, képernyőfotózni vagy más személyre átruházni.' },
            { term: 'Nem átruházható', detail: 'Az utalványok és bélyegzőkártyák az Ön hitelesített hallgatói fiókjához kötöttek. Pénzbeli vagy csereértékkel nem rendelkeznek, és nem értékesíthetők, illetve nem ruházhatók át.' },
            { term: 'Nincs készpénzegyenérték', detail: 'A kedvezményeket a kereskedő alkalmazza az értékesítés helyén. A Studeals semmilyen pénzügyi tranzakciót nem kezel, és nem vesz részt az adásvételben.' },
            { term: 'Csalárd felhasználás', detail: 'Az utalványok vagy bélyegzők hamisítása, újrafelhasználása vagy módosítása a jelen feltételek megsértése, és a magyar jog szerint bűncselekménynek minősülhet.' },
            { term: 'Hűségjutalmak', detail: 'A jutalomküszöböket (pl. „ingyenes kávé 10 bélyegző után") a kereskedő határozza meg, és azokat ésszerű előzetes értesítéssel módosíthatja.' },
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
      title: '5. Elfogadható használat',
      content: (
        <div className="space-y-3">
          <p>Ön vállalja, hogy <strong>nem</strong>:</p>
          <ul className="list-disc ml-5 space-y-1.5 text-gray-600">
            <li>Hoz létre több fiókot az ellenőrzés megkerülése vagy további utalványok igénylése céljából.</li>
            <li>Használ automatizált szkripteket, botokat vagy adatkaparókat a platformon.</li>
            <li>Kísérli meg a platform visszafejtését, dekompilálását vagy biztonsági résének kihasználását.</li>
            <li>Tesz közzé hamis, félrevezető vagy rágalmazó kereskedői értékeléseket.</li>
            <li>Zaklatja, fenyegeti vagy személyesíti meg a többi felhasználót vagy az alkalmazottakat.</li>
            <li>Használja a platformot a magyar vagy EU jog szerint jogellenes célra.</li>
            <li>Kísérli meg a QR-utalvány lejáratának, az egyszeri felhasználás kikényszerítésének vagy a hallgatói ellenőrzések megkerülését.</li>
          </ul>
          <p className="mt-2">
            Ezen szakasz megsértése azonnali, értesítés nélküli fiókfelfüggesztést vonhat maga után.
          </p>
        </div>
      ),
    },
    {
      icon: AlertTriangle,
      title: '6. Felelősségkizárás és felelősség korlátozása',
      content: (
        <div className="space-y-3">
          <p>
            <strong>A Studeals piactér-közvetítő.</strong> Összekötjük a hallgatókat a kereskedőkkel,
            de nem vagyunk részese közöttük zajló tranzakciónak. Nem vállalunk jótállást arra, hogy:
          </p>
          <ul className="list-disc ml-5 space-y-1.5 text-gray-600">
            <li>Bármely ajánlat elérhető marad, vagy a kereskedő teljesíti azt.</li>
            <li>A platform megszakítás, hiba vagy biztonsági incidens nélkül működik.</li>
            <li>A megjelenített megtakarítási összegek garantáltak vagy tényleges pénzügyi megtakarítást képviselnek.</li>
          </ul>
          <p className="mt-3">
            A magyar jog által megengedett legnagyobb mértékben a Studeals nem felel a platform
            használatából eredő közvetett, járulékos vagy következményes károkért, beleértve a
            kereskedő általi utalvány-nem-teljesítésből eredő veszteségeket is.
          </p>
          <p className="mt-3">
            A jelen feltételek nem korlátozzák a Studeals felelősségét a gondatlanságból, csalásból
            vagy a jogszabály által kizárt egyéb esetekből eredő halálesetért vagy személyi sérülésért.
          </p>
        </div>
      ),
    },
    {
      icon: Gavel,
      title: '7. Szellemi tulajdon',
      content: (
        <p>
          A Studealshez tartozó platformtartalom, márkajelzések, kódok és arculat szerzői jogi és
          szellemi tulajdonjogi védelem alatt állnak. A kereskedők megtartják üzleti adataik és
          ajánlattartalmuk tulajdonjogát, de engedélyt adnak a Studealsnek azok platformon való
          megjelenítésére. A Studeals tartalmát tilos reprodukálni, továbbterjeszteni vagy abból
          származékos művet alkotni kifejezett írásbeli engedély nélkül.
        </p>
      ),
    },
    {
      icon: FileText,
      title: '8. Fiók megszüntetése',
      content: (
        <div className="space-y-2">
          <p>
            <strong>Ön</strong> fiókját bármikor törölheti a Fiókbeállítások → Fiók törlése menüpontban.
            Személyes adatait az alkalmazandó adatmegőrzési kötelezettségekre figyelemmel 30 napon belül
            véglegesen töröljük (lásd{' '}
            <Link href="/privacy?lang=hu" className="text-brand-600 underline">Adatvédelmi tájékoztatónkat</Link>).
          </p>
          <p className="mt-2">
            <strong>A Studeals</strong> azonnali értesítés nélkül felfüggesztheti vagy megszüntetheti
            fiókját, ha megsérti a jelen feltételeket, csalárd tevékenységet folytat, vagy ha azt
            jogszabály írja elő. A megszüntetés nem érinti a megszerzett jogokat vagy kötelezettségeket.
          </p>
        </div>
      ),
    },
    {
      icon: Scale,
      title: '9. Irányadó jog és viták',
      content: (
        <div className="space-y-3">
          <p>
            Ezeket a feltételeket a magyar jog szabályozza. A jelen feltételekkel vagy a platformmal
            kapcsolatban felmerülő vitákat először jóhiszemű tárgyalással kell rendezni. Megoldás hiányában
            a vitákat a Magyarország illetékes bíróságai elé kell utalni. Az EU-s fogyasztók fenntartják
            azt a jogot, hogy alternatív vitarendezési eljárást (ADR) kezdeményezzenek tartózkodási
            helyük szerinti országban.
          </p>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mt-3 space-y-2">
            <p className="text-xs font-semibold text-blue-800">Panasztétel lehetőségei:</p>
            <a
              href="https://ec.europa.eu/consumers/odr/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-blue-700 hover:underline"
            >
              <ExternalLink size={11} />
              EU online vitarendezési platform — ec.europa.eu/consumers/odr
            </a>
            <a
              href="https://bfkh.gov.hu/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-blue-700 hover:underline"
            >
              <ExternalLink size={11} />
              Magyar Fogyasztóvédelmi Hatóság (BFKH) — bfkh.gov.hu
            </a>
            <a
              href="https://naih.hu"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-blue-700 hover:underline"
            >
              <ExternalLink size={11} />
              NAIH (adatvédelmi panasz) — naih.hu
            </a>
          </div>
        </div>
      ),
    },
    {
      icon: Mail,
      title: '10. Kapcsolat',
      content: (
        <p>
          A jelen feltételekkel kapcsolatos kérdésekkel forduljon hozzánk a{' '}
          <a href="mailto:legal@studeals.app" className="text-brand-600 underline">legal@studeals.app</a>{' '}
          címen. Adatvédelmi kérdésekért lásd{' '}
          <Link href="/privacy?lang=hu" className="text-brand-600 underline">Adatvédelmi tájékoztatónkat</Link>,
          vagy lépjen kapcsolatba velünk a{' '}
          <a href="mailto:privacy@studeals.app" className="text-brand-600 underline">privacy@studeals.app</a>{' '}
          címen.
        </p>
      ),
    },
  ],
};

// ---------------------------------------------------------------------------
// English content
// ---------------------------------------------------------------------------

const EN = {
  pageTitle: 'Terms of Service',
  langLabel: 'English',
  otherLang: 'Magyar',
  lastUpdated: 'Last updated: May 2026 · Applies to studeals.vercel.app',
  jurisdictionBadge: (
    <>
      <strong>Jurisdiction: Hungary.</strong> These Terms are governed by Hungarian law (Civil Code,
      Ptk.) and applicable EU consumer protection regulations. These Terms form a binding agreement
      between you and Studeals when you use the platform.
    </>
  ),
  odrBanner: (
    <>
      <strong>EU Dispute Resolution:</strong> You may submit a consumer complaint to the EU Online
      Dispute Resolution platform at{' '}
      <a
        href="https://ec.europa.eu/consumers/odr/"
        target="_blank"
        rel="noopener noreferrer"
        className="underline"
      >
        ec.europa.eu/consumers/odr
      </a>
      . For consumer protection matters in Hungary, contact the{' '}
      <a
        href="https://bfkh.gov.hu/"
        target="_blank"
        rel="noopener noreferrer"
        className="underline"
      >
        Hungarian Consumer Protection Authority (BFKH)
      </a>
      .
    </>
  ),
  ctaTitle: 'Questions about these Terms?',
  ctaBody: 'Our legal team is happy to help with any questions about your rights or obligations.',
  ctaFooter: 'Also see our',
  ctaFooterLink: 'Privacy Policy',
  backLabel: 'Back',
  sections: [
    {
      icon: FileText,
      title: '1. Acceptance of Terms',
      content: (
        <p>
          By creating an account on Studeals (available at{' '}
          <a href="https://studeals.vercel.app" className="text-brand-600 underline">
            studeals.vercel.app
          </a>
          ), accessing the platform, or using any of its features, you agree to be bound by these
          Terms of Service ("Terms") and our{' '}
          <Link href="/privacy" className="text-brand-600 underline">Privacy Policy</Link>. If you
          do not agree to these Terms, you may not use the platform. We may update these Terms from
          time to time; continued use after changes are posted constitutes acceptance. Material
          changes will be notified via in-app notification.
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
            <li>Be at least 16 years of age (GDPR Art. 8).</li>
          </ul>
          <p className="mt-2">
            Providing false verification documents is a violation of these Terms and may result in
            immediate account suspension and referral to the relevant institution. Studeals reserves
            the right to re-verify your status at any time.
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
            <li>Honour all published discounts and promotions when presented with a valid, unexpired Studeals voucher or QR stamp.</li>
            <li>Ensure offer descriptions, discount values, and expiry dates are accurate at the time of publication.</li>
            <li>Not discriminate against students presenting Studeals vouchers in a manner inconsistent with the advertised offer.</li>
            <li>Use the platform&apos;s QR scanner to confirm redemptions.</li>
            <li>Comply with all applicable Hungarian consumer protection laws and advertising standards.</li>
            <li>Not use student data obtained through the platform for any purpose other than confirming the specific redemption at hand.</li>
          </ul>
          <p className="mt-2">
            Studeals reserves the right to remove vendor listings, suspend accounts, or terminate
            vendor access for repeated non-fulfilment of advertised offers or breach of these Terms.
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
            { term: 'Expiry', detail: "QR vouchers expire 24 hours after generation. Loyalty stamps expire per the vendor's configured stamp expiry window (default: no expiry unless the vendor sets one)." },
            { term: 'Single use', detail: 'Each claimed voucher is valid for a single redemption at the issuing vendor. Voucher codes must not be shared, screenshotted, or transferred to another person.' },
            { term: 'Non-transferable', detail: 'Vouchers and stamp cards are tied to your verified student account. They have no monetary or exchange value and cannot be sold or transferred.' },
            { term: 'No cash equivalent', detail: "Discounts are applied at the point of sale by the vendor. Studeals does not process any financial transaction and is not a party to the sale." },
            { term: 'Fraudulent use', detail: 'Attempting to forge, reuse, or alter vouchers or stamps is a breach of these Terms and may constitute fraud under Hungarian law.' },
            { term: 'Loyalty rewards', detail: "Reward thresholds (e.g., \"free coffee after 10 stamps\") are set by the vendor and may change at the vendor's discretion with reasonable notice." },
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
            <strong>Studeals is a marketplace intermediary.</strong> We connect students with vendors
            but are not a party to any transaction between them. We make no warranty that:
          </p>
          <ul className="list-disc ml-5 space-y-1.5 text-gray-600">
            <li>Any specific offer will remain available or be fulfilled by the vendor.</li>
            <li>The platform will be free of interruptions, errors, or security breaches.</li>
            <li>Savings figures displayed are guaranteed or represent actual cash savings.</li>
          </ul>
          <p className="mt-3">
            To the maximum extent permitted by Hungarian law, Studeals shall not be liable for
            indirect, incidental, or consequential damages arising from your use of the platform,
            including losses resulting from a vendor&apos;s failure to honour a voucher.
          </p>
          <p className="mt-3">
            Nothing in these Terms limits Studeals&apos; liability for death or personal injury
            caused by negligence, fraud, or fraudulent misrepresentation, or any other liability
            that cannot be excluded by law.
          </p>
        </div>
      ),
    },
    {
      icon: Gavel,
      title: '7. Intellectual Property',
      content: (
        <p>
          All platform content, branding, code, and design belonging to Studeals is protected by
          copyright and intellectual property law. Vendors retain ownership of their business
          information and offer content, but grant Studeals a licence to display it on the platform.
          You may not reproduce, redistribute, or create derivative works from Studeals content
          without express written permission.
        </p>
      ),
    },
    {
      icon: FileText,
      title: '8. Account Termination',
      content: (
        <div className="space-y-2">
          <p>
            <strong>You</strong> may delete your account at any time from Account Settings → Delete
            Account. Your personal data will be permanently erased within 30 days, subject to our
            data retention obligations under applicable law (see our{' '}
            <Link href="/privacy" className="text-brand-600 underline">Privacy Policy</Link>).
          </p>
          <p className="mt-2">
            <strong>Studeals</strong> may suspend or terminate your account immediately and without
            notice if you breach these Terms, engage in fraudulent activity, or if we are required
            to do so by law. Termination does not affect any accrued rights or obligations.
          </p>
        </div>
      ),
    },
    {
      icon: Scale,
      title: '9. Governing Law & Disputes',
      content: (
        <div className="space-y-3">
          <p>
            These Terms are governed by the laws of Hungary. Any dispute arising out of or relating
            to these Terms or the platform shall first be subject to good-faith negotiation. If
            unresolved, disputes shall be referred to the competent courts of Hungary. EU consumers
            retain the right to pursue alternative dispute resolution (ADR) in their country of
            residence.
          </p>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mt-3 space-y-2">
            <p className="text-xs font-semibold text-blue-800">How to raise a complaint:</p>
            <a
              href="https://ec.europa.eu/consumers/odr/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-blue-700 hover:underline"
            >
              <ExternalLink size={11} />
              EU Online Dispute Resolution — ec.europa.eu/consumers/odr
            </a>
            <a
              href="https://bfkh.gov.hu/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-blue-700 hover:underline"
            >
              <ExternalLink size={11} />
              Hungarian Consumer Protection Authority (BFKH) — bfkh.gov.hu
            </a>
            <a
              href="https://naih.hu"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-blue-700 hover:underline"
            >
              <ExternalLink size={11} />
              NAIH (data protection complaints) — naih.hu
            </a>
          </div>
        </div>
      ),
    },
    {
      icon: Mail,
      title: '10. Contact',
      content: (
        <p>
          For questions about these Terms, contact us at{' '}
          <a href="mailto:legal@studeals.app" className="text-brand-600 underline">
            legal@studeals.app
          </a>
          . For privacy-related enquiries, see our{' '}
          <Link href="/privacy" className="text-brand-600 underline">Privacy Policy</Link> or
          contact{' '}
          <a href="mailto:privacy@studeals.app" className="text-brand-600 underline">
            privacy@studeals.app
          </a>
          .
        </p>
      ),
    },
  ],
};

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

function TermsContent() {
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
            <Scale size={22} className="text-brand-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t.pageTitle}</h1>
            <p className="text-gray-500 text-sm mt-1">{t.lastUpdated}</p>
          </div>
        </div>

        {/* Jurisdiction badge */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 flex items-start gap-3">
          <Gavel size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">{t.jurisdictionBadge}</p>
        </div>

        {/* EU ODR banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-8 flex items-start gap-3">
          <ExternalLink size={16} className="text-blue-600 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800">{t.odrBanner}</p>
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
            href="mailto:legal@studeals.app"
            className="inline-block bg-white text-brand-600 font-bold text-sm px-5 py-2 rounded-xl hover:bg-blue-50 transition-colors"
          >
            legal@studeals.app
          </a>
          <p className="text-blue-200 text-xs mt-3">
            {t.ctaFooter}{' '}
            <Link href={isHU ? '/privacy?lang=hu' : '/privacy'} className="underline">
              {t.ctaFooterLink}
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

export default function TermsPage() {
  return (
    <Suspense>
      <TermsContent />
    </Suspense>
  );
}
