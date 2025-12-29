'use client'
import type React from 'react'
import { toPng } from 'html-to-image'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useRef, useEffect, useLayoutEffect, Suspense } from 'react'
import Image from 'next/image'
import axios from 'axios'
import { HexColorPicker } from 'react-colorful'
import { db } from '@/lib/db'
type UploadedImg = {
  id: number
  src: string
  // legacy pixel values (still updated, but normalized is the source of truth)
  x: number
  y: number
  width: number
  height: number
  rotation: number
  // normalized coordinates (0–1, relative to the canvas)
  nx?: number // fraction of canvas width from left
  ny?: number // fraction of canvas height from top
  nWidth?: number // fraction of canvas width
  nHeight?: number // fraction of canvas height
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
  rotation: number
  // normalized coordinates (0–1, relative to the canvas)
  nx?: number // fraction of canvas width from left
  ny?: number // fraction of canvas height from top
  nFontSize?: number // font size as a fraction of canvas width
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
  productColor: string
  frontMask: string | null
  backMask: string | null
}
// 🔑 Shared with /chat-box so both use the same AI session
const SESSION_ID_KEY = 'aiChat_sessionId'
// Local meta key just for frontend TTL checks (safe to keep asset-chat specific)
const ASSET_SESSION_META_KEY = 'assetChat_sessionMeta'
// Match backend TTL (24 hours)
const SESSION_TTL_MS = 24 * 60 * 60 * 1000
// Fixed snapshot size for order-quantity page
const SNAPSHOT_SIZE = 800
const BASE_SIZE = 800
type AssetSessionMeta = {
  id: string
  createdAt: string
  updatedAt: string
  lastAssetPath?: string | null
  lastAssetUrl?: string | null
}
type ChatMessage = {
  role: 'user' | 'assistant'
  text: string
  imageUrl?: string
}
function DesignPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  // Chat state (message is the input for the AI, not email)
  const [message, setMessage] = useState('')
  const [loadingAI, setLoadingAI] = useState(false)
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [backendHistory, setBackendHistory] = useState<ChatMessage[]>([])
  const [chatImage, setChatImage] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const smoothScrollNextRef = useRef(false)
  // Asset session id for this product
  const [assetSessionId, setAssetSessionId] = useState<string | null>(null)
  // Small helper: get a valid (non-expired) AI chat session id (global / legacy).
  const getOrCreateSessionId = (): string | null => {
    if (typeof window === 'undefined') return null
    const rawMeta = window.localStorage.getItem(ASSET_SESSION_META_KEY)
    if (rawMeta) {
      try {
        const meta = JSON.parse(rawMeta) as AssetSessionMeta
        if (!meta.id || !meta.createdAt) {
          window.localStorage.removeItem(ASSET_SESSION_META_KEY)
        } else {
          const createdAtMs = new Date(meta.createdAt).getTime()
          if (!Number.isNaN(createdAtMs)) {
            const age = Date.now() - createdAtMs
            if (age <= SESSION_TTL_MS) {
              // ✅ Within TTL → reuse id
              return meta.id
            }
          }
          // ❌ Expired or invalid → clear both meta + shared id
          window.localStorage.removeItem(ASSET_SESSION_META_KEY)
          window.localStorage.removeItem(SESSION_ID_KEY)
        }
      } catch {
        window.localStorage.removeItem(ASSET_SESSION_META_KEY)
      }
    }
    // Fallback: if /chat-box already wrote a plain id, reuse it (no TTL yet).
    const legacyId = window.localStorage.getItem(SESSION_ID_KEY)
    if (legacyId && legacyId.trim().length > 0) {
      return legacyId.trim()
    }
    // No existing session → let backend create one (send no sessionId)
    return null
  }
  // Email modal state
  const [isSending, setIsSending] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [showEmailForm, setShowEmailForm] = useState(false)
  const [email, setEmail] = useState('')
  // Design elements
  const [frontUploadedImages, setFrontUploadedImages] = useState<UploadedImg[]>([])
  const [backUploadedImages, setBackUploadedImages] = useState<UploadedImg[]>([])
  const [frontTextElements, setFrontTextElements] = useState<TextEl[]>([])
  const [backTextElements, setBackTextElements] = useState<TextEl[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [draggedTextId, setDraggedTextId] = useState<number | null>(null)
  const [draggedImageId, setDraggedImageId] = useState<number | null>(null)
  const [editingTextId, setEditingTextId] = useState<number | null>(null)
  const [selectedTextId, setSelectedTextId] = useState<number | null>(null)
  const [selectedImageId, setSelectedImageId] = useState<number | null>(null)
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null)
  // Product / canvas
  const [selectedProductImage, setSelectedProductImage] = useState<string | null>(null)
  const [selectedProductName, setSelectedProductName] = useState<string>('Product')
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [hasLoadedDesignData, setHasLoadedDesignData] = useState(false)
  const [selectedProductCategory, setSelectedProductCategory] = useState<string>('')
  const [isViewingBack, setIsViewingBack] = useState(false)
  const [frontImage, setFrontImage] = useState<string | null>(null)
  const [backImage, setBackImage] = useState<string | null>(null)
  const [hasBackImage, setHasBackImage] = useState(false)
  const [productColor, setProductColor] = useState('#FFFFFF')
  const [productMask, setProductMask] = useState<string | null>(null)
  const [frontMask, setFrontMask] = useState<string | null>(null)
  const [backMask, setBackMask] = useState<string | null>(null)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showTextColorPicker, setShowTextColorPicker] = useState(false)
  // Canvas refs
  const canvasRef = useRef<HTMLDivElement>(null)
  const hiddenCanvasRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatFileInputRef = useRef<HTMLInputElement>(null)
  const canvasWrapperRef = useRef<HTMLDivElement>(null)
  const [artboardScale, setArtboardScale] = useState(1)

  // Fixed-size hidden canvases for front/back snapshots
  const frontSnapshotRef = useRef<HTMLDivElement>(null)
  const backSnapshotRef = useRef<HTMLDivElement>(null)
  // Track canvas size so we can convert between pixels and normalized coordinates
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
  const getCurrentCanvasSize = () => {
    return { width: BASE_SIZE, height: BASE_SIZE }
  }
  // Ensure an image has normalized fields, using a known "base" canvas size
  const withNormalizedFromBase = (
    img: UploadedImg,
    baseWidth?: number,
    baseHeight?: number,
  ): UploadedImg => {
    const width = baseWidth || getCurrentCanvasSize().width
    const height = baseHeight || getCurrentCanvasSize().height
    if (!width || !height) return img
    if (
      img.nx != null &&
      img.ny != null &&
      img.nWidth != null &&
      img.nHeight != null
    ) {
      return img
    }
    return {
      ...img,
      nx: img.x / width,
      ny: img.y / height,
      nWidth: img.width / width,
      nHeight: img.height / height,
    }
  }
  const getArtboardCoordsFromEvent = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return null
    // rect.width already includes the transform scale
    const scale = rect.width / BASE_SIZE
    if (!scale) return null
    const x = (e.clientX - rect.left) / scale
    const y = (e.clientY - rect.top) / scale
    return { x, y, scale }
  }
  // Convert normalized coordinates → pixels, for a given target size (or current canvas)
  const normalizedToPixels = (
    img: UploadedImg,
    targetWidth?: number,
    targetHeight?: number,
  ) => {
    const base =
      targetWidth && targetHeight
        ? { width: targetWidth, height: targetHeight }
        : { width: BASE_SIZE, height: BASE_SIZE } // <— changed
    const width = base.width
    const height = base.height
    if (
      img.nx != null &&
      img.ny != null &&
      img.nWidth != null &&
      img.nHeight != null
    ) {
      return {
        x: img.nx * width,
        y: img.ny * height,
        width: img.nWidth * width,
        height: img.nHeight * height,
      }
    }
    return {
      x: img.x,
      y: img.y,
      width: img.width,
      height: img.height,
    }
  }
  // Factory for new images that sets both pixel and normalized coordinates
  const createUploadedImage = (
    src: string,
    xPx: number,
    yPx: number,
    widthPx: number,
    heightPx: number,
  ): UploadedImg => {
    const { width, height } = getCurrentCanvasSize()
    const canvasW = width || 500
    const canvasH = height || 500
    return {
      id: Date.now() + Math.random(),
      src,
      x: xPx,
      y: yPx,
      width: widthPx,
      height: heightPx,
      rotation: 0,
      nx: xPx / canvasW,
      ny: yPx / canvasH,
      nWidth: widthPx / canvasW,
      nHeight: heightPx / canvasH,
    }
  }
  // Ensure a text element has normalized fields, using the canvas size it was
  // originally created/saved with (baseWidth/Height).
  const withNormalizedTextFromBase = (
    txt: TextEl,
    baseWidth?: number,
    baseHeight?: number,
  ): TextEl => {
    // baseWidth / baseHeight should be the design's canvasWidth / canvasHeight
    // that we saved in localStorage when the design was created.
    const width = baseWidth || 500
    const height = baseHeight || 500
    if (!width || !height) return txt
    // Already normalized → just return it
    if (txt.nx != null && txt.ny != null && txt.nFontSize != null) {
      return txt
    }
    return {
      ...txt,
      nx: txt.x / width,
      ny: txt.y / height,
      nFontSize: txt.fontSize / width,
    }
  }
  // Convert normalized text → pixel coordinates (and font size)
  // for a given target canvas size.
  const normalizedTextToPixels = (
    txt: TextEl,
    targetWidth?: number,
    targetHeight?: number,
  ) => {
    let width: number
    let height: number
    if (targetWidth && targetHeight) {
      width = targetWidth
      height = targetHeight
    } else {
      width = BASE_SIZE
      height = BASE_SIZE
    }
    if (txt.nx != null && txt.ny != null && txt.nFontSize != null) {
      return {
        x: txt.nx * width,
        y: txt.ny * height,
        fontSize: txt.nFontSize * width,
      }
    }
    return {
      x: txt.x,
      y: txt.y,
      fontSize: txt.fontSize,
    }
  }
  // Factory for new text elements that sets both pixel and normalized coordinates
  // Factory for new text elements that sets both pixel and normalized coordinates
  const createTextElement = (text: string, xPx: number, yPx: number, fontSizePx: number): TextEl => {
    const canvasW = BASE_SIZE
    const canvasH = BASE_SIZE
    return {
      id: Date.now(),
      text,
      x: xPx,
      y: yPx,
      fontSize: fontSizePx,
      fontFamily: 'Arial',
      fontWeight: 'normal',
      fontStyle: 'normal',
      scale: 1,
      color: '#000000',
      rotation: 0,
      nx: xPx / canvasW,
      ny: yPx / canvasH,
      nFontSize: fontSizePx / canvasW,
    }
  }
  // Resize / rotate state
  const [resizeInfo, setResizeInfo] = useState<{
    id: number
    type: 'image' | 'text'
    handle: 'tl' | 'tr' | 'bl' | 'br' | 't' | 'b' | 'l' | 'r'
    originalX: number
    originalY: number
    originalWidth: number
    originalHeight: number
    originalMouseX: number
    originalMouseY: number
    originalScale: number
  } | null>(null)
  const [rotateInfo, setRotateInfo] = useState<{
    id: number
    type: 'image' | 'text'
    centerX: number
    centerY: number
    startAngle: number
  } | null>(null)
  const FONT_OPTIONS = [
    'Arial',
    'Verdana',
    'Helvetica',
    'Times New Roman',
    'Georgia',
    'Impact',
    'Courier New',
  ]
  // Switch between front & back arrays
  const currentUploadedImages = isViewingBack ? backUploadedImages : frontUploadedImages
  const currentTextElements = isViewingBack ? backTextElements : frontTextElements
  // Track canvas size via ResizeObserver
  // Track wrapper size and compute scale for the fixed artboard
  useLayoutEffect(() => {
    const node = canvasWrapperRef.current
    if (!node) return
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return
      const { width, height } = entry.contentRect
      const minDim = Math.min(width, height)
      if (!minDim || minDim < 50) return
      const next = Math.min(minDim / BASE_SIZE, 1)
      setArtboardScale((prev) => (Math.abs(prev - next) < 0.001 ? prev : next))
    })
    ro.observe(node)
    return () => ro.disconnect()
  }, [])
  // Scroll chat to bottom on new message
  // Scroll chat panel to bottom on new message (does NOT scroll the whole page)
  useEffect(() => {
    const el = chatScrollRef.current
    if (!el) return

    const behavior: ScrollBehavior = smoothScrollNextRef.current ? 'smooth' : 'auto'
    el.scrollTo({ top: el.scrollHeight, behavior })

    smoothScrollNextRef.current = false
  }, [chatHistory])
  // 📦 Restore asset session per product on mount / product change
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!selectedProductId) return
    const perProductKey = `asset_session_${selectedProductId}`
    const savedSessionId = window.localStorage.getItem(perProductKey)
    if (!savedSessionId) return
    setAssetSessionId(savedSessionId)
      ; (async () => {
        try {
          const apiBase = process.env.NEXT_PUBLIC_API_URL ?? ''
          console.log('[Design] restoreAssetSession URL:', apiBase)
          const res = await fetch(
            `${apiBase}/api/asset-session?sessionId=${encodeURIComponent(savedSessionId)}`,
          )
          const data = await res.json()
          if (data.error) {
            console.error('Failed to restore asset session:', data.error)
            return
          }
          if (data.history) {
            setBackendHistory(data.history)
          }
          if (Array.isArray(data.history)) {
            const uiHistory: ChatMessage[] = data.history
              .filter(
                (msg: any) =>
                  msg.role === 'user' ||
                  msg.role === 'assistant' ||
                  msg.role === 'model',
              )
              .map((msg: any) => {
                const role: 'user' | 'assistant' =
                  msg.role === 'user' ? 'user' : 'assistant'
                return {
                  role,
                  text: msg.text || (msg.imageUrl ? '[image]' : ''),
                  imageUrl: msg.imageUrl ?? undefined,
                }
              })
            setChatHistory(uiHistory)
            setBackendHistory(data.history as ChatMessage[])
          }
        } catch (err) {
          console.error('Error restoring asset session:', err)
        }
      })()
  }, [selectedProductId])
  // Load design (and rehydrate images from IndexedDB) from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    // 🔑 Use cartItemId if present, otherwise fall back to productId
    const storageId = searchParams.get('cartItemId') || searchParams.get('productId')
    if (!storageId) return
    const designKey = `designData_${storageId}`
    const loadData = async () => {
      const rawDesign = localStorage.getItem(designKey)
      if (rawDesign) {
        try {
          const d: DesignData = JSON.parse(rawDesign)
          const rehydrate = async (imgs: any[]) => {
            if (!imgs) return []
            return Promise.all(
              imgs.map(async (img) => {
                if (img.src === 'INDEXED_DB_ASSET') {
                  const asset = await db.cartAssets.get(String(img.id))
                  return { ...img, src: asset?.base64 || '' }
                }
                return img
              }),
            )
          }
          const realFrontImages = await rehydrate(d.frontUploadedImages || [])
          const realBackImages = await rehydrate(d.backUploadedImages || [])
          const baseW = d.canvasWidth || 500
          const baseH = d.canvasHeight || 500
          setSelectedProductImage(d.productImage)
          setFrontUploadedImages(
            realFrontImages.map((img) => withNormalizedFromBase(img, baseW, baseH)),
          )
          setBackUploadedImages(
            realBackImages.map((img) => withNormalizedFromBase(img, baseW, baseH)),
          )
          setFrontTextElements(
            (d.frontTextElements || []).map((t) =>
              withNormalizedTextFromBase(t, baseW, baseH),
            ),
          )
          setBackTextElements(
            (d.backTextElements || []).map((t) =>
              withNormalizedTextFromBase(t, baseW, baseH),
            ),
          )
          setIsViewingBack(d.isViewingBack || false)
          setProductColor(d.productColor || '#FFFFFF')
          setFrontMask(d.frontMask || null)
          setBackMask(d.backMask || null)
          if (d.selectedProductName) setSelectedProductName(d.selectedProductName)
          // 🔑 Ensure selectedProductId is always set, even if old data didn’t store it
          setSelectedProductId(d.selectedProductId || storageId)
          if (d.selectedProductCategory) setSelectedProductCategory(d.selectedProductCategory)
          // ✅ We’ve loaded a full design from localStorage
          setHasLoadedDesignData(true)
        } catch (err) {
          console.warn('Failed to load designData:', err)
        }
      }
    }
    loadData()
  }, [searchParams])
  // Load product data from URL params
  useEffect(() => {
    const storageId = searchParams.get('cartItemId') || searchParams.get('productId')
    const productImageParam = searchParams.get('productImage')
    const productName = searchParams.get('productName')
    const productCategory = searchParams.get('productCategory')
    if (storageId) setSelectedProductId(storageId)
    if (productName) setSelectedProductName(decodeURIComponent(productName))
    if (productCategory) setSelectedProductCategory(decodeURIComponent(productCategory))
    // ✅ Always ensure the base shirt is present (even if designData was loaded)
    if (productImageParam) {
      const decodedFront = decodeURIComponent(productImageParam)
      // Ensure front is set
      setFrontImage((prev) => prev ?? decodedFront)
      setSelectedProductImage((prev) => prev ?? decodedFront)
      const frontMaskPath = decodedFront.replace('.png', '_mask.png')
      setFrontMask((prev) => prev ?? frontMaskPath)
      setProductMask((prev) => prev ?? frontMaskPath)
      // Probe back side
      const backImagePath = decodedFront.replace('.png', ' back.png')
      const backMaskPath = decodedFront.replace('.png', '_back_mask.png')
      const img = new window.Image()
      img.onload = () => {
        setHasBackImage(true)
        setBackImage(backImagePath)
        setBackMask(backMaskPath)
      }
      img.onerror = () => {
        setHasBackImage(false)
        setBackImage(null)
        setBackMask(null)
      }
      img.src = backImagePath
    }
  }, [searchParams])
  // Toggle front/back
  const toggleFrontBack = () => {
    if (isViewingBack) {
      setSelectedProductImage(frontImage)
      setProductMask(frontMask)
      setIsViewingBack(false)
    } else {
      setSelectedProductImage(backImage)
      setProductMask(backMask)
      setIsViewingBack(true)
    }
  }
  useEffect(() => {
    if (isViewingBack) {
      setSelectedProductImage(backImage || null)
      setProductMask(backMask || null)
    } else {
      setSelectedProductImage(frontImage || null)
      setProductMask(frontMask || null)
    }
  }, [isViewingBack, frontImage, backImage, frontMask, backMask])
  // Text handlers
  const handleTextSizeChange = (id: number, newSize: string) => {
    const size = parseInt(newSize, 10)
    const finalSize = isNaN(size) ? 0 : size
    const { width } = getCurrentCanvasSize()
    const canvasW = width || 500
    const update = (elements: TextEl[]) =>
      elements.map((t) =>
        t.id === id
          ? {
            ...t,
            fontSize: finalSize,
            nFontSize: finalSize / canvasW,
          }
          : t,
      )
    if (isViewingBack) setBackTextElements(update)
    else setFrontTextElements(update)
  }
  const handleToggleBold = (id: number) => {
    const toggle = (elements: TextEl[]) =>
      elements.map((t) =>
        t.id === id ? { ...t, fontWeight: t.fontWeight === 'bold' ? 'normal' : 'bold' } : t,
      )
    if (isViewingBack) setBackTextElements(toggle)
    else setFrontTextElements(toggle)
  }
  const handleToggleItalic = (id: number) => {
    const toggle = (elements: TextEl[]) =>
      elements.map((t) =>
        t.id === id ? { ...t, fontStyle: t.fontStyle === 'italic' ? 'normal' : 'italic' } : t,
      )
    if (isViewingBack) setBackTextElements(toggle)
    else setFrontTextElements(toggle)
  }
  const handleTextFontChange = (id: number, newFont: string) => {
    const update = (elements: TextEl[]) =>
      elements.map((t) => (t.id === id ? { ...t, fontFamily: newFont } : t))
    if (isViewingBack) setBackTextElements(update)
    else setFrontTextElements(update)
  }
  const handleTextDragStart = (e: React.MouseEvent, id: number) => {
    const text = (isViewingBack ? backTextElements : frontTextElements).find((t) => t.id === id)
    const coords = getArtboardCoordsFromEvent(e)
    if (!text || !coords) return
    const { x, y } = normalizedTextToPixels(text) // artboard coords
    setDraggedTextId(id)
    setDragOffset({
      x: coords.x - x,
      y: coords.y - y,
    })
    e.preventDefault()
  }
  const handleTextDrag = (e: React.MouseEvent) => {
    if (draggedTextId === null || !dragOffset) return
    const coords = getArtboardCoordsFromEvent(e)
    if (!coords) return
    const xArt = coords.x - dragOffset.x
    const yArt = coords.y - dragOffset.y
    const update = (elements: TextEl[]) =>
      elements.map((t) => {
        if (t.id !== draggedTextId) return t
        const nx = xArt / BASE_SIZE
        const ny = yArt / BASE_SIZE
        return {
          ...t,
          x: xArt,
          y: yArt,
          nx,
          ny,
        }
      })
    if (isViewingBack) setBackTextElements(update)
    else setFrontTextElements(update)
  }
  const handleTextDragEnd = () => {
    setDraggedTextId(null)
    setDragOffset(null)
  }
  const handleTextChange = (id: number, newText: string) => {
    const update = (elements: TextEl[]) =>
      elements.map((t) => (t.id === id ? { ...t, text: newText } : t))
    if (isViewingBack) setBackTextElements(update)
    else setFrontTextElements(update)
  }
  const handleDeleteText = (id: number) => {
    const filter = (elements: TextEl[]) => elements.filter((t) => t.id !== id)
    if (isViewingBack) setBackTextElements(filter)
    else setFrontTextElements(filter)
  }
  // Image drag inside canvas
  const handleImageDragStart = (e: React.MouseEvent, id: number) => {
    const img = (isViewingBack ? backUploadedImages : frontUploadedImages).find((i) => i.id === id)
    const coords = getArtboardCoordsFromEvent(e)
    if (!img || !coords) return
    const { x, y } = normalizedToPixels(img) // artboard coords
    setDraggedImageId(id)
    setDragOffset({
      x: coords.x - x,
      y: coords.y - y,
    })
    e.preventDefault()
  }
  const handleImageDrag = (e: React.MouseEvent) => {
    if (draggedImageId === null || !dragOffset) return
    const coords = getArtboardCoordsFromEvent(e)
    if (!coords) return
    const xArt = coords.x - dragOffset.x
    const yArt = coords.y - dragOffset.y
    const update = (elements: UploadedImg[]) =>
      elements.map((img) => {
        if (img.id !== draggedImageId) return img
        const nx = xArt / BASE_SIZE
        const ny = yArt / BASE_SIZE
        return {
          ...img,
          x: xArt,
          y: yArt,
          nx,
          ny,
        }
      })
    if (isViewingBack) setBackUploadedImages(update)
    else setFrontUploadedImages(update)
  }
  const handleImageDragEnd = () => {
    setDraggedImageId(null)
    setDragOffset(null)
  }
  const handleDeleteImage = (id: number) => {
    const filter = (elements: UploadedImg[]) => elements.filter((img) => img.id !== id)
    if (isViewingBack) setBackUploadedImages(filter)
    else setFrontUploadedImages(filter)
  }
  // Resize handlers
  const handleResizeStart = (
    e: React.MouseEvent,
    id: number,
    type: 'image' | 'text',
    handle: 'tl' | 'tr' | 'bl' | 'br' | 't' | 'b' | 'l' | 'r',
  ) => {
    e.stopPropagation()
    e.preventDefault()
    const element =
      type === 'image'
        ? (isViewingBack ? backUploadedImages : frontUploadedImages).find((img) => img.id === id)
        : (isViewingBack ? backTextElements : frontTextElements).find((txt) => txt.id === id)
    if (!element) return
    const elNode = document.querySelector(`[data-element-id="${id}"]`) as HTMLElement | null
    const bounds = elNode?.getBoundingClientRect()
    if (type === 'image') {
      const img = element as UploadedImg
      const { x, y, width, height } = normalizedToPixels(img)
      setResizeInfo({
        id,
        type,
        handle,
        originalX: x,
        originalY: y,
        originalWidth: width || bounds?.width || 100,
        originalHeight: height || bounds?.height || 50,
        originalMouseX: e.clientX,
        originalMouseY: e.clientY,
        originalScale: 1,
      })
    } else {
      const txt = element as TextEl
      const { x, y } = normalizedTextToPixels(txt)
      setResizeInfo({
        id,
        type,
        handle,
        originalX: x,
        originalY: y,
        originalWidth: bounds?.width || 100,
        originalHeight: bounds?.height || 50,
        originalMouseX: e.clientX,
        originalMouseY: e.clientY,
        originalScale: txt.scale || 1,
      })
    }
  }
  const MIN_SIZE = 20
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))
  const handleResize = (e: React.MouseEvent) => {
    if (!resizeInfo) return
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
      originalScale,
    } = resizeInfo
    // Screen-space mouse delta
    const dxScreen = e.clientX - originalMouseX
    const dyScreen = e.clientY - originalMouseY
    // Convert screen deltas -> artboard deltas (because canvasRef is scaled visually)
    const rect = canvasRef.current?.getBoundingClientRect()
    const scale = rect ? rect.width / BASE_SIZE : 1
    const dx = dxScreen / (scale || 1)
    const dy = dyScreen / (scale || 1)
    if (type === 'image') {
      const updateImages = (prev: UploadedImg[]) =>
        prev.map((img) => {
          if (img.id !== id) return img
          let newX = originalX
          let newY = originalY
          let newW = originalWidth
          let newH = originalHeight
          // --- Resize in artboard space ---
          if (handle.includes('l')) {
            newX = originalX + dx
            newW = originalWidth - dx
          } else if (handle.includes('r')) {
            newW = originalWidth + dx
          }
          if (handle.includes('t')) {
            newY = originalY + dy
            newH = originalHeight - dy
          } else if (handle.includes('b')) {
            newH = originalHeight + dy
          }
          // Lock one axis for pure side handles
          if (handle === 'l' || handle === 'r') {
            newY = originalY
            newH = originalHeight
          }
          if (handle === 't' || handle === 'b') {
            newX = originalX
            newW = originalWidth
          }
          // --- Enforce minimum size, preserving the opposite edge ---
          if (newW < MIN_SIZE) {
            if (handle.includes('l')) newX = originalX + (originalWidth - MIN_SIZE)
            newW = MIN_SIZE
          }
          if (newH < MIN_SIZE) {
            if (handle.includes('t')) newY = originalY + (originalHeight - MIN_SIZE)
            newH = MIN_SIZE
          }
          // --- Keep inside the 800×800 artboard (optional but recommended) ---
          // Left/top bounds
          if (newX < 0) {
            if (handle.includes('l')) newW = newW + newX // shrink width by overshoot
            newX = 0
          }
          if (newY < 0) {
            if (handle.includes('t')) newH = newH + newY
            newY = 0
          }
          // Right/bottom bounds
          if (newX + newW > BASE_SIZE) {
            if (handle.includes('r')) newW = BASE_SIZE - newX
            else newX = BASE_SIZE - newW
          }
          if (newY + newH > BASE_SIZE) {
            if (handle.includes('b')) newH = BASE_SIZE - newY
            else newY = BASE_SIZE - newH
          }
          // Re-apply min after bounds corrections
          newW = Math.max(MIN_SIZE, newW)
          newH = Math.max(MIN_SIZE, newH)
          newX = clamp(newX, 0, BASE_SIZE - newW)
          newY = clamp(newY, 0, BASE_SIZE - newH)
          // --- Normalized values should be relative to BASE_SIZE (NOT rect.width) ---
          const nx = newX / BASE_SIZE
          const ny = newY / BASE_SIZE
          const nWidth = newW / BASE_SIZE
          const nHeight = newH / BASE_SIZE
          return {
            ...img,
            x: newX,
            y: newY,
            width: newW,
            height: newH,
            nx,
            ny,
            nWidth,
            nHeight,
          }
        })
      if (isViewingBack) setBackUploadedImages(updateImages)
      else setFrontUploadedImages(updateImages)
    } else {
      // Text resizing = scale adjust; use artboard delta so behavior is consistent at any zoom
      const updateText = (prev: TextEl[]) =>
        prev.map((txt) => {
          if (txt.id !== id) return txt
          // Use whichever delta “matters” for the active handle
          const delta =
            handle.includes('l') || handle.includes('r')
              ? dx
              : handle.includes('t') || handle.includes('b')
                ? dy
                : dx // fallback
          // Right/bottom grows, left/top shrinks
          const direction = handle.includes('r') || handle.includes('b') ? 1 : -1
          const scaleFactor = 1 + (direction * delta) / 200
          let newScale = originalScale * scaleFactor
          if (newScale < 0.2) newScale = 0.2
          if (newScale > 5) newScale = 5
          return { ...txt, scale: newScale }
        })
      if (isViewingBack) setBackTextElements(updateText)
      else setFrontTextElements(updateText)
    }
  }
  const handleResizeEnd = () => {
    setResizeInfo(null)
  }
  // Rotate
  const handleRotateStart = (e: React.MouseEvent, id: number, type: 'image' | 'text') => {
    e.stopPropagation()
    e.preventDefault()
    const elNode = document.querySelector(`[data-element-id="${id}"]`) as HTMLElement | null
    if (!elNode) return
    const rect = elNode.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    setRotateInfo({
      id,
      type,
      centerX,
      centerY,
      startAngle: 0,
    })
  }
  const handleRotate = (e: React.MouseEvent) => {
    if (!rotateInfo) return
    const deltaX = e.clientX - rotateInfo.centerX
    const deltaY = e.clientY - rotateInfo.centerY
    const angleDeg = (Math.atan2(deltaY, deltaX) * 180) / Math.PI + 90
    const updateRotation = (elements: any[]) =>
      elements.map((el) => (el.id === rotateInfo.id ? { ...el, rotation: angleDeg } : el))
    if (rotateInfo.type === 'image') {
      if (isViewingBack) setBackUploadedImages(updateRotation)
      else setFrontUploadedImages(updateRotation)
    } else {
      if (isViewingBack) setBackTextElements(updateRotation)
      else setFrontTextElements(updateRotation)
    }
  }
  const handleRotateEnd = () => {
    setRotateInfo(null)
  }
  // Text color
  const handleTextColorChange = (newColor: string) => {
    if (!selectedTextId) return
    const update = (elements: TextEl[]) =>
      elements.map((t) => (t.id === selectedTextId ? { ...t, color: newColor } : t))
    if (isViewingBack) setBackTextElements(update)
    else setFrontTextElements(update)
  }
  const selectedTextElement = currentTextElements.find((el) => el.id === selectedTextId)
  // Chat image upload
  const handleChatImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (loadEvent) => {
        const base64 = loadEvent.target?.result as string
        setChatImage(base64)
      }
      reader.readAsDataURL(file)
    }
  }
  // AI chat send (now with per-product Firestore session id + TTL fallback + Auto-Context Snapshot)
  const handleSendPrompt = async () => {
    // 🟢 1. Allow sending if we have a message OR an uploaded image OR a canvas to snapshot
    if (!message.trim() && !chatImage && !canvasRef.current) return
    setLoadingAI(true)
    const userMessage = message
    let userImageBase64 = chatImage
    // 🟢 2. AUTO-SNAPSHOT: If user didn't upload an image, snapshot the canvas for context
    if (!userImageBase64 && canvasRef.current) {
      try {
        userImageBase64 = await toPng(canvasRef.current, {
          cacheBust: true,
          pixelRatio: 1,
          backgroundColor: 'transparent',
          style: { background: 'transparent' },
        })
      } catch (err) {
        console.warn('Failed to snapshot canvas context:', err)
      }
    }
    // Prefer per-product session if we have a productId; otherwise use global getOrCreateSessionId
    let sessionId: string | null = null
    if (typeof window !== 'undefined' && selectedProductId) {
      const perProductKey = `asset_session_${selectedProductId}`
      const storedId = window.localStorage.getItem(perProductKey)
      sessionId = storedId || null
    } else {
      sessionId = getOrCreateSessionId()
    }
    smoothScrollNextRef.current = true
    // Optimistically add to UI (this is only for display)
    setChatHistory((prev) => [
      ...prev,
      {
        role: 'user',
        text: userMessage || (chatImage ? '[image only]' : '[Design Context Sent]'),
        imageUrl: chatImage || undefined,
      },
    ])
    // Clear input & preview
    setMessage('')
    setChatImage(null)
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? ''
      const res = await fetch(`${apiBase}/api/asset-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          history: backendHistory,
          sessionId: sessionId || undefined,
          inputImages: userImageBase64 ? [userImageBase64] : [],
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      if (Array.isArray(data.history)) {
        setBackendHistory(data.history)
      }
      if (typeof window !== 'undefined' && data.session) {
        try {
          const meta: AssetSessionMeta = {
            id: data.session.id,
            createdAt: data.session.createdAt,
            updatedAt: data.session.updatedAt,
            lastAssetPath: data.session.lastAssetPath ?? null,
            lastAssetUrl: data.session.lastAssetUrl ?? null,
          }
          window.localStorage.setItem(ASSET_SESSION_META_KEY, JSON.stringify(meta))
          if (meta.id) {
            window.localStorage.setItem(SESSION_ID_KEY, meta.id)
          }
          if (meta.id && selectedProductId) {
            const perProductKey = `asset_session_${selectedProductId}`
            window.localStorage.setItem(perProductKey, meta.id)
            setAssetSessionId(meta.id)
          } else if (meta.id) {
            setAssetSessionId(meta.id)
          }
        } catch (e) {
          console.warn('Failed to persist asset-chat session meta:', e)
        }
      }
      let aiText = ''
      let aiImageUrl: string | null = null
      if (data.parts) {
        for (const part of data.parts) {
          if (part.type === 'text') {
            aiText += part.text
          } else if (part.type === 'image') {
            if (part.base64 && typeof part.base64 === 'string') {
              if (part.base64.startsWith('http')) {
                const fetchRes = await fetch(part.base64)
                const blob = await fetchRes.blob()
                const reader = new FileReader()
                await new Promise((resolve) => {
                  reader.onloadend = () => {
                    aiImageUrl = reader.result as string
                    resolve(null)
                  }
                  reader.readAsDataURL(blob)
                })
              } else {
                aiImageUrl = part.base64
              }
            } else if (part.url) {
              aiImageUrl = part.url
            }
          }
        }
      }
      setChatHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: aiText || 'Here is your new asset!',
          imageUrl: aiImageUrl || undefined,
        },
      ])
    } catch (err: any) {
      console.error('Design AI error:', err)
      setChatHistory((prev) => [
        ...prev,
        { role: 'assistant', text: `Error: ${err.message}` },
      ])
    } finally {
      setLoadingAI(false)
    }
  }
  // Use AI image on canvas (centered default)
  const handleUseImage = (imgUrl: string) => {
    if (!imgUrl) return
    const newImage = createUploadedImage(imgUrl, 280, 100, 200, 200)
    if (isViewingBack) setBackUploadedImages((prev) => [...prev, newImage])
    else setFrontUploadedImages((prev) => [...prev, newImage])
  }
  // Dropzone file upload
  const handleFileUpload = (files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach((file) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (e) => {
          const result = e.target?.result as string
          const newImage = createUploadedImage(result, 280, 100, 150, 150)
          if (isViewingBack) {
            setBackUploadedImages((prev) => [...prev, newImage])
          } else {
            setFrontUploadedImages((prev) => [...prev, newImage])
          }
        }
        reader.readAsDataURL(file)
      }
    })
  }
  // Drag from OS / from chat into canvas
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
    const chatImageUrl = e.dataTransfer.getData('text/auren-image-url')
    if (chatImageUrl) {
      const rect = canvasRef.current?.getBoundingClientRect()
      const defaultSize = 200
      let xArt = 280
      let yArt = 100
      if (rect) {
        const scale = rect.width / BASE_SIZE || 1
        xArt = (e.clientX - rect.left) / scale - defaultSize / 2
        yArt = (e.clientY - rect.top) / scale - defaultSize / 2
      }
      const newImage = createUploadedImage(chatImageUrl, xArt, yArt, defaultSize, defaultSize)
      if (isViewingBack) setBackUploadedImages((prev) => [...prev, newImage])
      else setFrontUploadedImages((prev) => [...prev, newImage])
      return
    }
    handleFileUpload(e.dataTransfer.files)
  }
  const handleAddText = () => {
    const newText = createTextElement('New Text', 100, 100, 24)
    if (isViewingBack) setBackTextElements((prev) => [...prev, newText])
    else setFrontTextElements((prev) => [...prev, newText])
    setEditingTextId(newText.id)
    setSelectedTextId(newText.id)
  }
  // Email & snapshots (use fixed 800×800 snapshot nodes so exports are not scale-dependent)
  const handleSendToEmail = async (userEmail: string) => {
    // We no longer rely on canvasRef/hiddenCanvasRef for the export.
    // Instead we export from frontSnapshotRef/backSnapshotRef (fixed SNAPSHOT_SIZE).
    const hasBackSide = !!backImage && !!backMask && hasBackImage
    const frontNode = frontSnapshotRef.current
    const backNode = hasBackSide ? backSnapshotRef.current : null
    if (!frontNode) return
    setIsSending(true)
    const validFrontText = frontTextElements.filter((t) => t.text !== 'New Text')
    const validBackText = backTextElements.filter((t) => t.text !== 'New Text')
    // Clean up UI selections before snapshotting
    setFrontTextElements(validFrontText)
    setBackTextElements(validBackText)
    setSelectedTextId(null)
    setSelectedImageId(null)
    setEditingTextId(null)
    setResizeInfo(null)
    setRotateInfo(null)
    // Let state updates flush so selection borders/handles don’t leak into snapshot
    await new Promise((resolve) => setTimeout(resolve, 200))
    const snapshotOptions = {
      cacheBust: true,
      backgroundColor: 'transparent',
      width: SNAPSHOT_SIZE,
      height: SNAPSHOT_SIZE,
      style: {
        width: `${SNAPSHOT_SIZE}px`,
        height: `${SNAPSHOT_SIZE}px`,
        background: 'transparent',
      },
    } as const
    try {
      // ✅ Always export front from the front snapshot node
      const frontSnap = await toPng(frontNode, snapshotOptions)
      // ✅ Export back only if it exists
      const backSnap = backNode ? await toPng(backNode, snapshotOptions) : null
      const frontImageBase64 = frontSnap
      const backImageBase64 = backSnap || frontSnap // if no back, reuse front (or you can omit it)
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? ''
      const response = await axios.post(`${apiBase}/api/send-design`, {
        email: userEmail,
        frontImageBase64,
        backImageBase64,
        designDetails: {
          productName: selectedProductName,
          color: productColor,
        },
      })
      if (response.status === 200) {
        setEmailSent(true)
      } else {
        alert('Failed to send. Please try again.')
      }
    } catch (error) {
      console.error('Error processing design:', error)
      alert('An error occurred sending your design.')
    } finally {
      setIsSending(false)
      setTimeout(() => {
        setShowEmailForm(false)
        setEmail('')
        setEmailSent(false)
      }, 2000)
    }
  }
  const handleSubmitEmail = (e: React.FormEvent) => {
    e.preventDefault()
    if (email) handleSendToEmail(email)
  }
  // Go to order page (save snapshots + design metadata)
  const goToOrderPage = async () => {
    const validFrontText = frontTextElements.filter((t) => t.text !== 'New Text')
    const validBackText = backTextElements.filter((t) => t.text !== 'New Text')
    setFrontTextElements(validFrontText)
    setBackTextElements(validBackText)
    setSelectedTextId(null)
    setSelectedImageId(null)
    setEditingTextId(null)
    setResizeInfo(null)
    setRotateInfo(null)
    const hasBackSide = !!backImage && !!backMask && hasBackImage
    const frontNode = frontSnapshotRef.current
    const backNode = backSnapshotRef.current
    if (!frontNode) return
    await new Promise((resolve) => setTimeout(resolve, 200))
    const snapshotOptions = {
      cacheBust: true,
      backgroundColor: 'transparent',
      width: SNAPSHOT_SIZE,
      height: SNAPSHOT_SIZE,
      style: {
        width: `${SNAPSHOT_SIZE}px`,
        height: `${SNAPSHOT_SIZE}px`,
        background: 'transparent',
      },
    } as const
    let frontSnap: string | null = null
    let backSnap: string | null = null
    try {
      frontSnap = await toPng(frontNode, snapshotOptions)
      if (hasBackSide && backNode) {
        backSnap = await toPng(backNode, snapshotOptions)
      }
      if (selectedProductId && frontSnap) {
        const pid = String(selectedProductId)
        await db.cartAssets.put({
          id: `snapshot_front_${pid}`,
          base64: frontSnap,
          productId: pid,
        })
        if (backSnap) {
          await db.cartAssets.put({
            id: `snapshot_back_${pid}`,
            base64: backSnap,
            productId: pid,
          })
        }
      }
    } catch (err) {
      console.error('Failed to generate snapshots:', err)
    }
    const heavyFrontImages = [...frontUploadedImages]
    const heavyBackImages = [...backUploadedImages]
    const saveImagesToDb = async (images: UploadedImg[]) => {
      const lightweight: UploadedImg[] = []
      for (const img of images) {
        await db.cartAssets.put({
          id: String(img.id),
          base64: img.src,
          productId: selectedProductId || '',
        })
        lightweight.push({ ...img, src: 'INDEXED_DB_ASSET' })
      }
      return lightweight
    }
    const cleanFront = await saveImagesToDb(heavyFrontImages)
    const cleanBack = await saveImagesToDb(heavyBackImages)
    const { width: canvasW, height: canvasH } = getCurrentCanvasSize()
    const designData: DesignData = {
      productImage: selectedProductImage,
      frontUploadedImages: cleanFront,
      backUploadedImages: cleanBack,
      frontTextElements: validFrontText,
      backTextElements: validBackText,
      isViewingBack,
      canvasWidth: canvasW,
      canvasHeight: canvasH,
      selectedProductId,
      selectedProductName,
      selectedProductCategory,
      productColor,
      frontMask,
      backMask,
    }
    if (typeof window !== 'undefined' && selectedProductId) {
      localStorage.setItem(`designData_${selectedProductId}`, JSON.stringify(designData))
      localStorage.setItem(
        `orderMeta_${selectedProductId}`,
        JSON.stringify({
          source: 'design',
          productId: selectedProductId,
        }),
      )
      localStorage.setItem(`justEdited_${selectedProductId}`, 'true')
    }
    const baseId = selectedProductId || ''
    const href = `/order-quantity?cartItemId=${encodeURIComponent(
      baseId,
    )}&productId=${encodeURIComponent(
      baseId,
    )}&productName=${encodeURIComponent(
      selectedProductName || '',
    )}&productImage=${encodeURIComponent(
      frontImage || '',
    )}&productCategory=${encodeURIComponent(selectedProductCategory || '')}`
    router.push(href)
  }
  // Hidden/ghost canvas helpers
  const hasBackSide = !!backImage && !!backMask && hasBackImage
  const ghostUploadedImages = isViewingBack ? frontUploadedImages : backUploadedImages
  const ghostTextElements = isViewingBack ? frontTextElements : backTextElements
  const ghostProductImage = hasBackSide ? (isViewingBack ? frontImage : backImage) : frontImage
  const ghostMask = hasBackSide ? (isViewingBack ? frontMask : backMask) : frontMask
  const maskSrc = productMask || selectedProductImage
  const ghostMaskSrc = ghostMask || ghostProductImage
  return (
    <main className="min-h-screen bg-black text-white flex flex-col">      {/* Main 3-column layout: stacked on mobile, side-by-side on xl */}
      <div className="flex flex-col xl:flex-row items-center xl:items-stretch justify-start min-h-screen p-6 md:p-12 xl:px-16 xl:py-20 gap-16 xl:gap-8">
        <div className="flex flex-col w-full max-w-2xl xl:max-w-md min-h-[600px] xl:h-full order-1 xl:order-1 relative">
          {/* Header */}
          <div className="mb-4 xl:mb-6 shrink-0">
            <h1 className="text-4xl xl:text-7xl font-light leading-tight text-white">Chat</h1>
            {/* Avatar + description (hidden on small screens to save space) */}
            <div className="flex items-start gap-3 mt-4">
              <div className="w-10 h-10 md:w-12 md:h-12 xl:w-16 xl:h-16 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0">
                <Image src="/auren_white_logo.png" alt="Auren Logo" width={28} height={28} />
              </div>
              <p className="text-white/70 text-sm md:text-base leading-relaxed">
                Describe your idea — text, logo, vibe,
                <br />
                or upload inspo pics &amp; we&apos;ll recreate it!
              </p>
            </div>
          </div>
          {/* Chat history */}
          {/* Chat body (history + input) */}
          <div className="flex flex-col flex-1 min-h-0">
            {/* Chat history */}
            <div
              ref={chatScrollRef}
              className="flex-1 overflow-y-auto pr-2 space-y-4 xl:space-y-6 mb-4"
            >
              {chatHistory.map((msg, i) => (
                <div
                  key={i}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'
                    }`}
                >
                  {(msg.role === 'user' || !msg.imageUrl) && (
                    <div
                      className={`px-4 py-2 xl:py-3 rounded-2xl max-w-[90%] ${msg.role === 'user'
                        ? 'bg-blue-600 text-white self-end'
                        : 'bg-gray-800 text-white border border-white/10'
                        }`}
                    >
                      <p className="whitespace-pre-wrap text-sm">{msg.text}</p>
                    </div>
                  )}
                  {msg.imageUrl && (
                    <div className="mt-2 xl:mt-4 border border-white/10 rounded-xl overflow-hidden w-full max-w-[220px] xl:max-w-full">
                      <img
                        src={msg.imageUrl}
                        alt="Generated"
                        className="max-w-full max-h-[400px] object-contain mx-auto rounded-xl cursor-grab active:cursor-grabbing"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/auren-image-url', msg.imageUrl!)
                        }}
                      />
                      {msg.role === 'assistant' && (
                        <div className="flex gap-3 mt-3 mb-2 px-2">
                          <button
                            onClick={() => handleUseImage(msg.imageUrl!)}
                            className="px-3 py-1.5 text-xs xl:text-sm bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition w-full"
                          >
                            Use Image
                          </button>
                        </div>
                      )}
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
            {/* Chat input + mobile Back button, pinned to bottom */}
            <div className="w-full shrink-0 flex flex-col gap-2 mt-auto">
              {/* Optional preview of uploaded chat image */}
              {chatImage && (
                <div className="relative w-16 h-16 mb-1 rounded-md overflow-hidden">
                  <img
                    src={chatImage}
                    alt="Upload preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => setChatImage(null)}
                    className="absolute top-0 right-0 w-5 h-5 bg-black/70 text-white rounded-full flex items-center justify-center text-xs"
                  >
                    &times;
                  </button>
                </div>
              )}
              <div className="w-full">
                {/* Chat box */}
                <div className="flex items-center gap-2 xl:gap-3 rounded-2xl bg-gray-800 px-3 py-2 xl:px-4 xl:py-3 border-2 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.45)] w-full">
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSendPrompt()
                      }
                    }}
                    placeholder="Describe your idea..."
                    rows={1}
                    className="flex-1 bg-transparent outline-none placeholder-gray-500 text-white text-sm xl:text-base resize-none overflow-hidden"
                    style={{ minHeight: '28px', maxHeight: '96px' }}
                  />
                  {/* Upload button */}
                  <button
                    onClick={() => chatFileInputRef.current?.click()}
                    className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white transition"
                  >
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
                  {/* Send button */}
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
          </div>
        </div>
        {/* ============ MIDDLE: CANVAS ============ */}
        {/* ============ MIDDLE: CANVAS ============ */}
        <div className="w-full xl:flex-[2] flex items-stretch justify-center order-2 xl:order-2 min-h-0">
          <div
            className={`relative w-full max-w-xl bg-[#f5f1e8]
    px-2 md:px-4 xl:px-6 py-2 md:py-4 xl:py-6
    flex flex-col rounded-xl overflow-hidden
    shadow-[0_0_40px_rgba(0,0,0,0.7)]
    ${isDragging ? 'ring-2 ring-blue-400 ring-offset-4 ring-offset-black' : ''}`}
            style={{
              aspectRatio: '1 / 1',
              minHeight: 420, // optional safety so it never collapses
            }}
          >
            {/* Email button */}
            <button
              onClick={() => setShowEmailForm(true)}
              disabled={isSending || emailSent}
              className="absolute top-4 right-4 w-10 h-10 bg-black border border-white/20 rounded-lg flex items-center justify-center text-white transition disabled:opacity-50 z-40"
              title="Send design to email"
            >
              {isSending ? (
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a7.962 7.962 0 014-6.928V4C5.373 4 0 9.373 0 16h4z"
                  ></path>
                </svg>
              ) : emailSent ? (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              ) : (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              )}
            </button>
            {/* Canvas wrapper / dropzone */}
            {/* Canvas wrapper / dropzone (outer container resizes, inner artboard is fixed 800x800) */}
            {/* Canvas wrapper / dropzone (outer container resizes, inner artboard is fixed 800x800) */}
            <div
              ref={canvasWrapperRef}
              className="flex-1 w-full flex items-center justify-center relative overflow-hidden transition-colors"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onMouseMove={(e) => {
                if (resizeInfo) handleResize(e)
                else if (rotateInfo) handleRotate(e)
                else {
                  handleTextDrag(e)
                  handleImageDrag(e)
                }
              }}
              onMouseUp={() => {
                handleTextDragEnd()
                handleImageDragEnd()
                handleResizeEnd()
                handleRotateEnd()
              }}
              onMouseLeave={() => {
                handleTextDragEnd()
                handleImageDragEnd()
                handleResizeEnd()
                handleRotateEnd()
              }}
              onClick={() => {
                setSelectedTextId(null)
                setSelectedImageId(null)
                setEditingTextId(null)
              }}
            >
              {/* NEW: center + scale container */}
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: BASE_SIZE,
                  height: BASE_SIZE,
                  transform: `translate(-50%, -50%) scale(${artboardScale})`,
                  transformOrigin: 'center center',
                }}
              >
                {/* Actual artboard stays 800x800 */}
                <div
                  ref={canvasRef}
                  className="relative"
                  style={{
                    width: BASE_SIZE,
                    height: BASE_SIZE,
                    backgroundColor: 'transparent',
                  }}
                >
                  {/* Color mask */}
                  {maskSrc && (
                    <div
                      className="absolute inset-0"
                      style={{
                        backgroundColor: productColor,
                        maskImage: `url("${maskSrc}")`,
                        WebkitMaskImage: `url("${maskSrc}")`,
                        maskSize: 'contain',
                        WebkitMaskSize: 'contain',
                        maskRepeat: 'no-repeat',
                        WebkitMaskRepeat: 'no-repeat',
                        maskPosition: 'center',
                        WebkitMaskPosition: 'center',
                        mixBlendMode: 'multiply',
                        zIndex: 1,
                      }}
                    />
                  )}
                  {/* Product image */}
                  {selectedProductImage && (
                    <Image
                      src={selectedProductImage}
                      alt="Shirt Overlay"
                      fill
                      unoptimized
                      className="absolute inset-0 object-contain"
                      style={{
                        mixBlendMode: 'multiply',
                        backgroundColor: 'transparent',
                        zIndex: 2,
                      }}
                    />
                  )}
                  {/* Uploaded images */}
                  {/* Uploaded images */}
                  {currentUploadedImages.map((img) => {
                    const isSelected = selectedImageId === img.id
                    const { x, y, width, height } = normalizedToPixels(img)
                    return (
                      <div
                        key={img.id}
                        data-element-id={img.id}
                        className="absolute group"
                        style={{
                          left: x,
                          top: y,
                          width,
                          height,
                          zIndex: 3,
                          transform: `rotate(${img.rotation}deg)`,
                          border: isSelected ? '1px dashed #007AFF' : '1px dashed transparent',
                        }}
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedImageId(img.id)
                          setSelectedTextId(null)
                        }}
                      >
                        <img
                          src={img.src}
                          alt=""
                          draggable={false}
                          className="w-full h-full cursor-move"
                          style={{ objectFit: 'contain' }}
                          onMouseDown={(e) => {
                            e.stopPropagation()
                            handleImageDragStart(e, img.id)
                            setSelectedImageId(img.id)
                            setSelectedTextId(null)
                          }}
                        />
                        {/* Hover delete – ONLY when not selected */}
                        {!isSelected && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteImage(img.id)
                            }}
                            className="
            absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
            w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center
            opacity-0 pointer-events-none
            group-hover:opacity-100 group-hover:pointer-events-auto
            transition-opacity duration-150 z-[60] shadow-md
          "
                            title="Delete image"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                            >
                              <path
                                d="M18 6L6 18M6 6l12 12"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                        )}
                        {/* Resize + rotate handles */}
                        {isSelected && (
                          <>
                            {/* Corners */}
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
                            {/* Sides */}
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
                            {/* Rotation handle */}
                            <div
                              className="absolute -top-8 left-1/2 -translate-x-1/2 w-6 h-6 flex items-center justify-center cursor-crosshair z-50"
                              onMouseDown={(e) => handleRotateStart(e, img.id, 'image')}
                            >
                              <div className="w-3 h-3 bg-white border border-blue-500 rounded-full shadow-sm relative">
                                <div className="absolute h-4 w-px bg-blue-500 left-1/2 -translate-x-1/2 top-full" />
                              </div>
                            </div>
                          </>
                        )}
                      </div>

                    )
                  })}
                  {/* Text elements */}
                  {/* Text elements */}
                  {currentTextElements.map((textEl) => {
                    const isSelected = selectedTextId === textEl.id
                    const { x, y, fontSize } = normalizedTextToPixels(textEl)
                    const scaledFontSize = fontSize * textEl.scale
                    const isEditing = editingTextId === textEl.id
                    return (
                      <div
                        key={textEl.id}
                        data-element-id={textEl.id}
                        className="absolute group"
                        style={{
                          left: x,
                          top: y,
                          zIndex: 4,
                          transform: `rotate(${textEl.rotation}deg)`,
                          transformOrigin: 'center center',
                          border:
                            isSelected && !isEditing
                              ? '1px dashed #007AFF'
                              : '1px dashed transparent',
                          padding: 4,
                          cursor: isEditing ? 'text' : 'move',
                        }}
                        onMouseDown={(e) => {
                          if (isEditing) return
                          if (!isSelected) return
                          e.stopPropagation()
                          setSelectedImageId(null)
                          handleTextDragStart(e, textEl.id)
                        }}
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingTextId(textEl.id)
                          setSelectedTextId(null)
                          setSelectedImageId(null)
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation()
                          setEditingTextId(null)
                          setSelectedTextId(textEl.id)
                          setSelectedImageId(null)
                        }}
                      >
                        {isEditing ? (
                          <input
                            type="text"
                            value={textEl.text}
                            onChange={(e) => handleTextChange(textEl.id, e.target.value)}
                            onBlur={() => setEditingTextId(null)}
                            autoFocus
                            className="bg-transparent border-none outline-none p-0 m-0"
                            style={{
                              fontSize: `${scaledFontSize}px`,
                              fontFamily: textEl.fontFamily,
                              fontWeight: textEl.fontWeight,
                              fontStyle: textEl.fontStyle,
                              color: textEl.color,
                              minWidth: '50px',
                              width: `${(textEl.text.length + 1) * 0.6}em`,
                            }}
                          />
                        ) : (
                          <span
                            className="select-none whitespace-nowrap block leading-none"
                            style={{
                              fontSize: `${scaledFontSize}px`,
                              fontFamily: textEl.fontFamily,
                              fontWeight: textEl.fontWeight,
                              fontStyle: textEl.fontStyle,
                              color: textEl.color,
                            }}
                          >
                            {textEl.text}
                          </span>
                        )}
                        {/* Hover delete – only when not selected & not editing */}
                        {!isSelected && !isEditing && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteText(textEl.id)
                            }}
                            className="
            absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
            w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center
            opacity-0 pointer-events-none
            group-hover:opacity-100 group-hover:pointer-events-auto
            transition-opacity duration-150 z-[60] shadow-md
          "
                            title="Delete text"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                            >
                              <path
                                d="M18 6L6 18M6 6l12 12"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                        )}
                        {/* Text resize + rotate */}
                        {isSelected && !isEditing && (
                          <>
                            {/* Corners */}
                            <div
                              onMouseDown={(e) => handleResizeStart(e, textEl.id, 'text', 'tl')}
                              className="absolute -left-2 -top-2 w-4 h-4 bg-white border border-[#007AFF] rounded-full cursor-nwse-resize z-50 shadow-sm"
                            />
                            <div
                              onMouseDown={(e) => handleResizeStart(e, textEl.id, 'text', 'tr')}
                              className="absolute -right-2 -top-2 w-4 h-4 bg-white border border-[#007AFF] rounded-full cursor-nesw-resize z-50 shadow-sm"
                            />
                            <div
                              onMouseDown={(e) => handleResizeStart(e, textEl.id, 'text', 'bl')}
                              className="absolute -left-2 -bottom-2 w-4 h-4 bg-white border border-[#007AFF] rounded-full cursor-nesw-resize z-50 shadow-sm"
                            />
                            <div
                              onMouseDown={(e) => handleResizeStart(e, textEl.id, 'text', 'br')}
                              className="absolute -right-2 -bottom-2 w-4 h-4 bg-white border border-[#007AFF] rounded-full cursor-nwse-resize z-50 shadow-sm"
                            />
                            {/* Rotation */}
                            <div
                              className="absolute -top-8 left-1/2 -translate-x-1/2 w-6 h-6 flex items-center justify-center cursor-crosshair z-50"
                              onMouseDown={(e) => handleRotateStart(e, textEl.id, 'text')}
                            >
                              <div className="w-3 h-3 bg-white border border-blue-500 rounded-full shadow-sm relative">
                                <div className="absolute h-4 w-px bg-blue-500 left-1/2 -translate-x-1/2 top-full" />
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
            {/* Product label */}
            <div className="w-full text-center pt-4">
              <p className="text-gray-600 text-sm uppercase tracking-wide">
                {selectedProductName}
              </p>
            </div>
          </div>
          {/* Fixed-size hidden canvases (800×800) for order snapshots */}
          <div
            style={{
              position: 'absolute',
              left: '-9999px',
              top: 0,
              width: 0,
              height: 0,
              overflow: 'hidden',
            }}
          >
            {/* Front side snapshot */}
            <div
              ref={frontSnapshotRef}
              style={{
                width: SNAPSHOT_SIZE,
                height: SNAPSHOT_SIZE,
                position: 'relative',
                backgroundColor: 'transparent',
              }}
            >
              {/* Front color mask */}
              {(frontMask || frontImage) && (
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundColor: productColor,
                    maskImage: `url("${frontMask || frontImage}")`,
                    WebkitMaskImage: `url("${frontMask || frontImage}")`,
                    maskSize: 'contain',
                    WebkitMaskSize: 'contain',
                    maskRepeat: 'no-repeat',
                    WebkitMaskRepeat: 'no-repeat',
                    maskPosition: 'center',
                    WebkitMaskPosition: 'center',
                    mixBlendMode: 'multiply',
                    zIndex: 1,
                  }}
                />
              )}
              {/* Front product image */}
              {frontImage && (
                <img
                  src={frontImage}
                  alt="Front snapshot"
                  className="absolute inset-0 w-full h-full object-contain"
                  style={{ mixBlendMode: 'multiply', zIndex: 2 }}
                />
              )}
              {/* Front uploaded images */}
              {frontUploadedImages.map((img) => {
                const { x, y, width, height } = normalizedToPixels(
                  img,
                  SNAPSHOT_SIZE,
                  SNAPSHOT_SIZE,
                )
                return (
                  <div
                    key={img.id}
                    className="absolute group"
                    style={{
                      left: x,
                      top: y,
                      width,
                      height,
                      zIndex: 3,
                      transform: `rotate(${img.rotation}deg)`,
                    }}
                  >
                    <img src={img.src} className="w-full h-full" alt="" />
                  </div>
                )
              })}
              {/* Front text */}
              {frontTextElements.map((t) => {
                const { x, y, fontSize } = normalizedTextToPixels(
                  t,
                  SNAPSHOT_SIZE,
                  SNAPSHOT_SIZE,
                )
                const scaledFontSize = fontSize * t.scale
                return (
                  <div
                    key={t.id}
                    className="absolute"
                    style={{
                      left: x,
                      top: y,
                      zIndex: 4,
                      transform: `rotate(${t.rotation}deg)`,
                    }}
                  >
                    <span
                      style={{
                        fontSize: scaledFontSize,
                        fontFamily: t.fontFamily,
                        color: t.color,
                        fontWeight: t.fontWeight,
                        fontStyle: t.fontStyle,
                      }}
                    >
                      {t.text}
                    </span>
                  </div>
                )
              })}
            </div>
            {/* Back side snapshot (only if product has back) */}
            {hasBackSide && (
              <div
                ref={backSnapshotRef}
                style={{
                  width: SNAPSHOT_SIZE,
                  height: SNAPSHOT_SIZE,
                  position: 'relative',
                  backgroundColor: 'transparent',
                  marginTop: 16,
                }}
              >
                {/* Back color mask */}
                {(backMask || backImage) && (
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundColor: productColor,
                      maskImage: `url("${backMask || backImage}")`,
                      WebkitMaskImage: `url("${backMask || backImage}")`,
                      maskSize: 'contain',
                      WebkitMaskSize: 'contain',
                      maskRepeat: 'no-repeat',
                      WebkitMaskRepeat: 'no-repeat',
                      maskPosition: 'center',
                      WebkitMaskPosition: 'center',
                      mixBlendMode: 'multiply',
                      zIndex: 1,
                    }}
                  />
                )}
                {/* Back product image */}
                {backImage && (
                  <img
                    src={backImage}
                    alt="Back snapshot"
                    className="absolute inset-0 w-full h-full object-contain"
                    style={{ mixBlendMode: 'multiply', zIndex: 2 }}
                  />
                )}
                {/* Back uploaded images */}
                {backUploadedImages.map((img) => {
                  const { x, y, width, height } = normalizedToPixels(
                    img,
                    SNAPSHOT_SIZE,
                    SNAPSHOT_SIZE,
                  )
                  return (
                    <div
                      key={img.id}
                      className="absolute group"
                      style={{
                        left: x,
                        top: y,
                        width,
                        height,
                        zIndex: 3,
                        transform: `rotate(${img.rotation}deg)`,
                      }}
                    >
                      <img src={img.src} className="w-full h-full" alt="" />
                    </div>
                  )
                })}
                {/* Back text */}
                {backTextElements.map((t) => {
                  const { x, y, fontSize } = normalizedTextToPixels(
                    t,
                    SNAPSHOT_SIZE,
                    SNAPSHOT_SIZE,
                  )
                  const scaledFontSize = fontSize * t.scale
                  return (
                    <div
                      key={t.id}
                      className="absolute"
                      style={{
                        left: x,
                        top: y,
                        zIndex: 4,
                        transform: `rotate(${t.rotation}deg)`,
                      }}
                    >
                      <span
                        style={{
                          fontSize: scaledFontSize,
                          fontFamily: t.fontFamily,
                          color: t.color,
                          fontWeight: t.fontWeight,
                          fontStyle: t.fontStyle,
                        }}
                      >
                        {t.text}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          {/* Hidden ghost canvas for opposite side (for email, etc.) */}
          <div
            style={{
              position: 'absolute',
              left: '-9999px',
              top: 0,
              width: '100%',
              height: '100%',
            }}
          >
            <div
              ref={hiddenCanvasRef}
              className="relative"
              style={{
                width: BASE_SIZE,
                height: BASE_SIZE,
              }}
            >
              {ghostMaskSrc && (
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundColor: productColor,
                    maskImage: `url("${ghostMaskSrc}")`,
                    WebkitMaskImage: `url("${ghostMaskSrc}")`,
                    maskSize: 'contain',
                    WebkitMaskSize: 'contain',
                    maskRepeat: 'no-repeat',
                    WebkitMaskRepeat: 'no-repeat',
                    maskPosition: 'center',
                    WebkitMaskPosition: 'center',
                    mixBlendMode: 'multiply',
                    zIndex: 1,
                  }}
                />
              )}
              {ghostProductImage && (
                <img
                  src={ghostProductImage}
                  alt="Ghost"
                  className="absolute inset-0 w-full h-full object-contain"
                  style={{ mixBlendMode: 'multiply', zIndex: 2 }}
                />
              )}
              {ghostUploadedImages.map((img) => {
                const { x, y, width, height } = normalizedToPixels(img)
                return (
                  <div
                    key={img.id}
                    className="absolute group"
                    style={{
                      left: x,
                      top: y,
                      width,
                      height,
                      zIndex: 3,
                      transform: `rotate(${img.rotation}deg)`,
                    }}
                  >
                    <img src={img.src} className="w-full h-full" />
                  </div>
                )
              })}
              {ghostTextElements.map((t) => {
                const { x, y, fontSize } = normalizedTextToPixels(t)
                const scaledFontSize = fontSize * t.scale
                return (
                  <div
                    key={t.id}
                    className="absolute"
                    style={{
                      left: x,
                      top: y,
                      zIndex: 4,
                      transform: `rotate(${t.rotation}deg)`,
                    }}
                  >
                    <span
                      style={{
                        fontSize: scaledFontSize,
                        fontFamily: t.fontFamily,
                        color: t.color,
                        fontWeight: t.fontWeight,
                        fontStyle: t.fontStyle,
                      }}
                    >
                      {t.text}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
        {/* ============ RIGHT: DESIGN TOOLS ============ */}
        <div className="flex flex-col gap-4 w-full xl:w-[360px] 2xl:w-[420px] xl:flex-none order-3 xl:order-3 min-h-0 xl:h-full relative">
          <h2 className="text-3xl xl:text-5xl font-light leading-tight">Design tools</h2>
          {/* Tools column grows, Next is pushed to bottom on tall screens */}
          <div className="flex flex-col gap-3 flex-1 pb-6">
            {/* Add text */}
            <button
              onClick={handleAddText}
              className="flex items-center gap-4 rounded-lg bg-black border border-white/20 px-4 xl:px-6 py-3 xl:py-4 transition"
            >
              <div className="w-10 h-10 flex items-center justify-center text-white text-2xl font-bold">
                T
              </div>
              <span className="text-white text-base xl:text-lg">Add Text</span>
            </button>
            {/* Text editor panel */}
            {selectedTextElement && (
              <div className="pt-2 pl-4 space-y-3 border-l-2 border-blue-500 ml-2 xl:ml-4">
                <div>
                  <label className="block text-xs text-white/70 mb-1">Size (px)</label>
                  <input
                    type="text"
                    value={selectedTextElement.fontSize}
                    onChange={(e) =>
                      handleTextSizeChange(selectedTextElement.id, e.target.value)
                    }
                    className="w-full px-3 py-2 bg-black border border-white/20 rounded-lg text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/70 mb-1">Font</label>
                  <select
                    value={selectedTextElement.fontFamily}
                    onChange={(e) =>
                      handleTextFontChange(selectedTextElement.id, e.target.value)
                    }
                    className="w-full px-3 py-2 bg-black border border-white/20 rounded-lg text-white text-sm"
                  >
                    {FONT_OPTIONS.map((font) => (
                      <option
                        key={font}
                        value={font}
                        style={{ fontFamily: font, color: 'black' }}
                      >
                        {font}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggleBold(selectedTextElement.id)}
                    className={`flex-1 px-3 py-1.5 rounded-lg border text-sm ${selectedTextElement.fontWeight === 'bold'
                      ? 'bg-white text-black border-white'
                      : 'bg-black border-white/20 text-white'
                      } transition`}
                  >
                    Bold
                  </button>
                  <button
                    onClick={() => handleToggleItalic(selectedTextElement.id)}
                    className={`flex-1 px-3 py-1.5 rounded-lg border text-sm ${selectedTextElement.fontStyle === 'italic'
                      ? 'bg-white text-black border-white'
                      : 'bg-black border-white/20 text-white'
                      } transition`}
                  >
                    Italic
                  </button>
                </div>
                <div>
                  <label className="block text-xs text-white/70 mb-1">Color</label>
                  <button
                    onClick={() => setShowTextColorPicker((prev) => !prev)}
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
            {/* Upload logo/image */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-4 rounded-lg bg-black border border-white/20 px-4 xl:px-6 py-3 xl:py-4 transition"
            >
              <div className="w-10 h-10 flex items-center justify-center text-white">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
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
              </div>
              <span className="text-white text-base xl:text-lg">Upload Logo/Image</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handleFileUpload(e.target.files)}
              className="hidden"
            />
            {/* Edit color */}
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="flex items-center gap-4 rounded-lg bg-black border border-white/20 px-4 xl:px-6 py-3 xl:py-4 transition"
            >
              <div
                className="w-8 h-8 rounded-md border border-white/50"
                style={{ backgroundColor: productColor }}
              />
              <span className="text-white text-base xl:text-lg">Edit Color</span>
            </button>
            {showColorPicker && (
              <div className="pt-2 xl:pt-4">
                <HexColorPicker
                  color={productColor}
                  onChange={setProductColor}
                  style={{ width: '100%' }}
                />
              </div>
            )}
            {/* Front/back toggle */}
            {frontImage && backImage && hasBackImage && (
              <button
                onClick={toggleFrontBack}
                className="flex items-center gap-4 rounded-lg bg-black border border-white/20 px-4 xl:px-6 py-3 xl:py-4 transition"
                title={isViewingBack ? 'Show Front' : 'Show Back'}
              >
                <div className="w-10 h-10 flex items-center justify-center text-white">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  >
                    <path
                      d="M8 12h8M12 8l4 4-4 4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <span className="text-white text-base xl:text-lg">
                  {isViewingBack ? 'Front Side' : 'Back Side'}
                </span>
              </button>
            )}
            {/* Next button under design tools, aligned with chat row */}
            {/* Mobile Next button */}
            {/* BOTTOM ROW – right: Next button */}
            <div className="w-full xl:col-[3/4] xl:row-[2/3] flex items-end">
              <button
                onClick={goToOrderPage}
                className="w-full rounded-xl bg-black border border-white/20 px-5 py-3 text-white text-base font-medium transition"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* Email modal */}
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
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
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
                  className="flex-1 px-4 py-3 bg-black border border-white/20 rounded-lg text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSending || !email}
                  className="flex-1 px-4 py-3 bg:white bg-white text-black rounded-lg font-medium hover:bg-white/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
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
    <Suspense
      fallback={
        <main className="relative min-h-screen bg-black text-white overflow-hidden flex items-center justify-center">
          <div className="text-white">Loading...</div>
        </main>
      }
    >
      <DesignPageContent />
    </Suspense>
  )
}
