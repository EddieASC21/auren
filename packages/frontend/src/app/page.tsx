'use client'

import { motion, useInView } from 'framer-motion'
import VideoBackground from '@/components/VideoBackground'
import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState, useRef, type FormEvent } from 'react'
import AurenAnimation from './AurenAnimation'

// Base URL for backend API (uses env in prod, falls back to localhost:3001 in dev)
const NEWSLETTER_API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const isVideoInView = useInView(videoRef, { margin: '-20% 0px -20% 0px' })

  // Section 6 animation trigger
  const animationSectionRef = useRef<HTMLElement | null>(null)
  const shouldLoadAnimation = useInView(animationSectionRef, {
    once: true,
    margin: '-200px',
  })

  useEffect(() => {
    const video = videoRef.current
    if (video) {
      if (isVideoInView) {
        video
          .play()
          .catch((e) => console.error('Autoplay failed:', e))
      } else {
        video.pause()
      }
    }
  }, [isVideoInView])

  // FAQ modal state
  const [activeFaq, setActiveFaq] = useState<null | 'payment' | 'shipping' | 'returns'>(null)

  // Newsletter state
  const [newsletterEmail, setNewsletterEmail] = useState('')
  const [newsletterLoading, setNewsletterLoading] = useState(false)
  const [newsletterMessage, setNewsletterMessage] = useState<string | null>(null)
  const [newsletterError, setNewsletterError] = useState<string | null>(null)
  const [newsletterAgree, setNewsletterAgree] = useState(false)

  const handleNewsletterSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setNewsletterMessage(null)
    setNewsletterError(null)

    const email = newsletterEmail.trim()
    if (!email) {
      setNewsletterError('Please enter an email address.')
      return
    }

    try {
      setNewsletterLoading(true)

      const res = await fetch(`${NEWSLETTER_API_BASE}/api/newsletter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        mode: 'cors',
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Unable to subscribe right now.')
      }

      setNewsletterMessage('Thanks for subscribing!')
      setNewsletterEmail('')
    } catch (err: any) {
      console.error('Newsletter subscribe error:', err)
      setNewsletterError(
        err.message || 'Something went wrong. Please try again.',
      )
    } finally {
      setNewsletterLoading(false)
    }
  }

  return (
    <main className="relative bg-white">
      {/* Top Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-8 py-6 bg-transparent">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 relative">
              <Image
                src="/auren_white_logo.png"
                alt="Auren Logo"
                fill
                sizes="32px"
                className="object-contain"
              />
            </div>
            <span className="text-white text-xl font-light">auren</span>
          </div>

          {/* Nav Links (right corner) */}
          <div className="flex items-center gap-8">
            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.open('/contact', '_blank', 'noopener')
                }
              }}
              className="px-6 py-2 text-sm font-light text-white bg-white/10 border border-white/25 rounded-full hover:bg-white/20 transition"
            >
              Contact Us
            </button>
          </div>
        </div>
      </nav>

      {/* Section 1: Hero with Video Background */}
      <section className="relative h-screen flex flex-col items-center justify-center overflow-hidden">
        <VideoBackground />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 text-center max-w-6xl px-8"
        >
          <h1 className="text-6xl md:text-8xl font-light text-white mb-6 leading-tight">
            Create custom
            <br />
            products with ease
          </h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="text-white/80 text-xl md:text-2xl mb-12 font-light"
          >
            Competitve pricing. Premium Quality. Delivered to your door.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="flex gap-4 justify-center"
          >
            <Link href="/catalog">
              <button className="px-12 py-4 text-white text-base font-light bg-white/10 backdrop-blur-xl border border-white/20 rounded-full hover:bg-white/15 transition-all duration-300">
                Get Started
              </button>
            </Link>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1 }}
          className="absolute bottom-12 left-1/2 -translate-x-1/2 z-10"
        >
          <div className="flex flex-col items-center gap-2">
            <span className="text-white/60 text-sm font-light">Scroll down</span>
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              className="text-white/60"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M7 10L12 15L17 10"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* Section 6: Get Started - Video Introduction */}
      <section
        id="get-started-section"
        ref={animationSectionRef}
        className="relative h-screen overflow-hidden bg-black"
      >
        {shouldLoadAnimation ? (
          <AurenAnimation />
        ) : (
          <div className="w-full h-full bg-black" />
        )}
      </section>

      {/* Section 7: How it Works - Detailed */}
      <section className="relative bg-how-it-works-cream py-32 sm:py-48">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 items-start gap-x-44 gap-y-20 lg:grid-cols-2">
            {/* Left Column */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="lg:pr-4 flex flex-col justify-between h-full"
            >
              <div>
                <h2 className="mt-2 text-6xl font-normal tracking-tight text-gray-900 sm:text-5xl">
                  How it Works
                </h2>
                <p className="mt-8 text-xl leading-8 text-gray-700 max-w-xl">
                  We work directly with vetted factories to get you the best quality at the best prices.
                </p>

                <div className="mt-12">
                  <p className="text-xl font-semibold text-gray-700 text-center lg:text-left -mt-4">
                    Produced in the same factories as:
                    <br />
                  </p>

                  {/* Brand + logos block */}
                  <div className="mt-1 flex flex-col items-start text-left space-y-1 pl-2">
                    <p className="text-2xl md:text-3xl font-medium tracking-wider text-gray-900 lg:translate-x-10">
                      GENTLE MONSTER
                    </p>

                    {/* logos */}
                    <div className="mt-1 flex items-center justify-start gap-1 lg:translate-x-10">
                      <div className="relative w-[140px] h-16 md:h-20">
                        <Image
                          src="/images/Banana-Republic-logo.png"
                          alt="Banana Republic"
                          fill
                          sizes="140px"
                          className="object-contain"
                        />
                      </div>

                      <div className="relative w-[140px] h-16 md:h-20">
                        <Image
                          src="/images/boss-hugo-boss-logo-png-transparent.png"
                          alt="BOSS Hugo Boss"
                          width={220}
                          height={16}
                          sizes="140px"
                          className="object-contain scale-105 -translate-y-5"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Right Column */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <dl className="space-y-12 border-l-2 border-gray-900/20 pl-10">
                <div className="relative">
                  <dt className="text-xl font-semibold text-gray-900">
                    <div className="absolute -left-12 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-gray-900 text-white font-bold">
                      01
                    </div>
                    You design.
                  </dt>
                  <dd className="mt-3 text-lg leading-7 text-black">
                    Share your vision with us. Upload your designs, sketches, or describe your product idea.
                  </dd>
                </div>
                <div className="relative">
                  <dt className="text-xl font-semibold text-gray-900">
                    <div className="absolute -left-12 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-gray-900 text-white font-bold">
                      02
                    </div>
                    We source.
                  </dt>
                  <dd className="mt-3 text-lg leading-7 text-black">
                    We work with our network of trusted factories to source materials and manufacture your product.
                  </dd>
                </div>
                <div className="relative">
                  <dt className="text-xl font-semibold text-gray-900">
                    <div className="absolute -left-12 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-gray-900 text-white font-bold">
                      03
                    </div>
                    Delivered to you.
                  </dt>
                  <dd className="mt-3 text-lg leading-7 text-black">
                    Your finished products are shipped directly to you.
                  </dd>
                </div>
              </dl>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Section 9: Final CTA with Video */}
      <section className="relative h-screen overflow-hidden bg-black">
        <video
          ref={videoRef}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 min-w-full min-h-full object-cover z-10"
          playsInline
          muted
          loop
          preload="metadata"
          poster="/images/poster-hero.jpg"
        >
          <source
            src="https://storage.googleapis.com/auren-public-asset/auren_3d_rotate_cube.mp4"
            type="video/mp4"
          />
        </video>
        <div className="relative z-20 h-full flex flex-col items-center justify-center bg-black/30 px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="max-w-4xl text-center"
          >
            <h2 className="text-4xl font-light tracking-tight text-white sm:text-6xl mb-12">
              Get Started with Auren
            </h2>

            <Link href="/catalog">
              <button className="px-12 py-4 text-white text-base font-light bg-white/10 backdrop-blur-xl border border-white/20 rounded-full hover:bg-white/15 transition-all duration-300">
                Get Started
              </button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black py-16 px-8 relative z-30">
        <div className="max-w-6xl lg:max-w-7xl mx-auto">
          {/* Top Section — 3 evenly spaced columns */}
          <div className="grid gap-12 md:grid-cols-3 lg:gap-20 mb-12 items-start">
            {/* Brand Information */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 relative">
                  <Image
                    src="/auren_white_logo.png"
                    alt="Auren Logo"
                    fill
                    sizes="32px"
                    className="object-contain"
                  />
                </div>
                <span className="text-white text-xl font-light">auren</span>
              </div>
              <p className="text-white text-sm">© 2025 AUREN</p>
            </div>

            {/* FAQs Column */}
            <div>
              <h4 className="text-white font-semibold mb-4">FAQs</h4>
              <ul className="space-y-2">
                <li>
                  <button
                    type="button"
                    onClick={() => setActiveFaq('payment')}
                    className="text-left text-white/60 hover:text-white transition-colors text-sm underline"
                  >
                    Payment
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setActiveFaq('shipping')}
                    className="text-left text-white/60 hover:text-white transition-colors text-sm underline"
                  >
                    Shipping &amp; Timeline
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setActiveFaq('returns')}
                    className="text-left text-white/60 hover:text-white transition-colors text-sm underline"
                  >
                    Returns
                  </button>
                </li>
                <li>
                  <a
                    href="/contact"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/60 hover:text-white transition-colors text-sm underline"
                  >
                    Contact
                  </a>
                </li>
              </ul>
            </div>

            {/* Newsletter Column */}
            <div>
              <h4 className="text-white font-semibold mb-4">Newsletter</h4>
              <p className="text-white/60 text-sm mb-4 leading-relaxed max-w-sm">
                Be the first to get the latest news about trends, launches, and promotions.
              </p>

              <form onSubmit={handleNewsletterSubmit} className="mb-3">
                <div className="flex">
                  <input
                    type="email"
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="flex-1 px-4 py-2 bg-white rounded-l-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20"
                    required
                  />
                  <button
                    type="submit"
                    disabled={newsletterLoading || !newsletterAgree}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 transition-colors rounded-r-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {newsletterLoading ? (
                      <span className="text-xs text-white">Sending…</span>
                    ) : (
                      <svg
                        className="w-5 h-5 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </form>

              {newsletterMessage && (
                <p className="text-xs text-emerald-400 mb-2">{newsletterMessage}</p>
              )}
              {newsletterError && (
                <p className="text-xs text-red-400 mb-2">{newsletterError}</p>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-white/60 bg-transparent"
                  checked={newsletterAgree}
                  onChange={(e) => setNewsletterAgree(e.target.checked)}
                />
                <span className="text-white/60 text-xs">
                  By subscribing, you agree with the{' '}
                  <a
                    href="/legal/privacy"
                    className="underline hover:text-white transition-colors"
                  >
                    Privacy Policy.
                  </a>
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Section */}
          <div className="border-t border-white/10 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex gap-6">
                <a
                  href="/legal/terms"
                  className="text-white/60 hover:text-white transition-colors text-sm underline"
                >
                  Terms of Service
                </a>
                <a
                  href="/legal/privacy"
                  className="text-white/60 hover:text-white transition-colors text-sm underline"
                >
                  Privacy Policy
                </a>
                <a
                  href="/legal/cookies"
                  className="text-white/60 hover:text-white transition-colors text-sm underline"
                >
                  Cookies Policy
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* FAQ Modal */}
      {activeFaq && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={() => setActiveFaq(null)}
        >
          <div
            className="max-w-lg w-full rounded-2xl bg-zinc-900 text-white p-6 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setActiveFaq(null)}
              className="absolute top-3 right-3 text-white/60 hover:text-white text-sm"
              aria-label="Close"
            >
              ✕
            </button>

            <h3 className="text-xl font-semibold mb-3">
              {activeFaq === 'payment' && 'Payment'}
              {activeFaq === 'shipping' && 'Shipping & Timeline'}
              {activeFaq === 'returns' && 'Returns'}
            </h3>

            <p className="text-sm leading-relaxed text-white/80 whitespace-pre-line">
              {activeFaq === 'payment' &&
                `Auren accepts all major payment methods through our secure checkout system. Pricing varies based on the type of custom product you create. All charges will be shown clearly before purchase.`}

              {activeFaq === 'shipping' &&
                `Once your custom product is created and finalized, it’s produced and shipped directly to you. Shipping times depend on product type and your location. Once you submit your order, it takes 3–5 business days to produce the product and shipping takes approximately 3–5 business days. We will email a shipping number once your order is created.`}

              {activeFaq === 'returns' &&
                `Because Auren products are made custom for each customer, returns are limited. If there is an issue with quality, damage, or incorrect formulation, our support team will work with you to replace or resolve the order.`}
            </p>
          </div>
        </div>
      )}
    </main>
  )
}