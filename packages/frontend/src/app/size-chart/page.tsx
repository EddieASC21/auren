'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'

export default function SizeChartPage() {
  return (
    <main
      className="relative min-h-screen bg-white overflow-hidden"
    >
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link 
            href="/order-quantity"
            className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Order
          </Link>
          
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 relative">
              <Image 
                src="/auren_white_logo.png" 
                alt="Auren Logo" 
                fill
                className="object-contain"
              />
            </div>
            <span className="text-gray-900 text-xl font-light">auren</span>
          </div>
        </div>
      </div>

      {/* Size Chart Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <h1 className="text-4xl font-bold text-gray-900 mb-8">
            Standard U.S. Apparel Size Chart
          </h1>
          
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <Image
              src="/size_chart.png"
              alt="Standard U.S. Apparel Size Chart"
              width={800}
              height={1000}
              className="w-full h-auto"
              priority
            />
          </div>
          
          <div className="mt-8 text-gray-600">
            <p className="text-lg mb-4">
              Use this chart to determine the best size for your apparel order.
            </p>
            <p className="text-sm">
              If you're between sizes, we recommend choosing the larger size for a more comfortable fit.
            </p>
          </div>
          
          <div className="mt-8">
            <Link 
              href="/order-quantity"
              className="inline-flex items-center px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              Continue with Order
              <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </motion.div>
      </div>
    </main>
  )
}
