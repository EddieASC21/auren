'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'

export default function CatalogPage() {
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
      {/* Top-right label */}
      <div className="absolute top-6 right-8 text-gray-300 font-semibold tracking-widest uppercase text-sm">
        MAKE IT WITH AUREN
      </div>

      {/* Step number & progress (top-left) */}
      <div className="absolute top-6 left-6 z-20">
        <div className="text-white text-2xl font-light">01</div>
        <div className="flex items-center space-x-2 mt-2">
          <div className="w-24 h-1 bg-white rounded-full"></div>
          <div className="w-24 h-1 bg-white/30 rounded-full"></div>
        </div>
      </div>

      {/* Main layout */}
      <div className="mx-auto max-w-[1280px] px-6 w-full">
        <div className="min-h-screen flex items-center">
          <div className="grid w-full items-center gap-12 lg:gap-16 lg:grid-cols-2">
            {/* Left: Title block */}
            <div className="max-w-xl">
              <h1 className="text-[clamp(36px,6vw,64px)] font-extrabold leading-tight">
                Ready to start <br /> your brand?
              </h1>
              <p className="mt-4 text-xl text-white/85">with auren</p>
            </div>

            {/* Right: Cards */}
            <motion.div
              className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-10"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            >
              {/* Black card */}
              <Link href="/picking" className="shrink-0">
                <motion.div
                  className="relative w-[340px] h-[520px] sm:w-[360px] sm:h-[540px] bg-black/95 border border-white/20 rounded-xl cursor-pointer shadow-2xl overflow-hidden group backdrop-blur"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="flex justify-end items-center p-5 text-white/80 group-hover:text-white transition-colors">
                    <span className="text-sm font-medium">Start Making</span>
                    <svg width="22" height="22" viewBox="0 0 24 24" className="ml-2">
                      <path d="M7 17L17 7M7 7H17V17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>

                  <div className="flex flex-col items-center justify-center px-8 mt-2 text-center">
                    <Image
                      src="/Subtract.png"
                      alt="Catalog"
                      width={56}
                      height={56}
                      className="opacity-70 mb-4 group-hover:opacity-100 transition-opacity"
                    />
                    <h2 className="text-3xl font-bold mb-2">Make it fast</h2>
                    <p className="text-white/60 text-sm">
                      Ready-to-set and customizable apparel &amp; more.
                    </p>
                  </div>

                  <div className="absolute bottom-6 left-8 right-8">
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center text-white/90">
                        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                        </svg>
                        Quick Turnarounds
                      </li>
                      <li className="flex items-center text-white/90">
                        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                        </svg>
                        Premium quality
                      </li>
                    </ul>
                  </div>
                </motion.div>
              </Link>

              {/* White card */}
              <Link href="/chat-box" className="shrink-0">
                <motion.div
                  className="relative w-[340px] h-[520px] sm:w-[360px] sm:h-[540px] bg-white border border-white/30 rounded-xl cursor-pointer shadow-2xl overflow-hidden group backdrop-blur"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="flex justify-end items-center p-5 text-gray-700/80 group-hover:text-gray-700 transition-colors">
                    <span className="text-sm font-medium">Start Making</span>
                    <svg width="22" height="22" viewBox="0 0 24 24" className="ml-2">
                      <path d="M7 17L17 7M7 7H17V17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>

                  <div className="flex flex-col items-center justify-center px-8 mt-2 text-center">
                    <svg width="56" height="56" viewBox="0 0 64 64" fill="none" className="mb-4 opacity-70 group-hover:opacity-100 transition-opacity">
                      <path d="M20 20h24v24H20z" stroke="gray" strokeWidth="2" fill="none"/>
                      <circle cx="32" cy="32" r="8" stroke="gray" strokeWidth="2" fill="none"/>
                    </svg>
                    <h2 className="text-3xl font-bold text-gray-800 mb-2">Make it Custom</h2>
                    <p className="text-gray-600 text-sm">
                      Products designed from the ground up.
                    </p>
                  </div>

                  <div className="absolute bottom-6 left-8 right-8">
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center text-gray-800">
                        <svg className="w-4 h-4 mr-2 text-black" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                        </svg>
                        Total Creative Freedom
                      </li>
                      <li className="flex items-center text-gray-800">
                        <svg className="w-4 h-4 mr-2 text-black" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                        </svg>
                        Transparent Pricing
                      </li>
                    </ul>
                  </div>
                </motion.div>
              </Link>
            </motion.div>
          </div>
        </div>
      </div>
    </main>
  )
}
