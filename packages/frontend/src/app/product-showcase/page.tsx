// packages/frontend/src/app/product-showcase/page.tsx

'use client'

import Link from 'next/link'
import { useMemo, useState, useEffect } from 'react'
import { useCleanNavigation } from '@/hooks/useCleanNavigation'

import { useCartItems } from './hooks/useCartItems'
import { useDesignSessionId } from './hooks/useDesignSessionId'
import { ProductCard } from './components/ProductCard'
import { ShowcaseLeft } from './components/ShowcaseLeft'
import { CheckoutProviders } from './components/CheckoutProviders'
import { EmptyCard } from './components/EmptyCard'
import { ProductShowcaseSkeleton } from '@/components/ui/LoadingSkeleton'
import type { DesignData } from './types'
import { BACKGROUND_IMAGE } from '@/lib/cdn-assets'

// ✅ shared session/cart cleanup helpers
import { removeCartItem, resetGlobalChatSession } from '@/utils/session'

export default function ProductShowcase() {
  const { cartItems, setCartItems, loading } = useCartItems()
  const { navigate } = useCleanNavigation()

  // ✅ Early preload of first cart item's snapshot for faster LCP
  useEffect(() => {
    if (typeof window === 'undefined' || cartItems.length === 0) return

    const firstItem = cartItems[0]
    const frontSnapshot = firstItem?.frontSnapshot

    if (frontSnapshot) {
      if (frontSnapshot.startsWith('data:') || frontSnapshot.startsWith('blob:')) {
        return
      }
      // Preload any snapshot format with high priority
      const link = document.createElement('link')
      link.rel = 'preload'
      link.as = 'image'
      link.href = frontSnapshot
      link.fetchPriority = 'high'
      document.head.appendChild(link)

      // Also trigger browser preload
      const img = new Image()
      img.src = frontSnapshot

      return () => {
        if (document.head.contains(link)) {
          document.head.removeChild(link)
        }
      }
    }
  }, [cartItems])

  // Show skeleton while loading
  if (loading) {
    return <ProductShowcaseSkeleton />
  }

  return <ProductShowcaseContent
    cartItems={cartItems}
    setCartItems={setCartItems}
    navigate={navigate}
    loading={loading}
  />
}

function ProductShowcaseContent({
  cartItems,
  setCartItems,
  navigate,
  loading,
}: {
  cartItems: DesignData[]
  setCartItems: React.Dispatch<React.SetStateAction<DesignData[]>>
  navigate: (pathname: string, params?: import('@/lib/navigationState').NavigationParams) => void
  loading: boolean
}) {

  const [currentProductIndex, setCurrentProductIndex] = useState(0)

  // ✅ Get session ID for the CURRENT product (per-product lookup, not global)
  const currentProductId = cartItems[currentProductIndex]?.selectedProductId
  const designSessionId = useDesignSessionId(currentProductId)

  const currentItem: DesignData | null =
    cartItems.length > 0 ? cartItems[currentProductIndex] : null

  const isCreateVariationDisabled = useMemo(() => {
    if (!currentItem) return true
    const isChatCatalog = !!currentItem.fromChat && !currentItem.isCustomProduct
    return !!currentItem.isCustomProduct || isChatCatalog
  }, [currentItem])

  const handleLogin = (provider: string) => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/api/auth/login?provider=${provider}`
  }

  // stays here because it’s page-specific (API base env var + fetch)
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

  const handleCreateNewProductClick = async () => {
    // ✅ IMPORTANT CHANGE:
    // resetGlobalChatSession is now LOCAL-ONLY (no remote deletion).
    // Keep passing deleteDesignSession if you want, but it will be ignored after the utils patch.
    await resetGlobalChatSession(deleteDesignSession)

    // ✅ Send the user into a fresh chat flow (catalog should navigate with mode=new),
    // but it's also fine to land in catalog and start from there.
    navigate('/catalog')
  }

  const handleRemoveItem = async (productId: string) => {
    // ✅ The ONLY place we delete remote sessions should be removeCartItem.
    await removeCartItem({ productId, deleteDesignSession })

    // Calculate new items and index outside of setState
    const newItems = cartItems.filter((item) => item.selectedProductId !== productId)

    // Update index based on new items length
    let newIndex = currentProductIndex
    if (currentProductIndex >= newItems.length && newItems.length > 0) {
      newIndex = newItems.length - 1
    } else if (newItems.length === 0) {
      newIndex = 0
    }

    // Update both states separately (React will batch these automatically)
    setCartItems(newItems)
    if (newIndex !== currentProductIndex) {
      setCurrentProductIndex(newIndex)
    }
  }

  const handleCreateVariation = () => {
    if (!currentItem) return
    if (isCreateVariationDisabled) return

    const baseImage = currentItem.productImage || ''

    const createVariation = async () => {
      const { nanoid } = await import('nanoid')
      const newId = `var_${nanoid(6)}`

      navigate('/design', {
        productId: newId,
        productName: currentItem.selectedProductName || 'Variation',
        productImage: baseImage,
        productCategory: currentItem.selectedProductCategory || 'custom',
      })
    }

    void createVariation()
  }

  const handleNext = () => {
    setCurrentProductIndex((prev) => (prev + 1) % cartItems.length)
  }

  const handlePrev = () => {
    setCurrentProductIndex((prev) => (prev - 1 + cartItems.length) % cartItems.length)
  }

  return (
    <main
      className="relative min-h-screen text-white overflow-y-auto overflow-x-hidden font-sans"
      style={{
        backgroundColor: '#000000',
        backgroundImage: `url('${BACKGROUND_IMAGE}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className="absolute top-8 left-8 text-white text-3xl font-light">
        04
      </div>

      <div className="flex flex-col lg:flex-row items-center justify-center lg:justify-around gap-16 xl:gap-24 min-h-screen px-10 py-20">
        <div>
          <ShowcaseLeft
            canShow={cartItems.length > 0}
            isCreateVariationDisabled={isCreateVariationDisabled}
            onCreateVariation={handleCreateVariation}
            onCreateNewProduct={handleCreateNewProductClick}
          />
        </div>

        <div className="flex-shrink-0 w-[340px] max-w-[90vw] aspect-[2/3] relative">
          {cartItems.length === 0 && !loading ? (
            <EmptyCard />
          ) : (
            cartItems.length > 0 &&
            currentItem && (
              <ProductCard
                key={currentItem.selectedProductId}
                designData={currentItem}
                onRemove={handleRemoveItem}
                onNext={handleNext}
                onPrev={handlePrev}
                hasMultiple={cartItems.length > 1}
                currentIndex={currentProductIndex}
                totalItems={cartItems.length}
                designSessionId={designSessionId}
                priority={currentProductIndex === 0}
              />
            )
          )}
        </div>

        <div className="flex flex-col gap-4 max-w-sm mb-32">
          <CheckoutProviders onLogin={handleLogin} show={cartItems.length > 0} />
        </div>
      </div>

      {cartItems.length > 0 && (
        <div className="absolute bottom-8 right-8">
          <Link href="/get-started">
            <button className="glass-button px-8 py-3 text-white text-base font-medium transition-all hover:bg-white/20">
              Return Home
            </button>
          </Link>
        </div>
      )}
    </main>
  )
}
