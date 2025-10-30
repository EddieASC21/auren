'use client'

import Image from 'next/image'
import Link from 'next/link'

export default function ThankYouPage() {
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
        {/* Dark overlay for better text readability */}
        <div className="absolute inset-0 bg-black/20"></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4">
        {/* Abstract Icon */}
        <div className="mb-6 flex space-x-2">
          <div className="w-2 h-2 bg-white rounded-full opacity-80"></div>
          <div className="w-2 h-2 bg-white rounded-full opacity-60"></div>
          <div className="w-2 h-2 bg-white rounded-full opacity-40"></div>
        </div>

        {/* Main Title */}
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-medium text-white text-center mb-4">
          Thank You For Your Order
        </h1>

        {/* Subtitle */}
        <p className="text-lg md:text-xl text-gray-200 text-center font-normal max-w-md">
          Production and shipping updates will be sent via email
        </p>
      </div>

      {/* Return to Homepage Button */}
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
