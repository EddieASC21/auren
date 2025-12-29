// app/legal/cookies/page.tsx

export default function CookiesPage() {
    return (
        <section>
            <h1 className="text-3xl font-semibold mb-4">
                Auren Ventures Inc – Cookie Policy
            </h1>
            <p className="text-sm text-white/60 mb-8">
                Last updated: November 26, 2025
            </p>

            <p className="mb-4">
                This Cookie Policy explains how Auren Ventures Inc (“Auren,” “we,” “us,”
                or “our”) uses cookies and similar technologies when you visit our
                website or use our Services. By using Auren, you agree to the use of
                cookies as described in this policy.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-3">1. What Are Cookies?</h2>
            <p className="mb-2">
                Cookies are small text files placed on your device when you visit a
                website. They help websites function properly, remember preferences, and
                improve user experience. Cookies may be:
            </p>
            <ul className="list-disc list-inside space-y-1 mb-4">
                <li>Session cookies: deleted when you close your browser</li>
                <li>Persistent cookies: stored until they expire or are deleted</li>
                <li>First-party cookies: set by Auren</li>
                <li>Third-party cookies: set by external services we use</li>
            </ul>

            <h2 className="text-xl font-semibold mt-8 mb-3">
                2. How We Use Cookies
            </h2>
            <p className="mb-4">
                Auren uses cookies to ensure the platform works securely and smoothly.
                Our cookies fall into the following categories:
            </p>

            <h3 className="font-semibold mb-2">2.1 Essential Cookies</h3>
            <p className="mb-2">
                These are required for Auren to function. Without them, core features
                will not work. They are used for:
            </p>
            <ul className="list-disc list-inside space-y-1 mb-4">
                <li>Secure login sessions (NextAuth)</li>
                <li>Keeping your cart active</li>
                <li>Encrypted checkout functionality</li>
                <li>Server authentication</li>
                <li>Fraud prevention</li>
                <li>Basic site security</li>
            </ul>
            <p className="mb-4">These cookies cannot be disabled.</p>

            <h3 className="font-semibold mb-2">2.2 Functional Cookies</h3>
            <p className="mb-2">These help remember your preferences, such as:</p>
            <ul className="list-disc list-inside space-y-1 mb-4">
                <li>Saved login state</li>
                <li>Language settings</li>
                <li>View and layout preferences</li>
            </ul>

            <h3 className="font-semibold mb-2">2.3 Analytics Cookies</h3>
            <p className="mb-2">
                We use analytics cookies to understand how users interact with our
                platform so we can improve the experience, including:
            </p>
            <ul className="list-disc list-inside space-y-1 mb-4">
                <li>Tracking page visits</li>
                <li>Understanding feature usage</li>
                <li>Performance optimization</li>
            </ul>
            <p className="mb-4">
                We do not use analytics cookies to identify you personally.
            </p>

            <h3 className="font-semibold mb-2">2.4 Third-Party Cookies</h3>
            <p className="mb-2">
                Some cookies are placed by third-party services integrated into Auren,
                such as:
            </p>
            <ul className="list-disc list-inside space-y-1 mb-4">
                <li>Stripe (for secure payment processing)</li>
                <li>Cloud hosting/CDN providers</li>
                <li>Analytics services</li>
                <li>Manufacturing or fulfillment-related partners, if applicable</li>
            </ul>
            <p className="mb-4">
                These third parties may collect and process data according to their own
                policies.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-3">
                3. What Cookies Do We Use?
            </h2>
            <p className="mb-4">
                Common cookies used on Auren include session cookies for authentication,
                HTTP-only encrypted cookies for cart data, security cookies to protect
                user accounts, OAuth cookies for Google/Apple login, and analytics
                cookies for site metrics. We do not use cookies for advertising or
                behavioral tracking.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-3">
                4. Managing Cookies
            </h2>
            <p className="mb-4">
                You can control cookies through your browser settings. You may block or
                delete cookies, but doing so may affect platform functionality. If you
                disable essential cookies, you may not be able to log in, your cart may
                not save, and custom product creation may not function correctly.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-3">
                5. Do Not Track (DNT)
            </h2>
            <p className="mb-4">
                Auren does not currently respond to Do Not Track signals, as there is no
                industry standard for doing so.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-3">
                6. Changes to This Cookie Policy
            </h2>
            <p className="mb-4">
                We may update this policy periodically. The “Last Updated” date
                indicates the latest version. Continued use of the platform constitutes
                acceptance of any changes.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-3">7. Contact Us</h2>
            <p>
                If you have questions about this Cookie Policy, contact us at{' '}
                <span className="underline">team@auren.co</span>.
            </p>
        </section>
    )
}