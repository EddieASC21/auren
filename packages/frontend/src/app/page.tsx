'use client'

import { motion } from 'framer-motion'
import VideoBackground from '@/components/VideoBackground'
import Link from 'next/link'
import Image from 'next/image'

export default function Home() {

  return (
    <main className="relative bg-white">
      {/* Top Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-8 py-6 bg-transparent">
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
          <div className="flex items-center gap-8">
          </div>
        </div>
      </nav>
      
      {/* Section 1: Hero with Video Background */}
      <section className="relative h-screen flex flex-col items-center justify-center overflow-hidden">
        <VideoBackground />
        
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 text-center max-w-6xl px-8"
        >
          <h1 className="text-6xl md:text-8xl font-light text-white mb-6 leading-tight">
            Create custom
            <br />
            products with ease
          </h1>
          
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="text-white/80 text-xl md:text-2xl mb-12 font-light"
          >
            Competitve pricing. Premium Quality. Delivered to your door.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="flex gap-4 justify-center"
          >
            <Link href="/catalog">
              <button className="px-12 py-4 text-white text-base font-light bg-white/10 backdrop-blur-xl border border-white/20 rounded-full hover:bg-white/15 transition-all duration-300">
                Get Started
              </button>
            </Link>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1 }}
          className="absolute bottom-12 left-1/2 -translate-x-1/2 z-10"
        >
          <div className="flex flex-col items-center gap-2">
            <span className="text-white/60 text-sm font-light">Scroll down</span>
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              className="text-white/60"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 10L12 15L17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </motion.div>
          </div>
        </motion.div>
      </section>


      {/* --- NEW VIDEO SECTION --- */}
      <section className="relative h-screen overflow-hidden bg-black">
        <video
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 min-w-full min-h-full object-cover z-10"
          playsInline
          muted
          autoPlay
          loop // Added loop for this new video
          preload="metadata"
        >
          <source src="https://storage.googleapis.com/auren-public-asset/AUREN_CREME.mp4" type="video/mp4" />
        </video>

        {/* Overlay Content */}
        <div className="relative z-20 h-full flex flex-col items-center justify-center bg-black/30 px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="max-w-4xl text-center"
          >
            <h2 className="text-4xl font-light tracking-tight text-white sm:text-6xl mb-12">
              We work directly with vetted factories to get you the best quality at the best prices
            </h2>

            <Link href="/catalog">
              <button
                type="button"
                className="glass-button px-8 py-4 text-lg font-semibold text-white transition hover:bg-white/20"
              >
                Contact Us
              </button>
            </Link>

          </motion.div>
        </div>
      </section>


      {/* Section 6: Get Started - Video Introduction */}
      <section id="get-started-section" className="relative h-screen overflow-hidden bg-black">
        <video
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 min-w-full min-h-full object-cover z-10"
          playsInline
          muted
          autoPlay
          preload="metadata"
          loop
        >
          <source src="https://storage.googleapis.com/auren-public-asset/auren-design.mp4" type="video/mp4" />
        </video>
        
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/20 z-20"></div>
      </section>

      {/* Section 7: How it Works - Detailed */}
      <section className="relative bg-how-it-works-cream py-32 sm:py-48">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 items-start gap-x-44 gap-y-20 lg:grid-cols-2">
            
            {/* Left Column: Title and Description */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="lg:pr-4"
            >
              <h2 className="mt-2 text-6xl font-bold tracking-tight text-gray-900 sm:text-5xl">
                How it Works
              </h2>
              <p className="mt-8 text-xl leading-8 text-gray-700">
                Dream it, Design it, Deliver it.
              </p>
            </motion.div>

            {/* Right Column: Steps */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <dl className="space-y-12 border-l-2 border-gray-900/20 pl-10">
                <div className="relative">
                  <dt className="text-xl font-semibold text-gray-900">
                    <div className="absolute -left-12 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-gray-900 text-white font-bold">01</div>
                    You design.
                  </dt>
                  <dd className="mt-3 text-lg leading-7 text-black">
                    Share your vision with us. Upload your designs, sketches, or describe your product idea.
                  </dd>
                </div>
                <div className="relative">
                  <dt className="text-xl font-semibold text-gray-900">
                    <div className="absolute -left-12 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-gray-900 text-white font-bold">02</div>
                    We source.
                  </dt>
                  <dd className="mt-3 text-lg leading-7 text-black">
                    We work with our network of trusted factories to source materials and manufacture your product.
                  </dd>
                </div>
                <div className="relative">
                  <dt className="text-xl font-semibold text-gray-900">
                    <div className="absolute -left-12 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-gray-900 text-white font-bold">03</div>
                    Delivered to you.
                  </dt>
                  <dd className="mt-3 text-lg leading-7 text-black">
                    Your finished products are shipped directly to you, ready to sell to your customers.
                  </dd>
                </div>
              </dl>
            </motion.div>
            
          </div>
        </div>
      </section>

  
      {/* Section 9: Final CTA with Video */}
      <section className="relative h-screen overflow-hidden">
        {/* Video Background */}
        <video 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 min-w-full min-h-full object-cover z-10"
          playsInline
          muted
          autoPlay
          loop
          preload="metadata"
        >
          <source src="https://storage.googleapis.com/auren-public-asset/auren_3d_rotate_cube.mp4" type="video/mp4" />
        </video>

        {/* Overlay Content */}
        <div className="relative z-20 h-full flex flex-col items-center justify-center bg-black/30 px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="max-w-4xl text-center"
          >
            <h2 className="text-4xl font-light tracking-tight text-white sm:text-6xl mb-12">
              Get Started with Auren
            </h2>
            
            <Link href="/catalog">
              <button className="px-12 py-4 text-white text-base font-light bg-white/10 backdrop-blur-xl border border-white/20 rounded-full hover:bg-white/15 transition-all duration-300">
                Get Started
              </button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black py-16 px-8 relative z-30">
        <div className="max-w-7xl mx-auto">
          {/* Top Section */}
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            {/* Brand Information */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-3 mb-6">
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
              <p className="text-white/60 text-sm mb-6 leading-relaxed">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
              </p>
              <p className="text-white text-sm">© 2025 AUREN</p>
            </div>

            {/* FAQs Column */}
            <div>
              <h4 className="text-white font-semibold mb-4">FAQs</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-white/60 hover:text-white transition-colors text-sm">Information</a></li>
                <li><a href="#" className="text-white/60 hover:text-white transition-colors text-sm">Payment</a></li>
                <li><a href="#" className="text-white/60 hover:text-white transition-colors text-sm">Shipping</a></li>
                <li><a href="#" className="text-white/60 hover:text-white transition-colors text-sm">Returns</a></li>
                <li><a href="#" className="text-white/60 hover:text-white transition-colors text-sm">Gift Card</a></li>
              </ul>
            </div>

            {/* Company Column */}
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-white/60 hover:text-white transition-colors text-sm">Delivery</a></li>
                <li><a href="#" className="text-white/60 hover:text-white transition-colors text-sm">Collection</a></li>
                <li><a href="#" className="text-white/60 hover:text-white transition-colors text-sm">Our Journals</a></li>
                <li><a href="#" className="text-white/60 hover:text-white transition-colors text-sm">Contact</a></li>
                <li><a href="#" className="text-white/60 hover:text-white transition-colors text-sm">Careers</a></li>
              </ul>
            </div>

            {/* Newsletter Column */}
            <div>
              <h4 className="text-white font-semibold mb-4">Newsletter</h4>
              <p className="text-white/60 text-sm mb-4 leading-relaxed">
                Be the first to get the latest news about trends and promotions and much more!
              </p>
              <div className="flex mb-4">
                <input 
                  type="email" 
                  placeholder="Enter your email" 
                  className="flex-1 px-4 py-2 bg-white rounded-l-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white/20"
                />
                <button className="px-4 py-2 bg-white/10 hover:bg-white/20 transition-colors rounded-r-lg">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" className="w-4 h-4 rounded border-white/60 bg-transparent" />
                <span className="text-white/60 text-xs">
                  By subscribing, you agree with the{' '}
                  <a href="#" className="underline hover:text-white transition-colors">Privacy Policy.</a>
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Section */}
          <div className="border-t border-white/10 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              {/* Legal Links */}
              <div className="flex gap-6">
                <a href="#" className="text-white/60 hover:text-white transition-colors text-sm underline">Terms of Services</a>
                <a href="#" className="text-white/60 hover:text-white transition-colors text-sm underline">Privacy Policy</a>
                <a href="#" className="text-white/60 hover:text-white transition-colors text-sm underline">Cookies Policy</a>
              </div>

              {/* Language Selector */}
              <div className="relative">
                <select className="bg-transparent text-white/60 border border-white/20 rounded-lg px-4 py-2 pr-8 appearance-none focus:outline-none focus:ring-2 focus:ring-white/20">
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>

    </main>
  )
}
