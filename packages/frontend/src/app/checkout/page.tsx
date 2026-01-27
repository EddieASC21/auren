'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { db, blobToBase64, getAllDesigns, getAllOrders, getCachedSnapshot } from '@/lib/db'
import { maybeProxyGcsUrl } from '@/lib/imageProxy'
import { POSTER_HERO, VIDEO_3D_ROTATE_CUBE } from '@/lib/cdn-assets'
import { ALL_PRODUCTS_BASE } from '@/lib/products-data'
import {
    normalizePricingCategory,
    normalizePricingName,
} from '@/app/order-quantity/utils'

type AnyObj = Record<string, any>

function safeJsonParse<T = any>(raw: string | null): T | null {
    if (!raw) return null
    try {
        return JSON.parse(raw) as T
    } catch {
        return null
    }
}

function head(s: string | null | undefined, n = 40) {
    if (!s) return null
    return s.slice(0, n)
}

function buildVariantPath(src: string, suffix: string) {
    if (!src) return ''
    const normalized = src.replace(
        /^(.*?)(?:\sback|_back|-back)?(?:_mask)?(\.[a-z0-9]+)$/i,
        '$1$2',
    )
    const match = normalized.match(/^(.*?)(\.[a-z0-9]+)$/i)
    if (!match) return `${normalized}${suffix}`
    return `${match[1]}${suffix}${match[2]}`
}

function resolveCatalogProductImage(designData: AnyObj) {
    const rawCategory =
        designData?.selectedProductCategory ||
        designData?.productCategory ||
        ''
    const rawName =
        designData?.selectedProductName ||
        designData?.productName ||
        ''

    const category = normalizePricingCategory(String(rawCategory || ''))
    const name = normalizePricingName(String(rawName || ''), category)

    if (!category || !name) return ''

    const match = ALL_PRODUCTS_BASE.find((product) => {
        const productCategory = normalizePricingCategory(product.category)
        const productName = normalizePricingName(product.name, productCategory)
        return productCategory === category && productName === name
    })

    return match?.image || ''
}

function isLikelyImageString(s: unknown): s is string {
    if (typeof s !== 'string') return false
    const v = s.trim()
    return (
        v.startsWith('data:image/') ||
        v.startsWith('http://') ||
        v.startsWith('https://') ||
        v.startsWith('/') ||
        v.startsWith('blob:') ||
        v.startsWith('dexie:')
    )
}

function isLikelyBase64Image(s: unknown): s is string {
    if (typeof s !== 'string') return false
    const v = s.trim()
    return v.startsWith('data:image/')
}

function isBackendFetchableUrl(value: string) {
    return value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/')
}

async function resolveDexieToBase64(dexieSrcOrId: string): Promise<string | null> {
    const raw = (dexieSrcOrId || '').trim()
    if (!raw) return null

    const id = raw.startsWith('dexie:') ? raw.slice('dexie:'.length).trim() : raw
    if (!id) return null

    try {
        const rec = await db.images.get(id)
        if (!rec?.blob) return null
        return await blobToBase64(rec.blob)
    } catch (e) {
        console.warn('[checkout] Failed to resolve Dexie image -> base64', e)
        return null
    }
}

/**
 * Converts any supported "src" into base64 (data:image/...)
 * Supports:
 *  - data:image/...  (already base64)
 *  - blob:...        (fetch -> blob -> base64)
 *  - http(s)://...   (fetch -> blob -> base64)
 *  - /local/path     (fetch -> blob -> base64)
 *  - dexie:<id>      (Dexie -> base64)
 *  - <id>            (treat as Dexie id)
 */
async function resolveAnyToImageInput(value: unknown): Promise<string | null> {
    if (typeof value !== 'string') return null

    const v = value.trim()
    if (!v) return null

    if (v.startsWith('data:image/')) {
        return v
    }

    if (v.startsWith('dexie:')) {
        return await resolveDexieToBase64(v)
    }

    // raw id fallback (if someone stored just "<id>")
    if (
        !v.startsWith('http://') &&
        !v.startsWith('https://') &&
        !v.startsWith('/') &&
        !v.startsWith('blob:')
    ) {
        return await resolveDexieToBase64(v)
    }

    // blob/http/local path: fetch -> blob -> base64
    if (v.startsWith('blob:') || v.startsWith('http://') || v.startsWith('https://') || v.startsWith('/')) {
        try {
            // Use proxy for GCS URLs to avoid CORS issues
            const urlToFetch = maybeProxyGcsUrl(v)
            const res = await fetch(urlToFetch)
            if (!res.ok) return null
            const blob = await res.blob()
            return await blobToBase64(blob)
        } catch (e) {
            console.warn('[checkout] Failed to fetch src -> base64', e)
            return isBackendFetchableUrl(v) ? v : null
        }
    }

    return null
}

/**
 * Returns a base64 data URL or fetchable URL for snapshotFront/snapshotBack.
 * Supports all of your current sources + new dexie pointer formats.
 */
async function resolveSnapshotBase64(args: {
    productId: string
    designData: AnyObj
    side: 'front' | 'back'
    keysCount: number
    explicitCartItemId: string | null
}): Promise<string | null> {
    const { productId, designData, side, keysCount, explicitCartItemId } = args

    const uploadedKey = side === 'front' ? 'frontUploadedImages' : 'backUploadedImages'

    // 1) Dexie cartAssets snapshots (high-res PNG - preferred for email compatibility)
    try {
        const assetKey = side === 'front' ? `snapshot_front_${productId}` : `snapshot_back_${productId}`
        const asset = await db.cartAssets.get(assetKey)

        if (isLikelyBase64Image(asset?.base64)) {
            return asset.base64
        }

        if (isLikelyImageString(asset?.base64)) {
            const input = await resolveAnyToImageInput(asset.base64)
            if (input) return input
        }
    } catch (dbErr) {
        console.warn('⚠️ [checkout] Failed to read snapshots from Dexie cartAssets:', dbErr)
    }

    // 2) Dexie snapshots table (fallback - may contain WebP previews)
    try {
        const snapshot = await getCachedSnapshot(productId)
        if (snapshot) {
            const snapshotValue = side === 'front' ? snapshot.frontSnapshot : snapshot.backSnapshot
            if (isLikelyBase64Image(snapshotValue)) {
                return snapshotValue
            }
            if (isLikelyImageString(snapshotValue)) {
                const input = await resolveAnyToImageInput(snapshotValue)
                if (input) return input
            }
        }
    } catch (dbErr) {
        console.warn('⚠️ [checkout] Failed to read snapshots from Dexie snapshots table:', dbErr)
    }

    // 3) designData itself (now may be data: OR dexie: OR pointer field)
    const img0 = Array.isArray(designData?.[uploadedKey]) ? designData[uploadedKey][0] : null
    const src = img0?.src ?? null
    const ptr = img0?.pointer ?? null

    {
        const input = await resolveAnyToImageInput(src)
        if (input) return input
    }

    // pointer -> Dexie -> base64
    if (typeof ptr === 'string' && ptr.trim()) {
        const b64 = await resolveDexieToBase64(ptr.trim())
        if (b64) return b64
    }

    // legacy designData fields
    if (side === 'front') {
        const input = await resolveAnyToImageInput(designData?.frontImageBase64 ?? null)
        if (input) return input
    } else {
        const input = await resolveAnyToImageInput(designData?.backImageBase64 ?? null)
        if (input) return input
    }

    // 4) product base image fallback (catalog items with no snapshots)
    const baseProductImage =
        typeof designData?.productImage === 'string' ? designData.productImage : ''
    if (baseProductImage) {
        const normalizedBase = buildVariantPath(baseProductImage, '')
        const candidate =
            side === 'back'
                ? buildVariantPath(baseProductImage, ' back')
                : normalizedBase
        const input = await resolveAnyToImageInput(candidate)
        if (input) return input
    }

    const catalogImage = resolveCatalogProductImage(designData)
    if (catalogImage) {
        const candidate =
            side === 'back'
                ? buildVariantPath(catalogImage, ' back')
                : catalogImage
        const input = await resolveAnyToImageInput(candidate)
        if (input) return input
    }

    return null
}

function CheckoutContent() {
    const [status, setStatus] = useState('Syncing your cart...')
    const router = useRouter()
    const searchParams = useSearchParams()
    const hasStarted = useRef(false)

    useEffect(() => {
        // Prevent double-firing in React Strict Mode
        if (hasStarted.current) return
        hasStarted.current = true

        async function startCheckout() {
            const token = searchParams.get('token')
            const explicitCartItemId = searchParams.get('cartItemId') || searchParams.get('productId')
            const cartItems: AnyObj[] = []

            // ✅ Load designs and orders from Dexie (instead of localStorage)
            const [designs, orders] = await Promise.all([
                getAllDesigns(),
                getAllOrders(),
            ])

            // Create order lookup map
            const orderMap = new Map(orders.map(o => [o.productId, o]))

            for (const designRecord of designs) {
                try {
                    const id = designRecord.productId
                    const design = (designRecord.designData as AnyObj) || {}

                    const orderRecord = orderMap.get(id)
                    if (!orderRecord?.orderData) {
                        continue
                    }

                    const orderData = orderRecord.orderData as AnyObj
                    if (!orderData.isComplete) {
                        continue
                    }

                    // -----------------------------
                    // Snapshots (BASE64) resolution
                    // -----------------------------
                    const snapshotFront = await resolveSnapshotBase64({
                        productId: id,
                        designData: design,
                        side: 'front',
                        keysCount: designs.length,
                        explicitCartItemId,
                    })

                    const snapshotBack = await resolveSnapshotBase64({
                        productId: id,
                        designData: design,
                        side: 'back',
                        keysCount: designs.length,
                        explicitCartItemId,
                    })

                    if (!snapshotFront) {
                        const front0 = design?.frontUploadedImages?.[0] ?? null
                        const frontSrc = front0?.src ?? null
                        const frontPtr = front0?.pointer ?? null

                        console.error(`❌ [checkout] Item ${id} has NO snapshotFront after all fallbacks.`, {
                            id,
                            hasDexieFront:
                                (typeof frontSrc === 'string' && frontSrc.startsWith('dexie:')) ||
                                (typeof frontPtr === 'string' && !!frontPtr.trim()),
                            designFront0: front0,
                        })
                        continue
                    }

                    const category = String(
                        orderData.category ||
                        orderData.categoryKey ||
                        design.selectedCategoryKey ||
                        design.selectedCategory ||
                        design.category ||
                        ''
                    ).trim()

                    const name = String(
                        orderData.name ||
                        orderData.nameKey ||
                        design.selectedProductKey ||
                        design.selectedProductSlug ||
                        design.productKey ||
                        ''
                    ).trim()

                    const isCustom = Boolean(orderData.isCustom ?? design.isCustom ?? false)

                    // ✅ Get pricingMode from orderData (set by order-quantity page)
                    const pricingMode = orderData.pricingMode || 'manual_quote'

                    if (!category || !name) {
                        console.error(
                            `❌ [checkout] Missing pricing keys for item ${id}. Need category + name (stable keys like "mens" + "hoodie").`,
                            { category, name, orderData, design }
                        )
                        continue
                    }

                    cartItems.push({
                        designData: design,

                        snapshotFront,
                        snapshotBack,

                        snapshotBase64: snapshotFront,

                        orderData: {
                            category,
                            name,
                            isCustom,
                            pricingMode, // ✅ Pass to backend for 10% markup detection
                            quantity: orderData.quantity,
                            comments: orderData.comments || '',
                            sizeBreakdownText: orderData.sizeBreakdownText || '',
                        },
                    })
                } catch (e) {
                    console.error('❌ [checkout] Error parsing item:', e)
                }
            }

            if (cartItems.length === 0) {
                console.warn('🧾 [checkout] Cart is empty or no valid items found')
                setStatus('Your cart appears empty. Redirecting...')
                setTimeout(() => router.push('/product-showcase'), 1500)
                return
            }

            try {
                setStatus('Creating secure session...')

                const apiBase = process.env.NEXT_PUBLIC_API_URL
                if (!apiBase) {
                    console.error('❌ [checkout] NEXT_PUBLIC_API_URL is missing')
                    setStatus('Config error: API URL missing.')
                    return
                }

                const res = await fetch(`${apiBase}/api/checkout`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    credentials: 'include',
                    body: JSON.stringify({ cartItems }),
                })

                const rawText = await res.text()
                const data = safeJsonParse<AnyObj>(rawText) || {}

                if (!res.ok) {
                    console.error('❌ [checkout] Checkout Error:', res.status, data || rawText)
                    setStatus(data.error || 'Checkout failed. Please try again.')
                    return
                }

                if (data.url) {
                    setStatus('Redirecting to Stripe...')
                    window.location.href = data.url
                    return
                }

                console.error('❌ [checkout] No checkout URL returned:', data)
                setStatus('No checkout URL returned. Please try again.')
            } catch (err: any) {
                console.error('❌ [checkout] Network Error:', err)
                setStatus('Unexpected error. Please try again.')
            }
        }

        startCheckout()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <div className="relative z-20 flex flex-col items-center justify-center max-w-md w-full mx-4">
            <div className="animate-spin w-12 h-12 border-4 border-white/20 border-t-white rounded-full mb-8"></div>
            <h1 className="text-3xl font-light text-white mb-3 tracking-wide">Finalizing your order</h1>
            <p className="text-base text-white/70 font-light">{status}</p>
        </div>
    )
}

// ✅ WRAP IN SUSPENSE (Fixes build errors with useSearchParams)
export default function CheckoutPage() {
    const videoRef = useRef<HTMLVideoElement>(null)
    const [shouldLoadVideo, setShouldLoadVideo] = useState(false)
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

    useEffect(() => {
        if (typeof window === 'undefined') return
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
        const updateMotionPreference = () => {
            const reduced = mediaQuery.matches
            setPrefersReducedMotion(reduced)
            if (reduced) {
                setShouldLoadVideo(false)
            }
        }

        updateMotionPreference()
        mediaQuery.addEventListener('change', updateMotionPreference)

        if ('requestIdleCallback' in window) {
            const idleId = window.requestIdleCallback(
                () => setShouldLoadVideo((current) => current || !mediaQuery.matches),
                { timeout: 1500 }
            )
            return () => {
                window.cancelIdleCallback(idleId)
                mediaQuery.removeEventListener('change', updateMotionPreference)
            }
        }

        const timeoutId = setTimeout(
            () => setShouldLoadVideo((current) => current || !mediaQuery.matches),
            300
        )
        return () => {
            clearTimeout(timeoutId)
            mediaQuery.removeEventListener('change', updateMotionPreference)
        }
    }, [])

    useEffect(() => {
        const video = videoRef.current
        if (!video || !shouldLoadVideo) return

        if (video.readyState >= 2) {
            video.play().catch(() => {})
            return
        }

        const tryPlay = () => {
            video.play().catch(() => {})
        }

        video.addEventListener('canplay', tryPlay, { once: true })
        return () => video.removeEventListener('canplay', tryPlay)
    }, [shouldLoadVideo])

    return (
        <main className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden bg-black">
            <video
                ref={videoRef}
                className="absolute top-0 left-0 min-w-full min-h-full object-cover z-0 opacity-60"
                playsInline
                muted
                autoPlay
                loop
                preload={shouldLoadVideo ? 'metadata' : 'none'}
                poster={POSTER_HERO}
            >
                {shouldLoadVideo && !prefersReducedMotion && (
                    <source
                        src={VIDEO_3D_ROTATE_CUBE}
                        type="video/mp4"
                    />
                )}
            </video>

            <div className="absolute inset-0 bg-black/40 z-10" />

            <Suspense fallback={<div className="text-white z-20">Loading checkout...</div>}>
                <CheckoutContent />
            </Suspense>
        </main>
    )
}
