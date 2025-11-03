'use client'

import { motion } from 'framer-motion'
import { useState, useEffect, Suspense, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
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

function OrderQuantityContent() {

  // 🧠 Gemini order assistant chat state
  const [orderChat, setOrderChat] = useState<
    Array<{ role: "user" | "assistant"; text: string }>
  >([
    {
      role: "assistant",
      text: "Hi! I’m your order assistant 👋. Let’s get your sizing and preferences sorted. How many of each size do you need?",
    },
  ]);
  const [orderMessage, setOrderMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Chat send handler
  const handleSendOrderPrompt = async () => {
    if (!orderMessage.trim()) return;
    setIsSending(true);

    setOrderChat((prev) => [...prev, { role: "user", text: orderMessage }]);
    const userMsg = orderMessage;
    setOrderMessage("");

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/orders/assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatHistory: orderChat,   // send full conversation
          userMsg,                  // latest message
          draftId: "demo-draft-123" // temporary placeholder
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gemini error");

      const reply = data.aiReply || "Got it!";
      setOrderChat((prev) => [...prev, { role: "assistant", text: reply }]);
    } catch (err: any) {
      console.error(err);
      setOrderChat((prev) => [
        ...prev,
        { role: "assistant", text: "Sorry, something went wrong processing your request." },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  // ⚙️ Existing logic below this line stays as-is
  const searchParams = useSearchParams();
  const [quantity, setQuantity] = useState(35);
  const [productData, setProductData] = useState({
    productId: '',
    productName: '',
    productImage: '',
    productCategory: '',
  });
  const [unitPrice, setUnitPrice] = useState(0);
  const [totalCost, setTotalCost] = useState(0);
  const [isCustomProduct, setIsCustomProduct] = useState(false);
  const [comments, setComments] = useState(
    'For sizes I want 20 small, 10 medium, and 15 large. I want the design to be embroidered.'
  );
  const [designData, setDesignData] = useState<DesignData | null>(null);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  

  useEffect(() => {
    const productId = searchParams.get('productId')
    const productName = searchParams.get('productName')
    const productImage = searchParams.get('productImage')
    const productCategory = searchParams.get('productCategory')
    const isCustom = searchParams.get('isCustom')
    setIsCustomProduct(isCustom === 'true')

    if (productId && productName && productImage && productCategory) {
      setProductData({
        productId,
        productName: decodeURIComponent(productName),
        productImage: decodeURIComponent(productImage),
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
    } catch (err) {
      console.warn('Corrupt design data for', key)
      setDesignData(null)
    }
  }, [searchParams])

  useEffect(() => {
    const currentId = searchParams.get('productId')
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('designData_') && key !== `designData_${currentId}`) {
        localStorage.removeItem(key)
      }
    })
  }, [searchParams])

  

  const PREVIEW_W = 320
  const PREVIEW_H = 500

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

  useEffect(() => {
    if (!isCustomProduct && productData.productName && productData.productCategory) {
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

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [orderChat, isSending]);

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

      {/* MAIN GRID (unchanged positions) */}
      <motion.div
        className="mx-auto max-w-[1400px] px-6 md:px-10 min-h-screen grid grid-cols-12 items-center gap-6 md:gap-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        {/* LEFT: Preview Card — refined to match Figma */}
        <motion.div
          className="col-span-12 md:col-start-2 md:col-span-3 justify-self-center md:justify-self-start"
          initial={{ opacity: 0, scale: 0.92, rotate: 0 }}
          animate={{ opacity: 1, scale: 1, rotate: 2 }}
          transition={{ duration: 0.7, delay: 0.35 }}
        >
          <motion.div
            className="relative w-[300px] h-[460px] md:w-[320px] md:h-[500px] rounded-[40px] overflow-hidden"
            style={{ transform: 'rotate(2deg)' }}
            whileHover={{
              rotate: 0,
              scale: 1.03,
              transition: { duration: 0.25, ease: 'easeOut' },
            }}
          >
            {/* Outer glass & soft border */}
            <div className="absolute inset-0 rounded-[40px] bg-white/6 backdrop-blur-2xl ring-1 ring-inset ring-white/25 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.55)]" />

            {/* Subtle corner glow */}
            <div className="pointer-events-none absolute -top-16 -left-16 h-48 w-48 rounded-full bg-white/20 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-10 right-0 h-40 w-40 rounded-full bg-white/10 blur-3xl" />

            {/* Image well (matches Figma) */}
            <div className="relative m-4 h-[260px] md:h-[280px] rounded-[32px] overflow-hidden">
              {/* Inner well background & ring */}
              <div className="absolute inset-0 rounded-[32px] bg-gradient-to-b from-white/12 to-white/5 ring-1 ring-inset ring-white/20 backdrop-blur-md" />
              {/* Vignette */}
              <div className="absolute inset-0 rounded-[32px] bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.35),rgba(0,0,0,0)_60%)] opacity-60" />
              {/* Product image */}
              <div className="relative z-10 h-full w-full">
                <Image
                  src={productData.productImage || '/placeholder.png'}
                  alt={productData.productName || 'Product'}
                  fill
                  style={{ objectFit: 'contain', aspectRatio: '1 / 1' }}
                  priority
                />
              </div>

              {/* --- Reconstructed custom design overlay --- */}
              {designData && (
                <div
                  className="absolute inset-0 z-20 flex items-center justify-center"
                  style={{
                    backgroundColor: 'transparent',
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
                    {/* Uploaded images */}
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

                    {/* Text elements */}
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

              {/* Edit button */}
              <Link
                href={`/design?productId=${productData.productId}&productName=${encodeURIComponent(
                  productData.productName
                )}&productImage=${encodeURIComponent(productData.productImage)}`}
                className="absolute top-3 right-3 z-20 bg-white/15 text-white text-xs font-medium px-3 py-1.5 rounded-full ring-1 ring-white/30 backdrop-blur-md hover:bg-white/25"
              >
                Edit
              </Link>

              {/* Remove button */}
              <button className="absolute bottom-3 left-3 z-20 bg-white/12 text-white text-[11px] font-medium px-3 py-1.5 rounded-full ring-1 ring-white/25 backdrop-blur-md hover:bg-white/20">
                Remove Item From Cart
              </button>
            </div>

            {designData && (
              <Link
                href={
                  `/design` +
                  `?productId=${designData.selectedProductId || productData.productId}` +
                  `&productName=${encodeURIComponent(designData.selectedProductName || productData.productName)}` +
                  `&productImage=${encodeURIComponent(designData.productImage || productData.productImage)}` +
                  `&productCategory=${encodeURIComponent(designData.selectedProductCategory || productData.productCategory)}`
                }
                className="absolute bottom-3 right-3 z-20 bg-white/15 text-white text-[11px] font-medium px-3 py-1.5 rounded-full ring-1 ring-white/30 backdrop-blur-md hover:bg-white/25"
              >
                Re-Edit Design
              </Link>
            )}

            {/* Details panel */}
            <div className="relative px-5 pt-2 pb-5">
              <h2 className="text-[28px] leading-7 font-semibold mb-2 bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
                {productData.productName || 'Your Product'}
              </h2>
              <div className="space-y-1.5 text-white/90 text-sm">
                <p>Sizes: TBD</p>
                <p>Quantity: TBD</p>
                <p className="text-[13px]">Material: Premium Cotton</p>
                <p className="text-[13px]">Color: Custom</p>
              </div>
            </div>

          </motion.div>
        </motion.div>

        {/* CENTER: Quantity Card — adds inner darker panel like Figma */}
        <motion.div
          className="col-span-12 md:col-start-6 md:col-span-4 justify-self-center"
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
        >
          <div className="relative w-[90vw] max-w-[520px] h-[620px] rounded-[28px] overflow-hidden">
            {/* outer glass */}
            <div className="absolute inset-0 rounded-[28px] bg-white/8 backdrop-blur-2xl ring-1 ring-inset ring-white/25 shadow-2xl" />
            {/* inner inset panel */}
            <div className="absolute inset-6 rounded-[20px] bg-gradient-to-b from-black/25 to-black/35 ring-1 ring-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]" />

            <div className="relative z-10 p-8 h-full flex flex-col">
              <h2 className="text-2xl font-semibold text-white text-center mb-6">
                Select Order Quantity
              </h2>

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

              <div className="text-center mb-6">
                {isCustomProduct ? (
                  <>
                    <p className="text-white/80 mb-2">
                      For {quantity} units of your custom product
                    </p>
                    <p className="text-lg font-semibold text-white">
                      We will get back to you with quotes in less than 12 hours
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

              <div className="space-y-3">
                <h3 className="text-base font-medium text-white mb-3">
                  AI Order Assistant
                </h3>

                {/* Gemini Assistant Bubble (Fixed Height + Scroll) */}
                <div className="relative flex flex-col bg-white/10 backdrop-blur-md ring-1 ring-white/20 rounded-2xl p-5 shadow-[0_0_30px_rgba(255,255,255,0.08)] h-[240px] flex-shrink-0">
                  {/* Scrollable messages */}
                  <div className="flex-1 overflow-y-auto pr-2 space-y-3 mb-3">
                    {orderChat.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`px-5 py-3 rounded-2xl text-[15px] leading-relaxed max-w-[85%] ${msg.role === "user"
                              ? "bg-blue-600/80 text-white shadow-[0_2px_10px_rgba(59,130,246,0.3)]"
                              : "bg-white/15 text-white border border-white/10"
                            }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    ))}
                    {isSending && (
                      <div className="text-white/70 text-sm italic animate-pulse">
                        Gemini is thinking...
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                  

                  {/* Fixed Input Bar */}
                  <div className="flex items-center gap-3 bg-white/10 rounded-full ring-1 ring-white/25 px-3 py-2 mt-auto">
                    <textarea
                      value={orderMessage}
                      onChange={(e) => setOrderMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendOrderPrompt();
                        }
                      }}
                      placeholder="For sizes I want 20 small, 10 medium, and 15 large. I want the design to be embroidered."
                      className="flex-1 bg-transparent text-white/90 placeholder-white/60 resize-none outline-none text-sm px-2 py-1 leading-snug"
                      rows={1}
                    />
                    <button
                      onClick={handleSendOrderPrompt}
                      disabled={isSending}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full text-sm font-medium transition disabled:opacity-50"
                    >
                      Send
                    </button>
                  </div>
                </div>

                {/* Optional Size Chart link below */}
                <Link
                  href="/size-chart"
                  className="text-sm text-white/70 underline hover:text-white mt-3 block text-center"
                >
                  View Size Chart
                </Link>
              </div>
            </div>
          </div>
        </motion.div>

        {/* RIGHT: Next button (glowing pill like Figma) */}
        <motion.div
          className="col-span-12 md:col-start-11 md:col-span-2 justify-self-center md:justify-self-start"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.65 }}
        >
          <Link href="/product-showcase">
            <motion.button
              className="relative w-32 h-14 rounded-full text-white text-lg font-semibold"
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.96 }}
            >
              {/* glow + glass */}
              <span className="absolute inset-0 rounded-full bg-white/12 backdrop-blur-md ring-1 ring-inset ring-white/30 shadow-[0_10px_30px_rgba(0,0,0,0.35)]" />
              <span className="absolute inset-0 rounded-full bg-gradient-to-br from-white/10 to-transparent" />
              <span className="relative z-10">Next</span>
            </motion.button>
          </Link>
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
