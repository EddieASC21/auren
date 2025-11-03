'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CheckoutPage() {
    const [status, setStatus] = useState('Preparing your checkout...')
    const router = useRouter()

    useEffect(() => {
        async function startCheckout() {
            try {
                const res = await fetch('http://localhost:3001/api/checkout', {
                    method: 'POST',
                    credentials: 'include', // include cookies (for JWT auth)
                })

                if (!res.ok) {
                    const err = await res.json()
                    console.error('❌ Checkout Error:', err)
                    setStatus(err.error || 'Checkout failed. Please try again.')
                    return
                }

                const data = await res.json()
                if (data.url) {
                    setStatus('Redirecting to Stripe Checkout...')
                    window.location.href = data.url // 🪄 Go to Stripe!
                } else {
                    setStatus('No checkout URL returned. Please try again.')
                }
            } catch (err: any) {
                console.error('❌ Error:', err)
                setStatus('Unexpected error. Please try again.')
            }
        }

        startCheckout()
    }, [])

    return (
        <main className="min-h-screen flex flex-col items-center justify-center bg-black text-white text-center px-6">
            <h1 className="text-3xl font-light mb-4">Finalizing your checkout</h1>
            <p className="text-lg opacity-80">{status}</p>
        </main>
    )
}