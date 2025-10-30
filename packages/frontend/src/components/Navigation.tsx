'use client'

import Image from 'next/image'

export const Navigation = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-8 py-6 bg-black/20 backdrop-blur-sm">
      <div className="max-w-[1600px] mx-auto flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 relative">
            <Image 
              src="/auren_white_logo.png" 
              alt="Auren Logo" 
              fill
              className="object-contain"
            />
          </div>
          <span className="text-white text-xl font-light">auren</span>
        </div>
        
        {/* Nav Links */}
        <div className="flex items-center gap-4">
        </div>
      </div>
    </nav>
  )
}

