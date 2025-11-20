'use client'

import { motion } from 'framer-motion'
import { useState, useEffect, Suspense, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams, useRouter } from 'next/navigation'
import { getPriceDetails } from '../../lib/pricingData'

// --- Types for saved design reconstruction ---
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

function OrderQuantityContent() {
  const searchParams = useSearchParams()
  const [quantity, setQuantity] = useState(35)
  const router = useRouter()
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

  // -----------------------------------------------------------------
  // 👇 1. NEW: AI ASSISTANT LOGIC
  // -----------------------------------------------------------------
  const [chatInput, setChatInput] = useState('')
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'assistant', text: string }[]>([
    { role: 'assistant', text: 'Need help with sizing or customization? Just ask!' }
  ])
  const [isChatLoading, setIsChatLoading] = useState(false)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  const [isLoaded, setIsLoaded] = useState(false)

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [chatHistory])

  // --- 1. LOAD ALL DATA (Order, Design, Chat) ---
  useEffect(() => {
    const productId = searchParams.get('productId');
    if (productId && typeof window !== 'undefined') {

      // A. Load Order (Quantity, Comments)
      const savedOrder = localStorage.getItem(`orderData_${productId}`);
      if (savedOrder) {
        try {
          const parsed = JSON.parse(savedOrder);
          if (parsed.quantity) setQuantity(parsed.quantity);
          if (parsed.comments) setComments(parsed.comments);
        } catch (e) { }
      }

      // B. Load Chat History
      const savedChat = localStorage.getItem(`orderChatHistory_${productId}`);
      if (savedChat) {
        try {
          const parsedChat = JSON.parse(savedChat);
          // Only restore if it's a valid array
          if (Array.isArray(parsedChat) && parsedChat.length > 0) {
            setChatHistory(parsedChat);
          }
        } catch (e) { }
      }

      // 👇 CRITICAL CHANGE: Mark the page as "Loaded"
      // This triggers the Save hook to start listening for changes.
      setIsLoaded(true);
    }
  }, [searchParams]);

  // --- 2. SAVE ORDER DATA & CHAT HISTORY ON CHANGE ---
  // --- 2. SAVE ORDER DATA & CHAT HISTORY ON CHANGE ---
  useEffect(() => {
    // 👇 STOP HERE if we haven't finished loading yet!
    if (!isLoaded) return;

    const productId = searchParams.get('productId');
    if (productId && typeof window !== 'undefined') {
      const orderData = {
        quantity,
        comments,
        totalCost,
        unitPrice
      };
      localStorage.setItem(`orderData_${productId}`, JSON.stringify(orderData));
      localStorage.setItem(`orderChatHistory_${productId}`, JSON.stringify(chatHistory));
    }
  }, [quantity, comments, totalCost, unitPrice, chatHistory, searchParams, isLoaded]); // 👈 Add isLoaded here

  // --- 3. UPDATED AI CHAT HANDLER ---
  const handleChatSend = async () => {
    if (!chatInput.trim() || isChatLoading) return

    const userMsg = chatInput
    setChatInput('')

    const newHistory = [...chatHistory, { role: 'user' as const, text: userMsg }]
    setChatHistory(newHistory)
    setIsChatLoading(true)

    // Add to comments for final display
    setComments(prev => `${prev}\nUser: ${userMsg}`)

    try {
      // Determine if design exists
      const hasDesign = designData && (
        designData.frontUploadedImages.length > 0 ||
        designData.backUploadedImages.length > 0 ||
        designData.frontTextElements.length > 0
      );

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/orders/assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMsg,
          chatHistory: newHistory,
          draftId: searchParams.get('productId') || 'guest_session',
          context: {
            quantity: quantity, // Pass the slider number
            category: productData.productCategory, // Pass category for sizes
            hasDesign: hasDesign, // Pass design status
            currentComments: comments
          }
        }),
      })

      const data = await res.json()

      if (data.aiReply) {
        setChatHistory(prev => [...prev, { role: 'assistant', text: data.aiReply }])
        setComments(prev => `${prev}\nAI: ${data.aiReply}`)
      }
    } catch (err: any) {
      console.error('Assistant error', err)
      // 👇 VISUAL ERROR MESSAGE
      setChatHistory(prev => [...prev, { role: 'assistant', text: `⚠️ Error: ${err.message}. (Check console for details)` }])
    } finally {
      setIsChatLoading(false)
    }
  }

  // --- 4. NEW: HANDLE NEXT BUTTON CLICK ---
  const handleNext = () => {
    // Force a save before navigating to ensure latest data is captured
    const productId = searchParams.get('productId');
    if (productId) {
      const orderData = { quantity, comments, totalCost, unitPrice };
      localStorage.setItem(`orderData_${productId}`, JSON.stringify(orderData));
    }
    // Use router.push instead of Link for programmatic navigation after save
    router.push('/product-showcase');
  }


  // --- useEffects for loading product/design data (Unchanged) ---
  useEffect(() => {
    const productId = searchParams.get('productId')
    const productName = searchParams.get('productName')
    const productImage = searchParams.get('productImage')
    const productCategory = searchParams.get('productCategory')
    const isCustom = searchParams.get('isCustom')

    setIsCustomProduct(isCustom === 'true' || productId === 'ai-generated')

    if (productId && productName && productCategory) {
      setProductData({
        productId,
        productName: decodeURIComponent(productName),
        productImage: productImage ? decodeURIComponent(productImage) : '',
        productCategory: decodeURIComponent(productCategory),
      })
    }
  }, [searchParams])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const productId = searchParams.get('productId')
    if (!productId) {
      setDesignData(null)
      return
    }
    const key = `designData_${productId}`
    const raw = localStorage.getItem(key)
    if (!raw) {
      setDesignData(null)
      return
    }
    try {
      const d: DesignData = JSON.parse(raw)
      setDesignData(d)
      if (productId === 'ai-generated' && d.frontUploadedImages.length > 0) {
        setProductData(prev => ({
          ...prev,
          productImage: d.frontUploadedImages[0].src
        }));
      }
    } catch (err) {
      console.warn('Corrupt design data for', key)
      setDesignData(null)
    }
  }, [searchParams])

  // Clean up old designs (Optional logic you had)
  useEffect(() => {
    const currentId = searchParams.get('productId')
    Object.keys(localStorage).forEach((key) => {
      // We keep both designData AND orderData for the current product
      if ((key.startsWith('designData_') && key !== `designData_${currentId}`) ||
        (key.startsWith('orderData_') && key !== `orderData_${currentId}`)) {
        // Careful with this cleanup - usually better to clean up at the start of a *new* flow (like in Catalog)
        // rather than here, to allow switching back and forth between recent items.
        // For now, I'll leave your logic but commented out the aggressive cleanup to be safe, 
        // or you can keep it if you strictly want one active session at a time.
        // localStorage.removeItem(key) 
      }
    })
  }, [searchParams])


  // --- Canvas Scaling Logic ---
  const PREVIEW_W = 272
  const PREVIEW_H = 282

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

  // --- Pricing Logic ---
  useEffect(() => {
    if (isCustomProduct) {
      setUnitPrice(9.00);
      setTotalCost(quantity * 9.00);
    }
    else if (productData.productName && productData.productCategory) {
      const priceDetails = getPriceDetails(productData.productCategory, productData.productName)
      if (priceDetails) {
        let discountPercent = 0
        if (quantity >= 150) discountPercent = 0.15
        else if (quantity >= 100) discountPercent = 0.1
        else if (quantity >= 75) discountPercent = 0.07
        else if (quantity >= 50) discountPercent = 0.02
        const currentUnitPrice = priceDetails.base * (1 - discountPercent)
        setUnitPrice(currentUnitPrice)
        setTotalCost(quantity * currentUnitPrice)
      }
    }
  }, [quantity, productData, isCustomProduct])

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
        className="mx-auto max-w-[1600px] px-6 md:px-10 min-h-screen grid grid-cols-12 items-center gap-6 md:gap-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        {/* --- LEFT PREVIEW CARD --- */}
        <motion.div
          className="col-span-12 md:col-span-3 justify-self-center"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.35 }}
        >
          <motion.div
            className="relative w-[320px] h-[360px] rounded-[28px] overflow-hidden"
            whileHover={{
              scale: 1.03,
              transition: { duration: 0.25, ease: 'easeOut' },
            }}
          >
            {/* Outer glass & soft border */}
            <div className="absolute inset-0 rounded-[28px] bg-white/10 backdrop-blur-2xl ring-1 ring-inset ring-white/25 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.55)]" />

            {/* Image and Text Wrapper */}
            <div className="relative z-10 h-full w-full flex flex-col p-6">

              {/* Image Container */}
              <div className="relative flex-1 w-full h-full rounded-[20px] overflow-hidden">

                {/* --- LAYER 2: SHIRT OVERLAY --- */}
                <Image
                  src={productData.productImage || '/placeholder.png'}
                  alt={productData.productName || 'Product'}
                  fill
                  style={{
                    objectFit: 'contain',
                    mixBlendMode: 'multiply',
                    zIndex: 2,
                  }}
                  priority
                  unoptimized
                />

                {/* Reconstructed custom design overlay */}
                {designData && (
                  <>
                    {/* --- LAYER 1: COLOR --- */}
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

                    {/* --- LAYER 3 & 4: DESIGN --- */}
                    <div
                      className="absolute inset-0"
                      style={{
                        zIndex: 3,
                        width: PREVIEW_W,
                        height: PREVIEW_H,
                      }}
                    >
                      <div
                        className="relative"
                        style={{
                          width: designData.canvasWidth * scale,
                          height: designData.canvasHeight * scale,
                          transform: `translate(${offsetX}px, ${offsetY}px)`,
                        }}
                      >
                        {/* Layer 3: Uploaded images */}
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
                              zIndex: 3,
                            }}
                          />
                        ))}
                        {/* Layer 4: Text elements */}
                        {(designData.isViewingBack
                          ? designData.backTextElements
                          : designData.frontTextElements
                        ).map((t) => (
                          <span
                            key={t.id}
                            className="absolute select-none whitespace-nowrap"
                            style={{
                              left: t.x * scale,
                              top: t.y * scale,
                              fontSize: (t.fontSize * (t.scale || 1)) * scale,
                              fontFamily: t.fontFamily,
                              fontWeight: t.fontWeight,
                              fontStyle: t.fontStyle,
                              color: t.color,
                              zIndex: 4,
                            }}
                          >
                            {t.text}
                          </span>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Text below image */}
              <div className="flex justify-between items-center pt-4 mt-auto">
                <span className="text-sm font-medium text-white/80">MADE WITH AUREN</span>
                <span className="text-sm font-medium text-white/80">& YOU!</span>
              </div>

            </div>
          </motion.div>
        </motion.div>

        {/* --- CENTER QUANTITY CARD --- */}
        <motion.div
          className="col-span-12 md:col-span-6 justify-self-center w-full max-w-[600px]"
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
        >
          <div className="relative w-full rounded-[28px] overflow-hidden">
            <div className="absolute inset-0 rounded-[28px] bg-white/8 backdrop-blur-2xl ring-1 ring-inset ring-white/25 shadow-2xl" />
            <div className="absolute inset-6 rounded-[20px] bg-gradient-to-b from-black/25 to-black/35 ring-1 ring-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]" />

            <div className="relative z-10 p-8 h-full flex flex-col">
              <h2 className="text-2xl font-semibold text-white text-center mb-6">
                Select Order Quantity
              </h2>

              {/* Top Section: Quantity and Price */}
              <div className="relative bg-white/5 backdrop-blur-sm ring-1 ring-white/20 rounded-2xl p-6 shadow-lg">
                <div className="text-center mb-6">
                  <div className="text-6xl font-light text-white mb-3">{quantity}</div>
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
                  {isCustomProduct ? (
                    <>
                      <p className="text-white/80 mb-2">
                        For {quantity} units, it will cost $9/unit
                      </p>
                      <p className="text-2xl font-semibold text-white">
                        Your total cost is ${totalCost.toFixed(2)}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-white/80 mb-2">
                        For {quantity} units, it will cost ${unitPrice.toFixed(2)}/unit
                      </p>
                      <p className="text-2xl font-semibold text-white">
                        Your total cost is ${totalCost.toFixed(2)}
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* --- NEW: AI Assistant Section --- */}
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

                {/* Chat Interface Container */}
                <div className="relative h-72 bg-white/5 backdrop-blur-sm ring-1 ring-white/20 rounded-2xl overflow-hidden flex flex-col">

                  {/* Chat History Area */}
                  <div
                    ref={chatContainerRef}
                    className="flex-1 p-4 overflow-y-auto space-y-3 scrollbar-hide"
                  >
                    {chatHistory.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed ${msg.role === 'user'
                            ? 'bg-white/20 text-white'
                            : 'bg-black/40 text-white/90'
                          }`}>
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

                  {/* Input Area */}
                  <div className="p-2 bg-white/5 border-t border-white/10 flex gap-2 items-center">
                    <input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleChatSend()}
                      placeholder="Type your sizes (e.g. 10 M, 5 L)..."
                      className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder-white/50 px-2"
                    />
                    <button
                      onClick={handleChatSend}
                      disabled={isChatLoading || !chatInput.trim()}
                      className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white disabled:opacity-50 transition flex items-center justify-center"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
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
          className="col-span-12 md:col-span-3 justify-self-center md:justify-self-end"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.65 }}
        >
          {/* 👇 REMOVED <Link>, ADDED onClick={handleNext} */}
          <motion.button
            onClick={handleNext}
            className="relative w-32 h-14 rounded-full text-white text-lg font-semibold"
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.96 }}
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