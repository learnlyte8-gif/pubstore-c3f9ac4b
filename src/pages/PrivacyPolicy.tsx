import LegalLayout from "@/components/legal/LegalLayout";

export default function PrivacyPolicy() {
  return (
    <LegalLayout
      title="Privacy Policy"
      description="PUBSTORE's Privacy Policy explains how we collect, use, share, and protect your personal information across marketplace, wallet, rides, and vertical services."
      canonicalPath="/privacy-policy"
      lastUpdated="5 August 2026"
    >
      <h2 className="text-xl font-bold mt-8 mb-3">1. Introduction</h2>
      <p>
        PUBSTORE ("we", "us", or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, store, share, and protect your personal information when you use the PUBSTORE platform, including our website, mobile applications, and related services (collectively, the "Platform").
      </p>
      <p>
        This policy is designed to be consistent with privacy laws applicable to our users, including the Protection of Personal Information Act (POPIA) in South Africa, the General Data Protection Regulation (GDPR) where it applies, and the California Consumer Privacy Act (CCPA) where it applies. We encourage you to read this policy carefully. If you have any questions, please contact us at privacy@pubstore.app.
      </p>

      <h2 className="text-xl font-bold mt-8 mb-3">2. What information we collect</h2>
      <p>
        We collect information that you provide directly to us, information generated automatically when you use the Platform, and information we receive from third-party partners.
      </p>
      <h3 className="text-lg font-semibold mt-5 mb-2">2.1 Information you provide</h3>
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Account information</strong>: name, email address, phone number, password, profile photo, and date of birth.</li>
        <li><strong>Identity and verification</strong>: government-issued ID, selfie photos, business registration documents, and tax information when required for supplier verification, KYC, or withdrawals.</li>
        <li><strong>Contact and address</strong>: shipping addresses, billing addresses, pickup and drop-off locations for rides and deliveries.</li>
        <li><strong>Payment information</strong>: wallet top-up records, transaction history, payout account details, and payment method references. We do not store raw card numbers; these are tokenized by our payment providers.</li>
        <li><strong>Content and communications</strong>: product listings, reviews, ratings, messages, chat history, RFQ requests, and support tickets.</li>
      </ul>
      <h3 className="text-lg font-semibold mt-5 mb-2">2.2 Information collected automatically</h3>
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Device and usage data</strong>: device type, operating system, IP address, browser type, app version, and crash logs.</li>
        <li><strong>Location data</strong>: precise location when you enable location services for rides, delivery, or nearby supplier features; approximate location derived from IP address.</li>
        <li><strong>Activity data</strong>: products you view, searches you run, suppliers you follow, orders you place, and live streams you watch.</li>
        <li><strong>Cookies and similar technologies</strong>: identifiers used to keep you signed in, remember preferences, and analyze usage.</li>
      </ul>
      <h3 className="text-lg font-semibold mt-5 mb-2">2.3 Information from third parties</h3>
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Payment processors</strong>: transaction confirmations, risk signals, and chargeback information.</li>
        <li><strong>Identity verification services</strong>: verification results and watchlist screening.</li>
        <li><strong>Social sign-in providers</strong>: name, email, and profile photo when you choose to sign in with Google or other OAuth providers.</li>
        <li><strong>Suppliers and service providers</strong>: delivery confirmations, driver or courier status, and service fulfillment data.</li>
      </ul>

      <h2 className="text-xl font-bold mt-8 mb-3">3. How we use your information</h2>
      <p>We use your information to operate, maintain, and improve the Platform, including:</p>
      <ul className="list-disc pl-5 space-y-1.5">
        <li>creating and securing your account;</li>
        <li>processing orders, payments, wallet transactions, refunds, and escrow settlements;</li>
        <li>connecting Buyers with Suppliers, drivers, couriers, and service providers;</li>
        <li>personalizing product recommendations, search results, and content feeds;</li>
        <li>enabling AI features such as semantic search, product import, and listing generation;</li>
        <li>preventing fraud, money laundering, and unauthorized access;</li>
        <li>verifying identities and complying with legal and tax obligations;</li>
        <li>communicating with you about orders, promotions, support, and policy updates;</li>
        <li>analyzing usage trends and improving the Platform experience.</li>
      </ul>

      <h2 className="text-xl font-bold mt-8 mb-3">4. Legal basis for processing</h2>
      <p>
        We process personal data where we have a legal basis to do so. The legal basis depends on the processing activity and may include:
      </p>
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Performance of a contract</strong>: to fulfill orders, process payments, and provide the services you request.</li>
        <li><strong>Legitimate interests</strong>: to prevent fraud, improve the Platform, and send service-related communications.</li>
        <li><strong>Legal obligation</strong>: to comply with tax, financial, and regulatory requirements.</li>
        <li><strong>Consent</strong>: for optional features such as marketing emails, personalized ads, precise location, and biometric unlock. You can withdraw consent at any time in Settings.</li>
      </ul>

      <h2 className="text-xl font-bold mt-8 mb-3">5. How we share your information</h2>
      <p>
        We do not sell your personal information. We share your information only in limited circumstances:
      </p>
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>With other users</strong>: when you place an Order, we share necessary information with the Supplier or courier (such as your name, delivery address, and contact number) so they can fulfill the order. Driver and rider details are shared during rides.</li>
        <li><strong>With service providers</strong>: payment processors, cloud hosting providers, identity verification services, fraud detection tools, email delivery services, and analytics providers. These providers are contractually bound to protect your data and use it only for the services they provide to us.</li>
        <li><strong>With legal and regulatory authorities</strong>: when required by law, court order, or to protect the safety, rights, or property of PUBSTORE, our users, or others.</li>
        <li><strong>With business partners</strong>: only with your consent or when you choose to use integrated services such as social sign-in or third-party delivery partners.</li>
        <li><strong>With affiliates and successors</strong>: in connection with a merger, acquisition, or sale of assets, subject to confidentiality obligations.</li>
      </ul>

      <h2 className="text-xl font-bold mt-8 mb-3">6. International data transfers</h2>
      <p>
        PUBSTORE is operated from South Africa. Some of our service providers and infrastructure are located in other countries. When we transfer personal data across borders, we use safeguards such as standard contractual clauses and data processing agreements to ensure that your information remains protected in accordance with this Privacy Policy and applicable law.
      </p>

      <h2 className="text-xl font-bold mt-8 mb-3">7. Data retention</h2>
      <p>
        We retain your personal information for as long as necessary to provide the Platform, comply with legal obligations, resolve disputes, and enforce our agreements. Specific retention periods depend on the type of data and the legal requirements that apply. For example, transaction and tax records may be retained for several years after account closure.
      </p>
      <p>
        When personal information is no longer needed, we delete it or anonymize it. If you close your account, some data may be retained for legal, fraud prevention, or analytical purposes, but we will not use it to market to you or create new user profiles.
      </p>

      <h2 className="text-xl font-bold mt-8 mb-3">8. Your privacy rights</h2>
      <p>
        Depending on where you live, you may have the following rights:
      </p>
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Access</strong>: request a copy of the personal information we hold about you.</li>
        <li><strong>Correction</strong>: request that we update inaccurate or incomplete information.</li>
        <li><strong>Deletion</strong>: request deletion of your personal information, subject to legal and contractual exceptions.</li>
        <li><strong>Objection</strong>: object to certain processing, such as direct marketing or profiling for marketing purposes.</li>
        <li><strong>Restriction</strong>: request that we limit processing of your data in certain circumstances.</li>
        <li><strong>Data portability</strong>: request a machine-readable copy of your data to transfer to another service.</li>
        <li><strong>Withdraw consent</strong>: withdraw consent for optional processing at any time.</li>
        <li><strong>Complaint</strong>: lodge a complaint with a data protection authority.</li>
      </ul>
      <p>
        You can exercise many of these rights directly in the PUBSTORE app under Settings &gt; Privacy, or by contacting us at privacy@pubstore.app. We will respond to verifiable requests within the timeframes required by applicable law.
      </p>

      <h2 className="text-xl font-bold mt-8 mb-3">9. Security</h2>
      <p>
        We implement technical and organizational measures aimed at protecting your personal information from unauthorized access, disclosure, alteration, and destruction. These measures include encryption in transit, access controls, monitoring, and regular security reviews.
      </p>
      <p>
        Payment card data is tokenized by our payment providers, and we do not store raw card numbers on our servers. However, no system is completely secure. You are responsible for keeping your account credentials confidential and for using strong, unique passwords.
      </p>

      <h2 className="text-xl font-bold mt-8 mb-3">10. Cookies and tracking</h2>
      <p>
        We use cookies and similar technologies to operate the Platform, remember your preferences, analyze usage, and deliver personalized content and advertising. You can manage cookie preferences through your browser or device settings. Some cookies are essential for the Platform to function, while others are optional.
      </p>
      <p>
        You can control personalized advertising and activity tracking in Settings &gt; Privacy. Disabling these features may reduce the relevance of recommendations and ads but will not prevent core Platform functionality.
      </p>

      <h2 className="text-xl font-bold mt-8 mb-3">11. Children</h2>
      <p>
        PUBSTORE is not intended for users under the age of 18. We do not knowingly collect personal information from children. If you believe a child has provided us with personal information, please contact us at privacy@pubstore.app and we will delete it.
      </p>

      <h2 className="text-xl font-bold mt-8 mb-3">12. AI features</h2>
      <p>
        Our AI features, such as semantic search, product import, and listing generation, may process data you provide to generate outputs. We do not use your personal messages or confidential account information to train third-party AI models. AI outputs are generated for your convenience and should be reviewed before use.
      </p>

      <h2 className="text-xl font-bold mt-8 mb-3">13. Changes to this Privacy Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will notify you of material changes through the app, email, or a prominent notice on the Platform. The "Last updated" date at the top of this page indicates the most recent revision.
      </p>

      <h2 className="text-xl font-bold mt-8 mb-3">14. Contact us</h2>
      <p>
        If you have questions or concerns about this Privacy Policy or our data practices, please contact us:
      </p>
      <ul className="list-disc pl-5 space-y-1.5">
        <li>Email: privacy@pubstore.app</li>
        <li>Support: help@pubstore.app or via the in-app Help Center</li>
        <li>Legal: legal@pubstore.app</li>
      </ul>
      <p className="mt-4">
        We are committed to working with you to resolve any privacy concern. Please also review our Terms of Service for information about using the Platform.
      </p>
    </LegalLayout>
  );
}
