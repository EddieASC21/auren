'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'


export default function CatalogPage() {
  const router = useRouter() // 👈 --- ADD THIS HOOK ---

  // 👇 --- ADD THIS HANDLER FUNCTION ---
  const handleStartAiChat = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault(); // Stop the <Link> from navigating instantly

    // --- 1. Clear all data from the previous AI session ---
    if (typeof window !== 'undefined') {
      localStorage.removeItem('aiChat_chatHistory');
      localStorage.removeItem('aiChat_selectedImage');
      localStorage.removeItem('designData_ai-generated'); // Clear the final design too
    }

    // --- 2. Now, navigate to the chat-box ---
    router.push('/chat-box');
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
      {/* Main layout */}
      <div className="mx-auto max-w-[1280px] px-6 w-full">
        {/* 1. REMOVED items-center and ADDED pt-48 to push all content down */}
        <div className="min-h-screen flex pt-48">
          {/* 2. CHANGED items-center to items-start to align both columns to the top */}
          <div className="grid w-full items-start gap-12 lg:gap-16 lg:grid-cols-2">
            {/* Left: Title block */}
            <div className="max-w-xl">
              <h1 className="text-[clamp(36px,6vw,64px)] font-light leading-tight">
                Let's make your <br /> custom products! 
              </h1>
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
                    {/* --- ALIGNMENT FIX: Added fixed-height wrapper --- */}
                    <div className="h-16 w-16 flex items-center justify-center mb-4">
                      <Image
                        src="/Subtract.png"
                        alt="Catalog"
                        width={56}
                        height={56}
                        className="opacity-70 group-hover:opacity-100 transition-opacity"
                      />
                    </div>
                    {/* --- TEXT FIX: Updated text and font --- */}
                    <h2 className="text-3xl font-bold mb-2">Catalog</h2>
                    <p className="text-white/60 text-sm">
                      Browse our catalog for basic apparel &amp; more.
                    </p>
                  </div>

                  <div className="absolute bottom-6 left-8 right-8">
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center text-white/90">
                        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                        </svg>
                        Best prices & low minimums
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
              <Link href="/chat-box" className="shrink-0" onClick={handleStartAiChat}>
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
                    {/* --- ALIGNMENT FIX: Added fixed-height wrapper --- */}
                    <div className="h-16 w-16 flex items-center justify-center mb-4">
                      <svg width="56" height="56" viewBox="0 0 64 64" fill="none" className="opacity-70 group-hover:opacity-100 transition-opacity">
                        <path d="M20 20h24v24H20z" stroke="gray" strokeWidth="2" fill="none" />
                        <circle cx="32" cy="32" r="8" stroke="gray" strokeWidth="2" fill="none" />
                      </svg>
                    </div>
                    {/* --- TEXT FIX: Updated text and font --- */}
                    <h2 className="text-3xl font-bold text-gray-800 mb-2">Custom</h2>
                    <p className="text-gray-600 text-sm">
                      Design any custom product from scratch
                    </p>
                  </div>

                  <div className="absolute bottom-6 left-8 right-8">
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center text-gray-800">
                        <svg className="w-4 h-4 mr-2 text-black" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                        </svg>
                        Fully customizable
                      </li>
                      <li className="flex items-center text-gray-800">
                        <svg className="w-4 h-4 mr-2 text-black" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                        </svg>
                        Transparent pricing
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
