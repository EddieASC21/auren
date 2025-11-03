'use client'

import { motion } from 'framer-motion'
import { useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'

export default function ChatBoxPage() {
  const [message, setMessage] = useState('I want to make a custom hoodie')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [generatedImage, setGeneratedImage] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  // --- Handle drag-and-drop image preview
  useEffect(() => {
    const node = dropRef.current
    if (!node) return

    const prevent = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
    }
    const handleDrop = (e: DragEvent) => {
      prevent(e)
      const files = e.dataTransfer?.files
      if (files && files[0]) {
        const file = files[0]
        const url = URL.createObjectURL(file)
        setPreviewUrl(url)
      }
    }
      ;['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
        node.addEventListener(eventName as any, prevent)
      })
    node.addEventListener('drop', handleDrop as any)

    return () => {
      ;['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
        node.removeEventListener(eventName as any, prevent)
      })
      node.removeEventListener('drop', handleDrop as any)
    }
  }, [])

  // --- Local file upload handler
  const onFile = (file?: File) => {
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
  }

  // --- Send message -> OpenAI -> Vertex AI -> Display result
  const handleSend = async () => {
    try {
      setIsLoading(true)
      setGeneratedImage(null)
      setErrorMsg(null)

      // Step 1️⃣ Send user message to backend OpenAI route
      const chatRes = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: message }),
      })

      const chatData = await chatRes.json()
      if (!chatRes.ok) throw new Error(chatData.error || 'Failed to refine prompt')

      console.log('✨ Refined prompt:', chatData.reply)

      // Step 2️⃣ Send refined prompt to Imagen 4 route
      const imgRes = await fetch('http://localhost:3001/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: chatData.reply,
          aspectRatio: '1:1',
        }),
      })

      const imgData = await imgRes.json()
      if (!imgRes.ok) throw new Error(imgData.error || 'Failed to generate image')

      setGeneratedImage(imgData.imageUrl)
    } catch (err: any) {
      console.error('❌ ChatBox error:', err)
      setErrorMsg(err.message || 'Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main
      className="relative min-h-screen text-white overflow-hidden"
      style={{
        backgroundImage: "url('/background.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* Step indicator */}
      <motion.div
        className="absolute top-8 left-8"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="text-white text-3xl font-light mb-2">01</div>
        <div className="w-64 h-1 bg-white/25 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-white rounded-full"
            initial={{ width: 0 }}
            animate={{ width: '20%' }}
            transition={{ duration: 0.8, delay: 0.3 }}
          />
        </div>
      </motion.div>

      {/* Header */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 -mt-10 md:-mt-16">
        <motion.div
          className="text-center max-w-4xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-semibold leading-tight tracking-tight drop-shadow-[0_1px_0_rgba(0,0,0,0.2)]">
            What type of product
            <br className="hidden sm:block" /> do you want to make?
          </h1>
          <p className="mt-4 text-white/80 text-sm sm:text-base">
            Describe your idea — or drop a photo. We'll make it real.
          </p>
        </motion.div>

        {/* Chat input bar */}
        <motion.div
          ref={dropRef}
          className="mt-8 w-full max-w-3xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <div className="relative flex items-center gap-3 rounded-2xl border border-white/15 bg-black/40 backdrop-blur-xl px-3 py-2 shadow-2xl ring-1 ring-white/10">
            {/* logo */}
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/5 border border-white/20">
              <Image src="/auren_white_logo.png" alt="Auren" width={22} height={22} />
            </div>

            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your idea"
              className="flex-1 bg-transparent outline-none placeholder-white/50 text-white text-base sm:text-lg"
            />

            {/* upload */}
            <label
              className="relative grid place-items-center w-10 h-10 rounded-lg border border-white/20 bg-white/10 hover:bg-white/15 transition cursor-pointer"
              title="Upload image"
            >
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0] || undefined)}
              />
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-white">
                <path
                  d="M12 16V4m0 0 4 4M12 4 8 8"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <rect
                  x="4"
                  y="12"
                  width="16"
                  height="8"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
              </svg>
            </label>

            {/* send button */}
            <button
              onClick={handleSend}
              disabled={isLoading}
              className="grid place-items-center w-10 h-10 rounded-lg bg-white/10 border border-white/20 text-white hover:bg-white/15 transition"
              title="Send"
              aria-label="Send"
            >
              {isLoading ? (
                <svg
                  className="animate-spin w-5 h-5 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M3 11.5 20 4l-7.5 17-2.5-7.5L3 11.5z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    fill="currentColor"
                    fillOpacity="0.9"
                  />
                </svg>
              )}
            </button>
          </div>

          {/* File preview */}
          {previewUrl && (
            <div className="flex items-center gap-3 mt-3">
              <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-white/20 bg-white/10">
                <Image src={previewUrl} alt="upload preview" fill className="object-cover" />
              </div>
              <span className="text-sm text-white/70">Image attached</span>
            </div>
          )}

          {/* Error message */}
          {errorMsg && (
            <p className="mt-4 text-red-400 text-sm text-center">{errorMsg}</p>
          )}

          {/* Generated image */}
          { generatedImage && (
            <motion.div
              className="mt-8 flex items-center justify-center w-full max-w-2xl mx-auto rounded-2xl border border-white/20 bg-black/40 backdrop-blur-xl overflow-hidden shadow-xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              style={{
                aspectRatio: '1 / 1',
                maxHeight: '400px', // limits height on large screens
              }}
            >
              <div className="relative w-full h-full">
                <Image
                  src={generatedImage}
                  alt="AI generated design"
                  fill
                  className="object-contain rounded-2xl"
                  unoptimized
                />
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Navigation */}
        <div className="pointer-events-none absolute inset-x-0 bottom-10 flex items-center justify-between px-10">
          <Link href="/catalog" className="pointer-events-auto">
            <button className="w-28 h-12 rounded-full bg-white/10 text-white/80 border border-white/20 backdrop-blur-md text-sm font-medium hover:bg-white/20 hover:border-white/40 transition-all">
              Back
            </button>
          </Link>
          <Link href="/order-quantity?isCustom=true" className="pointer-events-auto">
            <button className="w-32 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-lg font-semibold transition-all hover:bg-white/20 hover:border-white/40">
              Next
            </button>
          </Link>
        </div>
      </div>
    </main>
  )
}