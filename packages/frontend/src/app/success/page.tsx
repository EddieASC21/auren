'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect } from 'react'
import { db } from '@/lib/db'

// Base URL for backend API (uses env in prod, falls back to localhost:3001 in dev)
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

export default function SuccessPage() {
  // 1️⃣ Clear cart-related data whenever user lands on /success
  useEffect(() => {
    ; (async () => {
      try {
        // Clear Dexie cart assets (snapshots + design images)
        try {
          await db.cartAssets.clear()
          console.log('✅ Dexie cartAssets cleared after success')
        } catch (dexieErr) {
          console.error('⚠️ Failed to clear Dexie cartAssets:', dexieErr)
        }

        // Clear all cart-related localStorage keys
        if (typeof window !== 'undefined') {
          const keysToRemove: string[] = []

          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)
            if (!key) continue

            if (
              key.startsWith('designData_') ||
              key.startsWith('orderData_') ||
              key.startsWith('snapshot_') ||
              key.startsWith('orderChatHistory_') ||
              key.startsWith('justEdited_')
            ) {
              keysToRemove.push(key)
            }
          }

          keysToRemove.forEach((k) => localStorage.removeItem(k))
          console.log('✅ Cleared cart-related localStorage keys:', keysToRemove)
        }
      } catch (err) {
        console.error('❌ Error while clearing cart after success:', err)
      }
    })()
  }, [])

  // 2️⃣ Cleanup: delete design + asset sessions in Firestore/GCS and wipe AI chat/design localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return

      ; (async () => {
        // --- Grab the session id(s) from localStorage (support legacy + new keys) ---
        const sessionIdKeys = [
          'designSessionId',   // canonical key
          'aiChat_sessionId',  // legacy key, just in case
        ]

        let sessionId: string | null = null
        for (const key of sessionIdKeys) {
          const val = window.localStorage.getItem(key)
          if (val && val.trim()) {
            sessionId = val.trim()
            break
          }
        }

        // --- Best-effort: tell backend to delete Firestore docs + bucket images ---
        if (sessionId) {
          const urls = [
            `${API_BASE}/api/design-session/delete`, // existing design-session cleanup
            `${API_BASE}/api/asset-session`,        // NEW: assetSessions + GCS cleanup
          ]

          await Promise.all(
            urls.map(async (url) => {
              try {
                const res = await fetch(url, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ sessionId }),
                  keepalive: true,
                })

                if (!res.ok) {
                  const txt = await res.text().catch(() => '')
                  console.warn(
                    '⚠️ [Success] Failed to delete session via',
                    url,
                    'sessionId=',
                    sessionId,
                    'status=',
                    res.status,
                    txt,
                  )
                } else {
                  console.log('✅ [Success] Session deleted via', url, 'sessionId=', sessionId)
                }
              } catch (err) {
                console.error(
                  '❌ [Success] Network error calling',
                  url,
                  'for',
                  sessionId,
                  err,
                )
              }
            }),
          )
        } else {
          console.log('🧹 [Success] No designSessionId/aiChat_sessionId found to delete remotely')
        }

        // --- Clear AI chat + design-related localStorage keys ---
        const explicitKeys = [
          // AI chat-only
          'aiChat_backendHistory',
          'aiChat_chatHistory',
          'aiChat_selectedImage',
          'aiChat_selectedBackImage',
          'aiChat_sessionId',
          'aiChat_sessionCreatedAt',
          // AI-generated design
          'designData_ai-generated',
          // design session id itself
          'designSessionId',
        ]

        const prefixKeys = [
          'designData_',
          'chatHistory_',
          'backendHistory_',
          'justEdited_',
          'snapshot_front_',
          'snapshot_back_',
          'orderChatHistory_',
          'orderData_',
        ]

        const keysToRemove: string[] = []

        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i)
          if (!key) continue

          if (explicitKeys.includes(key)) {
            keysToRemove.push(key)
            continue
          }

          if (prefixKeys.some((prefix) => key.startsWith(prefix))) {
            keysToRemove.push(key)
          }
        }

        keysToRemove.forEach((key) => window.localStorage.removeItem(key))
        console.log('🧹 [Success] Cleared AI + design localStorage keys:', keysToRemove)
      })()
  }, [])

  return (
    <div className="min-h-screen relative overflow-hidden bg-gray-900">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/background.png"
          alt="Background"
          fill
          className="object-cover blur-sm"
          priority
        />
        <div className="absolute inset-0 bg-black/20"></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4">
        {/* Auren Logo */}
        <div className="mb-6">
          <Image
            src="/auren_white_logo.png"
            alt="Auren Logo"
            width={70}
            height={70}
            className="opacity-90"
          />
        </div>

        {/* Main Title */}
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-medium text-white text-center mb-4">
          Thank You For Your Order
        </h1>

        {/* Subtitle */}
        <p className="text-lg md:text-xl text-gray-200 text-center font-normal max-w-md">
          Production and shipping updates will be sent via email.
        </p>
      </div>

      {/* Only "Return to Homepage" button */}
      <div className="absolute bottom-6 right-6 z-10">
        <Link href="/">
          <button className="bg-black/30 backdrop-blur-sm text-white px-6 py-3 rounded-lg font-medium hover:bg-black/40 transition-colors duration-200">
            Return to Homepage
          </button>
        </Link>
      </div>
    </div>
  )
}