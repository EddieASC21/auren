'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { db } from '@/lib/db'

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
            const cartItems: any[] = []

            // Get keys and filter for design data
            const keys = Object.keys(localStorage).filter(k => k.startsWith('designData_'))

            // ✅ Use for...of so we can safely use await for DB calls
            for (const key of keys) {
                try {
                    const design = JSON.parse(localStorage.getItem(key) || '{}')

                    // Extract ID
                    const rawId = design.selectedProductId || key.replace('designData_', '')
                    const id = String(rawId)

                    const orderDataRaw = localStorage.getItem(`orderData_${id}`)
                    if (!orderDataRaw) {
                        // No order stored for this design → not in Product Showcase cart
                        continue
                    }

                    let orderData: any
                    try {
                        orderData = JSON.parse(orderDataRaw)
                    } catch {
                        // Corrupt data → skip this item
                        continue
                    }

                    // Mirror ProductShowcase: only include fully completed orders
                    if (!orderData?.isComplete) {
                        continue
                    }
                    // 📸 1. Try Fetching High-Res Snapshots from Dexie (DB)
                    let snapshotFront: string | null = null
                    let snapshotBack: string | null = null

                    try {
                        const frontAsset = await db.cartAssets.get(`snapshot_front_${id}`)
                        if (frontAsset?.base64) snapshotFront = frontAsset.base64

                        const backAsset = await db.cartAssets.get(`snapshot_back_${id}`)
                        if (backAsset?.base64) snapshotBack = backAsset.base64
                    } catch (dbErr) {
                        console.warn("Failed to read snapshots from DB:", dbErr)
                    }

                    // 📸 2. Fallback to LocalStorage (Legacy/Backup)
                    // This handles cases where the DB might be empty but LocalStorage has data
                    if (!snapshotFront) {
                        snapshotFront =
                            localStorage.getItem(`snapshot_front_${id}`) ||
                            localStorage.getItem(`snapshot_${id}`) ||       // Legacy key
                            design.frontImageBase64 ||                      // Inside design object
                            null
                    }

                    if (!snapshotBack) {
                        snapshotBack =
                            localStorage.getItem(`snapshot_back_${id}`) ||
                            design.backImageBase64 ||
                            null
                    }

                    console.log(
                        `🛒 Item ${id}: Front Snap length: ${snapshotFront?.length || 0}, ` +
                        `Back Snap length: ${snapshotBack?.length || 0}`
                    )

                    cartItems.push({
                        designData: design,
                        snapshotFront,
                        snapshotBack,
                        snapshotBase64: snapshotFront, // Legacy fallback for backend
                        orderData: {
                            quantity: orderData.quantity,
                            unitPrice: orderData.unitPrice,
                            comments: orderData.comments || '',
                            sizeBreakdownText: orderData.sizeBreakdownText || '',
                        },
                    })
                } catch (e) {
                    console.error('Error parsing item:', e)
                }
            }

            if (cartItems.length === 0) {
                console.warn('Cart is empty or no designData found')
                setStatus('Your cart appears empty. Redirecting...')
                setTimeout(() => router.push('/product-showcase'), 2000)
                return
            }

            try {
                setStatus('Creating secure session...')

                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/checkout`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    credentials: 'include',
                    body: JSON.stringify({ cartItems }),
                })

                const data = await res.json()

                if (!res.ok) {
                    console.error('❌ Checkout Error:', data)
                    setStatus(data.error || 'Checkout failed. Please try again.')
                    return
                }

                if (data.url) {
                    setStatus('Redirecting to Stripe...')
                    window.location.href = data.url
                } else {
                    setStatus('No checkout URL returned. Please try again.')
                }
            } catch (err: any) {
                console.error('❌ Network Error:', err)
                setStatus('Unexpected error. Please try again.')
            }
        }

        startCheckout()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <div className="relative z-20 flex flex-col items-center justify-center max-w-md w-full mx-4">
            <div className="animate-spin w-12 h-12 border-4 border-white/20 border-t-white rounded-full mb-8"></div>
            <h1 className="text-3xl font-light text-white mb-3 tracking-wide">
                Finalizing your order
            </h1>
            <p className="text-base text-white/70 font-light">{status}</p>
        </div>
    )
}

// ✅ WRAP IN SUSPENSE (Fixes build errors with useSearchParams)
export default function CheckoutPage() {
    return (
        <main className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden bg-black">
            {/* --- BACKGROUND VIDEO --- */}
            <video
                className="absolute top-0 left-0 min-w-full min-h-full object-cover z-0 opacity-60"
                playsInline
                muted
                autoPlay
                loop
                preload="metadata"
            >
                <source
                    src="https://storage.googleapis.com/auren-public-asset/auren_3d_rotate_cube.mp4"
                    type="video/mp4"
                />
            </video>

            <div className="absolute inset-0 bg-black/40 z-10" />

            <Suspense fallback={<div className="text-white z-20">Loading checkout...</div>}>
                <CheckoutContent />
            </Suspense>
        </main>
    )
}