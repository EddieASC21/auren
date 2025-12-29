'use client'

import { toPng } from 'html-to-image'
import { useRouter } from 'next/navigation'
import { useState, useRef, useEffect, Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import axios from 'axios'
import { HexColorPicker } from "react-colorful";

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
  fontFamily: string
  fontWeight: string 
  fontStyle: string
  scale: number
  color: string
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

  // --- 👇 ADD THESE 3 LINES ---
  productColor: string
  frontMask: string | null
  backMask: string | null
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
  const [frontTextElements, setFrontTextElements] = useState<TextEl[]>([])
  const [backTextElements, setBackTextElements] = useState<TextEl[]>([])
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
  const [chatImage, setChatImage] = useState<string | null>(null); // 👈 ADD
  const chatFileInputRef = useRef<HTMLInputElement>(null); // 👈 ADD
  const [productColor, setProductColor] = useState('#FFFFFF'); // Default to white
  const [productMask, setProductMask] = useState<string | null>(null); // The *current* mask
  const [productOverlay, setProductOverlay] = useState<string | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showTextColorPicker, setShowTextColorPicker] = useState(false); // 👈 ADD THIS
  const [selectedTextId, setSelectedTextId] = useState<number | null>(null);
  const [frontMask, setFrontMask] = useState<string | null>(null); // 👈 --- ADD THIS LINE ---
  const [backMask, setBackMask] = useState<string | null>(null); // 👈 --- ADD THIS LINE ---
  const [selectedImageId, setSelectedImageId] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number, y: number } | null>(null);

  const [resizeInfo, setResizeInfo] = useState<{
    id: number;
    type: 'image' | 'text';
    handle: 'tl' | 'tr' | 'bl' | 'br' | 't' | 'b' | 'l' | 'r';
    originalX: number;
    originalY: number;
    originalWidth: number;
    originalHeight: number;
    originalMouseX: number;
    originalMouseY: number;
    originalScale: number;
  } | null>(null);


  const router = useRouter()

  const FONT_OPTIONS = [
    'Arial',
    'Verdana',
    'Helvetica',
    'Times New Roman',
    'Georgia',
    'Impact',
    'Courier New',
  ];

  const handleTextSizeChange = (id: number, newSize: string) => {
    // Allows the user to clear the input, but defaults to a minimum size
    const size = parseInt(newSize, 10);
    const finalSize = isNaN(size) ? 0 : size; // Default to 8 if empty/invalid

    if (isViewingBack) {
      setBackTextElements(prev => prev.map(text =>
        text.id === id ? { ...text, fontSize: finalSize } : text
      ))
    } else {
      setFrontTextElements(prev => prev.map(text =>
        text.id === id ? { ...text, fontSize: finalSize } : text
      ))
    }
  }

  // 👇 ADD THIS ENTIRE FUNCTION
  const handleChatImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        const base64 = loadEvent.target?.result as string;
        setChatImage(base64); // Store image as base64
      };
      reader.readAsDataURL(file);
    }
  };

  const handleToggleBold = (id: number) => {
    const toggle = (elements: typeof frontTextElements) =>
      elements.map(text =>
        text.id === id
          ? { ...text, fontWeight: text.fontWeight === 'bold' ? 'normal' : 'bold' }
          : text
      );

    if (isViewingBack) {
      setBackTextElements(toggle);
    } else {
      setFrontTextElements(toggle);
    }
  }

  const handleToggleItalic = (id: number) => {
    const toggle = (elements: typeof frontTextElements) =>
      elements.map(text =>
        text.id === id
          ? { ...text, fontStyle: text.fontStyle === 'italic' ? 'normal' : 'italic' }
          : text
      );

    if (isViewingBack) {
      setBackTextElements(toggle);
    } else {
      setFrontTextElements(toggle);
    }
  }

  const handleTextFontChange = (id: number, newFont: string) => {
    if (isViewingBack) {
      setBackTextElements(prev => prev.map(text =>
        text.id === id ? { ...text, fontFamily: newFont } : text
      ))
    } else {
      setFrontTextElements(prev => prev.map(text =>
        text.id === id ? { ...text, fontFamily: newFont } : text
      ))
    }
  }

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

  // --- UPDATED "SAVE" HOOK (Saves CHAT on any change) ---
  useEffect(() => {
    // Don't save if we don't have a product ID
    if (!selectedProductId) return;

    const chatKey = `chatHistory_${selectedProductId}`;
    try {
      // We save the full chat history
      localStorage.setItem(chatKey, JSON.stringify(chatHistory));
    } catch (err) {
      console.warn('Failed to save chatHistory:', err);
    }
  }, [chatHistory, selectedProductId]); // Runs when chat or productID changes

  useEffect(() => {
    // Scroll to bottom whenever chatHistory changes
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  // -----------------------------------------------------------------
  // --- NEW "LOAD" HOOK (Loads Design + Chat from Local Storage) ----
  // -----------------------------------------------------------------
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Get the product ID from the URL. This is our master key.
    const productId = searchParams.get('productId');
    if (!productId) return; // No product, so nothing to load.

    const designKey = `designData_${productId}`;
    const chatKey = `chatHistory_${productId}`;

    // --- 1. Load the VISUAL DESIGN ---
    const rawDesign = localStorage.getItem(designKey);
    if (rawDesign) {
      try {
        const d: DesignData = JSON.parse(rawDesign);

        // Re-hydrate all our visual states
        setSelectedProductImage(d.productImage);
        setFrontUploadedImages(d.frontUploadedImages || []);
        setBackUploadedImages(d.backUploadedImages || []);
        setFrontTextElements(d.frontTextElements || []);
        setBackTextElements(d.backTextElements || []);
        setIsViewingBack(d.isViewingBack || false);
        setProductColor(d.productColor || '#FFFFFF');
        setFrontMask(d.frontMask || null);
        setBackMask(d.backMask || null);

        if (d.selectedProductName) setSelectedProductName(d.selectedProductName);
        if (d.selectedProductId) setSelectedProductId(d.selectedProductId);
        if (d.selectedProductCategory) setSelectedProductCategory(d.selectedProductCategory);
      } catch (err) {
        console.warn("Failed to load designData:", err);
        localStorage.removeItem(designKey); // Clear corrupt data
      }
    }

    // --- 2. Load the CHAT HISTORY ---
    const rawChat = localStorage.getItem(chatKey);
    if (rawChat) {
      try {
        const loadedChatHistory = JSON.parse(rawChat);
        setChatHistory(loadedChatHistory);
      } catch (err) {
        console.warn("Failed to load chatHistory:", err);
        localStorage.removeItem(chatKey); // Clear corrupt data
      }
    }

    // We only run this once when the page and searchParams are ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Get product data from URL on mount
  // Get product data from URL on mount
  // Get product data from URL on mount
  // Get product data from URL on mount
  useEffect(() => {
    const productId = searchParams.get('productId');
    const productImage = searchParams.get('productImage');
    const productName = searchParams.get('productName');
    const productCategory = searchParams.get('productCategory');

    if (productId) setSelectedProductId(productId);

    if (productImage) {
      const decodedImage = decodeURIComponent(productImage);

      // FRONT images
      setFrontImage(decodedImage);
      setSelectedProductImage(decodedImage);
      setProductOverlay(decodedImage);

      // FRONT mask
      const frontMaskPath = decodedImage.replace(".png", "_mask.png");
      setProductMask(frontMaskPath); // 👈 --- SETS THE CURRENT MASK ---
      setFrontMask(frontMaskPath); // 👈 --- SETS THE FRONT MASK ---

      // BACK image
      const backImagePath = decodedImage.replace(".png", " back.png");
      setBackImage(backImagePath);

      // BACK mask
      const backMaskPath = decodedImage.replace(".png", "_back_mask.png"); // 👈 --- NEW ---
      setBackMask(backMaskPath); // 👈 --- NEW ---

      // Check if back image exists
      const img = new window.Image();
      img.onload = () => setHasBackImage(true);
      img.onerror = () => setHasBackImage(false);
      img.src = backImagePath;
    }

    if (productName) setSelectedProductName(decodeURIComponent(productName));
    if (productCategory) setSelectedProductCategory(decodeURIComponent(productCategory));
  }, [searchParams]);

  // Function to toggle between front and back
  const toggleFrontBack = () => {
    if (isViewingBack) {
      setSelectedProductImage(frontImage);
      setProductMask(frontMask); // 👈 --- ADD THIS LINE ---
      setIsViewingBack(false);
    } else {
      setSelectedProductImage(backImage);
      setProductMask(backMask); // 👈 --- ADD THIS LINE ---
      setIsViewingBack(true);
    }
  };

  const handleSendPrompt = async () => {
    if (!message.trim()) return
    setLoadingAI(true)

    // Add user's message to chat
    // If there's an image, show the text *and* the image in the user's chat bubble
    if (chatImage) {
      setChatHistory(prev => [
        ...prev,
        { role: 'user', text: message, imageUrl: chatImage }
      ]);
    } else {
      setChatHistory(prev => [...prev, { role: 'user', text: message }]);
    }

    const userMessage = message; // Store message before clearing
    setMessage('');
    setChatImage(null); // Clear the image after sending

    try {
      // 🧠 Step 1: Refine prompt with OpenAI (NOW WITH VISION)
      const chatRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: userMessage, // Send the stored message
          imageBase64: chatImage // 👈 SEND THE IMAGE
        }),
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

      productColor: productColor,
      frontMask: frontMask,
      backMask: backMask,
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
      // 👇 We'll use the FRONT image as the "main" one
      `&productImage=${encodeURIComponent(frontImage || '')}` +
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
      fontSize: 24,
      fontFamily: 'Arial',
      fontWeight: 'normal', // 👈 --- ADD THIS LINE ---
      fontStyle: 'normal',
      scale: 1,
      color: '#000000' // 👈 ADD THIS (default to black)
    }
    if (isViewingBack) {
      setBackTextElements(prev => [...prev, newText])
    } else {
      setFrontTextElements(prev => [...prev, newText])
    }
    setEditingTextId(newText.id)
    setSelectedTextId(newText.id);
  }

  const handleTextDragStart = (e: React.MouseEvent, id: number) => {
    const text = (isViewingBack ? backTextElements : frontTextElements).find(t => t.id === id);
    const canvasRect = canvasRef.current?.getBoundingClientRect(); // 👈 Get canvas rect
    if (!text || !canvasRect) return; // 👈 Safety check

    setDraggedTextId(id);
    setDragOffset({
      x: (e.clientX - canvasRect.left) - text.x, // 👈 Calculate offset relative to canvas
      y: (e.clientY - canvasRect.top) - text.y,
    });

    e.preventDefault();
  }

  const handleTextDrag = (e: React.MouseEvent) => {
    if (draggedTextId === null || !dragOffset) return;
    const rect = canvasRef.current?.getBoundingClientRect(); // 👈 Get canvas rect
    if (!rect) return; // 👈 Safety check

    const x = (e.clientX - rect.left) - dragOffset.x; // 👈 Calculate position relative to canvas
    const y = (e.clientY - rect.top) - dragOffset.y;

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
    setDraggedTextId(null);
    setDragOffset(null); // 👈 ADD THIS
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
    const img = (isViewingBack ? backUploadedImages : frontUploadedImages).find(i => i.id === id);
    const canvasRect = canvasRef.current?.getBoundingClientRect(); // 👈 Get canvas rect
    if (!img || !canvasRect) return; // 👈 Safety check

    setDraggedImageId(id);
    setDragOffset({
      x: (e.clientX - canvasRect.left) - img.x, // 👈 Calculate offset relative to canvas
      y: (e.clientY - canvasRect.top) - img.y,
    });

    e.preventDefault();
  }

  const handleImageDrag = (e: React.MouseEvent) => {
    if (draggedImageId === null || !dragOffset) return;
    const rect = canvasRef.current?.getBoundingClientRect(); // 👈 Get canvas rect
    if (!rect) return; // 👈 Safety check

    const x = (e.clientX - rect.left) - dragOffset.x; // 👈 Calculate position relative to canvas
    const y = (e.clientY - rect.top) - dragOffset.y;

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
    setDraggedImageId(null);
    setDragOffset(null); // 👈 ADD THIS
  }

  const handleDeleteImage = (id: number) => {
    if (isViewingBack) {
      setBackUploadedImages(prev => prev.filter(img => img.id !== id))
    } else {
      setFrontUploadedImages(prev => prev.filter(img => img.id !== id))
    }
  }

  const handleResizeStart = (
    e: React.MouseEvent,
    id: number,
    type: 'image' | 'text',
    handle: 'tl' | 'tr' | 'bl' | 'br' | 't' | 'b' | 'l' | 'r' // 👈 Make sure this is updated
  ) => {
    e.stopPropagation();
    e.preventDefault();

    const element =
      type === 'image'
        ? (isViewingBack ? backUploadedImages : frontUploadedImages).find(img => img.id === id)
        : (isViewingBack ? backTextElements : frontTextElements).find(txt => txt.id === id);

    if (!element) return;

    const elNode = document.querySelector(`[data-element-id="${id}"]`);
    const bounds = elNode?.getBoundingClientRect();

    setResizeInfo({
      id,
      type,
      handle,
      originalX: element.x,
      originalY: element.y,
      originalWidth: (element as UploadedImg).width || bounds?.width || 100,
      originalHeight: (element as UploadedImg).height || bounds?.height || 50,
      originalMouseX: e.clientX,
      originalMouseY: e.clientY,
      // 👇 ADD THIS LINE (or modify if it exists)
      originalScale: (element as TextEl).scale || 1,
    });
  };

  // 👇 ADD THIS NEW FUNCTION
  const handleResize = (e: React.MouseEvent) => {
    if (!resizeInfo) return;

    const {
      id,
      type,
      handle,
      originalX,
      originalY,
      originalWidth,
      originalHeight,
      originalMouseX,
      originalMouseY,
      originalScale // 👈 We'll need this
    } = resizeInfo;

    const dx = e.clientX - originalMouseX;
    const dy = e.clientY - originalMouseY;

    if (type === 'image') {
      const updateImages = (prev: UploadedImg[]) =>
        prev.map(img => {
          if (img.id !== id) return img;

          let newX = originalX, newY = originalY, newW = originalWidth, newH = originalHeight;

          // Horizontal handles
          if (handle.includes('l')) {
            newX = originalX + dx;
            newW = originalWidth - dx;
          } else if (handle.includes('r')) {
            newW = originalWidth + dx;
          }

          // Vertical handles
          if (handle.includes('t')) {
            newY = originalY + dy;
            newH = originalHeight - dy;
          } else if (handle.includes('b')) {
            newH = originalHeight + dy;
          }

          // Lock axis for side-only handles
          if (handle === 'l' || handle === 'r') {
            newY = originalY;
            newH = originalHeight;
          }
          if (handle === 't' || handle === 'b') {
            newX = originalX;
            newW = originalWidth;
          }

          // Prevent inverting
          if (newW < 20) newW = 20;
          if (newH < 20) newH = 20;

          return { ...img, x: newX, y: newY, width: newW, height: newH };
        });

      if (isViewingBack) {
        setBackUploadedImages(updateImages);
      } else {
        setFrontUploadedImages(updateImages);
      }
    } else { // type === 'text'
      const updateText = (prev: TextEl[]) =>
        prev.map(txt => {
          if (txt.id !== id) return txt;

          let newX = originalX, newY = originalY;
          let newW = originalWidth, newH = originalHeight;

          // Get new dimensions *as if* it were an image
          if (handle.includes('l')) {
            newX = originalX + dx;
            newW = originalWidth - dx;
          } else if (handle.includes('r')) {
            newW = originalWidth + dx;
          }
          if (handle.includes('t')) {
            newY = originalY + dy;
            newH = originalHeight - dy;
          } else if (handle.includes('b')) {
            newH = originalHeight + dy;
          }

          // Calculate a *proportional* scale delta.
          // We'll use the horizontal change as the main driver.
          const widthScaleDelta = newW / originalWidth;
          let newScale = originalScale * widthScaleDelta;

          if (newScale < 0.1) newScale = 0.1;

          // Apply new X/Y only if the handle implies it
          // (e.g., dragging 'tl' moves X/Y, 'br' does not)
          const finalX = (handle.includes('l')) ? newX : originalX;
          const finalY = (handle.includes('t')) ? newY : originalY;

          return { ...txt, scale: newScale, x: finalX, y: finalY };
        });

      if (isViewingBack) {
        setBackTextElements(updateText);
      } else {
        setFrontTextElements(updateText);
      }
    }
  };

  // 👇 ADD THIS NEW FUNCTION
  const handleResizeEnd = () => {
    setResizeInfo(null);
  };

  const handleTextColorChange = (newColor: string) => {
    if (!selectedTextId) return;

    const updateColor = (elements: TextEl[]) =>
      elements.map(text =>
        text.id === selectedTextId ? { ...text, color: newColor } : text
      );

    if (isViewingBack) {
      setBackTextElements(updateColor);
    } else {
      setFrontTextElements(updateColor);
    }
  };

  const selectedTextElement = currentTextElements.find(el => el.id === selectedTextId);

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
            {/* --- 👇 ADD THIS BLOCK: Image Thumbnail --- */}
            {chatImage && (
              <div className="relative w-20 h-20 mb-2 rounded-md overflow-hidden">
                <img src={chatImage} alt="Upload preview" className="w-full h-full object-cover" />
                <button
                  onClick={() => setChatImage(null)}
                  className="absolute top-0 right-0 w-5 h-5 bg-black/70 text-white rounded-full flex items-center justify-center text-xs"
                >
                  &times;
                </button>
              </div>
            )}
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
              <button
                onClick={() => chatFileInputRef.current?.click()}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white transition">
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
              <input
                type="file"
                ref={chatFileInputRef}
                onChange={handleChatImageUpload}
                accept="image/*"
                className="hidden"
              />
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
                if (resizeInfo) {
                  handleResize(e);
                } else {
                  handleTextDrag(e);
                  handleImageDrag(e);
                }
              }}
              onMouseUp={() => {
                handleTextDragEnd();
                handleImageDragEnd();
                handleResizeEnd();
              }}
              onMouseLeave={() => { // 👈 ADD THIS
                handleTextDragEnd();
                handleImageDragEnd();
                handleResizeEnd();
              }}
              onClick={() => {
                setSelectedTextId(null);
                setSelectedImageId(null); // 👈 ADD THIS
                setEditingTextId(null);
              }}
            >
              {/* Canvas content */}
              {/* Canvas content */}
              {/* CANVAS */}
              <div
                ref={canvasRef}
                className="w-full h-full relative"
                style={{ backgroundColor: "transparent" }}   // VERY IMPORTANT FIX
              >
                {/* -------------------------------------------------- */}
                {/* LAYER 1 — COLOR THAT GETS MASKED (like <div class="color">) */}
                {/* -------------------------------------------------- */}
                {selectedProductImage && (
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundColor: productColor,

                      // Mask to shirt shape — uses SAME PNG you used in HTML
                      maskImage: `url("${selectedProductImage}")`,
                      WebkitMaskImage: `url("${selectedProductImage}")`,

                      maskSize: "contain",
                      WebkitMaskSize: "contain",

                      maskRepeat: "no-repeat",
                      WebkitMaskRepeat: "no-repeat",

                      maskPosition: "center",
                      WebkitMaskPosition: "center",

                      mixBlendMode: "multiply",
                      zIndex: 1,
                    }}
                  />
                )}

                {/* -------------------------------------------------- */}
                {/* LAYER 2 — SHIRT PNG (same as img-2 / shirt.png) */}
                {/* -------------------------------------------------- */}
                {selectedProductImage && (
                  <Image
                    src={selectedProductImage}
                    alt="Shirt Overlay"
                    fill
                    unoptimized
                    className="absolute inset-0 object-contain"
                    style={{
                      mixBlendMode: "multiply",     // identical to HTML
                      backgroundColor: "transparent", // FIX white halo issue
                      zIndex: 2,
                    }}
                  />
                )}

                {/* -------------------------------------------------- */}
                {/* LAYER 3 — UPLOADED IMAGES */}
                {/* -------------------------------------------------- */}
                {currentUploadedImages.map((img) => {
                  const isSelected = selectedImageId === img.id; // 👈 Check for selection
                  return (
                    <div
                      key={img.id}
                      data-element-id={img.id} // 👈 ADD: Data attribute
                      className="absolute group" // Remove cursor-move
                      style={{
                        left: `${img.x}px`,
                        top: `${img.y}px`,
                        width: `${img.width}px`,   // 👈 SET WIDTH
                        height: `${img.height}px`, // 👈 SET HEIGHT
                        zIndex: 3,
                        // Add border if selected
                        border: isSelected ? '1px dashed #007AFF' : '1px dashed transparent',
                      }}
                      onClick={(e) => { // 👈 ADD: Select on click
                        e.stopPropagation();
                        setSelectedImageId(img.id);
                        setSelectedTextId(null);
                      }}
                    >
                      <img
                        src={img.src}
                        alt=""
                        draggable={false}
                        className="w-full h-full cursor-move" // 👈 Add cursor-move here
                        style={{
                          objectFit: 'contain',
                        }}
                        onMouseDown={(e) => { // 👈 This is for DRAGGING
                          e.stopPropagation();
                          handleImageDragStart(e, img.id);
                          setSelectedImageId(img.id);
                          setSelectedTextId(null);
                        }}
                      />
                      <button
                        onClick={() => handleDeleteImage(img.id)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 z-10" // 👈 Add z-10
                      >
                        ×
                      </button>

                      {/* --- 👇 ADD RESIZE HANDLES --- */}
                      {/* --- 👇 ADD RESIZE HANDLES --- */}
                      {isSelected && (
                        <>
                          {/* --- Corners --- */}
                          <div
                            onMouseDown={(e) => handleResizeStart(e, img.id, 'image', 'tl')}
                            className="absolute -left-1 -top-1 w-3 h-3 bg-white border border-black cursor-nwse-resize z-10"
                          />
                          <div
                            onMouseDown={(e) => handleResizeStart(e, img.id, 'image', 'tr')}
                            className="absolute -right-1 -top-1 w-3 h-3 bg-white border border-black cursor-nesw-resize z-10"
                          />
                          <div
                            onMouseDown={(e) => handleResizeStart(e, img.id, 'image', 'bl')}
                            className="absolute -left-1 -bottom-1 w-3 h-3 bg-white border border-black cursor-nesw-resize z-10"
                          />
                          <div
                            onMouseDown={(e) => handleResizeStart(e, img.id, 'image', 'br')}
                            className="absolute -right-1 -bottom-1 w-3 h-3 bg-white border border-black cursor-nwse-resize z-10"
                          />

                          {/* --- 👇 ADD THESE 4 NEW HANDLES --- */}
                          {/* --- Sides --- */}
                          <div
                            onMouseDown={(e) => handleResizeStart(e, img.id, 'image', 't')}
                            className="absolute left-1/2 -top-1 w-3 h-3 -translate-x-1/2 bg-white border border-black cursor-ns-resize z-10"
                          />
                          <div
                            onMouseDown={(e) => handleResizeStart(e, img.id, 'image', 'b')}
                            className="absolute left-1/2 -bottom-1 w-3 h-3 -translate-x-1/2 bg-white border border-black cursor-ns-resize z-10"
                          />
                          <div
                            onMouseDown={(e) => handleResizeStart(e, img.id, 'image', 'l')}
                            className="absolute -left-1 top-1/2 w-3 h-3 -translate-y-1/2 bg-white border border-black cursor-ew-resize z-10"
                          />
                          <div
                            onMouseDown={(e) => handleResizeStart(e, img.id, 'image', 'r')}
                            className="absolute -right-1 top-1/2 w-3 h-3 -translate-y-1/2 bg-white border border-black cursor-ew-resize z-10"
                          />
                        </>
                      )}
                    </div>
                  );
                })}

                {/* -------------------------------------------------- */}
                {/* LAYER 4 — TEXT */}
                {/* -------------------------------------------------- */}
                {currentTextElements.map((textEl) => {
                  const isSelected = selectedTextId === textEl.id;
                  const scaledFontSize = textEl.fontSize * textEl.scale; // 👈 Calculate scaled size

                  return (
                    <div
                      key={textEl.id}
                      data-element-id={textEl.id} // 👈 ADD: Data attribute
                      className="absolute group"
                      style={{
                        left: `${textEl.x}px`,
                        top: `${textEl.y}px`,
                        zIndex: 4,
                        border:
                          isSelected && editingTextId !== textEl.id // 👈 Don't show box when editing
                            ? '1px dashed #007AFF'
                            : '1px dashed transparent',
                        padding: 2,
                        lineHeight: 1, // 👈 ADD: Prevents layout shifts
                      }}
                      onMouseDown={(e) => { // This is for DRAGGING
                        if (editingTextId) return;
                        e.stopPropagation();

                        // NEW LOGIC: If already selected, enter edit mode.
                        if (selectedTextId === textEl.id) {
                          setEditingTextId(textEl.id);
                          // We don't drag if we're entering edit mode.
                        } else {
                          // Otherwise, select it and start dragging.
                          handleTextDragStart(e, textEl.id);
                          setSelectedTextId(textEl.id);
                          setSelectedImageId(null);
                        }
                      }}
                      onDoubleClick={() => {
                        setEditingTextId(textEl.id);
                        setSelectedTextId(textEl.id);
                        setSelectedImageId(null);
                      }}
                    >
                      {/* THIS IS THE NEW CODE */}
                      {editingTextId === textEl.id ? (
                        <input
                          type="text"
                          value={textEl.text}
                          onChange={(e) => handleTextChange(textEl.id, e.target.value)}
                          onBlur={() => setEditingTextId(null)}
                          autoFocus
                          className="bg-transparent border-none outline-none" // 👈 NEW
                          style={{
                            fontSize: scaledFontSize,
                            fontFamily: textEl.fontFamily,
                            fontWeight: textEl.fontWeight,
                            fontStyle: textEl.fontStyle,
                            color: textEl.color, // 👈 ADDED
                          }}
                        />
                      ) : (
                        <span
                          className="select-none whitespace-nowrap cursor-move" // 👈 NEW
                          style={{
                            fontSize: scaledFontSize,
                            fontFamily: textEl.fontFamily,
                            fontWeight: textEl.fontWeight,
                            fontStyle: textEl.fontStyle,
                            color: textEl.color, // 👈 ADDED
                          }}
                        >
                          {textEl.text}
                        </span>
                      )}
                      {/* END OF NEW CODE */}

                      {/* --- 👇 ADD RESIZE HANDLES (only when selected and not editing) --- */}
                      {isSelected && editingTextId !== textEl.id && (
                        <>
                          {/* Note: We use 'br' logic for all corners for text scaling */}
                          {/* Top-Left */}
                          <div
                            onMouseDown={(e) => handleResizeStart(e, textEl.id, 'text', 'tl')}
                            className="absolute -left-1 -top-1 w-3 h-3 bg-white border border-black cursor-nwse-resize z-10"
                          />
                          {/* Top-Right */}
                          <div
                            onMouseDown={(e) => handleResizeStart(e, textEl.id, 'text', 'tr')}
                            className="absolute -right-1 -top-1 w-3 h-3 bg-white border border-black cursor-nesw-resize z-10"
                          />
                          {/* Bottom-Left */}
                          <div
                            onMouseDown={(e) => handleResizeStart(e, textEl.id, 'text', 'bl')}
                            className="absolute -left-1 -bottom-1 w-3 h-3 bg-white border border-black cursor-nesw-resize z-10"
                          />
                          {/* Bottom-Right */}
                          <div
                            onMouseDown={(e) => handleResizeStart(e, textEl.id, 'text', 'br')}
                            className="absolute -right-1 -bottom-1 w-3 h-3 bg-white border border-black cursor-nwse-resize z-10"
                          />
                        </>
                      )}
                    </div>
                  );
                })}
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
          <h2 className="text-5xl font-light leading-tight">
            Design tools
          </h2>

          {/* Tool buttons */}
          <div className="flex flex-col gap-3">
            {/* Add Text button */}
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

            {/* --- 👇 ADD THIS ENTIRE BLOCK --- */}
            {/* --- START: NEW TEXT EDITOR UI --- */}
            {/* --- START: NEW TEXT EDITOR UI --- */}
            {/* --- START: MOVED AND UPDATED TEXT EDITOR UI --- */}
            {selectedTextElement && (
              <div className="pt-2 pl-4 space-y-3 border-l-2 border-blue-500 ml-4"> {/* 👈 CHANGED */}

                {/* Font Size Input (Type changed to "text") */}
                <div>
                  <label className="block text-xs text-white/70 mb-1">Size (px)</label> {/* 👈 CHANGED */}
                  <input
                    type="text" // Changed from "number"
                    value={selectedTextElement.fontSize}
                    onChange={(e) => handleTextSizeChange(selectedTextElement.id, e.target.value)}
                    className="w-full px-3 py-2 bg-black border border-white/20 rounded-lg text-white text-sm"
                  />
                </div>

                {/* Font Family Dropdown */}
                <div>
                  <label className="block text-xs text-white/70 mb-1">Font</label> {/* 👈 CHANGED */}
                  <select
                    value={selectedTextElement.fontFamily}
                    onChange={(e) => handleTextFontChange(selectedTextElement.id, e.target.value)}
                    
                    className="w-full px-3 py-2 bg-black border border-white/20 rounded-lg text-white text-sm" 
                  >
                    {FONT_OPTIONS.map(font => (
                      <option key={font} value={font} style={{ fontFamily: font, color: 'black' }}>
                        {font}
                      </option>
                    ))}
                  </select>
                </div>

                {/* --- START: NEW BOLD/ITALIC BUTTONS --- */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggleBold(selectedTextElement.id)}
                    className={`flex-1 px-3 py-1.5 rounded-lg border text-sm ${selectedTextElement.fontWeight === 'bold' // 👈 CHANGED
                      ? 'bg-white text-black border-white'
                      : 'bg-black border-white/20 text-white'
                      } transition`}
                  >
                    Bold
                  </button>
                  <button
                    onClick={() => handleToggleItalic(selectedTextElement.id)}
                    className={`flex-1 px-3 py-1.5 rounded-lg border text-sm ${selectedTextElement.fontStyle === 'italic' // 👈 CHANGED
                      ? 'bg-white text-black border-white'
                      : 'bg-black border-white/20 text-white'
                      } transition`}
                  >
                    Italic
                  </button>
                </div>
                {/* --- END: NEW BOLD/ITALIC BUTTONS --- */}
                {/* --- 👇 ADD THIS NEW COLOR SECTION --- */}
                <div>
                  <label className="block text-xs text-white/70 mb-1">Color</label>
                  <button
                    onClick={() => setShowTextColorPicker(prev => !prev)}
                    className="w-full h-10 rounded-lg border border-white/20"
                    style={{ backgroundColor: selectedTextElement.color }}
                  />
                </div>
                {showTextColorPicker && (
                  <HexColorPicker
                    color={selectedTextElement.color}
                    onChange={handleTextColorChange}
                    style={{ width: '100%' }}
                  />
                )}

              </div>
            )}
            {/* --- END: TEXT EDITOR UI --- */}


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
            {/* Edit Color button */}
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="flex items-center gap-4 rounded-lg bg-black border border-white/20 px-6 py-4 hover:bg-white/10 transition"
            >
              <div
                className="w-10 h-10 rounded-md border border-white/50"
                style={{ backgroundColor: productColor }}
              />
              <span className="text-white text-lg">Edit Color</span>
            </button>

            {/* NEW Color Picker component */}
            {/* NEW Color Picker component */}
            {showColorPicker && (
              <div className="pt-4"> {/* Added a wrapper for padding */}
                <HexColorPicker
                  color={productColor}
                  onChange={setProductColor}
                  style={{ width: '100%' }} // Makes it fill the container
                />
              </div>
            )}

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
              className="w-full rounded-xl bg-black border border-white/20 px-5 py-3 text-white text-base font-medium hover:bg-white/10 transition" // 👈 CHANGED
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
