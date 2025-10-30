'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import axios from 'axios'

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

  // Get current active design elements based on view
  const currentUploadedImages = isViewingBack ? backUploadedImages : frontUploadedImages
  const currentTextElements = isViewingBack ? backTextElements : frontTextElements

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

  // Function to handle Next button - capture design data
  const handleNextClick = () => {
    const canvasWidth = canvasRef.current?.clientWidth || 0
    const canvasHeight = canvasRef.current?.clientHeight || 0
    const designData = {
      productImage: selectedProductImage,
      frontUploadedImages: frontUploadedImages,
      backUploadedImages: backUploadedImages,
      frontTextElements: frontTextElements,
      backTextElements: backTextElements,
      isViewingBack: isViewingBack,
      canvasWidth,
      canvasHeight
    }
    
    // Store design data in localStorage to avoid URL length issues
    localStorage.setItem('designData', JSON.stringify(designData))
    
    return `/order-quantity?productId=${selectedProductId}&productName=${encodeURIComponent(selectedProductName)}&productImage=${encodeURIComponent(selectedProductImage || '')}&productCategory=${encodeURIComponent(selectedProductCategory)}`
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
    <main className="relative min-h-screen bg-black text-white overflow-hidden">
      {/* Top progress indicator */}
      <div className="absolute top-8 left-4 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="text-white text-3xl font-light">02</span>
          <div className="w-64 h-1 bg-white/25 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full" style={{ width: '80%' }} />
          </div>
        </div>
        {/* Chat heading below progress */}
        <h1 className="text-7xl font-light leading-tight text-white">
          Chat
        </h1>
        {/* Instructions with icon */}
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

      {/* Main content - Three column layout */}
      <div className="flex items-center justify-between min-h-screen px-16 py-20 gap-8">
        
        {/* Left Column - Chat Section */}
        <div className="flex flex-col gap-12 flex-1 max-w-md">
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
            <Link href={handleNextClick()}>
              <button className="w-full rounded-xl bg-black border border-white/20 px-6 py-4 text-white text-lg font-medium hover:bg-white/10 transition">
                Next
              </button>
            </Link>
          </div>
        </div>

      </div>

      {/* Input field at bottom left with blue glow */}
      <div className="absolute bottom-20 left-8 w-full max-w-xl">
        <div className="flex items-center gap-3 rounded-2xl bg-gray-800 px-4 py-3 border-2 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.5)]">
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Make a minimalist white spaceship"
            className="flex-1 bg-transparent outline-none placeholder-gray-500 text-white text-base"
          />
          
          {/* Upload icon */}
          <button className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white transition">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 16V4m0 0 4 4M12 4 8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              <rect x="4" y="12" width="16" height="8" rx="2" stroke="currentColor" strokeWidth="1.6"/>
            </svg>
          </button>

          {/* Send icon */}
          <button className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white transition">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M3 11.5 20 4l-7.5 17-2.5-7.5L3 11.5z" stroke="currentColor" strokeWidth="1.6" fill="currentColor" fillOpacity="0.9"/>
            </svg>
          </button>
        </div>
      </div>

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
