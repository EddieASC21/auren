'use client'

import type React from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { useEffect } from 'react'
import { measurePageLoad } from '@/lib/performance'
import { useCleanNavigation } from '@/hooks/useCleanNavigation'
import { SUBTRACT_IMAGE, BACKGROUND_IMAGE } from '@/lib/cdn-assets'

type CardsProps = {
  handleStartAiChat: (e: React.MouseEvent<HTMLAnchorElement>) => void
}

function Cards({ handleStartAiChat }: CardsProps) {
  return (
    <motion.div
      // Layout Logic:
      // - xl:justify-end -> pushes right on big screens
      // - justify-center -> centers them when stacked below title
      className="flex flex-col md:flex-row items-center justify-center xl:justify-end gap-6 md:gap-8 xl:gap-10 w-full xl:w-auto"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      {/* Black card — Catalog / Picking */}
      <Link href="/picking" className="group">
        <motion.div
          // Standard sizes, no shrinking needed now that we stack on laptops
          className="relative 
            w-[300px] h-[460px] 
            md:w-[340px] md:h-[520px] 
            2xl:w-[360px] 2xl:h-[540px] 
            bg-black/95 border border-white/20 rounded-xl cursor-pointer shadow-2xl overflow-hidden backdrop-blur"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
          transition={{ duration: 0.25 }}
        >
          <div className="flex justify-end items-center p-5 text-white/80 group-hover:text-white transition-colors">
            <span className="text-sm font-medium">Start Making</span>
            <svg width="22" height="22" viewBox="0 0 24 24" className="ml-2">
              <path
                d="M7 17L17 7M7 7H17V17"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div className="flex flex-col items-center justify-center px-6 mt-2 text-center">
            <div className="h-14 w-14 md:h-16 md:w-16 flex items-center justify-center mb-4">
              <Image
                src={SUBTRACT_IMAGE}
                alt="Catalog"
                width={56}
                height={56}
                priority
                className="opacity-70 group-hover:opacity-100 transition-opacity w-12 h-12 md:w-14 md:h-14"
                unoptimized
              />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-2">Catalog</h2>
            <p className="text-white/60 text-xs md:text-sm">
              Browse our catalog for basic apparel &amp; more.
            </p>
          </div>

          <div className="absolute bottom-6 left-6 right-6">
            <ul className="space-y-2 text-xs md:text-sm">
              <li className="flex items-center text-white/90">
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                Best prices & low minimums
              </li>
              <li className="flex items-center text-white/90">
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                Premium quality
              </li>
            </ul>
          </div>
        </motion.div>
      </Link>

      {/* White card — Custom / AI Chat */}
      <Link href="/chat-box" className="group" onClick={handleStartAiChat}>
        <motion.div
          className="relative 
            w-[300px] h-[460px] 
            md:w-[340px] md:h-[520px] 
            2xl:w-[360px] 2xl:h-[540px] 
            bg-white border border-white/30 rounded-xl cursor-pointer shadow-2xl overflow-hidden backdrop-blur"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
          transition={{ duration: 0.25 }}
        >
          <div className="flex justify-end items-center p-5 text-gray-700/80 group-hover:text-gray-700 transition-colors">
            <span className="text-sm font-medium">Start Making</span>
            <svg width="22" height="22" viewBox="0 0 24 24" className="ml-2">
              <path
                d="M7 17L17 7M7 7H17V17"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div className="flex flex-col items-center justify-center px-6 mt-2 text-center">
            <div className="h-14 w-14 md:h-16 md:w-16 flex items-center justify-center mb-4">
              <svg
                width="56"
                height="56"
                viewBox="0 0 64 64"
                fill="none"
                className="opacity-70 group-hover:opacity-100 transition-opacity w-12 h-12 md:w-14 md:h-14"
              >
                <path d="M20 20h24v24H20z" stroke="gray" strokeWidth="2" fill="none" />
                <circle cx="32" cy="32" r="8" stroke="gray" strokeWidth="2" fill="none" />
              </svg>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">Custom</h2>
            <p className="text-gray-600 text-xs md:text-sm">
              Design from scratch or upload your mockup to get a custom quote.
            </p>
          </div>

          <div className="absolute bottom-6 left-6 right-6">
            <ul className="space-y-2 text-xs md:text-sm">
              <li className="flex items-center text-gray-800">
                <svg className="w-4 h-4 mr-2 text-black" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                Fully customizable
              </li>
              <li className="flex items-center text-gray-800">
                <svg className="w-4 h-4 mr-2 text-black" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                Transparent pricing
              </li>
            </ul>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  )
}

export default function CatalogPage() {
  const { navigate } = useCleanNavigation()

  useEffect(() => {
    measurePageLoad('Catalog')
  }, [])

  const handleStartAiChat = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    navigate('/chat-box', { mode: 'new' })
  }

  return (
    <main
      className="relative min-h-screen text-white overflow-hidden"
      style={{
        backgroundImage: `url('${BACKGROUND_IMAGE}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      <div className="absolute top-6 right-8 text-gray-300 font-semibold tracking-widest uppercase text-sm">
        MAKE IT WITH AUREN
      </div>

      <div className="absolute top-6 left-6 z-20">
        <div className="text-white text-2xl font-light">01</div>
        <div className="flex items-center space-x-2 mt-2">
          <div className="w-24 h-1 bg-white rounded-full" />
          <div className="w-24 h-1 bg-white/30 rounded-full" />
        </div>
      </div>

      <div className="mx-auto max-w-[1280px] px-6 w-full">
        {/* Added xl:items-start to ensure alignment at top */}
        <div className="min-h-screen flex items-start pt-32 md:pt-40 xl:pt-0 xl:items-center">

          <div className="flex flex-col xl:flex-row w-full items-start justify-between gap-12 md:gap-16 xl:gap-20">
            {/* Left: Title */}
            {/* Added 'pt-2' here to nudge the text down slightly so it aligns visually with card top */}
            <div className="max-w-2xl lg:max-w-3xl shrink-0 pt-2">
              <h1 className="text-[clamp(32px,5vw,58px)] font-light leading-none">
                Let&apos;s make your <br /> custom products!
              </h1>
            </div>

            {/* Right: Cards */}
            <Cards handleStartAiChat={handleStartAiChat} />
          </div>
        </div>
      </div>
    </main>
  )
}
