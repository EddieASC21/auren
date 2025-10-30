'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function GetStartedRedirect() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to home page with scroll to get-started section
    router.push('/#get-started-section')
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-light text-gray-900 mb-4">Redirecting...</h1>
        <p className="text-gray-600">Taking you to the get started section.</p>
      </div>
    </div>
  )
}
