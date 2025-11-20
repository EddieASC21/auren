'use client'

import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { nanoid } from 'nanoid'

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
  fontFamily: string
  fontWeight: string
  fontStyle: string
  scale: number
  color: string
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
  productColor: string
  frontMask: string | null
  backMask: string | null
}

export default function ProductShowcase() {
  const router = useRouter()
  // Store an array of items (Cart)
  const [cartItems, setCartItems] = useState<DesignData[]>([])
  const [loading, setLoading] = useState(true)

  // Load ALL designs from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return

    const items: DesignData[] = []
    // Scan all keys
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('designData_')) {
        try {
          const raw = localStorage.getItem(key)
          if (raw) {
            const parsed: DesignData = JSON.parse(raw)
            items.push(parsed)
          }
        } catch (err) {
          console.warn('Failed to parse item', key)
        }
      }
    })

    // Reverse so the newest design shows up first (on the left)
    setCartItems(items.reverse())
    setLoading(false)
  }, [])

  const handleLogin = (provider: string) => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/api/auth/login?provider=${provider}`;
  };

  // --- REMOVE ITEM LOGIC ---
  const handleRemoveItem = (productId: string) => {
    if (typeof window === 'undefined') return

    // 1. Clear specific Local Storage keys
    localStorage.removeItem(`designData_${productId}`)
    localStorage.removeItem(`orderData_${productId}`)
    localStorage.removeItem(`chatHistory_${productId}`)

    if (productId === 'ai-generated') {
      localStorage.removeItem('aiChat_chatHistory')
      localStorage.removeItem('aiChat_selectedImage')
    }

    // 2. Update UI State
    setCartItems(prev => prev.filter(item => item.selectedProductId !== productId))
  }

  // --- CREATE VARIATION LOGIC ---
  // Uses the most recent item (index 0) as the base
  const handleCreateVariation = () => {
    if (cartItems.length === 0) return

    const item = cartItems[0] // Base on the newest item
    const newId = `var_${nanoid(6)}` // New unique ID

    // Use uploaded image as base if it was AI, otherwise use catalog image
    let baseImage = item.productImage;
    if (item.selectedProductId === 'ai-generated' && item.frontUploadedImages.length > 0) {
      baseImage = item.frontUploadedImages[0].src;
    }

    const params = new URLSearchParams({
      productId: newId,
      productName: item.selectedProductName || 'Variation',
      productImage: baseImage || '',
      productCategory: item.selectedProductCategory || 'custom'
    })

    router.push(`/design?${params.toString()}`)
  }

  // Scaling math
  const PREVIEW_W = 320
  const PREVIEW_H = 480

  // --- 👇 ADD THIS HELPER FUNCTION ---
  const getOrderData = (id: string) => {
    if (typeof window === 'undefined') return { quantity: 0, totalCost: 0, comments: '' };
    try {
      const raw = localStorage.getItem(`orderData_${id}`);
      if (raw) return JSON.parse(raw);
    } catch (e) { }
    return { quantity: 0, totalCost: 0, comments: '' };
  }

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
        className="flex flex-col lg:flex-row items-center justify-center lg:justify-around gap-16 xl:gap-24 min-h-screen px-10 py-20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.3 }}
      >
        {/* LEFT COLUMN (Title & Buttons) */}
        <motion.div
          className="flex flex-col gap-6 max-w-md text-center lg:text-left items-center lg:items-start"
          initial={{ opacity: 0, x: -200 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <div>
            <h1 className="text-6xl font-light leading-tight mb-2">
              Here's what<br />you made
            </h1>
            <p className="text-base text-white/70">with Auren</p>
          </div>

          <div className="flex flex-col gap-4 mt-4">
            {/* Triggers creation based on the first item in list */}
            <button
              onClick={handleCreateVariation}
              className="glass-button w-60 px-8 py-3 text-white text-base font-medium transition-all hover:bg-white/20"
            >
              Create Variation
            </button>

            <Link href="/catalog">
              <button className="glass-button w-60 px-8 py-3 text-white text-base font-medium transition-all hover:bg-white/20">
                Create New Product
              </button>
            </Link>
          </div>
        </motion.div>

        {/* CENTER COLUMN - Product Cards (Horizontal Scroll) */}
        <motion.div
          className="flex-shrink-0 w-[320px] h-[480px]" // Fixed window size for visual consistency
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.1 }}
        >
          {/* This container allows horizontal scrolling if multiple items exist */}
          <div className="flex gap-6 overflow-x-auto overflow-y-hidden w-[90vw] max-w-[340px] lg:max-w-[340px] xl:max-w-[340px] snap-x snap-mandatory scrollbar-hide h-full pr-4">

            <AnimatePresence>
              {cartItems.length === 0 && !loading && (
                <div className="w-full h-full flex items-center justify-center text-white/50 italic border border-white/20 rounded-[28px] bg-white/5">
                  No items in cart.
                </div>
              )}

              {cartItems.map((designData) => {
                const orderInfo = getOrderData(designData.selectedProductId!);
                // Logic to determine display image
                let displayImage = designData.productImage || '/placeholder.png';
                if (designData.selectedProductId === 'ai-generated' && designData.frontUploadedImages.length > 0) {
                  displayImage = designData.frontUploadedImages[0].src;
                }

                // Scaling logic
                const scaleRatio = Math.min(
                  PREVIEW_W / designData.canvasWidth,
                  PREVIEW_H / designData.canvasHeight
                )
                const offsetX = (PREVIEW_W - designData.canvasWidth * scaleRatio) / 2
                const offsetY = (PREVIEW_H - designData.canvasHeight * scaleRatio) / 2

                return (
                  <motion.div
                    key={designData.selectedProductId}
                    layout
                    exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
                    className="relative flex-shrink-0 w-[320px] h-[480px] rounded-[28px] bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl overflow-hidden flex flex-col p-4 snap-center"
                  >
                    {/* Top Bar */}
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-white/80 ml-2 truncate max-w-[150px]">{designData.selectedProductName || 'Product'}</span>
                      <Link
                        href={`/design?productId=${designData.selectedProductId}&productName=${encodeURIComponent(designData.selectedProductName || '')}&productImage=${encodeURIComponent(designData.productImage || '')}&productCategory=${encodeURIComponent(designData.selectedProductCategory || '')}`}
                        className="text-sm text-white/90 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full px-4 py-1.5 transition"
                      >
                        Edit
                      </Link>
                    </div>

                    {/* Product Image Area */}
                    <div className="relative flex-1 w-full h-full rounded-[20px] overflow-hidden flex items-center justify-center bg-black/5">

                      {/* LAYER 2: Shirt Image */}
                      <Image
                        src={displayImage}
                        alt={designData.selectedProductName || 'Product'}
                        fill
                        style={{ objectFit: 'contain', mixBlendMode: 'multiply', zIndex: 2 }}
                        priority
                        unoptimized
                      />

                      {/* LAYER 1: Color & Mask */}
                      <div
                        className="absolute inset-0"
                        style={{
                          backgroundColor: designData.productColor || '#FFFFFF',
                          maskImage: `url("${designData.isViewingBack ? designData.backMask : designData.frontMask}")`,
                          WebkitMaskImage: `url("${designData.isViewingBack ? designData.backMask : designData.frontMask}")`,
                          maskSize: "contain",
                          WebkitMaskSize: "contain",
                          maskRepeat: "no-repeat",
                          WebkitMaskRepeat: "no-repeat",
                          maskPosition: "center",
                          WebkitMaskPosition: "center",
                          mixBlendMode: "multiply",
                          zIndex: 1,
                        }}
                      />

                      {/* LAYER 3 & 4: Design Elements */}
                      <div
                        className="absolute inset-0 z-20 flex items-center justify-center"
                        style={{ backgroundColor: 'transparent', zIndex: 3 }}
                      >
                        <div
                          className="relative"
                          style={{
                            width: designData.canvasWidth * scaleRatio,
                            height: designData.canvasHeight * scaleRatio,
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
                                left: img.x * scaleRatio,
                                top: img.y * scaleRatio,
                                width: img.width * scaleRatio,
                                height: img.height * scaleRatio,
                                zIndex: 3
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
                                left: t.x * scaleRatio,
                                top: t.y * scaleRatio,
                                fontSize: (t.fontSize * (t.scale || 1)) * scaleRatio,
                                fontFamily: t.fontFamily,
                                fontWeight: t.fontWeight,
                                fontStyle: t.fontStyle,
                                color: t.color,
                                zIndex: 4
                              }}
                            >
                              {t.text}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Remove Button */}
                      <button
                        onClick={() => handleRemoveItem(designData.selectedProductId!)}
                        className="absolute bottom-3 left-3 z-20 bg-white/12 text-white text-xs font-medium px-3 py-1.5 rounded-full ring-1 ring-white/25 backdrop-blur-md hover:bg-red-500/50 hover:border-red-500 transition"
                      >
                        Remove Item
                      </button>
                    </div>

                    {/* Details */}
                    {/* --- 👇 REPLACED DETAILS SECTION --- */}
                    <div className="px-3 pt-3">
                      <div className="flex justify-between items-end mb-1">
                        <h2 className="text-lg font-semibold text-white truncate max-w-[140px]">
                          {designData.selectedProductName || 'Custom Product'}
                        </h2>
                        <div className="text-right">
                          <p className="text-xl font-bold text-white">${orderInfo.totalCost}</p>
                        </div>
                      </div>

                      <div className="space-y-1 text-white/70 text-sm border-t border-white/10 pt-2 mt-1">
                        <div className="flex justify-between text-xs">
                          <span>Total Quantity:</span>
                          <span className="text-white font-medium">{orderInfo.quantity} units</span>
                        </div>

                        {/* Size Breakdown / Comments */}
                        <div className="text-xs text-white/50 bg-white/5 p-2 rounded-lg mt-1 h-12 overflow-hidden">
                          <p className="line-clamp-2 leading-relaxed">
                            {orderInfo.comments ? orderInfo.comments.replace(/(User:|AI:)/g, '').trim() : 'No custom size breakdown provided.'}
                          </p>
                        </div>
                      </div>
                    </div>
                    {/* --- 👆 END REPLACED SECTION --- */}
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* RIGHT COLUMN - Checkout (Only if items exist) */}
        <motion.div
          className="flex flex-col gap-4 max-w-sm"
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          {cartItems.length > 0 && (
            <>
              <p className="text-base text-white/70">To checkout:</p>

              {/* Google */}
              <button
                onClick={() => handleLogin("google")}
                className="w-[320px] h-12 rounded-full bg-white/90 border border-white/20 text-black font-medium flex items-center justify-center gap-3 transition-all hover:bg-white hover:shadow-lg hover:border-white/40 text-base"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
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
                className="w-[320px] h-12 rounded-full bg-white/90 border border-white/20 text-black font-medium flex items-center justify-center gap-3 transition-all hover:bg-white hover:shadow-lg hover:border-white/40 text-base"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                </svg>
                Continue with Apple
              </button>

              {/* Microsoft */}
              <button
                onClick={() => handleLogin("microsoft")}
                className="w-[320px] h-12 rounded-full bg-white/90 border border-white/20 text-black font-medium flex items-center justify-center gap-3 transition-all hover:bg-white hover:shadow-lg hover:border-white/40 text-base"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="8" height="8" fill="#F35325" />
                  <rect x="13" y="3" width="8" height="8" fill="#81BC06" />
                  <rect x="3" y="13" width="8" height="8" fill="#05A6F0" />
                  <rect x="13" y="13" width="8" height="8" fill="#FFBA08" />
                </svg>
                Continue with Microsoft
              </button>
            </>
          )}
        </motion.div>
      </motion.div>

      {/* Return Home */}
      <div className="absolute bottom-8 right-8">
        <Link href="/get-started">
          <button className="glass-button px-8 py-3 text-white text-base font-medium transition-all hover:bg-white/20">
            Return Home
          </button>
        </Link>
      </div>
    </motion.main>
  )
}