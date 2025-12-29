'use client'

import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { nanoid } from 'nanoid'
import { db } from '@/lib/db'

// --- Design types ---
type UploadedImg = {
  id: number
  src: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
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
  rotation: number
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
  fromChat?: boolean
  isCustomProduct?: boolean

  // NEW – snapshots saved in /design and used in order-quantity
  frontSnapshot?: string | null
  backSnapshot?: string | null
}

// ------------------------------------------------------------------
// Sub-Component for individual cards
// ------------------------------------------------------------------
function ProductCard({
  designData,
  onRemove,
  onNext,
  onPrev,
  hasMultiple,
  currentIndex,
  totalItems,
  designSessionId,
}: {
  designData: DesignData
  onRemove: (id: string) => void | Promise<void>
  onNext: () => void
  onPrev: () => void
  hasMultiple: boolean
  currentIndex: number
  totalItems: number
  designSessionId?: string | null
}) {
  const router = useRouter()
  const [isViewingBack, setIsViewingBack] = useState(false)

  const hasSnapshots =
    !!designData.frontSnapshot || !!designData.backSnapshot

  // Only allow back view if we actually have a back side
  const hasBackSide =
    !!designData.backSnapshot ||
    (designData.backUploadedImages?.length ?? 0) > 0 ||
    (designData.backTextElements?.length ?? 0) > 0 ||
    !!designData.backMask

  const categoryLower = (designData.selectedProductCategory || '').toLowerCase()
  const isOneSizeCategory =
    categoryLower.includes('other') ||
    categoryLower.includes('accessory') ||
    categoryLower.includes('gift')

  const getOrderData = (id: string) => {
    if (typeof window === 'undefined') {
      return {
        quantity: 0,
        totalCost: 0,
        comments: '',
        sizeBreakdownText: '',
      }
    }
    try {
      const raw = localStorage.getItem(`orderData_${id}`)
      if (raw) return JSON.parse(raw)
    } catch (e) { }
    return { quantity: 0, totalCost: 0, comments: '', sizeBreakdownText: '' }
  }

  const orderInfo = getOrderData(designData.selectedProductId!)

  function parseSizeBreakdown(info: {
    sizeBreakdownText?: string
    comments?: string
  }) {
    const text = info.sizeBreakdownText || info.comments || ''
    if (!text) return {}

    const regex = /(\d+)\s*([a-zA-Z0-9]+)/g
    const result: Record<string, number> = {}
    let match

    while ((match = regex.exec(text)) !== null) {
      const qty = parseInt(match[1], 10)
      let size = match[2].toUpperCase()

      if (['SMALL', 'SM', 'S'].includes(size)) size = 'S'
      else if (['MEDIUM', 'MD', 'M'].includes(size)) size = 'M'
      else if (['LARGE', 'LG', 'L'].includes(size)) size = 'L'
      else if (['EXTRA LARGE', 'XL'].includes(size)) size = 'XL'
      else if (['2XL', 'XXL'].includes(size)) size = '2XL'

      if (['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'].includes(size)) {
        result[size] = (result[size] || 0) + qty
      }
    }
    return result
  }

  const sizeBreakdown = isOneSizeCategory
    ? {}
    : parseSizeBreakdown(orderInfo)

  // --- Base product image selection (for fallback) ---
  let rawImage = designData.productImage || '/placeholder.png'
  if (
    designData.selectedProductId === 'ai-generated' &&
    designData.frontUploadedImages.length > 0
  ) {
    rawImage = designData.frontUploadedImages[0].src
  }

  let cleanFrontImage = rawImage
  if (typeof rawImage === 'string') {
    cleanFrontImage = rawImage
      .replace(/_back/g, '')
      .replace(/ back/g, '')
      .replace(/-back/g, '')
  }

  let displayImage: string = cleanFrontImage

  if (hasSnapshots) {
    const frontSnap = designData.frontSnapshot || designData.backSnapshot
    const backSnap = designData.backSnapshot || designData.frontSnapshot

    displayImage =
      isViewingBack && hasBackSide && backSnap ? backSnap : (frontSnap || cleanFrontImage)
  } else {
    const isStaticImage =
      typeof cleanFrontImage === 'string' && cleanFrontImage.startsWith('/')

    if (
      isViewingBack &&
      hasBackSide &&
      isStaticImage &&
      !cleanFrontImage.includes('placeholder')
    ) {
      const lastDotIndex = cleanFrontImage.lastIndexOf('.')
      if (lastDotIndex !== -1) {
        displayImage =
          cleanFrontImage.substring(0, lastDotIndex) +
          ' back' +
          cleanFrontImage.substring(lastDotIndex)
      }
    }
  }

  const PREVIEW_MAX_W = 320
  const PREVIEW_MAX_H = 360

  const { scale, displayW, displayH, xOffset, currentMask } = useMemo(() => {
    // 🔹 If we have front/back snapshots, ignore canvasWidth/Height scaling
    if (hasSnapshots) {
      return {
        scale: 1,                 // no extra zoom
        displayW: PREVIEW_MAX_W,  // fixed preview box
        displayH: PREVIEW_MAX_H,
        xOffset: 0,
        currentMask: null,        // don’t apply color masks on snapshots
      }
    }

    // 🔹 Original logic for non-snapshot designs
    const rawW = designData.canvasWidth || 500
    const rawH = designData.canvasHeight || 500
    const ratio = rawW / rawH
    const MIN_RATIO = 0.65

    let finalW = rawW
    let offset = 0

    if (ratio < MIN_RATIO) {
      finalW = rawH * MIN_RATIO
      offset = (finalW - rawW) / 2
    }

    const baseScale = Math.min(PREVIEW_MAX_W / finalW, PREVIEW_MAX_H / rawH)

    let mask: string | null = null
    if (!hasSnapshots) {
      mask = isViewingBack ? designData.backMask : designData.frontMask
      if (!mask && designData.productImage) {
        const base = designData.productImage
        const cleanBase = base
          .replace(/_back/g, '')
          .replace(/ back/g, '')
          .replace(/-back/g, '')
        const suffix = isViewingBack ? '_back_mask.png' : '_mask.png'
        mask = cleanBase.replace('.png', suffix)
      }
    }

    return {
      scale: baseScale * 1.15,
      displayW: finalW,
      displayH: rawH,
      xOffset: offset,
      currentMask: mask,
    }
  }, [designData, isViewingBack, hasSnapshots])

  useEffect(() => {
    if (!hasBackSide && isViewingBack) {
      setIsViewingBack(false)
    }
  }, [hasBackSide, isViewingBack])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.3 }}
      className="relative flex-shrink-0 w-[340px] h-[520px] rounded-[28px] bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl overflow-hidden flex flex-col p-3"
      style={{ WebkitMaskImage: '-webkit-radial-gradient(white, black)' }}
    >
      {/* Header: Edit + Carousel arrows */}
      <div className="flex justify-between items-center mb-2 px-1">
        <button
          type="button"
          onClick={() => {
            const productId = designData.selectedProductId || ''
            const productName = designData.selectedProductName || ''
            const productCategory = designData.selectedProductCategory || ''

            if (designData.fromChat) {
              const params = new URLSearchParams({
                productId,
                productName,
                productCategory,
                isCustom: designData.isCustomProduct ? 'true' : 'false',
                fromOrderQuantity: 'true',
              })

              // forward designSessionId so chat-box can restore conversation
              if (designSessionId) {
                params.set('designSessionId', designSessionId)
              }

              router.push(`/chat-box?${params.toString()}`)
            } else {
              router.push(
                `/design?productId=${encodeURIComponent(
                  productId
                )}&productName=${encodeURIComponent(
                  productName
                )}&productImage=${encodeURIComponent(
                  designData.productImage || ''
                )}&productCategory=${encodeURIComponent(productCategory)}`
              )
            }
          }}
          className="text-xs text-white/90 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full px-4 py-1.5 transition"
        >
          Edit
        </button>

        {hasMultiple ? (
          <div className="flex gap-1">
            <button
              onClick={onPrev}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white transition"
            >
              ←
            </button>
            <button
              onClick={onNext}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white transition"
            >
              →
            </button>
          </div>
        ) : (
          <div className="w-8 h-8" />
        )}
      </div>

      {/* Central design preview */}
      <div className="relative flex-1 w-full h-full rounded-[20px] overflow-hidden flex items-center justify-center bg-black/5">
        <div
          style={{
            width: displayW,
            height: displayH,
            transform: hasSnapshots ? 'none' : `scale(${scale})`,
            transformOrigin: 'center center',
            position: 'relative',
            flexShrink: 0,
          }}
        >
          {/* Color mask – disabled when using snapshots */}
          {currentMask && (
            <div
              className="absolute inset-0"
              style={{
                backgroundColor: designData.productColor || '#FFFFFF',
                WebkitMaskImage: `url("${currentMask}")`,
                maskImage: `url("${currentMask}")`,
                WebkitMaskSize: 'contain',
                maskSize: 'contain',
                WebkitMaskRepeat: 'no-repeat',
                maskRepeat: 'no-repeat',
                WebkitMaskPosition: 'center',
                maskPosition: 'center',
                mixBlendMode: 'multiply',
                zIndex: 1,
              }}
            />
          )}

          {/* Base garment / snapshot image */}
          <Image
            src={displayImage}
            alt={designData.selectedProductName || 'Product'}
            fill
            unoptimized
            style={{
              objectFit: 'contain',
              backgroundColor: 'transparent',
              mixBlendMode: hasSnapshots ? 'normal' : 'multiply',
              zIndex: 2,
            }}
          />

          {/* Overlaid art + text – ONLY when no snapshots */}
          {!hasSnapshots && (
            <div className="absolute inset-0" style={{ zIndex: 3 }}>
              {(isViewingBack
                ? designData.backUploadedImages
                : designData.frontUploadedImages
              ).map((img) => (
                <img
                  key={img.id}
                  src={img.src}
                  draggable={false}
                  className="absolute"
                  style={{
                    left: img.x + xOffset,
                    top: img.y,
                    width: img.width,
                    height: img.height,
                    objectFit: 'contain',
                  }}
                />
              ))}

              {(isViewingBack
                ? designData.backTextElements
                : designData.frontTextElements
              ).map((t) => (
                <span
                  key={t.id}
                  className="absolute whitespace-nowrap select-none"
                  style={{
                    left: t.x + xOffset,
                    top: t.y,
                    fontSize: t.fontSize * (t.scale || 1),
                    fontFamily: t.fontFamily,
                    fontWeight: t.fontWeight,
                    fontStyle: t.fontStyle,
                    color: t.color,
                    lineHeight: 1,
                  }}
                >
                  {t.text}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* View front/back toggle */}
        {hasBackSide && (
          <button
            onClick={() => setIsViewingBack((prev) => !prev)}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 bg-white/12 text-white text-xs font-medium px-3 py-1.5 rounded-full ring-1 ring-white/25 backdrop-blur-md hover:bg-white/20 transition underline"
          >
            {isViewingBack ? 'View Front' : 'View Back'}
          </button>
        )}

        {/* Remove button */}
        <button
          onClick={() => onRemove(designData.selectedProductId!)}
          className="absolute bottom-3 left-3 z-20 bg-white/12 text-white text-xs font-medium px-3 py-1.5 rounded-full ring-1 ring-white/25 backdrop-blur-md hover:bg-red-500/50 hover:border-red-500 transition underline"
        >
          Remove
        </button>
      </div>

      {/* Bottom product + size summary */}
      <div className="mt-3 w-full px-2 py-2 border-t border-white/10">
        <div className="flex flex-col items-center mb-3">
          <h2 className="text-3xl font-bold text-white">
            {designData.selectedProductName || 'Product'}
          </h2>
          <div className="flex gap-1 mt-1">
            {Array.from({ length: totalItems }).map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full ${i === currentIndex ? 'bg-white' : 'bg-white/20'
                  }`}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-between w-full items-end">
          <div className="flex flex-col text-white text-lg font-bold space-y-0.5">
            {isOneSizeCategory ? (
              <p className="drop-shadow-sm">One size item</p>
            ) : Object.keys(sizeBreakdown).length > 0 ? (
              Object.entries(sizeBreakdown)
                .sort(([a], [b]) => {
                  const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', '2XL']
                  return sizeOrder.indexOf(a) - sizeOrder.indexOf(b)
                })
                .map(([size, qty]) => (
                  <p key={size} className="drop-shadow-sm">
                    {qty} {size}
                  </p>
                ))
            ) : (
              <p className="text-white/50 italic font-normal text-sm">
                No size data
              </p>
            )}
          </div>

          <div className="flex flex-col items-end text-right">
            <p className="text-white text-sm font-bold uppercase tracking-wide mb-0.5">
              {orderInfo.quantity} units
            </p>
            <p className="text-4xl font-bold text-white tracking-tight">
              ${Number(orderInfo.totalCost).toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ------------------------------------------------------------------
// Main Page Component
// ------------------------------------------------------------------
export default function ProductShowcase() {
  const router = useRouter()
  const [cartItems, setCartItems] = useState<DesignData[]>([])
  const [loading, setLoading] = useState(true)
  const [currentProductIndex, setCurrentProductIndex] = useState(0)

  // Global designSessionId to forward back into chat-box
  const [designSessionId, setDesignSessionId] = useState<string | null>(null)

  // Load designSessionId (set by chat-box / order flow)
  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const stored = localStorage.getItem('designSessionId')
      if (stored) {
        setDesignSessionId(stored)
      }
    } catch (e) {
      console.warn('Could not read designSessionId in product-showcase', e)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const loadItems = async () => {
      const items: DesignData[] = []

      const keys = Object.keys(localStorage).filter((k) =>
        k.startsWith('designData_')
      )

      const rehydrateImages = async (imgs: UploadedImg[]) => {
        return Promise.all(
          imgs.map(async (img) => {
            if (img.src === 'INDEXED_DB_ASSET') {
              const asset = await db.cartAssets.get(String(img.id))
              return { ...img, src: asset?.base64 || '' }
            }
            return img
          })
        )
      }

      for (const key of keys) {
        try {
          const raw = localStorage.getItem(key)
          if (!raw) continue

          const parsed: DesignData = JSON.parse(raw)

          // derive the productId
          const productId =
            parsed.selectedProductId || key.replace('designData_', '')

          // look up corresponding order data
          const orderRaw = localStorage.getItem(`orderData_${productId}`)
          if (!orderRaw) continue // no order, not ready for checkout

          let orderIsComplete = false
          let fromChatFlag = false
          let isCustomFlag = false

          try {
            const orderParsed = JSON.parse(orderRaw)
            orderIsComplete = !!orderParsed.isComplete
            fromChatFlag = !!orderParsed.fromChat

            const explicitFlag = !!orderParsed.isCustomProduct
            const designFlag = !!parsed.isCustomProduct

            const cat = (parsed.selectedProductCategory || '').toLowerCase()
            const implicitCustom = cat === 'custom' || cat === 'unknown'

            isCustomFlag = explicitFlag || designFlag || implicitCustom
          } catch { }

          if (!orderIsComplete) continue // user never pressed Next → skip

          const [
            frontRehydrated,
            backRehydrated,
            frontSnapRecord,
            backSnapRecord,
          ] = await Promise.all([
            rehydrateImages(parsed.frontUploadedImages || []),
            rehydrateImages(parsed.backUploadedImages || []),
            db.cartAssets.get(`snapshot_front_${productId}`),
            db.cartAssets.get(`snapshot_back_${productId}`),
          ])

          const frontSnapshot = frontSnapRecord?.base64 || null
          const backSnapshot = backSnapRecord?.base64 || null

          items.push({
            ...parsed,
            selectedProductId: productId,
            frontUploadedImages: frontRehydrated,
            backUploadedImages: backRehydrated,
            fromChat: fromChatFlag,
            isCustomProduct: isCustomFlag,
            frontSnapshot,
            backSnapshot,
          })
        } catch (err) {
          console.warn('Failed to parse item', key)
        }
      }

      setCartItems(items.reverse())
      setLoading(false)
    }

    loadItems()
  }, [])

  const handleLogin = (provider: string) => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/api/auth/login?provider=${provider}`
  }

  // helper to delete a design session in backend
  const deleteDesignSession = async (sessionId: string) => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? ''
    if (!apiBase || !sessionId) return

    try {
      await fetch(`${apiBase}/api/design-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
    } catch (err) {
      console.error('[product-showcase] Failed to delete design session', err)
    }
  }

  const resetGlobalChatSession = async () => {
    if (typeof window === 'undefined') return

    const currentSessionId = window.localStorage.getItem('aiChat_sessionId')
    if (currentSessionId) {
      await deleteDesignSession(currentSessionId)
    }

    window.localStorage.removeItem('aiChat_sessionId')
    window.localStorage.removeItem('aiChat_sessionCreatedAt')
    window.localStorage.removeItem('aiChat_chatHistory')
    window.localStorage.removeItem('aiChat_selectedImage')
    window.localStorage.removeItem('aiChat_selectedBackImage')
  }

  const handleCreateNewProductClick = async () => {
    await resetGlobalChatSession()
    router.push('/catalog')
  }

  // handleRemoveItem clears cart, per-item session, and possibly global session
  const handleRemoveItem = async (productId: string) => {
    if (typeof window === 'undefined') return

    // Session mapping for this specific cart item (if created from chat)
    const mappedSessionId = window.localStorage.getItem(
      `design_session_${productId}`
    )

    // Remove local cart + order data
    window.localStorage.removeItem(`designData_${productId}`)
    window.localStorage.removeItem(`orderData_${productId}`)
    window.localStorage.removeItem(`orderChatHistory_${productId}`)
    window.localStorage.removeItem(`design_session_${productId}`)

    // If this design session is also the "global" chat session, clear it
    const globalSessionId = window.localStorage.getItem('aiChat_sessionId')
    if (mappedSessionId && globalSessionId === mappedSessionId) {
      window.localStorage.removeItem('aiChat_sessionId')
      window.localStorage.removeItem('aiChat_sessionCreatedAt')
      window.localStorage.removeItem('aiChat_chatHistory')
      window.localStorage.removeItem('aiChat_selectedImage')
      window.localStorage.removeItem('aiChat_selectedBackImage')
    }

    // Legacy cleanup for the special AI-generated product id
    if (productId === 'ai-generated') {
      window.localStorage.removeItem('aiChat_chatHistory')
      window.localStorage.removeItem('aiChat_selectedImage')
      window.localStorage.removeItem('aiChat_selectedBackImage')
    }

    // Tell backend to delete the Firestore doc + GCS assets
    if (mappedSessionId) {
      await deleteDesignSession(mappedSessionId)
    }

    // Update local React state
    setCartItems((prev) => {
      const newItems = prev.filter(
        (item) => item.selectedProductId !== productId
      )

      if (currentProductIndex >= newItems.length && newItems.length > 0) {
        setCurrentProductIndex(newItems.length - 1)
      } else if (newItems.length === 0) {
        setCurrentProductIndex(0)
      }

      return newItems
    })
  }

  const handleCreateVariation = () => {
    if (cartItems.length === 0) return

    const item = cartItems[currentProductIndex]
    if (!item) return

    // 1) Block custom products
    // 2) Block catalog items that came from the chat flow
    const isChatCatalog = item.fromChat && !item.isCustomProduct
    if (item.isCustomProduct || isChatCatalog) return

    const newId = `var_${nanoid(6)}`
    let baseImage = item.productImage
    if (
      item.selectedProductId === 'ai-generated' &&
      item.frontUploadedImages.length > 0
    ) {
      baseImage = item.frontUploadedImages[0].src
    }

    const params = new URLSearchParams({
      productId: newId,
      productName: item.selectedProductName || 'Variation',
      productImage: baseImage || '',
      productCategory: item.selectedProductCategory || 'custom',
    })

    router.push(`/design?${params.toString()}`)
  }

  const handleNext = () => {
    setCurrentProductIndex((prev) => (prev + 1) % cartItems.length)
  }

  const handlePrev = () => {
    setCurrentProductIndex(
      (prev) => (prev - 1 + cartItems.length) % cartItems.length
    )
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
      transition={{ duration: 0.8, ease: 'easeOut' }}
    >
      <motion.div
        className="absolute top-8 left-8 text-white text-3xl font-light"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
      >
        04
      </motion.div>

      <motion.div
        className="flex flex-col lg:flex-row items-center justify-center lg:justify-around gap-16 xl:gap-24 min-h-screen px-10 py-20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.3 }}
      >
        {/* LEFT COLUMN */}
        <motion.div
          className="flex flex-col gap-6 max-w-md text-center lg:text-left items-center lg:items-start"
          initial={{ opacity: 0, x: -200 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <div>
            <h1 className="text-6xl font-light leading-tight mb-2">
              Here's what
              <br />
              you made
            </h1>
            <p className="text-base text-white/70">with Auren</p>
          </div>

          <div className="flex flex-col gap-4 mt-4">
            {/* Conditionally render Create Variation */}
            {cartItems.length > 0 &&
              (() => {
                const currentItem = cartItems[currentProductIndex]
                const isChatCatalog =
                  !!currentItem?.fromChat && !currentItem?.isCustomProduct
                const isDisabled =
                  !!currentItem?.isCustomProduct || isChatCatalog

                return (
                  <button
                    onClick={handleCreateVariation}
                    disabled={isDisabled}
                    className={
                      'glass-button w-60 px-8 py-3 text-white text-base font-medium transition-all ' +
                      (isDisabled
                        ? 'opacity-40 cursor-not-allowed'
                        : 'hover:bg-white/20')
                    }
                  >
                    {isDisabled
                      ? 'Variations unavailable for this order'
                      : 'Create Variation'}
                  </button>
                )
              })()}

            <button
              type="button"
              onClick={handleCreateNewProductClick}
              className="glass-button w-60 px-8 py-3 text-white text-base font-medium transition-all hover:bg-white/20"
            >
              Create New Product
            </button>
          </div>
        </motion.div>

        {/* CENTER COLUMN - Active Product Card (Carousel) */}
        <motion.div
          className="flex-shrink-0 w-[340px] h-[520px] relative"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.1 }}
        >
          <AnimatePresence mode="wait">
            {cartItems.length === 0 && !loading ? (
              <div className="w-full h-full flex items-center justify-center text-white/50 italic border border-white/20 rounded-[28px] bg-white/5">
                No items in cart.
              </div>
            ) : (
              cartItems.length > 0 && (
                <ProductCard
                  key={cartItems[currentProductIndex].selectedProductId}
                  designData={cartItems[currentProductIndex]}
                  onRemove={handleRemoveItem}
                  onNext={handleNext}
                  onPrev={handlePrev}
                  hasMultiple={cartItems.length > 1}
                  currentIndex={currentProductIndex}
                  totalItems={cartItems.length}
                  designSessionId={designSessionId}
                />
              )
            )}
          </AnimatePresence>
        </motion.div>

        {/* RIGHT COLUMN - Checkout */}
        <motion.div
          className="flex flex-col gap-4 max-w-sm mb-32"
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          {cartItems.length > 0 && (
            <>
              <p className="text-base text-white/70">To checkout:</p>
              {/* Google */}
              <button
                onClick={() => handleLogin('google')}
                className="w-[320px] h-12 rounded-full bg-white/90 border border-white/20 text-black font-medium flex items-center justify-center gap-3 transition-all hover:bg-white hover:shadow-lg hover:border-white/40 text-base"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Continue with Google
              </button>
              {/* Apple */}
              <button
                onClick={() => handleLogin('apple')}
                className="w-[320px] h-12 rounded-full bg-white/90 border border-white/20 text-black font-medium flex items-center justify-center gap-3 transition-all hover:bg-white hover:shadow-lg hover:border-white/40 text-base"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                </svg>
                Continue with Apple
              </button>
              {/* Microsoft */}
              <button
                onClick={() => handleLogin('microsoft')}
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

      {/* Return Home - CONDITIONALLY RENDERED */}
      {cartItems.length > 0 && (
        <div className="absolute bottom-8 right-8">
          <Link href="/get-started">
            <button className="glass-button px-8 py-3 text-white text-base font-medium transition-all hover:bg-white/20">
              Return Home
            </button>
          </Link>
        </div>
      )}
    </motion.main>
  )
}