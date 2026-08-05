import LegalLayout from "@/components/legal/LegalLayout";

export default function Terms() {
  return (
    <LegalLayout
      title="Terms of Service"
      description="PUBSTORE Terms of Service for buyers, suppliers, and users of the marketplace, wallet, rides, and vertical services."
      canonicalPath="/terms"
      lastUpdated="5 August 2026"
    >
      <h2 className="text-xl font-bold mt-8 mb-3">1. Welcome to PUBSTORE</h2>
      <p>
        These Terms of Service ("Terms") govern your access to and use of PUBSTORE, the social marketplace platform that brings together products, stories, and people across marketplace, news, stays, autos, jobs, services, rides, logistics, and more. PUBSTORE is operated by PUBSTORE ("we", "us", or "our"). By using PUBSTORE, you agree to these Terms. If you do not agree, please do not use the platform.
      </p>
      <p>
        These Terms apply to everyone who accesses or uses PUBSTORE, including buyers, suppliers, sellers, drivers, couriers, service providers, and visitors. Additional policies may apply to specific features, such as the Supplier Plans, AI Credits, Buyer Protection, and Delivery & Courier Payouts policies.
      </p>

      <h2 className="text-xl font-bold mt-8 mb-3">2. Eligibility and accounts</h2>
      <p>
        You must be at least 18 years old to create an account or enter into transactions on PUBSTORE. By registering, you confirm that the information you provide is accurate and complete, and that you will keep it up to date. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.
      </p>
      <p>
        We reserve the right to suspend or terminate accounts that violate these Terms, are inactive for extended periods, or are associated with fraudulent, abusive, or illegal activity. We may also require identity verification before enabling certain features, such as becoming a supplier, withdrawing wallet funds, or running ad campaigns.
      </p>

      <h2 className="text-xl font-bold mt-8 mb-3">3. Definitions</h2>
      <p>In these Terms, the following definitions apply:</p>
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Platform</strong> means the PUBSTORE website, mobile applications, and related services.</li>
        <li><strong>Buyer</strong> means a user who purchases, books, or requests products or services through the Platform.</li>
        <li><strong>Supplier</strong> means a user who lists, sells, advertises, or provides products or services through the Platform.</li>
        <li><strong>Order</strong> means a transaction initiated by a Buyer for products or services listed by a Supplier.</li>
        <li><strong>Wallet</strong> means the PUBSTORE Pay stored-value account used for payments, transfers, refunds, and withdrawals.</li>
        <li><strong>Escrow</strong> means the buyer-protection process where funds are held until delivery conditions are met.</li>
        <li><strong>Content</strong> means any text, images, videos, reviews, listings, and other materials posted on the Platform.</li>
      </ul>

      <h2 className="text-xl font-bold mt-8 mb-3">4. Buyer terms</h2>
      <p>
        When you place an Order, you are making an offer to purchase the listed item on the terms described in the listing. Prices are set by Suppliers and may change without notice. You are responsible for reviewing the item description, price, delivery options, and Supplier policies before completing a purchase.
      </p>
      <p>
        Payment is processed through PUBSTORE Pay or approved third-party payment methods. By completing payment, you authorize us to charge the applicable amount, including the item price, shipping or delivery fees, applicable taxes, and platform fees.
      </p>
      <p>
        Delivery terms depend on the Supplier and any selected courier or delivery partner. If no partnered courier is available, delivery may be arranged directly with the Supplier. Shipping fees are displayed at checkout and are paid to the chosen courier upon successful delivery, subject to our Delivery & Courier Payouts policy.
      </p>
      <p>
        You may request a refund only if the product has not been delivered and the order has not yet been marked as processing by the Supplier. If the Supplier has begun processing, cancellation is not available, but you may raise a dispute through the in-app support center.
      </p>

      <h2 className="text-xl font-bold mt-8 mb-3">5. Supplier terms</h2>
      <p>
        To list products or services, you must apply to become a Supplier and select a Supplier Plan (Free, Pro, or Elite). Suppliers are responsible for the accuracy of their listings, the quality and legality of their products and services, compliance with applicable laws, and fulfillment of Orders.
      </p>
      <p>
        We charge a commission on the sale of goods, calculated on the cost of goods sold (excluding shipping). Commission rates vary by Supplier Plan: 12% for Free, 7% for Pro, and 4% for Elite. Suppliers may also purchase AI credits, ad campaigns, and premium features subject to separate pricing.
      </p>
      <p>
        Suppliers must mark Orders as "processing" and then "delivered" through the Supplier dashboard. Settlement of funds to the Supplier's sales wallet occurs only after the Buyer has confirmed delivery or after the applicable delivery-confirmation period expires. If a refund is approved, the held funds are released back to the Buyer.
      </p>
      <p>
        Suppliers must not list prohibited items, counterfeit goods, or services that violate intellectual property rights, consumer protection laws, or platform policies. We may remove listings, withhold settlements, or suspend Supplier accounts for violations.
      </p>

      <h2 className="text-xl font-bold mt-8 mb-3">6. Wallet, payments, and refunds</h2>
      <p>
        PUBSTORE Pay is a stored-value wallet that enables payments for Orders, peer-to-peer transfers, withdrawals, and AI credit purchases. Wallet balances are not bank deposits and do not earn interest. You are responsible for maintaining sufficient funds for transactions you authorize.
      </p>
      <p>
        You may top up your wallet using approved payment methods. Withdrawals are subject to verification, available balance, and any applicable processing times. Withdrawal requests may be approved manually by administrators to prevent fraud and ensure compliance.
      </p>
      <p>
        Refunds are processed to the Buyer's wallet when a refund request is approved. We reserve the right to recover funds from Suppliers or other users when refunds, chargebacks, or reversals are necessary.
      </p>

      <h2 className="text-xl font-bold mt-8 mb-3">7. Buyer protection and escrow</h2>
      <p>
        To protect Buyers, payments for most Orders are held in escrow until the Buyer confirms receipt. The Supplier may mark the Order as delivered, but the Buyer must independently confirm delivery before the held funds are released to the Supplier.
      </p>
      <p>
        If the Buyer does not confirm delivery within a reasonable period, the Platform may release the funds automatically based on tracking data or the Supplier's delivery confirmation, subject to the Buyer's right to dispute non-delivery or misdelivery.
      </p>
      <p>
        If a Buyer raises a valid non-delivery or significant misdescription claim, we may reverse the transaction and refund the Buyer from the held escrow funds. We reserve the right to make final decisions on disputes, but encourage Buyers and Suppliers to resolve issues directly through the in-app chat.
      </p>

      <h2 className="text-xl font-bold mt-8 mb-3">8. AI credits and AI features</h2>
      <p>
        AI-powered features, such as semantic search, product import, listing generation, and document analysis, consume AI credits. Each account receives a limited number of free AI actions; additional actions require a paid plan or top-up pack. AI credit usage is tracked server-side and is non-refundable unless a billing error occurs.
      </p>
      <p>
        AI outputs are generated by third-party models and are provided for convenience only. You are responsible for reviewing and validating any AI-generated listings, descriptions, or recommendations before publishing or acting on them.
      </p>

      <h2 className="text-xl font-bold mt-8 mb-3">9. Rides, logistics, and services</h2>
      <p>
        Rides, logistics, and other service features connect users with independent drivers, couriers, and service providers. PUBSTORE facilitates the connection, payment, and dispute resolution, but the underlying service contract is between the user and the provider. We do not guarantee availability, timing, or service quality.
      </p>
      <p>
        Drivers and couriers must comply with applicable licensing, insurance, and vehicle safety requirements. Users must provide accurate pickup and destination information and follow the provider's safety policies.
      </p>

      <h2 className="text-xl font-bold mt-8 mb-3">10. Prohibited conduct</h2>
      <p>You may not use PUBSTORE to:</p>
      <ul className="list-disc pl-5 space-y-1.5">
        <li>violate any applicable law or regulation;</li>
        <li>infringe intellectual property, privacy, or other rights;</li>
        <li>sell counterfeit, illegal, dangerous, or prohibited goods;</li>
        <li>engage in fraud, money laundering, or market manipulation;</li>
        <li>harass, threaten, or discriminate against other users;</li>
        <li>interfere with the platform's security, integrity, or availability;</li>
        <li>use automated scraping, bots, or other unauthorized means to access the platform;</li>
        <li>circumvent fees, escrow, or our commission model.</li>
      </ul>

      <h2 className="text-xl font-bold mt-8 mb-3">11. Intellectual property</h2>
      <p>
        PUBSTORE and its branding, trademarks, logos, software, and content are owned by us or our licensors and are protected by intellectual property laws. You may not use our trademarks without written permission.
      </p>
      <p>
        You retain ownership of Content you post, but you grant us a worldwide, non-exclusive, royalty-free license to use, display, distribute, and modify your Content for the purpose of operating, promoting, and improving the Platform. You represent that you have the right to post your Content and that it does not infringe third-party rights.
      </p>

      <h2 className="text-xl font-bold mt-8 mb-3">12. Dispute resolution</h2>
      <p>
        We encourage users to resolve disputes through direct communication and the in-app support center. If a dispute cannot be resolved, PUBSTORE will make a good-faith decision based on available evidence, including order records, chat messages, tracking data, and delivery confirmations.
      </p>
      <p>
        Nothing in these Terms prevents either party from seeking injunctive relief or pursuing claims in a court of competent jurisdiction. The laws of the Republic of South Africa, where PUBSTORE is operated, govern these Terms, except where local consumer protection laws require otherwise.
      </p>

      <h2 className="text-xl font-bold mt-8 mb-3">13. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, PUBSTORE is not liable for any indirect, incidental, special, consequential, or punitive damages, including lost profits or data loss, arising from your use of the Platform. Our total liability for any claim arising out of these Terms is limited to the amount paid by you for the specific transaction giving rise to the claim, or the amount of fees paid by you to PUBSTORE in the six months preceding the claim, whichever is higher.
      </p>
      <p>
        We do not guarantee that the Platform will be uninterrupted, error-free, or secure, and we are not responsible for the actions, content, or omissions of other users or third-party providers.
      </p>

      <h2 className="text-xl font-bold mt-8 mb-3">14. Termination and suspension</h2>
      <p>
        You may close your account at any time from the Settings page. We may suspend or terminate your account, remove Content, or restrict features if you violate these Terms, pose a risk to other users, or where required by law. Upon termination, your rights to use the Platform cease, but provisions related to payment, escrow, intellectual property, and dispute resolution will survive.
      </p>

      <h2 className="text-xl font-bold mt-8 mb-3">15. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. We will notify users of material changes through the app, email, or a prominent notice on the Platform. Continued use of PUBSTORE after changes take effect constitutes acceptance of the revised Terms. The "Last updated" date at the top of this page indicates when the Terms were most recently revised.
      </p>

      <h2 className="text-xl font-bold mt-8 mb-3">16. Contact us</h2>
      <p>
        If you have questions about these Terms, please contact us at:
      </p>
      <ul className="list-disc pl-5 space-y-1.5">
        <li>Email: legal@pubstore.app</li>
        <li>Support: help@pubstore.app or via the in-app Help Center</li>
        <li>Privacy: privacy@pubstore.app</li>
      </ul>
      <p className="mt-4">
        These Terms are designed to be fair and transparent. We recommend that you read them together with our Privacy Policy and other applicable policies before using PUBSTORE.
      </p>
    </LegalLayout>
  );
}
