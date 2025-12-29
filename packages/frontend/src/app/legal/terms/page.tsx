// app/legal/terms/page.tsx

export default function TermsPage() {
    return (
        <section>
            <h1 className="text-3xl font-semibold mb-4">
                Auren Ventures Inc – Terms of Service
            </h1>
            <p className="text-sm text-white/60 mb-8">
                Last updated: November 26, 2025
            </p>

            <p className="mb-4">
                These Terms of Service (“Terms”) govern your access to and use of Auren
                (“Auren,” “we,” “us,” or “our”), including our website, platform, tools,
                and services that allow users to create custom physical products that we
                manufacture and ship to their door (the “Services”). By accessing or
                using Auren, you agree to these Terms. If you do not agree, do not use
                our Services.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-3">1. About Us</h2>
            <p className="mb-2">
                Auren is an AI-powered platform that enables users to design,
                customize, and purchase physical products. We handle product creation,
                manufacturing, and delivery.
            </p>
            <ul className="list-disc list-inside space-y-1 mb-4">
                <li>Company: Auren Ventures Inc</li>
                <li>Contact: team@auren.co</li>
            </ul>

            <h2 className="text-xl font-semibold mt-8 mb-3">2. Using Auren</h2>
            <ul className="list-disc list-inside space-y-1 mb-4">
                <li>
                    You must create an account to use our platform and agree to provide
                    accurate, up-to-date information.
                </li>
                <li>
                    Auren is intended for users 13+ (or the minimum age of digital consent
                    in your country). If you are under 18, you must have permission from a
                    parent or guardian.
                </li>
                <li>
                    We may suspend or terminate accounts that violate these Terms,
                    including accounts that upload harmful, illegal, or infringing
                    content.
                </li>
            </ul>

            <h2 className="text-xl font-semibold mt-8 mb-3">3. Ordering Products</h2>
            <h3 className="font-semibold mb-2">3.1 Order Acceptance</h3>
            <p className="mb-2">
                Your order is accepted once we send you an order confirmation email. At
                that point, a binding contract exists.
            </p>
            <p className="mb-2">We may reject or cancel an order if:</p>
            <ul className="list-disc list-inside space-y-1 mb-2">
                <li>the product cannot be manufactured;</li>
                <li>the order violates our acceptable use guidelines; or</li>
                <li>there is a pricing or technical error.</li>
            </ul>
            <p className="mb-4">
                In these cases, we will issue a refund if you were charged.
            </p>

            <h3 className="font-semibold mb-2">3.2 Custom Products</h3>
            <p className="mb-4">
                Every product purchased through Auren is custom-made to order using your
                inputs and designs. Production begins immediately after your order is
                confirmed.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-3">
                4. Pricing &amp; Payment
            </h2>
            <ul className="list-disc list-inside space-y-1 mb-4">
                <li>All prices are displayed at checkout.</li>
                <li>
                    Payments are securely processed through Stripe. Auren does not store
                    full credit card information.
                </li>
                <li>
                    Taxes, shipping rates, and applicable fees are shown before checkout.
                </li>
            </ul>

            <h2 className="text-xl font-semibold mt-8 mb-3">
                5. Shipping &amp; Delivery
            </h2>
            <p className="mb-2">
                Auren partners with vetted manufacturing and fulfillment providers,
                which may be located in the U.S. or internationally. Shipping times
                vary based on:
            </p>
            <ul className="list-disc list-inside space-y-1 mb-2">
                <li>the product type;</li>
                <li>your location; and</li>
                <li>the manufacturer’s location.</li>
            </ul>
            <p className="mb-4">
                Estimated delivery windows are provided at checkout. Once an order has
                shipped, we will provide tracking when available.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-3">
                6. No Returns or Refunds (Custom Products)
            </h2>
            <p className="mb-4">
                Because every item is custom-made for you, all sales are final. We do
                not accept cancellations, returns, or refunds after an order is placed.
                You acknowledge this before completing checkout.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-3">7. Your Content</h2>
            <h3 className="font-semibold mb-2">7.1 Ownership</h3>
            <p className="mb-2">
                You own all original content, designs, images, and inputs you upload
                (“User Content”). By using Auren, you grant us a worldwide,
                royalty-free, sublicensable license to use, reproduce, modify,
                manufacture, ship, and display your User Content solely to provide the
                Services.
            </p>

            <h3 className="font-semibold mb-2">7.2 Responsibility for Content</h3>
            <p className="mb-2">You are responsible for ensuring your content does not:</p>
            <ul className="list-disc list-inside space-y-1 mb-2">
                <li>violate any laws;</li>
                <li>infringe intellectual property; or</li>
                <li>contain hateful, harmful, or explicit material.</li>
            </ul>
            <p className="mb-4">
                Auren may refuse or remove content at our discretion. You agree to
                indemnify Auren against claims arising from your content.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-3">
                8. Auren’s Intellectual Property
            </h2>
            <p className="mb-4">
                Auren Ventures Inc owns all rights to the platform, website, AI models,
                software, branding, templates, and tools. You may not copy, reproduce,
                distribute, or create derivative works from our platform or content
                unless we explicitly allow it.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-3">
                9. Third-Party Services
            </h2>
            <p className="mb-4">
                To manufacture and ship products, we may share necessary information
                (such as product files and shipping addresses) with third-party
                production partners. These partners only receive information required to
                fulfill your order.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-3">10. Privacy</h2>
            <p className="mb-4">
                We only use your personal information in accordance with our Privacy
                Policy. This includes your email, name, address, phone number, and
                encrypted session data. Auren does not sell your personal data.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-3">11. Service Changes</h2>
            <p className="mb-4">
                We may update, improve, or modify Auren at any time. Minor changes will
                not materially impact your ability to use the platform.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-3">12. Disclaimers</h2>
            <p className="mb-4">
                Auren provides the Services “as-is.” We do not guarantee uninterrupted
                platform access, exact color or material match between screen preview
                and final product, or suitability of a custom product for any specific
                purpose. You are responsible for verifying the accuracy and
                appropriateness of your design before ordering.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-3">
                13. Limitation of Liability
            </h2>
            <p className="mb-4">
                To the fullest extent permitted by law, Auren Ventures Inc is not liable
                for lost profits, indirect or consequential damages, issues resulting
                from user-generated content, or delays caused by shipping carriers,
                manufacturers, or supply chain factors. Our maximum liability for any
                claim is the amount you paid for the relevant order.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-3">14. Termination</h2>
            <p className="mb-4">
                We may suspend or terminate your account if you violate these Terms,
                upload harmful or illegal content, misuse the platform, or engage in
                fraud or abusive behavior. You may delete your account at any time,
                which will permanently delete your stored data (subject to legal
                retention requirements).
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-3">15. Governing Law</h2>
            <p className="mb-4">
                These Terms are governed by the laws of your primary operating
                jurisdiction (to be finalized). You agree to resolve any disputes in the
                courts located in that jurisdiction.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-3">
                16. Changes to These Terms
            </h2>
            <p>
                We may update these Terms periodically. The latest version will always
                be posted on our website with an updated date. Continued use of the
                platform means you accept the new Terms.
            </p>
        </section>
    )
}