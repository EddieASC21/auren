'use client'

import { motion } from 'framer-motion'
import { useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Buffer } from 'buffer'
import { db, blobToBase64 } from '../../lib/db' // Ensure this path is correct
import { nanoid } from 'nanoid'

// 👇 CHANGE THIS BLOCK
type ChatMessage = {
  role: 'user' | 'assistant';
  text: string;
  imageUrls?: string[];       // 👈 Array of blob URLs (PLURAL)
  imagePointers?: string[];   // 👈 Array of DB IDs (PLURAL)
}

export default function ChatBoxPage() {
  const [message, setMessage] = useState('I want to make a custom hoodie')
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const chatEndRef = useRef<HTMLDivElement>(null)
  const [selectedGeneratedImage, setSelectedGeneratedImage] = useState<string | null>(null);

  // Holds the IndexedDB ID for the image currently sitting in the input bar
  const [chatImageIds, setChatImageIds] = useState<string[]>([])

  // -----------------------------------------------------------------
  // 1. LOAD HOOK (Hydrates chat from IndexedDB)
  // -----------------------------------------------------------------
  // -----------------------------------------------------------------
  // 1. LOAD HOOK (Hydrates chat from IndexedDB)
  // -----------------------------------------------------------------
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const chatKey = 'aiChat_chatHistory';
    const imageKey = 'aiChat_selectedImage';

    const loadChat = async () => {
      const rawChat = localStorage.getItem(chatKey);
      if (!rawChat) return;

      try {
        const loadedChat: any[] = JSON.parse(rawChat);

        // Hydrate: Swap pointers for real blob URLs
        const hydratedChat = await Promise.all(
          loadedChat.map(async (msg) => {
            // MIGRATION: If old data has singular pointers, convert to array
            if (msg.imagePointer && !msg.imagePointers) {
              msg.imagePointers = [msg.imagePointer];
            }

            // Now handle the array (Plural)
            if (msg.imagePointers && msg.imagePointers.length > 0) {
              const urls: string[] = [];
              // Loop through the array of IDs
              for (const pointer of msg.imagePointers) {
                try {
                  const record = await db.images.get(pointer);
                  if (record) {
                    urls.push(URL.createObjectURL(record.blob));
                  }
                } catch (e) {
                  console.error("Error retrieving image from DB:", e);
                }
              }
              // Return with populated URLs array
              return { ...msg, imageUrls: urls };
            }
            return msg;
          })
        );

        setChatHistory(hydratedChat as ChatMessage[]);
      } catch (e) {
        console.warn('Failed to load aiChat_chatHistory', e);
        localStorage.removeItem(chatKey);
      }
    }

    loadChat();

    const rawImage = localStorage.getItem(imageKey);
    if (rawImage) {
      setSelectedGeneratedImage(rawImage);
    }
  }, []);

  // -----------------------------------------------------------------
  // 2. SAVE HOOKS (Sanitized)
  // -----------------------------------------------------------------
  useEffect(() => {
    if (chatHistory.length > 0) {
      try {
        // Sanitize: Remove huge blob URLs before saving to Local Storage
        const sanitizedChatHistory = chatHistory.map(msg => {
          const { imageUrls, ...restOfMsg } = msg;
          return restOfMsg; // Only save text + imagePointer
        });

        localStorage.setItem('aiChat_chatHistory', JSON.stringify(sanitizedChatHistory));
      } catch (err) {
        console.warn('Failed to save aiChat_chatHistory:', err);
      }
    }
  }, [chatHistory]);

  useEffect(() => {
    // Guard: Don't save blob URLs to LS (they expire anyway)
    if (selectedGeneratedImage && !selectedGeneratedImage.startsWith('blob:')) {
      localStorage.setItem('aiChat_selectedImage', selectedGeneratedImage);
    } else {
      localStorage.removeItem('aiChat_selectedImage');
    }
  }, [selectedGeneratedImage]);

  // Scroll effect
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  // -----------------------------------------------------------------
  // 3. FILE HANDLERS (Save to DB immediately)
  // -----------------------------------------------------------------

  // -----------------------------------------------------------------
  // 3. FILE HANDLERS (Appends to arrays)
  // -----------------------------------------------------------------
  const handleFileProcess = async (file: File) => {
    // 1. Preview
    const url = URL.createObjectURL(file);
    setPreviewUrls(prev => [...prev, url]); // 👈 Append to array

    // 2. Save to DB
    try {
      const newImageId = nanoid();
      await db.images.add({
        id: newImageId,
        blob: file,
        createdAt: new Date()
      });
      setChatImageIds(prev => [...prev, newImageId]); // 👈 Append to array
    } catch (err) {
      console.error("Failed to save image to IndexedDB", err);
    }
  };

  const onFile = (file?: File) => {
    if (file) handleFileProcess(file);
  }

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
        handleFileProcess(files[0]);
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

  // -----------------------------------------------------------------
  // 4. UPDATED SEND LOGIC (Connects Image to Chat & API)
  // -----------------------------------------------------------------
  // -----------------------------------------------------------------
  // 4. SEND LOGIC (Handles multiple images)
  // -----------------------------------------------------------------
  const handleSend = async () => {
    // Allow sending if text OR images exist
    if (isLoading || (!message.trim() && chatImageIds.length === 0)) return

    setIsLoading(true)

    const userMessage = message;
    const userImagePointers = [...chatImageIds]; // Copy array
    const userImageUrls = [...previewUrls];      // Copy array

    // 1. Add user message to UI
    setChatHistory(prev => [
      ...prev,
      {
        role: 'user',
        text: userMessage,
        imageUrls: userImageUrls.length > 0 ? userImageUrls : undefined,         // 👈 Pass Array
        imagePointers: userImagePointers.length > 0 ? userImagePointers : undefined // 👈 Pass Array
      }
    ])

    // Clear inputs
    setMessage('')
    setPreviewUrls([]) // 👈 Reset Array
    setChatImageIds([]) // 👈 Reset Array

    try {
      // --- 2. PREPARE IMAGE FOR API ---
      let imageBase64: string | null = null;

      // Note: We are sending the FIRST image to the API for now.
      if (userImagePointers.length > 0) {
        const record = await db.images.get(userImagePointers[0]);
        if (record) {
          imageBase64 = await blobToBase64(record.blob);
        }
      }

      // --- 3. SEND TO API ---
      const chatRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userMessage,
          imageBase64: imageBase64
        }),
      })

      // ... (Rest of the API logic remains the same until saving the AI response) ...

      const chatData = await chatRes.json()
      if (!chatRes.ok) throw new Error(chatData.error || 'Failed to refine prompt')
      const refinedPrompt = chatData.reply || userMessage

      const imgRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/generate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: refinedPrompt, aspectRatio: '1:1' }),
      })
      const imgData = await imgRes.json()
      if (!imgRes.ok) throw new Error(imgData.error || 'Failed to generate image')

      // --- 4. SAVE AI RESULT ---
      const aiImageUrl = imgData.imageUrl;
      const aiImageFetch = await fetch(aiImageUrl);
      const aiImageBlob = await aiImageFetch.blob();
      const aiImageId = nanoid();

      await db.images.add({ id: aiImageId, blob: aiImageBlob, createdAt: new Date() });
      const aiBlobUrl = URL.createObjectURL(aiImageBlob);

      setChatHistory(prev => [
        ...prev,
        {
          role: 'assistant',
          text: `Here's the design I came up with for "${refinedPrompt}":`,
          imageUrls: [aiBlobUrl],     // 👈 Array
          imagePointers: [aiImageId], // 👈 Array
        },
      ])
    } catch (err: any) {
      console.error('❌ ChatBox error:', err)
      setChatHistory(prev => [...prev, { role: 'assistant', text: `Sorry, an error occurred: ${err.message}` }])
    } finally {
      setIsLoading(false)
    }
  }

  // -----------------------------------------------------------------
  // 5. REFINE LOGIC (With DB Integration)
  // -----------------------------------------------------------------
  const handleRefineImage = async (prompt: string, imageUrl?: string) => {
    if (!imageUrl) return;
    try {
      setIsLoading(true)
      let imageBase64 = "";

      // 👇 FIXED: Use .includes() to find the message in the array
      const msg = chatHistory.find(m => m.imageUrls?.includes(imageUrl));

      // Find the index of the specific image within that array
      const idx = msg?.imageUrls?.indexOf(imageUrl) ?? -1;
      const pointer = msg?.imagePointers?.[idx];

      if (pointer) {
        const record = await db.images.get(pointer);
        if (record) imageBase64 = await blobToBase64(record.blob);
      } else {
        const res = await fetch(imageUrl);
        const blob = await res.blob();
        imageBase64 = await blobToBase64(blob);
      }

      const refineRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/refine-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, lastPrompt: prompt }),
      })
      const refineData = await refineRes.json()
      if (!refineRes.ok) throw new Error(refineData.error)

      const regenRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/regenerate-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, suggestion: refineData.suggestion }),
      })
      const regenData = await regenRes.json()
      if (!regenRes.ok) throw new Error(regenData.error)

      const newFetch = await fetch(regenData.imageUrl);
      const newBlob = await newFetch.blob();
      const newId = nanoid();
      await db.images.add({ id: newId, blob: newBlob, createdAt: new Date() });

      setChatHistory(prev => [
        ...prev,
        {
          role: "assistant",
          text: refineData.suggestion,
          imageUrls: [URL.createObjectURL(newBlob)],
          imagePointers: [newId],
        },
      ])
    } catch (err: any) {
      alert(`Refine failed: ${err.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUseImage = (imgUrl: string) => {
    if (!imgUrl) return
    setSelectedGeneratedImage(imgUrl);
    setChatHistory(prev => [...prev, { role: 'assistant', text: "Great! I've selected that design. Click 'Next' to continue." }])
  }

  const goToNextPage = () => {
    const designData = {
      productImage: null,
      frontUploadedImages: selectedGeneratedImage ? [{ id: 1, src: selectedGeneratedImage, x: 0, y: 0, width: 500, height: 500 }] : [],
      backUploadedImages: [],
      frontTextElements: [],
      backTextElements: [],
      isViewingBack: false,
      canvasWidth: 500,
      canvasHeight: 500,
      selectedProductId: "ai-generated",
      selectedProductName: "AI Generated Design",
      selectedProductCategory: "custom",
      productColor: "#FFFFFF", // Add default color
      frontMask: null, // AI images don't have masks usually
      backMask: null
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(`designData_ai-generated`, JSON.stringify(designData));
      // Clean up others
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('designData_') && key !== `designData_ai-generated`) {
          localStorage.removeItem(key)
        }
      })
    }

    const href = `/order-quantity?productId=ai-generated&productName=AI Generated Design&productCategory=custom`;
    router.push(href);
  }

  return (
    <main
      ref={dropRef}
      className="relative min-h-screen text-white overflow-hidden"
      style={{
        backgroundImage: "url('/background.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
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

      {chatHistory.length === 0 ? (
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

          <motion.div
            className="mt-8 w-full max-w-3xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <div className="relative flex items-center gap-3 rounded-2xl border border-white/15 bg-black/40 backdrop-blur-xl px-3 py-2 shadow-2xl ring-1 ring-white/10">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/5 border border-white/20">
                <Image src="/auren_white_logo.png" alt="Auren" width={22} height={22} />
              </div>
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Describe your idea"
                className="flex-1 bg-transparent outline-none placeholder-white/50 text-white text-base sm:text-lg"
              />
              <label className="relative grid place-items-center w-10 h-10 rounded-lg border border-white/20 bg-white/10 hover:bg-white/15 transition cursor-pointer" title="Upload image">
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0] || undefined)} />
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-white"><path d="M12 16V4m0 0 4 4M12 4 8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /><rect x="4" y="12" width="16" height="8" rx="2" stroke="currentColor" strokeWidth="1.6" /></svg>
              </label>
              <button onClick={handleSend} disabled={isLoading} className="grid place-items-center w-10 h-10 rounded-lg bg-white/10 border border-white/20 text-white hover:bg-white/15 transition" title="Send" aria-label="Send">
                {isLoading ? <svg className="animate-spin w-5 h-5 text-white" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 11.5 20 4l-7.5 17-2.5-7.5L3 11.5z" stroke="currentColor" strokeWidth="1.6" fill="currentColor" fillOpacity="0.9" /></svg>}
              </button>
            </div>
            {/* MULTI-IMAGE PREVIEW */}
            {previewUrls.length > 0 && (
              <div className="flex items-center gap-3 mt-3 overflow-x-auto">
                {previewUrls.map((url, idx) => (
                  <div key={idx} className="relative w-12 h-12 rounded-lg overflow-hidden border border-white/20 bg-white/10 shrink-0">
                    <Image src={url} alt="preview" fill className="object-cover" />
                  </div>
                ))}
                <span className="text-sm text-white/70">
                  {previewUrls.length} image{previewUrls.length > 1 ? 's' : ''} attached
                </span>
              </div>
            )}
          </motion.div>
          <div className="pointer-events-none absolute inset-x-0 bottom-10 flex items-center justify-between px-10">
            <Link href="/catalog" className="pointer-events-auto"><button className="w-28 h-12 rounded-full bg-white/10 text-white/80 border border-white/20 backdrop-blur-md text-sm font-medium hover:bg-white/20 hover:border-white/40 transition-all">Back</button></Link>
            <button
              onClick={goToNextPage}
              disabled={!selectedGeneratedImage}
              className="w-32 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-lg font-semibold transition-all hover:bg-white/20 hover:border-white/40 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>

      ) : (

        <div className="relative z-10 flex flex-col h-screen p-8 pt-32 pb-6">
          <div className="flex-1 overflow-y-auto pr-2 space-y-6 mb-4">
            {chatHistory.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`px-4 py-3 rounded-2xl max-w-[80%] ${msg.role === 'user'
                    ? 'bg-blue-600 text-white self-end'
                    : 'bg-gray-800 text-white border border-white/10'
                    }`}
                >
                  <p className="whitespace-pre-wrap text-sm">{msg.text}</p>
                </div>

                {/* MULTI-IMAGE RENDER IN CHAT */}
                {msg.imageUrls && msg.imageUrls.length > 0 && (
                  <div className={`mt-4 flex flex-wrap gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.imageUrls.map((url, idx) => (
                      <motion.div key={idx} className="border border-white/10 rounded-xl overflow-hidden max-w-[300px] relative" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        {/* Selected Border */}
                        {selectedGeneratedImage === url && msg.role === 'assistant' && <div className="absolute inset-0 ring-4 ring-blue-500 rounded-xl z-10 pointer-events-none" />}

                        <Image src={url} alt="design" width={400} height={400} className="w-full h-auto" unoptimized />

                        {/* Action Buttons (Only for Assistant) */}
                        {msg.role === 'assistant' && (
                          <div className="flex gap-2 p-2 bg-black/30">
                            <button onClick={() => handleUseImage(url)} className="flex-1 px-4 py-2 text-sm bg-blue-600 rounded-lg text-white">{selectedGeneratedImage === url ? 'Selected' : 'Use'}</button>
                            {/* Only show Refine if it's a single image result, to simplify UI */}
                            {msg.imageUrls!.length === 1 && <button onClick={() => handleRefineImage(msg.text, url)} className="flex-1 px-4 py-2 text-sm bg-gray-700 rounded-lg text-white">Refine</button>}
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex items-start">
                <div className="px-4 py-3 rounded-2xl max-w-[80%] bg-gray-800 text-white border border-white/10">
                  <p className="text-sm text-gray-400 italic animate-pulse">Generating...</p>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          <div className="flex items-center gap-4 mt-auto w-full">
            <Link href="/catalog" className="pointer-events-auto">
              <button className="w-28 h-12 rounded-full bg-white/10 text-white/80 border border-white/20 backdrop-blur-md text-sm font-medium hover:bg-white/20 hover:border-white/40 transition-all">
                Back
              </button>
            </Link>

            <div className="relative flex-1 flex items-center gap-3 rounded-2xl border border-white/15 bg-black/40 backdrop-blur-xl px-3 py-2 shadow-2xl ring-1 ring-white/10">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/5 border border-white/20">
                <Image src="/auren_white_logo.png" alt="Auren" width={22} height={22} />
              </div>
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Describe your idea"
                className="flex-1 bg-transparent outline-none placeholder-white/50 text-white text-base sm:text-lg"
              />
              <label className="relative grid place-items-center w-10 h-10 rounded-lg border border-white/20 bg-white/10 hover:bg-white/15 transition cursor-pointer" title="Upload image">
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0] || undefined)} />
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-white"><path d="M12 16V4m0 0 4 4M12 4 8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /><rect x="4" y="12" width="16" height="8" rx="2" stroke="currentColor" strokeWidth="1.6" /></svg>
              </label>
              <button onClick={handleSend} disabled={isLoading} className="grid place-items-center w-10 h-10 rounded-lg bg-white/10 border border-white/20 text-white hover:bg-white/15 transition" title="Send" aria-label="Send">
                {isLoading ? <svg className="animate-spin w-5 h-5 text-white" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 11.5 20 4l-7.5 17-2.5-7.5L3 11.5z" stroke="currentColor" strokeWidth="1.6" fill="currentColor" fillOpacity="0.9" /></svg>}
              </button>
            </div>

            <button
              onClick={goToNextPage}
              disabled={!selectedGeneratedImage}
              className="w-32 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-lg font-semibold transition-all hover:bg-white/20 hover:border-white/40 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

    </main>
  )
}