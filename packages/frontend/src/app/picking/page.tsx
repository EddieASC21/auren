'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { getPriceDetails } from '../../lib/pricingData'
import { nanoid } from 'nanoid' // 1. Import nanoid

interface Product {
  id: number
  name: string
  image: string
  category: string
  price?: string | null
}

export default function PickPage() {
  const router = useRouter()
  const [selectedCategory, setSelectedCategory] = useState('mens')
  // const [selectedProduct, setSelectedProduct] = useState<number | null>(null)

  const categories = ['mens', 'womens', 'other items']

  const allProducts: Product[] = [
    // Mens products
    { id: 0, name: 'T-Shirt', image: '/mens/t shirt.png', category: 'mens' },
    { id: 1, name: 'Polo', image: '/mens/polo.png', category: 'mens' },
    { id: 2, name: 'Sweatshirt', image: '/mens/sweatshirt.png', category: 'mens' },
    { id: 3, name: 'Hoodie', image: '/mens/hoodie.png', category: 'mens' },
    { id: 4, name: 'Quarter Zip', image: '/mens/quarterzip.png', category: 'mens' },
    { id: 5, name: 'Long Sleeve', image: '/mens/long sleeve.png', category: 'mens' },
    { id: 6, name: 'Vest', image: '/mens/vest.png', category: 'mens' },
    { id: 7, name: 'Shorts', image: '/mens/shorts.png', category: 'mens' },
    { id: 8, name: 'Sports Short', image: '/mens/sports short.png', category: 'mens' },
    { id: 9, name: 'Sports Shirt', image: '/mens/sports shirt.png', category: 'mens' },
    { id: 10, name: 'Sweatpants', image: '/mens/sweatpants.png', category: 'mens' },
    { id: 11, name: 'Tank Top', image: '/mens/tank top.png', category: 'mens' },

    // Womens products
    { id: 12, name: 'T-Shirt', image: '/womens/t shirt.png', category: 'womens' },
    { id: 13, name: 'Polo', image: '/womens/polo.png', category: 'womens' },
    { id: 14, name: 'Sweatshirt', image: '/womens/sweatshirt.png', category: 'womens' },
    { id: 15, name: 'Hoodie', image: '/womens/hoodie.png', category: 'womens' },
    { id: 16, name: 'Quarter Zip', image: '/womens/quarterzip.png', category: 'womens' },
    { id: 17, name: 'Long Sleeve', image: '/womens/long sleeve.png', category: 'womens' },
    { id: 18, name: 'Vest', image: '/womens/vest.png', category: 'womens' },
    { id: 19, name: 'Skirt', image: '/womens/skirt.png', category: 'womens' },
    { id: 20, name: 'Sweatshorts', image: '/womens/sweatshorts.png', category: 'womens' },
    { id: 21, name: 'Baby Tee', image: '/womens/baby tee.png', category: 'womens' },
    { id: 22, name: 'Spandex Shorts', image: '/womens/spandex shorts.png', category: 'womens' },
    { id: 23, name: 'Sports Bra', image: '/womens/sports bra.png', category: 'womens' },
    { id: 24, name: 'Sports Shirt', image: '/womens/sports shirt.png', category: 'womens' },
    { id: 25, name: 'Sports Shorts', image: '/womens/sports shorts.png', category: 'womens' },
    { id: 26, name: 'Sweatpants', image: '/womens/sweatpants.png', category: 'womens' },
    { id: 27, name: 'Tank Top', image: '/womens/tank top.png', category: 'womens' },

    // Other products
    { id: 28, name: 'Backpack', image: '/other/backpack.png', category: 'other items' },
    { id: 29, name: 'Baseball Hat', image: '/other/baseball hat.png', category: 'other items' },
    { id: 30, name: 'Beanie', image: '/other/beanie.png', category: 'other items' },
    { id: 31, name: 'Bottle', image: '/other/bottle front.png', category: 'other items' },
    { id: 32, name: 'Notebook', image: '/other/notebook.png', category: 'other items' },
    { id: 33, name: 'Pen', image: '/other/pen.png', category: 'other items' },
    { id: 34, name: 'Tote Bag', image: '/other/tote bag.png', category: 'other items' },
    { id: 35, name: 'Tumbler', image: '/other/tumbler.png', category: 'other items' },
    { id: 36, name: 'Tumbler Bottle', image: '/other/tumbler bottle.png', category: 'other items' },
    { id: 37, name: 'Mug', image: '/other/mug front.png', category: 'other items' },
    { id: 38, name: 'Sock Outer', image: '/other/sock outer side.png', category: 'other items' },
    { id: 39, name: 'Sock Inner', image: '/other/sock inner side.png', category: 'other items' },
  ].map((p) => {
    const priceDetails = getPriceDetails(p.category, p.name)
    return {
      ...p,
      price: priceDetails ? `$${priceDetails.base.toFixed(2)}` : null,
    }
  })

  const products = allProducts.filter(product => product.category === selectedCategory)

  // Reset selected product when category changes
  /*useEffect(() => {
    setSelectedProduct(null)
  }, [selectedCategory])

  const handleNext = () => {
    if (selectedProduct !== null) {
      const product = allProducts.find(p => p.id === selectedProduct)
      if (product) {
        // Navigate to design page with product data in URL
        router.push(`/design?productId=${product.id}&productName=${encodeURIComponent(product.name)}&productImage=${encodeURIComponent(product.image)}&productCategory=${encodeURIComponent(product.category)}`)
      }
    }
  }*/

  const handleProductSelect = (product: Product) => {
    // 2. Generate a unique ID for this specific product selection (e.g. "0_abc123")
    // This allows multiple items of the same product type (e.g. two T-Shirts) to exist in the cart.
    const uniqueId = `${product.id}_${nanoid(6)}`;

    // 3. Navigate to the design page with the NEW unique ID.
    // Note: We do NOT need to clear localStorage here. Since the ID is unique, 
    // the design page will automatically start with a blank state for this specific item.
    router.push(`/design?productId=${uniqueId}&productName=${encodeURIComponent(product.name)}&productImage=${encodeURIComponent(product.image)}&productCategory=${encodeURIComponent(product.category)}`)
  }

  return (
    <main className="flex min-h-screen">
      {/* Left Panel - Black Background */}
      <div className="w-1/3 bg-black text-white flex flex-col justify-between p-8">
        <div className="flex flex-col gap-6">
          {/* Step indicator */}
          <div className="flex flex-col gap-4">
            <span className="text-gray-400 text-sm">step 2</span>
            <div className="flex items-center gap-3">
              <span className="text-white text-2xl font-light">01</span>
              <div className="flex-1 h-1 bg-white/25 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full"
                  style={{ width: '30%' }}
                />
              </div>
            </div>
          </div>

          {/* Main heading */}
          <div className="flex-1 flex items-center">
            <h1 className="text-7xl font-light leading-tight">
              Make it fast
            </h1>
          </div>

          {/* Description */}
          <p className="text-white text-lg leading-relaxed">
            Our signature ready-made products, customized with your designs.
          </p>
        </div>

        {/* Back button */}
        <div>
          <Link href="/catalog">
            <button className="rounded-lg border border-white px-6 py-3 text-white hover:bg-white/10 transition">
              Back
            </button>
          </Link>
        </div>
      </div>

      {/* Right Panel - Light Beige Background */}
      <div className="flex-1 bg-[#f5f1e8] text-black flex flex-col">
        <div className="flex-1 p-8 flex flex-col">
          {/* Top right label */}
          <div className="flex justify-end mb-8">
            <span className="text-gray-500 text-sm">WHITE LABEL PRODUCT</span>
          </div>

          {/* Product Catalog heading */}
          <h2 className="text-5xl font-light mb-8">
            Product Catalog
          </h2>

          {/* Category tabs */}
          <div className="flex gap-3 mb-8 flex-wrap">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-6 py-3 rounded-lg border transition ${selectedCategory === category
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-black border-black'
                  }`}
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </button>
            ))}
          </div>

          {/* Product grid */}
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-3 gap-4">
              {products.map((product, index) => (
                <div
                  key={product.id}
                  onClick={() => handleProductSelect(product)} // --- THIS LINE CHANGED ---
                  className={`rounded-lg border border-black p-6 cursor-pointer transition bg-white hover:bg-gray-200`} // --- THIS LINE CHANGED ---
                >

                  {/* Product image */}
                  <div className="h-48 bg-gray-100 rounded-lg mb-4 flex items-center justify-center overflow-hidden">
                    <Image
                      src={product.image}
                      alt={product.name}
                      width={200}
                      height={200}
                      className="object-contain w-full h-full"
                      unoptimized
                    />
                  </div>

                  {/* Product name */}
                  <p className="text-black text-sm font-medium">
                    {product.name}
                  </p>
                  {product.price && (
                    <p className="text-gray-500 text-sm mt-1">From {product.price}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </main>
  )
}