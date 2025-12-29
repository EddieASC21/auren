// app/legal/privacy/page.tsx

export default function PrivacyPage() {
    return (
        <section>
            <h1 className="text-3xl font-semibold mb-4">
                Auren Ventures Inc – Privacy Policy
            </h1>
            <p className="text-sm text-white/60 mb-8">
                Last updated: November 26, 2025
            </p>

            <p className="mb-4">
                This Privacy Policy explains how Auren Ventures Inc (“Auren,” “we,”
                “us,” or “our”) collects, uses, stores, and shares your information when
                you access or use our website, platform, and services that enable you to
                design, customize, purchase, and receive custom physical products
                (“Services”). By using Auren, you consent to the practices described in
                this Privacy Policy.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-3">
                1. Information We Collect
            </h2>
            <h3 className="font-semibold mb-2">1.1 Personal Information</h3>
            <ul className="list-disc list-inside space-y-1 mb-4">
                <li>Name</li>
                <li>Email address</li>
                <li>Phone number</li>
                <li>Shipping address</li>
                <li>Billing address</li>
            </ul>

            <h3 className="font-semibold mb-2">1.2 Payment Information</h3>
            <p className="mb-2">
                Payments are processed by Stripe. We do not store full credit card
                numbers or payment credentials. Stripe may collect:
            </p>
            <ul className="list-disc list-inside space-y-1 mb-4">
                <li>Card number</li>
                <li>Expiration date</li>
                <li>Security code</li>
                <li>Billing information</li>
            </ul>
            <p className="mb-4">
                Their processing is governed by Stripe’s own privacy policy.
            </p>

            <h3 className="font-semibold mb-2">1.3 Account Information</h3>
            <ul className="list-disc list-inside space-y-1 mb-4">
                <li>Login credentials (email + password)</li>
                <li>Login activity</li>
                <li>OAuth data (Google/Apple sign-in) if used</li>
            </ul>
            <p className="mb-4">Passwords are securely hashed (bcrypt).</p>

            <h3 className="font-semibold mb-2">1.4 Design &amp; Product Data</h3>
            <p className="mb-2">To create custom products, we collect:</p>
            <ul className="list-disc list-inside space-y-1 mb-4">
                <li>Uploaded images, text, or designs</li>
                <li>Product specifications or preferences</li>
                <li>Generated output files for manufacturing</li>
            </ul>

            <h3 className="font-semibold mb-2">1.5 Technical Information</h3>
            <p className="mb-2">
                Collected automatically when you use the platform, including:
            </p>
            <ul className="list-disc list-inside space-y-1 mb-4">
                <li>IP address</li>
                <li>Browser type</li>
                <li>Device information</li>
                <li>Usage data (pages visited, actions taken)</li>
                <li>Cookie data</li>
                <li>Encrypted cart/session information (via HTTP-only cookies)</li>
            </ul>

            <h2 className="text-xl font-semibold mt-8 mb-3">
                2. How We Use Your Information
            </h2>
            <p className="mb-2">We use your information to:</p>
            <ul className="list-disc list-inside space-y-1 mb-4">
                <li>Create and manage your Auren account</li>
                <li>Enable product customization and manufacturing</li>
                <li>Process and fulfill your orders</li>
                <li>Communicate order updates and support</li>
                <li>Improve platform performance and user experience</li>
                <li>Prevent fraud and maintain platform security</li>
                <li>Comply with legal obligations</li>
            </ul>
            <p className="mb-4">We do not sell your personal data.</p>

            <h2 className="text-xl font-semibold mt-8 mb-3">
                3. How We Share Your Information
            </h2>
            <p className="mb-2">
                We only share information when necessary to operate our Services.
            </p>

            <h3 className="font-semibold mb-2">
                3.1 Manufacturing &amp; Fulfillment Partners
            </h3>
            <p className="mb-2">
                To produce and ship your custom products, we share with our vetted
                partner factories:
            </p>
            <ul className="list-disc list-inside space-y-1 mb-4">
                <li>Your design files</li>
                <li>Your name</li>
                <li>Shipping address</li>
                <li>Order details</li>
            </ul>
            <p className="mb-4">
                These partners use your data solely to make and deliver your products.
            </p>

            <h3 className="font-semibold mb-2">3.2 Payment Processor</h3>
            <p className="mb-4">
                We share order details with Stripe to process payments.
            </p>

            <h3 className="font-semibold mb-2">3.3 Service Providers</h3>
            <p className="mb-2">
                We may use third-party providers for cloud hosting, database management,
                analytics, and customer support. They access data only as necessary to
                perform their services.
            </p>

            <h3 className="font-semibold mb-2">3.4 Legal Requirements</h3>
            <p className="mb-4">
                We may disclose information if required by law, legal process, or to
                protect Auren’s rights.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-3">
                4. Cookies &amp; Tracking Technologies
            </h2>
            <p className="mb-4">
                Auren uses cookies for secure session management, cart encryption,
                saving login states, and basic analytics. You may disable cookies via
                your browser, but the platform may not function fully.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-3">
                5. International Data Transfers
            </h2>
            <p className="mb-4">
                Some manufacturing or fulfillment partners may be located outside your
                country (e.g., Canada, EU, Australia, China). If a product is produced
                abroad, your shipping address must be shared with that facility. By
                placing an order, you consent to these transfers.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-3">6. Data Security</h2>
            <p className="mb-4">
                We protect your data using PostgreSQL with Prisma ORM, HTTPS &amp; TLS
                encryption, HTTP-only encrypted cookies, bcrypt password hashing,
                strict access controls, automatic session expiration, and secure OAuth
                flows. While no system is perfect, we follow industry-standard security
                practices.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-3">7. Data Retention</h2>
            <p className="mb-4">
                We retain your information until you delete your account, you request
                data deletion, or the data is no longer needed for its original
                purpose. Design files, account data, and order history are deleted upon
                account deletion unless we are legally required to keep them.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-3">8. Your Rights</h2>
            <p className="mb-2">
                Depending on your location, you may have rights to:
            </p>
            <ul className="list-disc list-inside space-y-1 mb-4">
                <li>Access your personal data</li>
                <li>Correct inaccurate data</li>
                <li>Request deletion</li>
                <li>Request a copy of your data</li>
                <li>Opt out of marketing emails</li>
                <li>Limit processing (where applicable)</li>
            </ul>
            <p className="mb-4">
                You can manage most of these within your account or by emailing
                team@auren.co.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-3">
                9. Children&apos;s Privacy
            </h2>
            <p className="mb-4">
                Auren is not directed to children under 13. We do not knowingly collect
                personal information from children under the age of 13.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-3">
                10. Third-Party Links
            </h2>
            <p className="mb-4">
                Our website may contain links to third-party sites. We are not
                responsible for their privacy practices.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-3">
                11. Changes to This Policy
            </h2>
            <p className="mb-4">
                We may update this Privacy Policy periodically. The “Last Updated” date
                reflects the most recent version. Continued use of Auren indicates
                acceptance of changes.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-3">12. Contact Us</h2>
            <p>
                If you have questions about this Privacy Policy or your data, email us
                at <span className="underline">team@auren.co</span>.
            </p>
        </section>
    )
}