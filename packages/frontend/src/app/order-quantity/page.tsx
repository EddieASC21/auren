// packages/frontend/src/app/order-quantity/page.tsx

'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useNavigationParams } from '@/hooks/useNavigationParams'
import { useCleanNavigation } from '@/hooks/useCleanNavigation'

import { StepHeader } from './components/StepHeader'
import { PreviewCard } from './components/PreviewCard'
import { QuantityCard } from './components/QuantityCard'
import { NextButton } from './components/NextButton'
import { OrderQuantitySkeleton } from '@/components/ui/LoadingSkeleton'
import { db, saveOrder, getOrder } from '@/lib/db'
import { BACKGROUND_IMAGE } from '@/lib/cdn-assets'

import { useProductMeta } from './hooks/useProductMeta'
import { useDesignVisuals } from './hooks/useDesignVisuals'
import { useCustomPricingFlag } from './hooks/useCustomPricingFlag'
import { usePricing } from './hooks/usePricing'
import { useOrderData } from './hooks/useOrderData'
import { useOrderPersistence } from './hooks/useOrderPersistence'
import { useOrderValidation } from './hooks/useOrderValidation'
import { useOrderAssistant } from './hooks/useOrderAssistant'
import { useDesignSessionId } from './hooks/useDesignSessionId'

import {
  getPreviewImage,
  derivePricingKeys,
  resolveMaskedPreview,
  buildVariantPath,
  resolveCatalogProductImage,
} from './utils'

function OrderQuantityContent() {
  const navParams = useNavigationParams()
  const { navigate } = useCleanNavigation()

  const storageId = navParams.cartItemId || navParams.productId || ''
  const fromChat = navParams.fromChat ?? false

  const { productData, isOneSizeCategory } = useProductMeta(navParams)
  const [debugEnabled, setDebugEnabled] = useState(false)
  const [isViewingBackPreview, setIsViewingBackPreview] = useState(false)
  const [resolvedProductImage, setResolvedProductImage] = useState('')

  // Early preload of snapshot to improve LCP - runs before anything else
  useEffect(() => {
    if (typeof window === 'undefined' || !storageId) return

    // Preload snapshot from localStorage/IndexedDB immediately
    const preloadSnapshot = async () => {
      try {
        // First try localStorage (fastest, synchronous)
        const cachedFront = localStorage.getItem(`snapshot_preview_front_${storageId}`)
        if (cachedFront) {
          // Convert base64 to blob URL for better browser caching
          if (cachedFront.startsWith('data:image/')) {
            try {
              const parts = cachedFront.split(',')
              const contentType = parts[0].match(/:(.*?);/)?.[1] || 'image/png'
              const byteString = atob(parts[1])
              const ab = new ArrayBuffer(byteString.length)
              const ia = new Uint8Array(ab)
              for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i)
              }
              const blob = new Blob([ab], { type: contentType })
              const blobUrl = URL.createObjectURL(blob)

              // Preload the blob URL
              const link = document.createElement('link')
              link.rel = 'preload'
              link.as = 'image'
              link.href = blobUrl
              link.fetchPriority = 'high'
              document.head.appendChild(link)

              // Also trigger browser preload via Image
              const img = new Image()
              img.src = blobUrl
              return
            } catch {
              // Fallback to base64 if conversion fails
            }
          }

          // Fallback: preload base64 directly
          const img = new Image()
          img.src = cachedFront
        } else {
          // Try IndexedDB if not in localStorage
          const previewAsset = await db.cartAssets.get(`snapshot_preview_front_${storageId}`)
          if (previewAsset?.base64) {
            // Same conversion logic for IndexedDB
            if (previewAsset.base64.startsWith('data:image/')) {
              try {
                const parts = previewAsset.base64.split(',')
                const contentType = parts[0].match(/:(.*?);/)?.[1] || 'image/png'
                const byteString = atob(parts[1])
                const ab = new ArrayBuffer(byteString.length)
                const ia = new Uint8Array(ab)
                for (let i = 0; i < byteString.length; i++) {
                  ia[i] = byteString.charCodeAt(i)
                }
                const blob = new Blob([ab], { type: contentType })
                const blobUrl = URL.createObjectURL(blob)

                const link = document.createElement('link')
                link.rel = 'preload'
                link.as = 'image'
                link.href = blobUrl
                link.fetchPriority = 'high'
                document.head.appendChild(link)

                const img = new Image()
                img.src = blobUrl
              } catch {
                // Ignore conversion errors
              }
            }
          }
        }
      } catch (e) {
        // Ignore errors, this is just a performance optimization
      }
    }

    preloadSnapshot()
  }, [storageId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    // Defer debug check to avoid blocking main thread
    const checkDebug = () => {
      const params = new URLSearchParams(window.location.search)
      const enabled =
        params.get('debugOrder') === '1' ||
        window.localStorage.getItem('debugOrderQuantity') === 'true'
      setDebugEnabled(enabled)
    }

    if ('requestIdleCallback' in window) {
      requestIdleCallback(checkDebug)
    } else {
      setTimeout(checkDebug, 0)
    }
  }, [navParams])

  const [forceSnapshots, setForceSnapshots] = useState(fromChat)

  // ✅ Always load both snapshots to prevent delay when toggling to back view
  const { frontSnapshot, backSnapshot, designData, isLoaded: visualsLoaded } =
    useDesignVisuals(storageId, debugEnabled, true, forceSnapshots)

  // ✅ Read hasUserAddedLogo from orderMeta (batched with other reads in useDesignVisuals)
  const [hasUserAddedLogo, setHasUserAddedLogo] = useState<boolean | null>(null)

  useEffect(() => {
    if (!storageId) return

    const loadMeta = async () => {
      try {
        // Check Dexie first (primary source - has fresh data from chat-box)
        const order = await getOrder(storageId)
        if (order?.orderMeta) {
          setHasUserAddedLogo(order.orderMeta.hasUserAddedLogo ?? false)
          return
        }

        // Fall back to localStorage (legacy)
        const metaRaw = localStorage.getItem(`orderMeta_${storageId}`)
        if (metaRaw) {
          const meta = JSON.parse(metaRaw)
          setHasUserAddedLogo(meta.hasUserAddedLogo ?? false)
          return
        }

        if (debugEnabled) {
          console.warn('[order-quantity] No orderMeta found for storageId:', storageId)
        }
      } catch (err) {
        console.error('Failed to read orderMeta:', err)
      }
    }

    loadMeta()
  }, [debugEnabled, storageId])

  useEffect(() => {
    if (fromChat) {
      setForceSnapshots(true)
      return
    }
    if (hasUserAddedLogo === true) {
      setForceSnapshots(true)
    }
  }, [fromChat, hasUserAddedLogo])

  const isCustomProduct = useCustomPricingFlag({
    navParams,
    designData,
    productData,
  })

  const designSessionId = useDesignSessionId(navParams, storageId)

  const {
    quantity,
    setQuantity,
    comments,
    setComments,
    orderNotes,
    setOrderNotes,
    sizeBreakdownText,
    setSizeBreakdownText,
    chatHistory,
    setChatHistory,
    isLoaded,
  } = useOrderData(storageId)

  // ✅ Pricing now derived from backend quote using stable keys (via designData + productData)
  const { unitPrice, totalCost } = usePricing({
    quantity,
    productData,
    isCustomProduct,
    fromChat,
    designData,
  })

  useOrderPersistence({
    storageId,
    isLoaded,
    quantity,
    comments,
    totalCost,
    unitPrice,
    chatHistory,
    sizeBreakdownText,
    orderNotes,
    isCustomProduct,
    fromChat,
    productData,
    designData,
  })

  const {
    chatInput,
    setChatInput,
    isChatLoading,
    chatContainerRef,
    handleChatSend,
    aiApprovedNext,
  } = useOrderAssistant({
    designData,
    productData,
    quantity,
    isOneSizeCategory,
    fromChat,
    isCustomProduct,
    storageId,
    designSessionId,

    chatHistory,
    setChatHistory,

    comments,
    setComments,

    orderNotes,
    setOrderNotes,

    setSizeBreakdownText,

    hasUserAddedLogo: hasUserAddedLogo ?? false, // ✅ Pass logo detection flag from orderMeta
  })

  const { isOrderValid } = useOrderValidation({
    isOneSizeCategory,
    sizeBreakdownText,
    quantity,
    aiApprovedNext,
  })

  const [hasBackBase, setHasBackBase] = useState(false)

  const fallbackCatalogImage = useMemo(
    () =>
      resolveCatalogProductImage({
        productCategory: productData.productCategory,
        productName: productData.productName,
        designData,
      }),
    [designData, productData.productCategory, productData.productName],
  )

  useEffect(() => {
    if (typeof window === 'undefined') return

    // ✅ When coming from chat-box, don't load catalog product images
    // The snapshot already contains the complete rendered image
    if (fromChat) {
      setResolvedProductImage('')
      return
    }

    const candidate =
      productData.productImage || designData?.productImage || fallbackCatalogImage
    if (!candidate) {
      setResolvedProductImage('')
      return
    }

    let alive = true
    const img = new window.Image()
    img.onload = () => {
      if (alive) setResolvedProductImage(candidate)
    }
    img.onerror = () => {
      if (!alive) return
      setResolvedProductImage(fallbackCatalogImage || candidate)
    }
    img.src = candidate

    return () => {
      alive = false
    }
  }, [
    designData?.productImage,
    fallbackCatalogImage,
    fromChat,
    !!frontSnapshot, // ✅ Boolean coercion prevents array size changes
    !!backSnapshot,  // ✅ Boolean coercion prevents array size changes
    productData.productImage
  ])

  const hasBackUploads = useMemo(() => {
    return !!designData && (designData.backUploadedImages?.length || 0) > 0
  }, [designData])

  const hasBackSide = useMemo(() => {
    if (fromChat) {
      return Boolean(backSnapshot)
    }
    return !!backSnapshot || hasBackUploads || hasBackBase
  }, [backSnapshot, fromChat, hasBackUploads, hasBackBase])

  const hasDesignElements = useMemo(() => {
    if (!designData) return false
    const hasImages =
      (designData.frontUploadedImages?.length || 0) > 0 ||
      (designData.backUploadedImages?.length || 0) > 0
    const hasText =
      (designData.frontTextElements?.length || 0) > 0 ||
      (designData.backTextElements?.length || 0) > 0
    return hasImages || hasText
  }, [designData])

  const hasColorChange = useMemo(() => {
    const normalized = (designData?.productColor || '').toUpperCase()
    return Boolean(normalized) && normalized !== '#FFFFFF'
  }, [designData?.productColor])

  useEffect(() => {
    if (hasDesignElements || hasColorChange) {
      setForceSnapshots(true)
    }
  }, [hasColorChange, hasDesignElements])

  const shouldPreferSnapshots = useMemo(() => {
    if (fromChat) return true
    if (hasDesignElements || hasColorChange) return true
    return hasUserAddedLogo === true
  }, [fromChat, hasColorChange, hasDesignElements, hasUserAddedLogo])

  useEffect(() => {
    if (!resolvedProductImage) {
      setHasBackBase(false)
      return
    }

    let alive = true
    const checkBack = () => {
      const backImagePath = buildVariantPath(resolvedProductImage, ' back')
      if (debugEnabled) {
        
      }
      if (!backImagePath || backImagePath === resolvedProductImage) {
        if (alive) setHasBackBase(false)
        return
      }
      const img = new window.Image()
      img.onload = () => {
        if (debugEnabled) {
          
        }
        if (alive) setHasBackBase(true)
      }
      img.onerror = () => {
        if (debugEnabled) {
          console.warn('[order-quantity][hasBackBase] ❌ Back image not found:', backImagePath)
        }
        if (alive) setHasBackBase(false)
      }
      img.src = backImagePath
    }

    checkBack()
    return () => {
      alive = false
    }
  }, [resolvedProductImage, debugEnabled])

  useEffect(() => {
    if (!hasBackSide && isViewingBackPreview) {
      setIsViewingBackPreview(false)
    }
  }, [hasBackSide, isViewingBackPreview])

  // Optional cleanup of other design/order keys (deferred to avoid blocking)
  useEffect(() => {
    if (!storageId || typeof window === 'undefined') return

    // Defer cleanup to idle time to avoid blocking main thread
    const cleanup = () => {
      Object.keys(localStorage).forEach((key) => {
        if (
          (key.startsWith('designData_') && key !== `designData_${storageId}`) ||
          (key.startsWith('orderData_') && key !== `orderData_${storageId}`)
        ) {
          // optional cleanup – still commented out
          // localStorage.removeItem(key)
        }
      })
    }

    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(cleanup, { timeout: 3000 })
      return () => cancelIdleCallback(id)
    } else {
      const timeout = setTimeout(cleanup, 2000)
      return () => clearTimeout(timeout)
    }
  }, [storageId])

  const displayImage = useMemo(() => {
    const result = getPreviewImage({
      isViewingBack: isViewingBackPreview,
      hasBackSide,
      frontSnapshot,
      backSnapshot,
      designData,
      productImage: resolvedProductImage,
    })

    if (debugEnabled) {
      
    }

    return result
  }, [isViewingBackPreview, hasBackSide, frontSnapshot, backSnapshot, designData, resolvedProductImage, debugEnabled])
  const displayImageIsDataLike = Boolean(
    displayImage &&
      (displayImage.startsWith('data:') ||
        displayImage.startsWith('blob:') ||
        displayImage.startsWith('dexie:')),
  )

  const maskedPreview = useMemo(
    () =>
      resolveMaskedPreview({
        productImage: resolvedProductImage,
        designData,
        isViewingBack: isViewingBackPreview,
        hasBackBase,
      }),
    [designData, hasBackBase, isViewingBackPreview, resolvedProductImage],
  )

  const activeSnapshot = isViewingBackPreview ? backSnapshot : frontSnapshot

  // Prefer snapshots when a design exists for accurate placement.
  const usingSnapshots = shouldPreferSnapshots && Boolean(activeSnapshot)

  useEffect(() => {
    if (!shouldPreferSnapshots || activeSnapshot || !visualsLoaded) return
    console.warn('[order-quantity][preview] Expected snapshot but none found', {
      storageId,
      hasDesignElements,
      hasColorChange,
      hasUserAddedLogo,
      frontSnapshot: frontSnapshot ? frontSnapshot.substring(0, 50) : null,
      backSnapshot: backSnapshot ? backSnapshot.substring(0, 50) : null,
      designDataLoaded: Boolean(designData),
    })
  }, [
    activeSnapshot,
    backSnapshot,
    frontSnapshot,
    hasColorChange,
    hasDesignElements,
    hasUserAddedLogo,
    designData,
    shouldPreferSnapshots,
    storageId,
    visualsLoaded,
  ])

  const compositePreview = useMemo(() => {
    if (!designData) return null
    const uploadedImages = isViewingBackPreview
      ? designData.backUploadedImages || []
      : designData.frontUploadedImages || []
    const textElements = isViewingBackPreview
      ? designData.backTextElements || []
      : designData.frontTextElements || []

    if (uploadedImages.length === 0 && textElements.length === 0) return null

    return {
      baseImage: maskedPreview.baseImage || resolvedProductImage,
      maskSrc: maskedPreview.maskSrc || undefined,
      color: maskedPreview.color || undefined,
      uploadedImages,
      textElements,
      canvasWidth: designData.canvasWidth,
      canvasHeight: designData.canvasHeight,
    }
  }, [
    designData,
    isViewingBackPreview,
    maskedPreview.baseImage,
    maskedPreview.color,
    maskedPreview.maskSrc,
    resolvedProductImage,
  ])

  const useCompositePreview = useMemo(() => {
    // ✅ SIMPLIFIED: If using snapshots, never use composite preview
    // Snapshots are pre-rendered complete images - no need to rebuild layers
    if (usingSnapshots) {
      
      return false
    }

    // Only use composite when no snapshot available and we have design elements
    return !!compositePreview
  }, [usingSnapshots, compositePreview])

  // ✅ UPDATED: Use snapshot directly when available
  const effectiveDisplayImage = usingSnapshots ? activeSnapshot : (useCompositePreview ? null : displayImage)
  const forceMaskedPreview = displayImageIsDataLike && !compositePreview && !!resolvedProductImage

  const useMaskedPreview = useMemo(() => {
    // ✅ SIMPLIFIED: If using snapshots, never use masked preview
    // Snapshots are pre-rendered complete images - no need for mask layers
    if (usingSnapshots) {
      
      return false
    }

    if (useCompositePreview) return false

    if (forceMaskedPreview) return true
    const allowMaskedFallback =
      hasUserAddedLogo === false ||
      (hasUserAddedLogo !== true && visualsLoaded && !activeSnapshot)
    if (!allowMaskedFallback) {
      return false
    }

    if (!maskedPreview.baseImage || !maskedPreview.maskSrc || !maskedPreview.color) {
      return false
    }
    if (!effectiveDisplayImage) return true
    if (
      effectiveDisplayImage.startsWith('data:image/') ||
      effectiveDisplayImage.startsWith('blob:') ||
      effectiveDisplayImage.startsWith('dexie:')
    ) {
      return false
    }
    const normalizedDisplay = effectiveDisplayImage.replace(/%20/g, ' ').replace(/\+/g, ' ')
    const baseImages = [resolvedProductImage, designData?.productImage].filter(Boolean) as string[]
    return baseImages.some(
      (img) => img.replace(/%20/g, ' ').replace(/\+/g, ' ') === normalizedDisplay,
    )
  }, [
    usingSnapshots,
    designData?.productImage,
    effectiveDisplayImage,
    activeSnapshot,
    hasUserAddedLogo,
    maskedPreview.baseImage,
    maskedPreview.color,
    maskedPreview.maskSrc,
    resolvedProductImage,
    forceMaskedPreview,
    useCompositePreview,
    visualsLoaded,
  ])

  const prioritizePreview = useMemo(() => {
    if (useMaskedPreview) return true
    if (effectiveDisplayImage) return true
    return hasUserAddedLogo === false
  }, [effectiveDisplayImage, hasUserAddedLogo, useMaskedPreview])

  // Preload the most critical preview image for faster LCP
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!effectiveDisplayImage || !prioritizePreview) return

    // Only preload static images, not data/blob URLs
    if (
      effectiveDisplayImage.startsWith('data:') ||
      effectiveDisplayImage.startsWith('blob:') ||
      effectiveDisplayImage.startsWith('dexie:')
    ) {
      return
    }

    const link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'image'
    link.href = effectiveDisplayImage
    link.fetchPriority = 'high'
    document.head.appendChild(link)

    return () => {
      if (document.head.contains(link)) {
        document.head.removeChild(link)
      }
    }
  }, [effectiveDisplayImage, prioritizePreview])

  useEffect(() => {
    if (!useMaskedPreview) return
    const maskSrc = maskedPreview.maskSrc
    if (typeof window === 'undefined') return
    const shouldPrefetch = (src: string) =>
      src && !src.startsWith('data:') && !src.startsWith('blob:')

    // Defer prefetch to idle time to avoid blocking critical rendering
    const prefetchImage = () => {
      const links: HTMLLinkElement[] = []
      if (maskSrc && shouldPrefetch(maskSrc)) {
        const link = document.createElement('link')
        link.rel = 'prefetch'
        link.as = 'image'
        link.href = maskSrc
        links.push(link)
        document.head.appendChild(link)
      }
      return links
    }

    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(() => {
        const links = prefetchImage()
        return () => {
          links.forEach((link) => {
            if (document.head.contains(link)) {
              document.head.removeChild(link)
            }
          })
        }
      })
      return () => cancelIdleCallback(id)
    } else {
      const links = prefetchImage()
      return () => {
        links.forEach((link) => {
          if (document.head.contains(link)) {
            document.head.removeChild(link)
          }
        })
      }
    }
  }, [maskedPreview.baseImage, maskedPreview.maskSrc, useMaskedPreview])

  useEffect(() => {
    if (!debugEnabled) return
    if (effectiveDisplayImage) {
      
      return
    }

    console.warn('[order-quantity][preview] No display image found', {
      storageId,
      isViewingBackPreview,
      hasBackSide,
      hasBackBase,
      hasBackUploads,
      frontSnapshot: frontSnapshot ? frontSnapshot.substring(0, 50) : null,
      backSnapshot: backSnapshot ? backSnapshot.substring(0, 50) : null,
      designData: Boolean(designData),
      frontUploads: designData?.frontUploadedImages?.length || 0,
      backUploads: designData?.backUploadedImages?.length || 0,
      productImage: productData.productImage || null,
      resolvedProductImage: resolvedProductImage || null,
    })
  }, [
    backSnapshot,
    debugEnabled,
    designData,
    effectiveDisplayImage,
    frontSnapshot,
    hasBackSide,
    hasBackBase,
    hasBackUploads,
    isViewingBackPreview,
    productData.productImage,
    resolvedProductImage,
    storageId,
  ])

  const handleEditDesign = async () => {
    const productId = navParams.productId ?? ''
    const cartItemId = navParams.cartItemId ?? productId
    const productName = navParams.productName ?? ''
    const productCategory = navParams.productCategory ?? ''
    const productImage = navParams.productImage ?? ''
    const isCustom = navParams.isCustom ?? false

    // ✅ Set reset flag so chat resets when returning to order-quantity
    if (typeof window !== 'undefined' && storageId) {
      const resetPayload = { t: Date.now(), reason: 'edit-from-order-quantity' }
      localStorage.setItem(`orderChatReset_${storageId}`, JSON.stringify(resetPayload))
      // Also save to Dexie (where useOrderData checks)
      await saveOrder(storageId, { resetPayload })
    }

    if (fromChat) {
      // ✅ Resume chat explicitly (prevents accidental "new" behavior)
      // ✅ Always pass cartItemId when available, because chat-box prefers:
      //    storageId = cartItemId || productId
      navigate('/chat-box', {
        mode: 'resume',
        fromOrderQuantity: true,
        cartItemId,
        productId,
        productName,
        productCategory,
        isCustom,
        productImage: productImage || undefined,
        designSessionId: designSessionId || undefined,
      })
    } else {
      navigate('/design', {
        cartItemId,
        productId,
        productName,
        productCategory,
        productImage: productImage || undefined,
      })
    }
  }

  const handleNext = async () => {
    if (!isOrderValid || !storageId) return

    // ✅ Stable pricing keys required by backend checkout
    const { category, name } = derivePricingKeys({
      productCategory: productData.productCategory,
      productName: productData.productName,
      designData,
    })

    // ✅ Determine pricingMode for backend (catalog_markup vs manual_quote)
    const pricingMode =
      fromChat && !isCustomProduct ? 'catalog_markup' : 'manual_quote'

    // Build full conversation string from chatHistory
    const fullConversation = chatHistory
      .map((msg) => `${msg.role === 'user' ? 'User' : 'AI'}: ${msg.text}`)
      .join('\n')

    const orderData = {
      // ✅ REQUIRED (backend pricing keys)
      category,
      name,
      isCustom: Boolean(isCustomProduct),
      pricingMode, // ✅ Tell backend to apply 10% markup for product-chat items

      quantity,
      comments: fullConversation, // Full conversation history (user + AI)
      sizeBreakdownText,
      orderNotes,

      // ok to keep for UI / display
      totalCost,
      unitPrice,

      isComplete: true,
      fromChat,
    }

    if (!category || !name) return

    // Save to both localStorage (legacy) and Dexie (primary)
    localStorage.setItem(`orderData_${storageId}`, JSON.stringify(orderData))
    await saveOrder(storageId, { orderData })
    navigate('/product-showcase')
  }

  return (
    <main
      className="
        relative
        min-h-screen
        text-white
        overflow-x-hidden
        overflow-y-auto
      "
      style={{
        backgroundImage: `url('${BACKGROUND_IMAGE}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundColor: '#000000',
        backgroundAttachment: 'fixed',
      }}
    >
      <StepHeader />

      <div className="relative z-10 mx-auto max-w-[1600px] px-4 sm:px-6 md:px-10 pt-32 md:pt-40 pb-10 grid grid-cols-12 gap-6 md:gap-8 lg:items-center">
        {/* Debug: Log what's being passed to PreviewCard */}
        {(() => {
          
          return null
        })()}
        <PreviewCard
          displayImage={effectiveDisplayImage}
          fallbackProductImage={
            usingSnapshots
              ? '' // ✅ No fallback when using snapshots - snapshot is the source of truth
              : resolvedProductImage || productData.productImage
          }
          maskedBaseImage={maskedPreview.baseImage}
          maskedColor={maskedPreview.color}
          maskedMaskSrc={maskedPreview.maskSrc}
          useMaskedPreview={useMaskedPreview}
          compositePreview={useCompositePreview ? compositePreview : null}
          productName={productData.productName}
          hasBackSide={hasBackSide}
          isViewingBackPreview={isViewingBackPreview}
          onToggleBack={() => setIsViewingBackPreview((p) => !p)}
          onEdit={handleEditDesign}
          prioritizePreview={prioritizePreview}
          debugEnabled={debugEnabled}
          usingSnapshots={usingSnapshots}
        />

        <QuantityCard
          quantity={quantity}
          setQuantity={setQuantity}
          unitPrice={unitPrice}
          totalCost={totalCost}
          isOrderValid={isOrderValid}
          isOneSizeCategory={isOneSizeCategory}
          chatHistory={chatHistory}
          isChatLoading={isChatLoading}
          chatContainerRef={chatContainerRef}
          chatInput={chatInput}
          setChatInput={setChatInput}
          onSend={handleChatSend}
          navParams={navParams}
        />

        <NextButton isOrderValid={isOrderValid} onNext={handleNext} />
      </div>

    </main>
  )
}

export default function OrderQuantity() {
  return (
    <Suspense fallback={<OrderQuantitySkeleton />}>
      <OrderQuantityContent />
    </Suspense>
  )
}
