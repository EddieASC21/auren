'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

const CONTACT_API_BASE =
    process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export default function ContactPage() {
    const [submitted, setSubmitted] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setError(null)

        const formData = new FormData(e.currentTarget)

        const fullName = (formData.get('fullName') ?? '').toString().trim()
        const organization = (formData.get('organization') ?? '').toString().trim()
        const email = (formData.get('email') ?? '').toString().trim()
        const phone = (formData.get('phone') ?? '').toString().trim()
        const message = (formData.get('message') ?? '').toString().trim()
        const referral = (formData.get('referral') ?? '').toString().trim()

        if (!fullName || !email || !phone || !message || !referral) {
            setError('Please fill in all required fields.')
            return
        }

        try {
            setLoading(true)

            const res = await fetch(`${CONTACT_API_BASE}/api/contact`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fullName,
                    organization,
                    email,
                    phone,
                    message,
                    referral,
                }),
                mode: 'cors',
            })

            const data = await res.json().catch(() => ({}))

            if (!res.ok) {
                throw new Error(data.error || 'Something went wrong while sending your message.')
            }

            setSubmitted(true)
            e.currentTarget.reset()
        } catch (err: any) {
            console.error('Contact form error:', err)
            setError(err.message || 'Something went wrong. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    const handleReturnHome = () => {
        if (typeof window !== 'undefined') {
            window.close()
            setTimeout(() => {
                router.push('/')
            }, 100)
        } else {
            router.push('/')
        }
    }

    return (
        <main
            className="relative min-h-screen text-white overflow-hidden"
            style={{
                backgroundImage: "url('/background.png')",
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundAttachment: 'fixed',
            }}
        >
            <div className="absolute inset-0 bg-black/45" />

            <header className="relative z-20 px-8 py-6 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-3">
                    <div className="w-8 h-8 relative">
                        <Image
                            src="/auren_white_logo.png"
                            alt="Auren Logo"
                            fill
                            className="object-contain"
                        />
                    </div>
                    <span className="text-white text-xl font-light">auren</span>
                </Link>
            </header>

            <section className="relative z-20 flex items-center justify-center px-4 py-10 sm:py-16">
                <div className="w-full max-w-xl rounded-3xl bg-black/35 border border-white/15 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] px-6 py-8 sm:px-10 sm:py-10">
                    {!submitted ? (
                        <>
                            <h1 className="text-3xl sm:text-4xl font-light text-center mb-4">
                                Contact Us
                            </h1>
                            <p className="text-center text-white/75 text-sm sm:text-base mb-8">
                                Tell us a bit about yourself and what you&apos;re looking to make.
                            </p>

                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        Full Name <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="fullName"
                                        required
                                        className="w-full rounded-2xl bg-black/40 border border-white/25 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        Organization{' '}
                                        <span className="text-white/50 text-xs">(optional)</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="organization"
                                        className="w-full rounded-2xl bg-black/40 border border-white/25 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        Email <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        name="email"
                                        required
                                        className="w-full rounded-2xl bg-black/40 border border-white/25 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        Phone Number <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="tel"
                                        name="phone"
                                        required
                                        className="w-full rounded-2xl bg-black/40 border border-white/25 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        Inquiry / Message <span className="text-red-400">*</span>
                                    </label>
                                    <textarea
                                        name="message"
                                        required
                                        rows={4}
                                        className="w-full rounded-2xl bg-black/40 border border-white/25 px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-white/50"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        How Did You Hear About Us?{' '}
                                        <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="referral"
                                        required
                                        className="w-full rounded-2xl bg-black/40 border border-white/25 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
                                    />
                                </div>

                                {error && (
                                    <p className="text-sm text-red-400">{error}</p>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full mt-3 px-6 py-3 rounded-full bg-white/95 text-black text-sm sm:text-base font-medium tracking-wide hover:bg-white transition shadow-[0_10px_40px_rgba(0,0,0,0.5)] disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {loading ? 'Sending…' : 'Submit'}
                                </button>
                            </form>
                        </>
                    ) : (
                        <div className="text-center space-y-6 py-6">
                            <h2 className="text-2xl sm:text-3xl font-light">
                                Thank you for filling out the form.
                            </h2>
                            <p className="text-white/75 text-sm sm:text-base">
                                Our team will reach out shortly via email. For additional
                                    questions, please email{' '}
                                <a
                                    href="mailto:team@auren.co"
                                    className="underline hover:text-white"
                                >
                                    team@auren.co
                                </a>
                                .
                            </p>
                            <button
                                onClick={handleReturnHome}
                                className="inline-flex items-center justify-center px-6 py-2.5 rounded-full border border-white/40 text-sm text-white/90 hover:bg-white/10 transition"
                            >
                                Return to home
                            </button>
                        </div>
                    )}
                </div>
            </section>
        </main>
    )
}