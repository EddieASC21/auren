'use client'

import { motion } from 'framer-motion'
import { useState, useEffect, Suspense, useRef, useMemo } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { getPriceDetails } from '../../lib/pricingData'
import { db } from '@/lib/db'

// --- Types for saved design reconstruction ---
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
  isCustomProduct?: boolean
  fromChat?: boolean
}

function OrderQuantityContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const storageId =
    searchParams.get('cartItemId') || searchParams.get('productId') || ''

  const [quantity, setQuantity] = useState(35)
  const [productData, setProductData] = useState({
    productId: '',
    productName: '',
    productImage: '',
    productCategory: '',
  })
  const [unitPrice, setUnitPrice] = useState(0)
  const [totalCost, setTotalCost] = useState(0)
  const [isCustomProduct, setIsCustomProduct] = useState(false)
  const [comments, setComments] = useState(
    'For sizes I want 20 small, 10 medium, and 15 large.'
  )

  const [designData, setDesignData] = useState<DesignData | null>(null)

  // ONLY final notes from user (e.g., special instructions)
  const [orderNotes, setOrderNotes] = useState('')

  // ONLY the parsed sizes / confirmed text from AI
  const [sizeBreakdownText, setSizeBreakdownText] = useState('')

  const [awaitingComments, setAwaitingComments] = useState(false)
  const [isViewingBackPreview, setIsViewingBackPreview] = useState(false)

  const [frontSnapshot, setFrontSnapshot] = useState<string | null>(null)
  const [backSnapshot, setBackSnapshot] = useState<string | null>(null)
  const [isOneSizeCategory, setIsOneSizeCategory] = useState(false)

  const fromChat = searchParams.get('fromChat') === 'true'

  // track design session so chat-box can restore the same Firestore conversation
  const [designSessionId, setDesignSessionId] = useState<string | null>(null)

  // -----------------------------------------------------------------
  // AI ASSISTANT LOGIC
  // -----------------------------------------------------------------
  const [chatInput, setChatInput] = useState('')
  const [chatHistory, setChatHistory] = useState<
    { role: 'user' | 'assistant'; text: string }[]
  >([
    {
      role: 'assistant',
      text:
        'Hello! Let’s figure out how many of each size you need and any notes we should add to your order. ' +
        'You can type something like “20 S, 10 M, 5 L” or ask for help.',
    },
  ])
  const [isChatLoading, setIsChatLoading] = useState(false)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  const [isLoaded, setIsLoaded] = useState(false)

  // load designSessionId from URL or localStorage (set by chat-box)
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const fromUrl = searchParams.get('designSessionId')

    if (fromUrl) {
      setDesignSessionId(fromUrl)
      return
    }

    try {
      // read the same key chat-box uses
      const globalSession = localStorage.getItem('aiChat_sessionId')
      if (globalSession) {
        setDesignSessionId(globalSession)
        return
      }

      // as a fallback, try per-cart mapping from chat-box
      const sid =
        searchParams.get('cartItemId') || searchParams.get('productId')
      if (sid) {
        const mapped = localStorage.getItem(`design_session_${sid}`)
        if (mapped) {
          setDesignSessionId(mapped)
        }
      }
    } catch (e) {
      console.warn('Could not read design session id in order-quantity', e)
    }
  }, [searchParams])

  // Calculate price whenever quantity/product/custom-flag changes
  useEffect(() => {
    if (!productData.productCategory || !productData.productName) {
      return
    }

    const priceData = getPriceDetails(
      productData.productCategory,
      productData.productName,
      quantity,
      isCustomProduct
    )

    if (priceData) {
      let unit = priceData.unitPrice
      let total = priceData.totalCost

      // 10% markup when arriving from chat-box
      if (fromChat) {
        unit = unit * 1.1
        total = unit * quantity
      }

      setUnitPrice(unit)
      setTotalCost(total)
    }
  }, [
    quantity,
    productData.productCategory,
    productData.productName,
    isCustomProduct,
    fromChat,
  ])

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [chatHistory])

  // 1. LOAD ALL DATA (Order, Design, Chat)
  useEffect(() => {
    if (!storageId || typeof window === 'undefined') {
      return
    }

    // A. Load existing order data
    const savedOrder = localStorage.getItem(`orderData_${storageId}`)
    if (savedOrder) {
      try {
        const parsed = JSON.parse(savedOrder)
        if (parsed.quantity) {
          setQuantity(parsed.quantity)
        }
        if (parsed.comments) {
          setComments(parsed.comments)
        }
        if (parsed.sizeBreakdownText) {
          setSizeBreakdownText(parsed.sizeBreakdownText)
        }
        if (parsed.orderNotes) {
          setOrderNotes(parsed.orderNotes)
        }
      } catch {
        // ignore
      }
    }

    // B. If design was just edited, reset this item's order/chat
    const editFlagKey = `justEdited_${storageId}`
    const wasJustEdited = localStorage.getItem(editFlagKey)

    if (wasJustEdited) {
      console.log('Design was just edited. Resetting Order & AI for', storageId)

      localStorage.removeItem(editFlagKey)
      localStorage.removeItem(`orderChatHistory_${storageId}`)

      setSizeBreakdownText('')
      setComments('')
      setOrderNotes('')

      const freshOrder = {
        quantity: 35,
        comments: '',
        sizeBreakdownText: '',
        orderNotes: '',
        isComplete: false,
      }
      localStorage.setItem(`orderData_${storageId}`, JSON.stringify(freshOrder))
    } else {
      // C. Normal load: restore chat for this cart item
      const savedChat = localStorage.getItem(`orderChatHistory_${storageId}`)
      if (savedChat) {
        try {
          const parsedChat = JSON.parse(savedChat)
          if (Array.isArray(parsedChat) && parsedChat.length > 0) {
            setChatHistory(parsedChat)
          }
        } catch {
          // ignore
        }
      }
    }

    setIsLoaded(true)
  }, [storageId])

  // 2. SAVE ORDER DATA & CHAT HISTORY ON CHANGE
  useEffect(() => {
    if (!isLoaded || !storageId || typeof window === 'undefined') {
      return
    }

    let existingComplete = false
    const existingRaw = localStorage.getItem(`orderData_${storageId}`)
    if (existingRaw) {
      try {
        const parsed = JSON.parse(existingRaw)
        existingComplete = !!parsed.isComplete
      } catch {
        // ignore
      }
    }

    const orderData = {
      quantity,
      comments,
      totalCost,
      unitPrice,
      sizeBreakdownText,
      orderNotes,
      isComplete: existingComplete,
      fromChat,
      isCustomProduct,
    }

    localStorage.setItem(`orderData_${storageId}`, JSON.stringify(orderData))
    localStorage.setItem(
      `orderChatHistory_${storageId}`,
      JSON.stringify(chatHistory)
    )
  }, [
    storageId,
    quantity,
    comments,
    totalCost,
    unitPrice,
    chatHistory,
    isLoaded,
    sizeBreakdownText,
    orderNotes,
    isCustomProduct,
    fromChat,
  ])

  // UPDATED AI CHAT HANDLER
  const handleChatSend = async () => {
    if (!chatInput.trim() || isChatLoading) {
      return
    }

    const userMsg = chatInput
    setChatInput('')

    const previousHistory = [...chatHistory]
    const newHistory = [...chatHistory, { role: 'user' as const, text: userMsg }]
    setChatHistory(newHistory)
    setIsChatLoading(true)

    try {
      const hasImages =
        !!designData &&
        ((designData.frontUploadedImages?.length || 0) > 0 ||
          (designData.backUploadedImages?.length || 0) > 0)

      const hasOverlayDesign =
        hasImages ||
        (!!designData &&
          ((designData.frontTextElements?.length || 0) > 0 ||
            (designData.backTextElements?.length || 0) > 0))

      // If this is a catalog product coming from chat-box,
      // treat it as BLANK for the AI assistant
      const isChatCatalogFlow = fromChat && !isCustomProduct
      const hasDesign = isChatCatalogFlow ? false : hasOverlayDesign

      // If we were waiting for comments, treat this user message as those comments
      if (awaitingComments) {
        setOrderNotes(userMsg)
        setAwaitingComments(false)
      }

      // pick the Firestore draft/session id
      const draftId =
        designSessionId ||
        searchParams.get('designSessionId') ||
        (storageId ? `order_${storageId}` : 'guest_session')

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/orders/assistant`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userMsg,
            chatHistory: previousHistory,
            draftId,
            context: {
              quantity,
              category: productData.productCategory,
              categoryType: isOneSizeCategory ? 'one-size' : 'sized',
              productState: hasDesign
                ? 'Customized with Design'
                : 'Blank Product (No Print/Embroidery needed)',
              hasImages,
              hasDesign,
              // Prefer final orderNotes if present, otherwise fall back to comments
              currentComments: orderNotes || comments,
            },
          }),
        }
      )

      const data = await res.json()

      if (data.aiReply) {
        const reply = data.aiReply

        setChatHistory((prev) => [...prev, { role: 'assistant', text: reply }])

        // Backend tells us when it parsed a valid breakdown string
        if (data.validBreakdownText) {
          setSizeBreakdownText(data.validBreakdownText)
        }

        // Detect when AI is requesting comments
        if (reply.toLowerCase().includes('any additional comments')) {
          setAwaitingComments(true)
        }

        // If we weren't in "awaiting comments" mode, append AI reply to comments log
        if (!awaitingComments) {
          setComments((prev) => `${prev}\nAI: ${reply}`)
        }
      }
    } catch (err: any) {
      console.error('Assistant error', err)
      setChatHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `⚠️ Error: ${err.message}. (Check console for details)`,
        },
      ])
    } finally {
      setIsChatLoading(false)
    }
  }

  const handleNext = () => {
    if (!isOrderValid || !storageId) {
      return
    }

    const orderData = {
      quantity,
      comments,
      totalCost,
      unitPrice,
      sizeBreakdownText,
      orderNotes,
      isComplete: true,
      fromChat,
      isCustomProduct,
    }
    localStorage.setItem(`orderData_${storageId}`, JSON.stringify(orderData))

    router.push('/product-showcase')
  }

  const hasBackSide =
    !!backSnapshot || (!!designData && (designData.backUploadedImages?.length || 0) > 0)

  // Load product meta from URL
  useEffect(() => {
    const productId = searchParams.get('productId')
    const productName = searchParams.get('productName')
    const productImage = searchParams.get('productImage')
    const productCategory = searchParams.get('productCategory')

    if (productId && productName && productCategory) {
      const decodedCategory = decodeURIComponent(productCategory)
      const lower = decodedCategory.toLowerCase()

      const oneSize =
        lower.includes('other') ||
        lower.includes('accessory') ||
        lower.includes('gift')

      setProductData({
        productId,
        productName: decodeURIComponent(productName),
        productImage: productImage ? decodeURIComponent(productImage) : '',
        productCategory: decodedCategory,
      })

      setIsOneSizeCategory(oneSize)
    }
  }, [searchParams])

  // Load snapshots & design metadata from IndexedDB/localStorage
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    if (!storageId) {
      setDesignData(null)
      return
    }

    const loadVisuals = async () => {
      try {
        const front = await db.cartAssets.get(`snapshot_front_${storageId}`)
        if (front) {
          setFrontSnapshot(front.base64)
        }

        const back = await db.cartAssets.get(`snapshot_back_${storageId}`)
        if (back) {
          setBackSnapshot(back.base64)
        }

        const key = `designData_${storageId}`
        const raw = localStorage.getItem(key)
        if (raw) {
          const d = JSON.parse(raw)
          setDesignData(d)
        }
      } catch (err) {
        console.warn('Error loading visuals:', err)
      }
    }

    loadVisuals()
  }, [storageId])

  // Optional cleanup of other design/order keys
  useEffect(() => {
    if (!storageId || typeof window === 'undefined') {
      return
    }

    Object.keys(localStorage).forEach((key) => {
      if (
        (key.startsWith('designData_') && key !== `designData_${storageId}`) ||
        (key.startsWith('orderData_') && key !== `orderData_${storageId}`)
      ) {
        // optional cleanup – still commented out
        // localStorage.removeItem(key)
      }
    })
  }, [storageId])

  // If there's no back snapshot, force toggle to front
  useEffect(() => {
    if (!hasBackSide && isViewingBackPreview) {
      setIsViewingBackPreview(false)
    }
  }, [hasBackSide, isViewingBackPreview])

  // Determine if product is custom vs catalog
  useEffect(() => {
    const isCustomParam = searchParams.get('isCustom') === 'true'

    const cat =
      (designData?.selectedProductCategory || productData.productCategory || '').toLowerCase()

    const implicitCustom = !cat || cat === 'custom' || cat === 'unknown'

    const shouldUseCustomPricing = isCustomParam || implicitCustom
    setIsCustomProduct(shouldUseCustomPricing)
  }, [searchParams, designData, productData.productCategory])

  // Parsing helpers for sizes / quantity validation
  function computeParsedTotal(parsed: Record<string, number>) {
    return Object.values(parsed).reduce((a, b) => a + b, 0)
  }

  function parseSizesFromComments(text: string) {
    const sizeRegex =
      /(\d+)\s*(xs|s|sm|small|m|md|medium|l|lg|large|xl|extra large|2xl|xxl)/gi
    const result: Record<string, number> = {}

    let match
    while ((match = sizeRegex.exec(text)) !== null) {
      const count = Number(match[1])
      const size = match[2].toLowerCase()

      let normalized = size
      if (['extra small', 'xs'].includes(size)) {
        normalized = 's'
      }
      if (['small', 'sm', 's'].includes(size)) {
        normalized = 's'
      }
      if (['medium', 'md', 'm'].includes(size)) {
        normalized = 'm'
      }
      if (['large', 'lg', 'l'].includes(size)) {
        normalized = 'l'
      }
      if (['extra large', 'xl'].includes(size)) {
        normalized = 'xl'
      }
      if (['2xl', 'xxl'].includes(size)) {
        normalized = '2xl'
      }

      result[normalized] = (result[normalized] || 0) + count
    }

    return result
  }

  function parseOneSizeConfirmedQuantity(text: string) {
    if (!text) {
      return 0
    }
    const match = text.match(/(\d+)/)
    if (!match) {
      return 0
    }
    return Number(match[1])
  }

  const parsedSizes = useMemo(
    () => (!isOneSizeCategory ? parseSizesFromComments(sizeBreakdownText) : {}),
    [sizeBreakdownText, isOneSizeCategory]
  )

  const parsedTotal = useMemo(
    () => computeParsedTotal(parsedSizes),
    [parsedSizes]
  )

  const confirmedOneSizeQty = useMemo(
    () => (isOneSizeCategory ? parseOneSizeConfirmedQuantity(sizeBreakdownText) : null),
    [sizeBreakdownText, isOneSizeCategory]
  )

  const isOrderValid = isOneSizeCategory
    ? confirmedOneSizeQty === quantity
    : parsedTotal === quantity

  // Choose which snapshot/fallback image to show
  let displayImage =
    isViewingBackPreview && hasBackSide ? backSnapshot : frontSnapshot

  // Fallback for AI → order-quantity path (no snapshots yet)
  if (!displayImage && designData) {
    const fallback = isViewingBackPreview
      ? designData.backUploadedImages?.[0]?.src
      : designData.frontUploadedImages?.[0]?.src

    displayImage = fallback || null
  }

  const handleEditDesign = () => {
    const productId = searchParams.get('productId') ?? ''
    const cartItemId = searchParams.get('cartItemId') ?? productId
    const productName = searchParams.get('productName') ?? ''
    const productCategory = searchParams.get('productCategory') ?? ''
    const productImage = searchParams.get('productImage') ?? ''
    const isCustom = searchParams.get('isCustom') ?? 'false'

    if (fromChat) {
      const params = new URLSearchParams({
        productId,
        productName,
        productCategory,
        isCustom,
        fromOrderQuantity: 'true',
      })

      if (productImage) {
        params.set('productImage', productImage)
      }

      if (designSessionId) {
        params.set('designSessionId', designSessionId)
      }

      router.push(`/chat-box?${params.toString()}`)
    } else {
      const params = new URLSearchParams({
        cartItemId,
        productId,
        productName,
        productCategory,
      })

      if (productImage) {
        params.set('productImage', productImage)
      }

      router.push(`/design?${params.toString()}`)
    }
  }

  // Rewrite initial assistant message for one-size items
  useEffect(() => {
    if (!isOneSizeCategory) {
      return
    }

    setChatHistory((prev) => {
      if (prev.length > 1) {
        return prev
      }

      if (
        prev.length === 1 &&
        prev[0].role === 'assistant' &&
        prev[0].text.includes('how many of each size')
      ) {
        return [
          {
            role: 'assistant',
            text:
              'Hello! This product is one-size. Please confirm how many units you want (for example, “35 units”). ' +
              'Once we lock in the quantity, we’ll capture any additional comments or special instructions.',
          },
        ]
      }

      return prev
    })
  }, [isOneSizeCategory])

  return (
    <main
      className="
    relative
    min-h-screen
    text-white
    overflow-x-hidden
    overflow-y-auto     /* mobile & small screens can scroll */
    lg:h-screen         /* on desktop, lock to exactly 100vh */
    lg:overflow-y-hidden
  "
      style={{
        backgroundImage: "url('/background.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* Step Number & Progress */}
      <motion.div
        className="absolute top-8 left-8 z-20"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="text-white text-3xl font-light mb-2">03</div>
        <div className="w-64 sm:w-80 md:w-96 h-1 bg-white/30 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-white rounded-full"
            initial={{ width: 0 }}
            animate={{ width: '45%' }}
            transition={{ duration: 0.8, delay: 0.3 }}
          />
        </div>
      </motion.div>

      {/* --- MAIN GRID --- */}
      <motion.div
        className="mx-auto max-w-[1600px] px-4 sm:px-6 md:px-10 pt-32 md:pt-40 pb-10 grid grid-cols-12 gap-6 md:gap-8 lg:items-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        {/* --- LEFT PREVIEW CARD --- */}
        <motion.div
          className="col-span-12 lg:col-span-3 justify-self-center"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.35 }}
        >
          <motion.div
            className="relative w-full max-w-[360px] aspect-[3/4] rounded-[28px] overflow-hidden"
            whileHover={{
              scale: 1.03,
              transition: { duration: 0.25, ease: 'easeOut' },
            }}
          >
            {/* Edit button */}
            <div className="absolute top-4 left-4 z-30">
              <button
                type="button"
                onClick={handleEditDesign}
                className="bg-white/12 text-white text-xs font-medium px-3 py-1.5 rounded-full ring-1 ring-white/25 backdrop-blur-md hover:bg-white/20 transition"
              >
                Edit
              </button>
            </div>

            {/* Glass background */}
            <div className="absolute inset-0 rounded-[28px] bg-white/10 backdrop-blur-2xl ring-1 ring-inset ring-white/25 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.55)]" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-50" />

            {/* Shirt container – transparent so background shows through */}
            <div className="relative z-10 flex items-center justify-center w-full h-full">
              {displayImage ? (
                <img
                  src={displayImage}
                  alt={productData.productName || 'Product preview'}
                  className="max-w-[80%] max-h-[80%] object-contain drop-shadow-2xl"
                />
              ) : productData.productImage ? (
                <img
                  src={productData.productImage}
                  alt={productData.productName || 'Product preview'}
                  className="max-w-[80%] max-h-[80%] object-contain drop-shadow-2xl"
                />
              ) : (
                <div className="text-white/50 text-sm animate-pulse">
                  Loading Preview...
                </div>
              )}
            </div>

            {hasBackSide && (
              <button
                onClick={() => setIsViewingBackPreview((prev) => !prev)}
                className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 bg-white/12 text-white text-xs font-medium px-3 py-1.5 rounded-full ring-1 ring-white/25 backdrop-blur-md hover:bg-white/20 transition underline"
              >
                {isViewingBackPreview ? 'View Front' : 'View Back'}
              </button>
            )}
          </motion.div>

          <div className="mt-5 w-full max-w-[360px] flex items-center justify-between px-2">
            <span className="text-sm md:text-base font-semibold text-white tracking-widest">
              MADE WITH AUREN
            </span>
            <span className="text-sm md:text-base font-semibold text-white tracking-widest text-right">
              &amp; YOU!
            </span>
          </div>
        </motion.div>

        {/* --- CENTER QUANTITY CARD --- */}
        <motion.div
          className="col-span-12 lg:col-span-6 justify-self-center w-full max-w-[600px]"
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
        >
          <div className="relative w-full rounded-[28px] overflow-hidden">
            <div className="absolute inset-4 rounded-[24px] bg-gradient-to-b from-black/25 to-black/35 ring-1 ring-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]" />

            <div className="relative z-10 p-8 h-full flex flex-col">
              <h2 className="text-2xl font-semibold text-white text-center mb-6">
                Select Order Quantity
              </h2>

              {/* Top Section: Quantity and Price */}
              <div className="relative bg-white/5 backdrop-blur-sm ring-1 ring-white/20 rounded-2xl p-6 shadow-lg">
                <div className="text-center mb-6">
                  <div className="text-6xl font-light text-white mb-3">
                    {quantity}
                  </div>
                  <div className="relative mx-2">
                    <input
                      type="range"
                      min="35"
                      max="500"
                      value={quantity}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                      className="w-full h-2 bg-white/20 rounded-full appearance-none cursor-pointer slider"
                    />
                    <style jsx>{`
                      .slider::-webkit-slider-thumb {
                        appearance: none;
                        width: 20px;
                        height: 20px;
                        border-radius: 50%;
                        background: white;
                        cursor: pointer;
                        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
                      }
                      .slider::-moz-range-thumb {
                        width: 20px;
                        height: 20px;
                        border-radius: 50%;
                        background: white;
                        cursor: pointer;
                        border: none;
                        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
                      }
                    `}</style>
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-white/80 mb-2">
                    For {quantity} units, it will cost ${unitPrice.toFixed(2)}/unit
                  </p>
                  <p className="text-2xl font-semibold text-white">
                    Your total cost is ${totalCost.toFixed(2)}
                  </p>

                  {!isOrderValid && !isOneSizeCategory && (
                    <p className="text-red-400 text-sm mt-3 text-center">
                      Sizes must total exactly {quantity} units before continuing.
                    </p>
                  )}

                  {!isOrderValid && isOneSizeCategory && (
                    <p className="text-red-400 text-sm mt-3 text-center">
                      Please confirm the {quantity} units with the AI assistant before
                      continuing.
                    </p>
                  )}
                </div>
              </div>

              {/* --- AI Assistant Section --- */}
              <div className="mt-6 space-y-2">
                <div className="flex justify-between items-center px-1">
                  <h3 className="text-base font-medium text-white/80 text-left">
                    AI Order Assistant
                  </h3>
                  <Link
                    href={`/size-chart?${searchParams.toString()}`}
                    className="text-sm text-white/70 underline hover:text-white"
                  >
                    View Size Chart
                  </Link>
                </div>

                <div className="relative h-72 bg-white/5 backdrop-blur-sm ring-1 ring-white/20 rounded-2xl overflow-hidden flex flex-col">
                  <div
                    ref={chatContainerRef}
                    className="flex-1 p-4 overflow-y-auto space-y-3 scrollbar-hide"
                  >
                    {chatHistory.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'
                          }`}
                      >
                        <div
                          className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed ${msg.role === 'user'
                              ? 'bg-white/20 text-white'
                              : 'bg-black/40 text-white/90'
                            }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    ))}
                    {isChatLoading && (
                      <div className="flex justify-start">
                        <div className="bg-black/40 px-3 py-2 rounded-xl text-xs text-white/60 animate-pulse">
                          Thinking...
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-2 bg-white/5 border-t border-white/10 flex gap-2 items-center">
                    <input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleChatSend()}
                      placeholder={
                        isOneSizeCategory
                          ? 'Tell me how many units you want (e.g. 35) or ask a question...'
                          : 'Type your sizes or questions (e.g. 20 S, 10 M, 5 L)...'
                      }
                      className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder-white/50 px-2"
                    />
                    <button
                      onClick={handleChatSend}
                      disabled={isChatLoading || !chatInput.trim()}
                      className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white disabled:opacity-50 transition flex items-center justify-center"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path
                          d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
              {/* --- END: AI Assistant Section --- */}
            </div>
          </div>
        </motion.div>

        {/* RIGHT: Next button */}
        <motion.div
          className="col-span-12 lg:col-span-3 justify-self-center"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.65 }}
        >
          <motion.button
            onClick={handleNext}
            disabled={!isOrderValid}
            className={`relative w-32 h-14 rounded-full text-white text-lg font-semibold ${!isOrderValid ? 'opacity-40 cursor-not-allowed' : ''
              }`}
            whileHover={isOrderValid ? { scale: 1.06 } : {}}
            whileTap={isOrderValid ? { scale: 0.96 } : {}}
          >
            <span className="absolute inset-0 rounded-full bg-white/12 backdrop-blur-md ring-1 ring-inset ring-white/30 shadow-[0_10px_30px_rgba(0,0,0,0.35)]" />
            <span className="absolute inset-0 rounded-full bg-gradient-to-br from-white/10 to-transparent" />
            <span className="relative z-10">Next</span>
          </motion.button>
        </motion.div>
      </motion.div>
    </main>
  )
}

export default function OrderQuantity() {
  return (
    <Suspense
      fallback={
        <main className="relative min-h-screen text-white overflow-hidden flex items-center justify-center">
          <div className="text-white">Loading...</div>
        </main>
      }
    >
      <OrderQuantityContent />
    </Suspense>
  )
}