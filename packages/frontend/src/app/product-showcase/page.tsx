'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'

// --- Design types ---
type UploadedImg = {
  id: number
  src: string
  x: number
  y: number
  width: number
  height: number
}

type TextEl = {
  id: number
  text: string
  x: number
  y: number
  fontSize: number
}

type DesignData = {
  productImage: string | null
  frontUploadedImages: UploadedImg[]
  backUploadedImages: UploadedImg[]
  frontTextElements: TextEl[]
  backTextElements: TextEl[]
  isViewingBack: boolean
  canvasWidth: number
  canvasHeight: number
  selectedProductId?: string
  selectedProductName?: string
  selectedProductCategory?: string
}

export default function ProductShowcase() {
  const [designData, setDesignData] = useState<DesignData | null>(null)
  const [productInfo, setProductInfo] = useState({
    name: 'Your Product',
    image: '/placeholder.png',
    category: '',
  })

  // Load last design from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    const keys = Object.keys(localStorage).filter(k => k.startsWith('designData_'))
    if (!keys.length) return
    const latest = keys[keys.length - 1]
    const raw = localStorage.getItem(latest)
    if (!raw) return
    try {
      const parsed: DesignData = JSON.parse(raw)
      setDesignData(parsed)
      setProductInfo({
        name: parsed.selectedProductName || 'Your Product',
        image: parsed.productImage || '/placeholder.png',
        category: parsed.selectedProductCategory || '',
      })
    } catch (err) {
      console.warn('Failed to parse designData', err)
    }
  }, [])

  const handleLogin = (provider: string) => {
    window.location.href = `/api/auth/login?provider=${provider}`;
  };

  // Scaling math
  const PREVIEW_W = 320
  const PREVIEW_H = 480
  const { scale, offsetX, offsetY } = (() => {
    if (!designData?.canvasWidth || !designData?.canvasHeight)
      return { scale: 1, offsetX: 0, offsetY: 0 }
    const scaleRatio = Math.min(
      PREVIEW_W / designData.canvasWidth,
      PREVIEW_H / designData.canvasHeight
    )
    const offsetX = (PREVIEW_W - designData.canvasWidth * scaleRatio) / 2
    const offsetY = (PREVIEW_H - designData.canvasHeight * scaleRatio) / 2
    return { scale: scaleRatio, offsetX, offsetY }
  })()

  return (
    <motion.main
      className="relative min-h-screen text-white overflow-hidden"
      style={{
        backgroundImage: "url('/background.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      {/* Step Number */}
      <motion.div
        className="absolute top-8 left-8 text-white text-3xl font-light"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
      >
        04
      </motion.div>

      {/* Main Layout */}
      <motion.div
        className="flex items-center justify-between min-h-screen px-16 py-20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.3 }}
      >
        {/* LEFT */}
        <motion.div
          className="flex flex-col gap-8 max-w-md"
          initial={{ opacity: 0, x: -200 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <div>
            <h1 className="text-7xl font-light leading-tight mb-2">
              Here's what<br />you made
            </h1>
            <p className="text-lg text-white/70">with Auren</p>
          </div>

          <div className="flex flex-col gap-4 mt-6">
            <Link href="/design">
              <button className="glass-button w-64 h-12 text-white text-xl font-medium transition-all hover:bg-white/20">
                Create Variation
              </button>
            </Link>
            <Link href="/catalog">
              <button className="glass-button w-64 h-12 text-white text-xl font-medium transition-all hover:bg-white/20">
                Create New Product
              </button>
            </Link>
          </div>
        </motion.div>

        {/* CENTER - Product Card */}
        <motion.div
          className="flex-shrink-0"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.1 }}
          whileHover={{ scale: 1.05, rotate: 0 }}
        >
          <motion.div
            className="relative w-[320px] h-[480px] rounded-[48px] bg-white/5 backdrop-blur-xl border-2 border-white/30 shadow-2xl overflow-hidden"
            style={{ transform: 'rotate(2deg)' }}
          >
            {/* Product Image */}
            <div className="relative m-4 h-[280px] rounded-[36px] bg-white/10 backdrop-blur-md border border-white/20 overflow-hidden flex items-center justify-center">
              <div className="absolute inset-0">
                <Image
                  src={productInfo.image}
                  alt={productInfo.name}
                  fill
                  style={{ objectFit: 'contain' }}
                  priority
                />
              </div>

              {/* Overlay reconstructed design */}
              {designData && (
                <div
                  className="absolute inset-0 z-20 flex items-center justify-center"
                  style={{ backgroundColor: 'transparent' }}
                >
                  <div
                    className="relative"
                    style={{
                      width: designData.canvasWidth * scale,
                      height: designData.canvasHeight * scale,
                      transform: `translate(${offsetX}px, ${offsetY}px)`,
                    }}
                  >
                    {(designData.isViewingBack
                      ? designData.backUploadedImages
                      : designData.frontUploadedImages
                    ).map((img) => (
                      <img
                        key={img.id}
                        src={img.src}
                        alt=""
                        draggable={false}
                        className="absolute"
                        style={{
                          left: img.x * scale,
                          top: img.y * scale,
                          width: img.width * scale,
                          height: img.height * scale,
                        }}
                      />
                    ))}
                    {(designData.isViewingBack
                      ? designData.backTextElements
                      : designData.frontTextElements
                    ).map((t) => (
                      <span
                        key={t.id}
                        className="absolute text-black select-none"
                        style={{
                          left: t.x * scale,
                          top: t.y * scale,
                          fontSize: t.fontSize * scale,
                        }}
                      >
                        {t.text}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Edit & Remove */}
              <Link
                href={`/design?productId=${designData?.selectedProductId || '1'}&productName=${encodeURIComponent(productInfo.name)}&productImage=${encodeURIComponent(productInfo.image)}&productCategory=${encodeURIComponent(productInfo.category)}`}
                className="absolute top-4 right-4 bg-white/15 text-white text-sm font-medium px-3 py-1.5 rounded-full ring-1 ring-white/30 backdrop-blur-md hover:bg-white/25"
              >
                Edit
              </Link>

              <button className="absolute bottom-4 left-4 bg-white/12 text-white text-xs font-medium px-3 py-1.5 rounded-full ring-1 ring-white/25 backdrop-blur-md hover:bg-white/20">
                Remove Item From Cart
              </button>
            </div>

            {/* Details */}
            <div className="px-5 pt-3 pb-5 bg-white/5 backdrop-blur-md border-t border-white/20">
              <h2 className="text-3xl font-semibold mb-2 bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                {productInfo.name}
              </h2>
              <div className="space-y-1 text-white/90">
                <p>Sizes: TBD</p>
                <p>Quantity: TBD</p>
                <p className="text-[13px]">Material: Premium Cotton</p>
                <p className="text-[13px]">Color: Custom</p>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* ✅ RIGHT - Checkout restored */}
        {/* ✅ RIGHT - Checkout */}
        <motion.div
          className="flex flex-col gap-5 max-w-md"
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <p className="text-lg text-white/70 mb-2">To checkout:</p>

          {/* Google */}
          <button
            onClick={() => handleLogin("google")}
            className="w-[360px] h-16 rounded-full bg-white/90 border border-white/20 text-black font-semibold flex items-center justify-center gap-3 transition-all hover:bg-white hover:shadow-lg hover:border-white/40 text-2xl"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>

          {/* Apple */}
          <button
            onClick={() => handleLogin("apple")}
            className="w-[360px] h-16 rounded-full bg-white/90 border border-white/20 text-black font-semibold flex items-center justify-center gap-3 transition-all hover:bg-white hover:shadow-lg hover:border-white/40 text-2xl"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            Continue with Apple
          </button>

          {/* Microsoft */}
          <button
            onClick={() => handleLogin("microsoft")}
            className="w-[360px] h-16 rounded-full bg-white/90 border border-white/20 text-black font-semibold flex items-center justify-center gap-3 transition-all hover:bg-white hover:shadow-lg hover:border-white/40 text-2xl"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="8" height="8" fill="#F35325" />
              <rect x="13" y="3" width="8" height="8" fill="#81BC06" />
              <rect x="3" y="13" width="8" height="8" fill="#05A6F0" />
              <rect x="13" y="13" width="8" height="8" fill="#FFBA08" />
            </svg>
            Continue with Microsoft
          </button>
        </motion.div>
      </motion.div>

      {/* Return Home */}
      <div className="absolute bottom-8 right-8">
        <Link href="/get-started">
          <button className="glass-button w-64 h-12 text-white text-xl font-medium transition-all hover:bg-white/20">
            Return Home
          </button>
        </Link>
      </div>
    </motion.main>
  )
}