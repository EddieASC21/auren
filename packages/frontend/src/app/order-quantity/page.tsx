'use client'

import { motion } from 'framer-motion'
import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { getPriceDetails } from '../../lib/pricingData'

function OrderQuantityContent() {
  const searchParams = useSearchParams()
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
    'For sizes I want 20 small, 10 medium, and 15 large. I want the design to be embroidered.'
  )

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
                  sizes="320px"
                  priority
                  className="object-contain"
                />
              </div>

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
          <div className="relative w-[90vw] max-w-[520px] h-[520px] rounded-[28px] overflow-hidden">
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

              <div className="space-y-3 mt-auto">
                <h3 className="text-base font-medium text-white">
                  Sizing + Additional Comments
                </h3>

                <Link
                  href="/size-chart"
                  className="text-sm text-white/70 underline hover:text-white"
                >
                  View Size Chart
                </Link>

                <div className="bg-white/8 backdrop-blur-md ring-1 ring-white/15 rounded-lg p-3">
                  <textarea
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder="Describe your sizing requirements and any additional comments..."
                    className="w-full bg-transparent text-white/85 text-sm resize-none outline-none placeholder-white/50 min-h-[40px]"
                    rows={1}
                  />
                </div>
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
