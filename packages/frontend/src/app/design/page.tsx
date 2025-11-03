'use client'

import { toPng } from 'html-to-image'
import { useRouter } from 'next/navigation'
import { useState, useRef, useEffect, Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import axios from 'axios'

type UploadedImg = {
  id: number
  src: string
  x: number
  y: number
  width: number
  height: number
}

type TextEl = {
  id: number
  text: string
  x: number
  y: number
  fontSize: number
}

type DesignData = {
  productImage: string | null
  frontUploadedImages: UploadedImg[]
  backUploadedImages: UploadedImg[]
  frontTextElements: TextEl[]
  backTextElements: TextEl[]
  isViewingBack: boolean
  canvasWidth: number
  canvasHeight: number
  selectedProductId?: string
  selectedProductName?: string
  selectedProductCategory?: string
}

function DesignPageContent() {
  const searchParams = useSearchParams()
  const [message, setMessage] = useState('Make a minimalist white spaceship')
  const [isSending, setIsSending] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [email, setEmail] = useState('')
  const [frontUploadedImages, setFrontUploadedImages] = useState<Array<{id: number, src: string, x: number, y: number, width: number, height: number}>>([])
  const [backUploadedImages, setBackUploadedImages] = useState<Array<{id: number, src: string, x: number, y: number, width: number, height: number}>>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [frontTextElements, setFrontTextElements] = useState<Array<{id: number, text: string, x: number, y: number, fontSize: number}>>([])
  const [backTextElements, setBackTextElements] = useState<Array<{id: number, text: string, x: number, y: number, fontSize: number}>>([])
  const [draggedTextId, setDraggedTextId] = useState<number | null>(null)
  const [draggedImageId, setDraggedImageId] = useState<number | null>(null)
  const [editingTextId, setEditingTextId] = useState<number | null>(null)
  const [selectedProductImage, setSelectedProductImage] = useState<string | null>(null)
  const [selectedProductName, setSelectedProductName] = useState<string>('Product')
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [selectedProductCategory, setSelectedProductCategory] = useState<string>('')
  const [isViewingBack, setIsViewingBack] = useState(false)
  const [frontImage, setFrontImage] = useState<string | null>(null)
  const [backImage, setBackImage] = useState<string | null>(null)
  const [hasBackImage, setHasBackImage] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)
  const [aiReply, setAiReply] = useState<string>("")
  const [generatedImage, setGeneratedImage] = useState<string | null>(null)
  const [loadingAI, setLoadingAI] = useState(false)
  const [chatHistory, setChatHistory] = useState<
    Array<{ role: 'user' | 'assistant', text: string; imageUrl?: string }>
    >([])
  const chatEndRef = useRef<HTMLDivElement>(null)

  const router = useRouter()

  // Get current active design elements based on view
  const currentUploadedImages = isViewingBack ? backUploadedImages : frontUploadedImages
  const currentTextElements = isViewingBack ? backTextElements : frontTextElements

  useEffect(() => {
    const productId = searchParams.get('productId')
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('designData_') && key !== `designData_${productId}`) {
        localStorage.removeItem(key)
      }
    })
  }, [searchParams])

  useEffect(() => {
    try {
      // Only store the text messages, skip image data to avoid quota issues
      const textOnlyChat = chatHistory.map(({ role, text }) => ({ role, text }))
      localStorage.setItem('chatHistory', JSON.stringify(textOnlyChat))
    } catch (err) {
      console.warn('Failed to save chatHistory:', err)
    }
  }, [chatHistory])

  useEffect(() => {
    // Scroll to bottom whenever chatHistory changes
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = localStorage.getItem('designData')
    if (!raw) return
    try {
      const d: DesignData = JSON.parse(raw)

      // Base product image + side
      setSelectedProductImage(d.productImage)
      setIsViewingBack(d.isViewingBack ?? false)

      // Overlays/text
      setFrontUploadedImages(d.frontUploadedImages ?? [])
      setBackUploadedImages(d.backUploadedImages ?? [])
      setFrontTextElements(d.frontTextElements ?? [])
      setBackTextElements(d.backTextElements ?? [])

      // Optional (so your UI labels match)
      if (d.selectedProductName) setSelectedProductName(d.selectedProductName)
      if (d.selectedProductId) setSelectedProductId(d.selectedProductId)
      if (d.selectedProductCategory) setSelectedProductCategory(d.selectedProductCategory)
    } catch {
      // ignore malformed data
    }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // Get product data from URL on mount
  useEffect(() => {
    const productId = searchParams.get('productId')
    const productImage = searchParams.get('productImage')
    const productName = searchParams.get('productName')
    const productCategory = searchParams.get('productCategory')
    
    if (productId) {
      setSelectedProductId(productId)
    }
    
    if (productImage) {
      const decodedImage = decodeURIComponent(productImage)
      setFrontImage(decodedImage)
      setSelectedProductImage(decodedImage)
      
      // Generate back image path
      const backImagePath = decodedImage.replace('.png', ' back.png')
      setBackImage(backImagePath)
      
      // Check if back image exists by trying to load it
      const img = new window.Image()
      img.onload = () => setHasBackImage(true)
      img.onerror = () => setHasBackImage(false)
      img.src = backImagePath
    }
    if (productName) {
      setSelectedProductName(decodeURIComponent(productName))
    }
    if (productCategory) {
      setSelectedProductCategory(decodeURIComponent(productCategory))
    }
  }, [searchParams])

  // Function to toggle between front and back
  const toggleFrontBack = () => {
    if (isViewingBack) {
      setSelectedProductImage(frontImage)
      setIsViewingBack(false)
    } else {
      setSelectedProductImage(backImage)
      setIsViewingBack(true)
    }
  }

  const handleSendPrompt = async () => {
    if (!message.trim()) return
    setLoadingAI(true)

    // Add user's message to chat
    setChatHistory(prev => [...prev, { role: 'user', text: message }])
    setMessage('')

    try {
      // 🧠 Step 1: Refine prompt with OpenAI
      const chatRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: message }),
      })
      const chatData = await chatRes.json()
      if (!chatRes.ok) throw new Error(chatData.error || "Chat request failed")

      const refinedPrompt = chatData.reply || message

      // 🖼️ Step 2: Generate image from refined prompt
      const imgRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/generate-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: refinedPrompt }),
      })
      const imgData = await imgRes.json()
      if (!imgRes.ok) throw new Error(imgData.error || "Image generation failed")

      // Add assistant message + image to chat
      setChatHistory(prev => [
        ...prev,
        { role: 'assistant', text: refinedPrompt, imageUrl: imgData.imageUrl },
      ])
    } catch (err: any) {
      console.error("Design AI error:", err)
      alert(`Failed: ${err.message}`)
    } finally {
      setLoadingAI(false)
    }
  }

  const handleRefineImage = async (prompt: string, imageUrl?: string) => {
    try {
      setLoadingAI(true)

      // 🧠 Convert image URL to base64
      let imageBase64 = ""
      if (imageUrl) {
        const res = await fetch(imageUrl)
        const blob = await res.blob()
        const buffer = await blob.arrayBuffer()
        imageBase64 = Buffer.from(buffer).toString("base64")
      }

      // 1️⃣ Step 1: Ask Gemini to refine the description
      const refineRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/refine-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, lastPrompt: prompt }),
      })
      const refineData = await refineRes.json()
      if (!refineRes.ok) throw new Error(refineData.error || "Refine request failed")

      const suggestion = refineData.suggestion || "Enhance clarity and lighting."

      // 2️⃣ Step 2: Call Imagen 3 to regenerate based on suggestion
      const regenRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/regenerate-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, suggestion }),
      })
      const regenData = await regenRes.json()
      if (!regenRes.ok) throw new Error(regenData.error || "Regeneration failed")

      // 3️⃣ Step 3: Append refined result to chat
      setChatHistory(prev => [
        ...prev,
        {
          role: "assistant",
          text: suggestion,
          imageUrl: regenData.imageUrl,
        },
      ])
    } catch (err: any) {
      console.error("Refine Image Error:", err)
      alert(`Refine failed: ${err.message}`)
    } finally {
      setLoadingAI(false)
    }
  }

  // 🖼️ Place generated AI image on the shirt canvas
  const handleUseImage = (imgUrl: string) => {
    if (!imgUrl) return
    const newImage = {
      id: Date.now() + Math.random(),
      src: imgUrl,
      x: 100,
      y: 100,
      width: 200,
      height: 200,
    }

    if (isViewingBack) {
      setBackUploadedImages(prev => [...prev, newImage])
    } else {
      setFrontUploadedImages(prev => [...prev, newImage])
    }
  }

  const handleSendToEmail = async (userEmail: string) => {
    setIsSending(true)
    try {
      // EXAMPLE BODY, replace 'designData' appropriately
      const canvasWidth = canvasRef.current?.clientWidth || 0;
      const canvasHeight = canvasRef.current?.clientHeight || 0;
      const designData = {
        productImage: selectedProductImage,
        frontUploadedImages: frontUploadedImages,
        backUploadedImages: backUploadedImages,
        frontTextElements: frontTextElements,
        backTextElements: backTextElements,
        isViewingBack: isViewingBack,
        canvasWidth,
        canvasHeight,
        email: userEmail,
      };
      const response = await axios.post('/api/send-design', designData); // Change URL to your actual backend endpoint
      if (response.status === 200) {
        setEmailSent(true);
      } else {
        // Optionally show an error UI
        alert('Failed to send. Please try again.');
      }
    } catch (error) {
      console.error(error);
      alert('An error occurred sending your design.');
    }
    setIsSending(false);
    setShowEmailForm(false);
    setEmail('');
  }

  // 1) ADD this function inside DesignPageContent (near other handlers)
  const goToOrderPage = () => {
    const canvasWidth = canvasRef.current?.clientWidth || 0
    const canvasHeight = canvasRef.current?.clientHeight || 0

    const designData = {
      productImage: selectedProductImage,
      frontUploadedImages,
      backUploadedImages,
      frontTextElements,
      backTextElements,
      isViewingBack,
      canvasWidth,
      canvasHeight,
      // optional: keep these so /order-quantity can build a “Re-Edit” link
      selectedProductId,
      selectedProductName,
      selectedProductCategory,
    }

    if (typeof window !== 'undefined' && selectedProductId) {
      // Save under a product-specific key
      localStorage.setItem(`designData_${selectedProductId}`, JSON.stringify(designData))

      // Remove leftover designs from other products
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('designData_') && key !== `designData_${selectedProductId}`) {
          localStorage.removeItem(key)
        }
      })
    }

    const href =
      `/order-quantity` +
      `?productId=${selectedProductId}` +
      `&productName=${encodeURIComponent(selectedProductName)}` +
      `&productImage=${encodeURIComponent(selectedProductImage || '')}` +
      `&productCategory=${encodeURIComponent(selectedProductCategory)}`

    router.push(href)
  }

  const handleSubmitEmail = (e: React.FormEvent) => {
    e.preventDefault()
    if (email) {
      handleSendToEmail(email)
    }
  }

  const handleFileUpload = (files: FileList | null) => {
    if (!files) return
    
    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (e) => {
          const result = e.target?.result as string
          const newImage = {
            id: Date.now() + Math.random(),
            src: result,
            x: 100,
            y: 100,
            width: 150,
            height: 150
          }
          if (isViewingBack) {
            setBackUploadedImages(prev => [...prev, newImage])
          } else {
            setFrontUploadedImages(prev => [...prev, newImage])
          }
        }
        reader.readAsDataURL(file)
      }
    })
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFileUpload(e.dataTransfer.files)
  }

  const handleAddText = () => {
    const newText = {
      id: Date.now(),
      text: 'New Text',
      x: 100,
      y: 100,
      fontSize: 24
    }
    if (isViewingBack) {
      setBackTextElements(prev => [...prev, newText])
    } else {
      setFrontTextElements(prev => [...prev, newText])
    }
    setEditingTextId(newText.id)
  }

  const handleTextDragStart = (e: React.MouseEvent, id: number) => {
    setDraggedTextId(id)
    e.preventDefault()
  }

  const handleTextDrag = (e: React.MouseEvent) => {
    if (draggedTextId === null) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    if (isViewingBack) {
      setBackTextElements(prev => prev.map(text => 
        text.id === draggedTextId ? { ...text, x, y } : text
      ))
    } else {
      setFrontTextElements(prev => prev.map(text => 
        text.id === draggedTextId ? { ...text, x, y } : text
      ))
    }
  }

  const handleTextDragEnd = () => {
    setDraggedTextId(null)
  }

  const handleTextChange = (id: number, newText: string) => {
    if (isViewingBack) {
      setBackTextElements(prev => prev.map(text => 
        text.id === id ? { ...text, text: newText } : text
      ))
    } else {
      setFrontTextElements(prev => prev.map(text => 
        text.id === id ? { ...text, text: newText } : text
      ))
    }
  }

  const handleDeleteText = (id: number) => {
    if (isViewingBack) {
      setBackTextElements(prev => prev.filter(text => text.id !== id))
    } else {
      setFrontTextElements(prev => prev.filter(text => text.id !== id))
    }
  }

  const handleImageDragStart = (e: React.MouseEvent, id: number) => {
    setDraggedImageId(id)
    e.preventDefault()
  }

  const handleImageDrag = (e: React.MouseEvent) => {
    if (draggedImageId === null) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    if (isViewingBack) {
      setBackUploadedImages(prev => prev.map(img => 
        img.id === draggedImageId ? { ...img, x, y } : img
      ))
    } else {
      setFrontUploadedImages(prev => prev.map(img => 
        img.id === draggedImageId ? { ...img, x, y } : img
      ))
    }
  }

  const handleImageDragEnd = () => {
    setDraggedImageId(null)
  }

  const handleDeleteImage = (id: number) => {
    if (isViewingBack) {
      setBackUploadedImages(prev => prev.filter(img => img.id !== id))
    } else {
      setFrontUploadedImages(prev => prev.filter(img => img.id !== id))
    }
  }

  return (
    <main className="fixed inset-0 bg-black text-white overflow-hidden flex flex-col">
      {/* Top progress indicator */}
      {/* Main content - Three column layout */}
      <div className="flex items-start justify-between h-screen px-16 py-20 gap-8">
        {/* Left Column - Chat Section */}
        <div className="flex flex-col flex-1 max-w-md h-full">
          {/* Chat heading and description (top fixed area) */}
          <div className="mb-6">
            <h1 className="text-7xl font-light leading-tight text-white">Chat</h1>
            <div className="flex items-start gap-4 mt-4">
              <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0">
                <Image src="/auren_white_logo.png" alt="Auren Logo" width={32} height={32} />
              </div>
              <p className="text-white/70 text-base leading-relaxed">
                Describe your idea — text, logo, vibe,
                <br /> or upload inspo pics & we'll recreate it!
              </p>
            </div>
          </div>

          {/* Chat history (scrollable area below description) */}
          <div className="flex-1 overflow-y-auto pr-2 space-y-6 max-h-[80vh]">
            {chatHistory.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                {/* Only render text if it's a user message or if assistant has no image */}
                {(msg.role === 'user' || !msg.imageUrl) && (
                  <div
                    className={`px-4 py-3 rounded-2xl max-w-[80%] ${msg.role === 'user'
                        ? 'bg-blue-600 text-white self-end'
                        : 'bg-gray-800 text-white border border-white/10'
                      }`}
                  >
                    <p className="whitespace-pre-wrap text-sm">{msg.text}</p>
                  </div>
                )}

                {/* Render image below (no text bubble above it) */}
                {msg.imageUrl && (
                  <div className="mt-4 border border-white/10 rounded-xl overflow-hidden max-w-[80%]">
                    <img src={msg.imageUrl} alt="Generated" className="w-full h-auto rounded-xl" />
                    {/* Action buttons below AI-generated image */}
                    <div className="flex gap-3 mt-3">
                      <button
                        onClick={() => handleUseImage(msg.imageUrl!)}
                        className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition"
                      >
                        Use Image
                      </button>
                      <button
                        onClick={() => handleRefineImage(msg.text, msg.imageUrl)}
                        className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition"
                      >
                        Refine Image
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {loadingAI && (
              <div className="text-gray-400 text-sm italic mt-2 animate-pulse">
                Generating...
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input field (bottom of chat column) */}
          <div className="mt-4 w-full">
            <div className="flex items-center gap-3 rounded-2xl bg-gray-800 px-4 py-3 border-2 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.5)] w-full">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSendPrompt()
                  }
                }}
                placeholder="Make a minimalist white spaceship"
                rows={1}
                className="flex-1 bg-transparent outline-none placeholder-gray-500 text-white text-base resize-none overflow-hidden"
                style={{ minHeight: '40px', maxHeight: '120px' }}
              />

              {/* Upload icon */}
              <button className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white transition">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
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
              </button>

              {/* Send icon */}
              <button
                onClick={handleSendPrompt}
                disabled={loadingAI}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white transition disabled:opacity-50"
              >
                {loadingAI ? (
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
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
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
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
          </div>
        </div>
        {/* Middle Column - Product Display Area */}
        <div className="flex-1 flex items-center justify-center">
          <div className="relative w-full max-w-lg h-[90vh] bg-[#f5f1e8] border-2 border-dashed border-gray-300 p-8 flex flex-col">
            {/* Top right icon - Send to Email */}
            <button 
              onClick={() => setShowEmailForm(true)}
              disabled={isSending || emailSent}
              className="absolute top-6 right-6 w-10 h-10 bg-black border border-white/20 rounded-lg flex items-center justify-center text-white hover:bg-white/10 transition disabled:opacity-50 z-10"
              title="Send design to email"
            >
              {isSending ? (
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : emailSent ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
              )}
            </button>

            {/* Canvas Area - Blank canvas ready for product selection and editing */}
            <div 
              className={`flex-1 w-full flex items-center justify-center bg-white/30 rounded-lg relative overflow-hidden transition-colors ${
                isDragging ? 'bg-white/50 border-2 border-dashed border-gray-400' : ''
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onMouseMove={(e) => {
                handleTextDrag(e)
                handleImageDrag(e)
              }}
              onMouseUp={() => {
                handleTextDragEnd()
                handleImageDragEnd()
              }}
            >
              {/* Canvas content */}
              <div ref={canvasRef} className="w-full h-full relative">
                {/* Selected product image */}
                {selectedProductImage && (
                  <div className="absolute inset-0 flex items-center justify-center p-4">
                    <Image 
                      src={selectedProductImage} 
                      alt={selectedProductName}
                      width={500}
                      height={500}
                      className="object-contain w-full h-full"
                      unoptimized
                    />
                  </div>
                )}

                {/* Uploaded images */}
                {currentUploadedImages.map((img) => (
                  <div
                    key={img.id}
                    className="absolute group cursor-move"
                    style={{ left: `${img.x}px`, top: `${img.y}px` }}
                    onMouseDown={(e) => handleImageDragStart(e, img.id)}
                  >
                    <img 
                      src={img.src} 
                      alt={`Uploaded ${img.id}`}
                      className="object-contain rounded"
                      style={{ width: `${img.width || 150}px`, height: `${img.height || 150}px` }}
                      draggable={false}
                    />
                    <button
                      onClick={() => handleDeleteImage(img.id)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M18 6L6 18M6 6l12 12"/>
                      </svg>
                    </button>
                  </div>
                ))}

                {/* Text elements */}
                {currentTextElements.map((textEl) => (
                  <div
                    key={textEl.id}
                    className="absolute group cursor-move"
                    style={{ left: `${textEl.x}px`, top: `${textEl.y}px` }}
                    onMouseDown={(e) => handleTextDragStart(e, textEl.id)}
                  >
                    {editingTextId === textEl.id ? (
                      <input
                        type="text"
                        value={textEl.text}
                        onChange={(e) => handleTextChange(textEl.id, e.target.value)}
                        onBlur={() => setEditingTextId(null)}
                        className="bg-transparent border-2 border-blue-500 px-2 py-1 outline-none text-black"
                        style={{ fontSize: `${textEl.fontSize}px` }}
                        autoFocus
                      />
                    ) : (
                      <div className="relative">
                        <span 
                          className="text-black select-none"
                          style={{ fontSize: `${textEl.fontSize}px` }}
                          onDoubleClick={() => setEditingTextId(textEl.id)}
                        >
                          {textEl.text}
                        </span>
                        <button
                          onClick={() => handleDeleteText(textEl.id)}
                          className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-xs"
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {/* Empty state */}
                {!selectedProductImage && currentUploadedImages.length === 0 && currentTextElements.length === 0 && (
                  <div className="text-gray-400 text-sm">
                    Canvas Area - Drag & drop images or add text
                  </div>
                )}
              </div>
            </div>

            {/* Product label */}
            <div className="w-full text-center pt-4">
              <p className="text-gray-600 text-sm uppercase tracking-wide">{selectedProductName}</p>
            </div>
          </div>
        </div>

        {/* Right Column - Design Tools Section */}
        <div className="flex flex-col gap-4 flex-1 max-w-md">
          <h2 className="text-7xl font-light leading-tight">
            Design tools
          </h2>

          {/* Tool buttons */}
          <div className="flex flex-col gap-4">
            {/* Add Text button */}
            <button 
              onClick={handleAddText}
              className="flex items-center gap-4 rounded-lg bg-black border border-white/20 px-6 py-4 hover:bg-white/10 transition"
            >
              <div className="w-10 h-10 flex items-center justify-center text-white text-2xl font-bold">
                T
              </div>
              <span className="text-white text-lg">Add Text</span>
            </button>

            {/* Upload Logo/Image button */}
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-4 rounded-lg bg-black border border-white/20 px-6 py-4 hover:bg-white/10 transition"
            >
              <div className="w-10 h-10 flex items-center justify-center text-white">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M12 16V4m0 0 4 4M12 4 8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  <rect x="4" y="12" width="16" height="8" rx="2" stroke="currentColor" strokeWidth="1.6"/>
                </svg>
              </div>
              <span className="text-white text-lg">Upload Logo/Image</span>
            </button>
            
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handleFileUpload(e.target.files)}
              className="hidden"
            />

            {/* Edit Color button */}
            <button className="flex items-center gap-4 rounded-lg bg-black border border-white/20 px-6 py-4 hover:bg-white/10 transition">
              <div className="w-10 h-10 flex items-center justify-center text-white relative">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M12 20h9"/>
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
                <div className="absolute bottom-0 right-0 w-2 h-2 rounded-sm bg-white" />
              </div>
              <span className="text-white text-lg">Edit Color</span>
            </button>

            {/* Front/Back Toggle button */}
            {frontImage && backImage && hasBackImage && (
              <button 
                onClick={toggleFrontBack}
                className="flex items-center gap-4 rounded-lg bg-black border border-white/20 px-6 py-4 hover:bg-white/10 transition"
                title={isViewingBack ? 'Show Front' : 'Show Back'}
              >
                <div className="w-10 h-10 flex items-center justify-center text-white">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M8 12h8M12 8l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span className="text-white text-lg">{isViewingBack ? 'FrontSide' : 'BackSide'}</span>
              </button>
            )}
          </div>

          {/* Next button at bottom */}
          <div className="mt-auto">
            <button
              onClick={goToOrderPage}
              className="w-full rounded-xl bg-black border border-white/20 px-6 py-4 text-white text-lg font-medium hover:bg-white/10 transition"
            >
              Next
            </button>
          </div>
        </div>

      </div>

      {/* AI reply + generated image preview */}
      {(aiReply || generatedImage) && (
        <div className="absolute bottom-0 right-0 p-6 w-[400px] bg-black/80 text-white border border-white/20 rounded-tl-lg max-h-[70vh] overflow-y-auto">
          {aiReply && (
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2">AI Suggestion</h3>
              <p className="text-sm text-white/80 whitespace-pre-wrap">{aiReply}</p>
            </div>
          )}
          {generatedImage && (
            <div className="relative border border-white/10 rounded-lg overflow-hidden">
              <img src={generatedImage} alt="Generated Design" className="w-full h-auto" />
            </div>
          )}
        </div>
      )}

      {/* Email Form Modal */}
      {showEmailForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-black border border-white/20 rounded-lg p-8 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-light text-white">Send Design to Email</h3>
              <button 
                onClick={() => {
                  setShowEmailForm(false)
                  setEmail('')
                }}
                className="text-white/60 hover:text-white transition"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleSubmitEmail} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm text-white/70 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  required
                  className="w-full px-4 py-3 bg-black border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-white/40 transition"
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEmailForm(false)
                    setEmail('')
                  }}
                  className="flex-1 px-4 py-3 bg-black border border-white/20 rounded-lg text-white hover:bg-white/10 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSending || !email}
                  className="flex-1 px-4 py-3 bg-white text-black rounded-lg font-medium hover:bg-white/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSending ? 'Sending...' : 'Send PDF'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}

export default function DesignPage() {
  return (
    <Suspense fallback={
      <main className="relative min-h-screen bg-black text-white overflow-hidden flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </main>
    }>
      <DesignPageContent />
    </Suspense>
  )
}
