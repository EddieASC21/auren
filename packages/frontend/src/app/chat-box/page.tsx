'use client'

import { motion } from 'framer-motion'
import { useRef, useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { db, blobToBase64 } from '../../lib/db'
import { nanoid } from 'nanoid'

type ChatMessage = {
  role: 'user' | 'assistant';
  text: string;
  imageUrls?: string[];
  imagePointers?: string[];
};

function decodeBackendHistory(raw: any[]): ChatMessage[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter(
      (msg: any) =>
        msg.role === "user" ||
        msg.role === "assistant" ||
        msg.role === "model"
    )
    .map((msg: any) => {
      // 1️⃣ Text from parts[]
      const text =
        (msg.parts || [])
          .map((p: any) => (typeof p.text === "string" ? p.text : ""))
          .join("\n")
          .trim() || "";

      // 2️⃣ Normalize role
      const role: "user" | "assistant" =
        msg.role === "user" ? "user" : "assistant";

      // 3️⃣ Collect ALL possible image URLs
      const urls: string[] = [];

      // a) Model-level single imageUrl (generated designs)
      if (typeof msg.imageUrl === "string") {
        urls.push(msg.imageUrl);
      }

      // b) Optional array imageUrls
      if (Array.isArray(msg.imageUrls)) {
        urls.push(...msg.imageUrls.filter((u: any) => typeof u === "string"));
      }

      // c) NEW: user-uploadedImages stored by backend
      if (Array.isArray(msg.uploadedImages)) {
        urls.push(
          ...msg.uploadedImages.filter((u: any) => typeof u === "string")
        );
      }

      // d) NEW: any parts that have imageUrl (upload or generated)
      if (Array.isArray(msg.parts)) {
        for (const p of msg.parts) {
          if (typeof p.imageUrl === "string") {
            urls.push(p.imageUrl);
          }
        }
      }

      const uniqueUrls = Array.from(new Set(urls));
      const imageUrls = uniqueUrls.length > 0 ? uniqueUrls : undefined;

      // 4️⃣ Drop empty messages (no text, no images)
      if (!text && !imageUrls) {
        return null;
      }

      return {
        role,
        text,
        imageUrls,
      } as ChatMessage;
    })
    .filter(Boolean) as ChatMessage[];
}

// LocalStorage keys
const CHAT_HISTORY_KEY = 'aiChat_chatHistory';
const SELECTED_FRONT_KEY = 'aiChat_selectedImage';
const SELECTED_BACK_KEY = 'aiChat_selectedBackImage';
const SESSION_ID_KEY = 'aiChat_sessionId';
const SESSION_CREATED_AT_KEY = 'aiChat_sessionCreatedAt';

export default function ChatBoxPage() {
  const [message, setMessage] = useState('');
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [backendHistory, setBackendHistory] = useState<any[]>([]);
  const [chatImageIds, setChatImageIds] = useState<string[]>([]);

  // Design State
  const [frontImageSelected, setFrontImageSelected] = useState<string | null>(null);
  const [backImageSelected, setBackImageSelected] = useState<string | null>(null);

  const [frontImagePointer, setFrontImagePointer] = useState<string | null>(null);
  const [backImagePointer, setBackImagePointer] = useState<string | null>(null);
  const [orderMetadata, setOrderMetadata] = useState<{
    category: string;
    name: string;
    pricingMode: 'catalog_markup' | 'manual_quote';
  } | null>(null);

  const [orderPinned, setOrderPinned] = useState(false);

  // 🔐 Session state (this is your designSessionId/draftId)
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionCreatedAt, setSessionCreatedAt] = useState<number | null>(null);
  // Per-cart mapping to a design session (for editing from product-showcase)
  const [cartDesignSessionId, setCartDesignSessionId] = useState<string | null>(null);

  // We only want to hydrate from backend history once
  const hydratedFromBackendRef = useRef(false);

  // Helper: clear all local session-related state
  const clearLocalSessionState = () => {
    setSessionId(null);
    setSessionCreatedAt(null);
    setChatHistory([]);
    setBackendHistory([]);
    setFrontImageSelected(null);
    setBackImageSelected(null);
    setFrontImagePointer(null);
    setBackImagePointer(null);
    setOrderMetadata(null);
    setOrderPinned(false);
    setPreviewUrls([]);
    setChatImageIds([]);

    if (typeof window !== 'undefined') {
      localStorage.removeItem(SESSION_ID_KEY);
      localStorage.removeItem(SESSION_CREATED_AT_KEY);
      localStorage.removeItem(CHAT_HISTORY_KEY);
      localStorage.removeItem(SELECTED_FRONT_KEY);
      localStorage.removeItem(SELECTED_BACK_KEY);
    }
  };

  // Helper: delete session on server (explicit exit)
  // Helper: delete session on server (explicit exit)
  const deleteSessionOnServer = async (id: string) => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';

    if (!apiBase) {
      console.warn(
        'NEXT_PUBLIC_API_URL not set; skipping remote design-session delete'
      );
      return;
    }

    try {
      await fetch(`${apiBase}/api/design-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: id }),
      });
    } catch (err) {
      console.error('Failed to delete design session', err);
    }
  };

  // Helper: nuke + navigate (used when going to /catalog from here)
  const handleExitTo = async (path: string) => {
    const currentSessionId =
      sessionId ||
      (typeof window !== 'undefined'
        ? window.localStorage.getItem(SESSION_ID_KEY)
        : null);

    if (currentSessionId) {
      await deleteSessionOnServer(currentSessionId);
    }
    clearLocalSessionState();
    router.push(path);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const loadAllData = async () => {
      let storedSessionId: string | null = null;
      let storedCreatedAt: string | null = null;

      // 1) Read session metadata
      try {
        storedSessionId = localStorage.getItem(SESSION_ID_KEY);
        storedCreatedAt = localStorage.getItem(SESSION_CREATED_AT_KEY);

        if (storedSessionId) {
          setSessionId(storedSessionId);
        }
        if (storedCreatedAt) {
          const createdAtMs = Number(storedCreatedAt);
          if (!Number.isNaN(createdAtMs)) {
            setSessionCreatedAt(createdAtMs);

            // Optional: client-side TTL check
            /*const age = Date.now() - createdAtMs;
            if (age > SESSION_TTL_MS) {
              // session too old on this browser → nuke local + exit
              clearLocalSessionState();
              return;
            }*/
          }
        }
      } catch (err) {
        console.error('Error while restoring session metadata', err);
      }

      // ⚠️ No session id => treat as NO ACTIVE CHAT.
      if (!storedSessionId) {
        try {
          localStorage.removeItem(CHAT_HISTORY_KEY);
          localStorage.removeItem(SELECTED_FRONT_KEY);
          localStorage.removeItem(SELECTED_BACK_KEY);
        } catch {
          // ignore
        }
        setChatHistory([]);
        setFrontImageSelected(null);
        setBackImageSelected(null);
        return;
      }

      // 2) Try to restore from Firestore via GET /api/product-chat?sessionId=...
      // 2) Try to restore from Firestore via GET /api/product-chat?sessionId=...
      // 2) Try to restore from Firestore via GET /api/product-chat?sessionId=...
      // 2) Try to restore from Firestore via GET /api/product-chat?sessionId=...
      let restoredFromBackend = false;
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';

      if (storedSessionId && apiBase) {
        try {
          const res = await fetch(
            `${apiBase}/api/product-chat?sessionId=${encodeURIComponent(storedSessionId)}`
          );

          if (res.status === 404) {
            console.info('[product-chat] Session not found on backend, clearing local chat session');
            // Session doesn't exist server-side anymore -> wipe local state
            clearLocalSessionState();
            restoredFromBackend = false;
            return;
          }

          if (res.ok) {
            const data = await res.json();

            if (Array.isArray(data.history)) {
              setBackendHistory(data.history);

              const reconstructed = decodeBackendHistory(data.history);

              if (reconstructed.length > 0) {
                setChatHistory(reconstructed);
                hydratedFromBackendRef.current = true;
              }

              restoredFromBackend = true;
            }
          } else {
            const errText = await res.text().catch(() => '');
            console.warn(
              'Failed to restore chat session from product-chat:',
              res.status,
              errText
            );
          }
        } catch (err) {
          console.error('Error restoring session from product-chat', err);
        }
      } else if (!apiBase) {
        console.warn(
          'NEXT_PUBLIC_API_URL is not set; skipping backend chat restore.'
        );
      }

      // 3) Fallback to local caches if backend restore failed or history empty
      if (!restoredFromBackend) {
        // Backend history (cached)
        try {
          const historyRecord = await db.appState.get('backendHistory');
          if (historyRecord) setBackendHistory(historyRecord.value);
        } catch (e) {
          console.warn('Failed to load backend history from Dexie', e);
        }

        // Chat bubbles (UI cache)
        const rawChat = localStorage.getItem(CHAT_HISTORY_KEY);
        if (rawChat) {
          try {
            const loadedChat: any[] = JSON.parse(rawChat);
            const hydratedChat = await Promise.all(
              loadedChat.map(async (msg) => {
                // ❌ Never trust persisted imageUrls (they may be stale blob: URLs)
                if (msg.imageUrls) {
                  delete msg.imageUrls;
                }

                if (msg.imagePointer && !msg.imagePointers) {
                  msg.imagePointers = [msg.imagePointer];
                }

                if (msg.imagePointers && msg.imagePointers.length > 0) {
                  const urls: string[] = [];
                  for (const pointer of msg.imagePointers) {
                    try {
                      const record = await db.images.get(pointer);
                      if (record) {
                        urls.push(URL.createObjectURL(record.blob));
                      }
                    } catch (e) {
                      console.error(e);
                    }
                  }
                  return { ...msg, imageUrls: urls };
                }

                // If there are no pointers, return the message without images
                return { ...msg, imageUrls: undefined };
              })
            );
            setChatHistory(hydratedChat as ChatMessage[]);
          } catch (e) {
            localStorage.removeItem(CHAT_HISTORY_KEY);
          }
        }
      }

      // 4) Restore selections (front/back choice)
      const savedFront = localStorage.getItem(SELECTED_FRONT_KEY);
      const savedBack = localStorage.getItem(SELECTED_BACK_KEY);

      if (savedFront) setFrontImageSelected(savedFront);
      if (savedBack) setBackImageSelected(savedBack);
    };

    loadAllData();
  }, []);

  // If we came here to edit an existing cart item, restore its design-session id
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storageId =
      searchParams.get('cartItemId') || searchParams.get('productId');

    if (!storageId) return;

    const storedDesignSession = window.localStorage.getItem(
      `design_session_${storageId}`
    );
    if (!storedDesignSession) return;

    setSessionId(storedDesignSession);
    setCartDesignSessionId(storedDesignSession);
    window.localStorage.setItem(SESSION_ID_KEY, storedDesignSession);
  }, [searchParams]);

  // 🔁 Hydrate visible chat from backend history (e.g., when returning from /order-quantity)
  useEffect(() => {
    if (hydratedFromBackendRef.current) return;
    if (!backendHistory || backendHistory.length === 0) return;
    if (chatHistory.length > 0) return;

    const reconstructed = decodeBackendHistory(backendHistory);

    if (reconstructed.length > 0) {
      setChatHistory(reconstructed);
      hydratedFromBackendRef.current = true;
    }
  }, [backendHistory, chatHistory.length]);

  // 2. SAVE HOOKS
  useEffect(() => {
    if (backendHistory.length > 0) {
      db.appState
        .put({ key: 'backendHistory', value: backendHistory })
        .catch(console.error);
    }
  }, [backendHistory]);

  useEffect(() => {
    if (chatHistory.length > 0) {
      try {
        const sanitizedChatHistory = chatHistory.map((msg) => {
          const { imageUrls, ...restOfMsg } = msg;
          return restOfMsg;
        });
        localStorage.setItem(
          CHAT_HISTORY_KEY,
          JSON.stringify(sanitizedChatHistory)
        );
      } catch (err) {
        console.warn(err);
      }
    }
  }, [chatHistory]);

  useEffect(() => {
    if (frontImageSelected)
      localStorage.setItem(SELECTED_FRONT_KEY, frontImageSelected);
    else localStorage.removeItem(SELECTED_FRONT_KEY);

    if (backImageSelected)
      localStorage.setItem(SELECTED_BACK_KEY, backImageSelected);
    else localStorage.removeItem(SELECTED_BACK_KEY);
  }, [frontImageSelected, backImageSelected]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // 3. FILE HANDLERS (CHAT CONTEXT)
  const handleFileProcess = async (file: File) => {
    const url = URL.createObjectURL(file);
    setPreviewUrls((prev) => [...prev, url]);
    try {
      const newImageId = nanoid();
      await db.images.add({ id: newImageId, blob: file, createdAt: new Date() });
      setChatImageIds((prev) => [...prev, newImageId]);
    } catch (err) {
      console.error(err);
    }
  };

  const onFile = (file?: File) => {
    if (file) handleFileProcess(file);
  };

  // ---------------------------------------------------------
  // 🆕 DIRECT MOCKUP UPLOAD HANDLER (SKIPS AI)
  // ---------------------------------------------------------
  const handleDirectMockupUpload = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const manualId = `manual-${nanoid(6)}`;

    const designData = {
      productImage: null,
      frontUploadedImages: [
        { id: 1, src: url, x: 0, y: 0, width: 500, height: 500 },
      ],
      backUploadedImages: [],
      frontTextElements: [],
      backTextElements: [],
      isViewingBack: false,
      selectedProductId: manualId,
      selectedProductName: 'Custom Mockup Upload',
      selectedProductCategory: 'custom',
      productColor: '#FFFFFF',
    };

    if (typeof window !== 'undefined') {
      localStorage.setItem(
        `designData_${manualId}`,
        JSON.stringify(designData)
      );
    }

    router.push(`/manual-order?productId=${manualId}&isCustom=true`);
  };

  const removePreview = (index: number) => {
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
    setChatImageIds((prev) => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    const node = dropRef.current;
    if (!node) return;

    const prevent = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDrop = (e: DragEvent) => {
      prevent(e);
      const files = e.dataTransfer?.files;
      if (files && files[0]) handleFileProcess(files[0]);
    };

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
      node.addEventListener(eventName as any, prevent);
    });
    node.addEventListener('drop', handleDrop as any);

    return () => {
      ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
        node.removeEventListener(eventName as any, prevent);
      });
      node.removeEventListener('drop', handleDrop as any);
    };
  }, []);

  useEffect(() => {
    if (!searchParams) return;

    const fromOrderQuantity =
      searchParams.get('fromOrderQuantity') === 'true';

    if (!fromOrderQuantity) return;

    const productName = searchParams.get('productName');
    const productCategory = searchParams.get('productCategory');
    const isCustom = searchParams.get('isCustom') === 'true';

    if (productName && productCategory) {
      setOrderMetadata({
        category: decodeURIComponent(productCategory),
        name: decodeURIComponent(productName),
        pricingMode: isCustom ? 'manual_quote' : 'catalog_markup',
      });
      setOrderPinned(true);
    }
  }, [searchParams]);

  // 4. SEND LOGIC
  const handleSend = async () => {
    if (isLoading || (!message.trim() && chatImageIds.length === 0)) return;

    setIsLoading(true);
    const userMessage = message;
    const userImagePointers = [...chatImageIds];
    const userImageUrls = [...previewUrls];

    setChatHistory((prev) => [
      ...prev,
      {
        role: 'user',
        text: userMessage,
        imageUrls: userImageUrls.length > 0 ? userImageUrls : undefined,
        imagePointers: userImagePointers.length > 0 ? userImagePointers : undefined,
      },
    ]);

    setMessage('');
    setPreviewUrls([]);
    setChatImageIds([]);

    try {
      const inputImagesBase64: string[] = [];
      for (const ptr of userImagePointers) {
        const record = await db.images.get(ptr);
        if (record) {
          const b64 = await blobToBase64(record.blob);
          inputImagesBase64.push(b64);
        }
      }

      // fallback to front/back pointers if no new images
      if (inputImagesBase64.length === 0) {
        const lower = userMessage.toLowerCase();
        const mentionsBack =
          lower.includes('back') ||
          lower.includes('rear') ||
          lower.includes('behind') ||
          lower.includes('spine');
        const mentionsFront =
          lower.includes('front') ||
          lower.includes('chest') ||
          lower.includes('face');

        let targetPointer: string | null = null;
        if (mentionsBack) {
          targetPointer = backImagePointer || frontImagePointer || null;
        } else if (mentionsFront) {
          targetPointer = frontImagePointer || backImagePointer || null;
        } else {
          targetPointer = frontImagePointer || backImagePointer || null;
        }

        if (targetPointer) {
          const record = await db.images.get(targetPointer);
          if (record) {
            const b64 = await blobToBase64(record.blob);
            inputImagesBase64.push(b64);
          }
        }
      }

      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? '';

      const res = await fetch(`${apiBase}/api/product-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          history: backendHistory,
          inputImages: inputImagesBase64,
          draftId: sessionId ?? undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      // 🔐 Persist session metadata from backend
      const returnedSession = data.session || {};
      const newId: string | undefined =
        data.designSessionId || data.draftId || returnedSession.id;

      if (newId) {
        setSessionId(newId);
        setCartDesignSessionId(newId);

        if (typeof window !== 'undefined') {
          localStorage.setItem(SESSION_ID_KEY, newId);
        }

        const storageId =
          searchParams.get('cartItemId') || searchParams.get('productId');

        if (storageId && typeof window !== 'undefined') {
          window.localStorage.setItem(`design_session_${storageId}`, newId);

          try {
            const existingMetaRaw = window.localStorage.getItem(
              `orderMeta_${storageId}`,
            );
            const existingMeta = existingMetaRaw ? JSON.parse(existingMetaRaw) : null;

            const updatedMeta = {
              ...(existingMeta || {}),
              source: 'chat' as const,
              productId: storageId,
              sessionId: newId,
            };

            window.localStorage.setItem(
              `orderMeta_${storageId}`,
              JSON.stringify(updatedMeta),
            );
          } catch {
            // ignore
          }
        }

        let createdAtMs: number | null = null;
        const createdAtRaw = returnedSession.createdAt;

        if (typeof createdAtRaw === 'number') {
          createdAtMs = createdAtRaw;
        } else if (typeof createdAtRaw === 'string') {
          const parsed = Date.parse(createdAtRaw);
          if (!Number.isNaN(parsed)) createdAtMs = parsed;
        }

        if (!createdAtMs) {
          createdAtMs = Date.now();
        }

        setSessionCreatedAt(createdAtMs);
        if (typeof window !== 'undefined') {
          localStorage.setItem(SESSION_CREATED_AT_KEY, String(createdAtMs));
        }
      }

      // ✅ canonical history + persistence
      if (Array.isArray(data.history)) {
        const updatedHistory = data.history;
        setBackendHistory(updatedHistory);
        // no extra POST needed; product-chat already persisted to Firestore
      }

      if (data.orderMetadata && !orderPinned) {
        setOrderMetadata({
          category: data.orderMetadata.category ?? 'unknown',
          name: data.orderMetadata.name ?? 'custom',
          pricingMode:
            data.orderMetadata.pricingMode === 'catalog_markup'
              ? 'catalog_markup'
              : 'manual_quote',
        });
      }

      let aiText = '';
      const newImageUrls: string[] = [];
      const newImageIds: string[] = [];

      if (data.parts) {
        for (const part of data.parts) {
          if (part.type === 'text') {
            aiText += part.text;
          } else if (part.type === 'image' && part.base64) {
            const imgRes = await fetch(part.base64);
            const blob = await imgRes.blob();
            const url = URL.createObjectURL(blob);
            const id = nanoid();
            await db.images.add({
              id,
              blob,
              createdAt: new Date(),
            });
            newImageUrls.push(url);
            newImageIds.push(id);
          }
        }
      }

      setChatHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: aiText,
          imageUrls: newImageUrls.length > 0 ? newImageUrls : undefined,
          imagePointers: newImageIds.length > 0 ? newImageIds : undefined,
        },
      ]);
    } catch (err: any) {
      console.error('❌ ChatBox error:', err);
      setChatHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `Sorry, an error occurred: ${err.message}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // 5. INTENT PARSING
  const getIntentFromHistory = (
    msgIndex: number
  ): 'front' | 'back' | 'neutral' => {
    if (msgIndex === 0) return 'neutral';
    const prevMsg = chatHistory[msgIndex - 1];
    if (prevMsg && prevMsg.role === 'user') {
      const text = prevMsg.text.toLowerCase();
      if (
        text.includes('back') ||
        text.includes('rear') ||
        text.includes('behind') ||
        text.includes('spine')
      ) {
        return 'back';
      }
      if (
        text.includes('front') ||
        text.includes('chest') ||
        text.includes('face')
      ) {
        return 'front';
      }
    }
    return 'neutral';
  };

  // 6. SELECT LOGIC
  const handleUseImage = async (
    imgUrl: string,
    imgPointer: string | undefined,
    targetSide: 'front' | 'back'
  ) => {
    if (!imgUrl) return;

    if (targetSide === 'front') {
      if (frontImageSelected === imgUrl) {
        setFrontImageSelected(null);
        setFrontImagePointer(null);
        return;
      }
      setFrontImageSelected(imgUrl);
      setFrontImagePointer(imgPointer || null);
    } else if (targetSide === 'back') {
      if (backImageSelected === imgUrl) {
        setBackImageSelected(null);
        setBackImagePointer(null);
        return;
      }
      setBackImageSelected(imgUrl);
      setBackImagePointer(imgPointer || null);
    }
  };

  const handleSendImageByEmail = async (
    imgPointer?: string,
    imgUrl?: string
  ) => {
    try {
      // 1️⃣ Ask where to send it
      const email =
        typeof window !== "undefined"
          ? window.prompt("What email should we send this design to?")
          : null;

      if (!email) {
        return; // user cancelled
      }

      // 2️⃣ Get base64 for the FRONT image (this card)
      let frontImageBase64: string | null = null;

      // Prefer IndexedDB pointer if we have one
      if (imgPointer) {
        const record = await db.images.get(imgPointer);
        if (record?.blob) {
          frontImageBase64 = await blobToBase64(record.blob as Blob);
        }
      }

      // Fallback: fetch from object URL if pointer is missing
      if (!frontImageBase64 && imgUrl) {
        const res = await fetch(imgUrl);
        const blob = await res.blob();
        frontImageBase64 = await blobToBase64(blob);
      }

      if (!frontImageBase64) {
        console.warn("No image data found to email");
        return;
      }

      // 3️⃣ Build designDetails payload expected by backend
      const designDetails = {
        productName: orderMetadata?.name ?? "Custom Auren Design",
        color: "#FFFFFF", // or plug in a real color if you have it here
      };

      // 4️⃣ Call the *backend* route: /api/send-design
      const apiBase =
        process.env.NEXT_PUBLIC_API_URL || ""; // e.g. "https://api.auren.co"

      const res = await fetch(`${apiBase}/api/send-design`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          frontImageBase64,
          backImageBase64: null, // you can wire this up later if you want
          designDetails,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("Failed to send email", text);
        alert("We couldn't send that email. Please try again.");
        return;
      }

      alert("Design sent by email!");
    } catch (err) {
      console.error("Error emailing design", err);
      alert("Something went wrong sending the email.");
    }
  };

  const goToNextPage = () => {
    if (!frontImageSelected || !backImageSelected) return;

    const designData = {
      productImage: null,
      frontUploadedImages: frontImageSelected
        ? [
          {
            id: 1,
            src: frontImageSelected,
            x: 0,
            y: 0,
            width: 500,
            height: 500,
          },
        ]
        : [],
      backUploadedImages: backImageSelected
        ? [
          {
            id: 1,
            src: backImageSelected,
            x: 0,
            y: 0,
            width: 500,
            height: 500,
          },
        ]
        : [],
      frontTextElements: [],
      backTextElements: [],
      isViewingBack: false,
      canvasWidth: 500,
      canvasHeight: 500,
      selectedProductId: 'ai-generated',
      selectedProductName: 'AI Generated Design',
      selectedProductCategory: 'custom',
      productColor: '#FFFFFF',
      frontMask: null,
      backMask: null,
    };

    let targetPath = '/manual-order';
    let productId: string = designData.selectedProductId;
    let productName: string | null =
      designData.selectedProductName;
    let productCategory: string | null =
      designData.selectedProductCategory;
    let isCustom = true;

    const editingExisting =
      searchParams.get('fromOrderQuantity') === 'true';

    if (editingExisting) {
      const existingId =
        searchParams.get('productId') ??
        designData.selectedProductId;
      const existingName = searchParams.get('productName');
      const existingCategory = searchParams.get('productCategory');
      const existingIsCustom =
        searchParams.get('isCustom') === 'true';

      productId = existingId;
      productName = existingName ?? productName;
      productCategory = existingCategory ?? productCategory;
      isCustom = existingIsCustom;

      designData.selectedProductId = productId;
      designData.selectedProductName =
        productName ?? designData.selectedProductName;
      designData.selectedProductCategory =
        productCategory ?? designData.selectedProductCategory;

      targetPath = isCustom ? '/manual-order' : '/order-quantity';
    } else if (
      orderMetadata &&
      orderMetadata.pricingMode === 'catalog_markup' &&
      orderMetadata.category !== 'unknown'
    ) {
      const normalizedName = orderMetadata.name.toLowerCase();
      const normalizedCategory =
        orderMetadata.category.toLowerCase();
      const slug = `${normalizedCategory}-${normalizedName}`.replace(
        /\s+/g,
        '-'
      );

      designData.selectedProductId = slug;
      designData.selectedProductName = orderMetadata.name;
      designData.selectedProductCategory = orderMetadata.category;

      productId = slug;
      productName = orderMetadata.name;
      productCategory = orderMetadata.category;
      isCustom = false;
      targetPath = '/order-quantity';
    }

    if (typeof window !== 'undefined') {
      // Save design data as before
      localStorage.setItem(
        `designData_${designData.selectedProductId}`,
        JSON.stringify(designData)
      );

      // If this is going into the normal cart/order flow, tag it as chat-origin
      if (targetPath === '/order-quantity') {
        const cartId = productId;

        const meta = {
          source: 'chat' as const,
          productId: cartId,
          sessionId: sessionId ?? null,
        };

        window.localStorage.setItem(
          `orderMeta_${cartId}`,
          JSON.stringify(meta)
        );

        if (sessionId) {
          window.localStorage.setItem(
            `design_session_${cartId}`,
            sessionId
          );
        }
      }
    }

    if (targetPath === '/order-quantity') {
      const qs = new URLSearchParams({
        cartItemId: productId, // 👈 so product-showcase/edit can route back here
        productId,
        productName: productName ?? '',
        productCategory: productCategory ?? '',
        isCustom: isCustom ? 'true' : 'false',
        fromChat: 'true',
      });
      router.push(`${targetPath}?${qs.toString()}`);
    } else {
      const qs = new URLSearchParams({
        productId,
        isCustom: isCustom ? 'true' : 'false',
      });
      router.push(`${targetPath}?${qs.toString()}`);
    }
  };

  const glassButtonStyle =
    'absolute bottom-3 left-1/2 -translate-x-1/2 z-20 bg-white/12 text-white text-xs font-medium px-3 py-1.5 rounded-full ring-1 ring-white/25 backdrop-blur-md hover:bg-white/20 transition whitespace-nowrap';
  const selectedButtonStyle =
    'absolute bottom-3 left-1/2 -translate-x-1/2 z-20 bg-white text-black text-xs font-bold px-3 py-1.5 rounded-full shadow-[0_0_15px_rgba(255,255,255,0.4)] transition whitespace-nowrap';

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
              Describe your idea to our AI — or if you already have a
              design, upload your mockup to get a quote instantly.
            </p>
          </motion.div>

          <motion.div
            className="mt-8 w-full max-w-3xl flex flex-col items-end"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            {previewUrls.length > 0 && (
              <div className="mb-3 flex flex-wrap justify-end gap-3">
                {previewUrls.map((url, idx) => (
                  <div
                    key={idx}
                    className="relative w-20 h-20 rounded-lg overflow-hidden border border-white/20 bg-black/50 backdrop-blur-md group"
                  >
                    <Image
                      src={url}
                      alt="preview"
                      fill
                      className="object-cover"
                    />
                    <button
                      onClick={() => removePreview(idx)}
                      className="absolute top-1 right-1 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="relative flex items-center gap-3 rounded-2xl border border-white/15 bg-black/40 backdrop-blur-xl px-3 py-2 shadow-2xl ring-1 ring-white/10 w-full z-20">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/5 border border-white/20">
                <Image
                  src="/auren_white_logo.png"
                  alt="Auren"
                  width={22}
                  height={22}
                />
              </div>
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={
                  !frontImageSelected
                    ? 'Describe the front...'
                    : 'Describe the back...'
                }
                className="flex-1 bg-transparent outline-none placeholder-white/50 text-white text-base sm:text-lg"
              />

              {/* Chat-context upload */}
              <label className="relative grid place-items-center w-10 h-10 rounded-lg border border-white/20 bg-white/10 hover:bg-white/15 transition cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) =>
                    onFile(e.target.files?.[0] || undefined)
                  }
                />
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="text-white"
                >
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

              <button
                onClick={handleSend}
                disabled={isLoading}
                className="grid place-items-center w-10 h-10 rounded-lg bg-white/10 border border-white/20 text-white hover:bg.white/15 transition"
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
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
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

            {/* Direct mockup upload CTA */}
            <div className="w-full flex items-center justify-center gap-3 mt-10 mb-6 opacity-90">
              <div className="h-px w-20 bg-white/40" />
              <span className="text-sm font-bold text-white/80 uppercase tracking-widest">
                OR
              </span>
              <div className="h-px w-20 bg-white/40" />
            </div>

            <label className="relative flex items-center justify-center gap-4 px-8 py-4 rounded-full bg-white/20 hover:bg-white/30 border-2 border-white/60 transition-all duration-300 cursor-pointer group mx-auto shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:scale-[1.02] active:scale-95">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleDirectMockupUpload}
              />
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-white drop-shadow-sm"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span className="text-xl font-extrabold text-white tracking-wider drop-shadow-sm">
                UPLOAD COMPLETED MOCKUP
              </span>
            </label>
          </motion.div>

          <div className="pointer-events-none absolute inset-x-0 bottom-10 flex items-center justify-between px-10">
            <button
              type="button"
              onClick={() => handleExitTo('/catalog')}
              className="pointer-events-auto w-28 h-12 rounded-full bg-white/10 text-white/80 border border-white/20 backdrop-blur-md text-sm font-medium hover:bg-white/20 hover:border-white/40 transition-all"
            >
              Back
            </button>

            <button
              onClick={goToNextPage}
              disabled={!frontImageSelected || !backImageSelected}
              className={`w-32 h-12 rounded-full border text-white text-lg font-semibold transition-all pointer-events-auto ${!frontImageSelected || !backImageSelected
                ? 'bg-white/5 border-white/10 opacity-50 cursor-not-allowed'
                : 'bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/20 hover:border-white/40 shadow-xl'
                }`}
            >
              Next
            </button>
          </div>
        </div>
      ) : (
        <div className="relative z-10 flex flex-col h-screen p-8 pt-32 pb-6">
          <div className="flex-1 overflow-y-auto pr-2 space-y-6 mb-4">
            {chatHistory.map((msg, i) => {
              const intent = getIntentFromHistory(i);
              return (
                <div
                  key={i}
                  className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                >
                  {msg.role === 'user' ? (
                    <div className="flex flex-col items-end gap-2 max-w-[80%]">
                      {msg.imageUrls && msg.imageUrls.length > 0 && (
                        <div className="flex flex-wrap gap-2 justify-end mb-2">
                          {msg.imageUrls.map((url, idx) => (
                            <div
                              key={idx}
                              className="relative rounded-xl overflow-hidden border border-white/10 w-24 h-24"
                            >
                              <Image
                                src={url}
                                alt="upload"
                                fill
                                className="object-contain p-1"
                                unoptimized
                              />
                            </div>
                          ))}
                        </div>
                      )}
                      {msg.text && (
                        <div className="px-4 py-3 rounded-2xl bg-blue-600 text-white shadow-md">
                          <p className="whitespace-pre-wrap text-sm">
                            {msg.text}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-start gap-4 max-w-full">
                      {msg.imageUrls && msg.imageUrls.length > 0 && (
                        <div className="flex flex-wrap gap-6 justify-start">
                          {msg.imageUrls.map((url, idx) => {
                            const isSelectedAsFront =
                              frontImageSelected === url;
                            const isSelectedAsBack =
                              backImageSelected === url;
                            const pointer =
                              msg.imagePointers?.[idx];

                            let buttonAction: 'front' | 'back' =
                              'front';
                            let buttonLabel = 'Use as Front';

                            if (isSelectedAsFront) {
                              buttonLabel = 'Selected (Front)';
                            } else if (isSelectedAsBack) {
                              buttonLabel = 'Selected (Back)';
                              buttonAction = 'back';
                            } else {
                              if (intent === 'back') {
                                buttonAction = 'back';
                                buttonLabel = 'Use as Back';
                              } else if (frontImageSelected) {
                                buttonAction = 'back';
                                buttonLabel = 'Use as Back';
                              } else {
                                buttonAction = 'front';
                                buttonLabel = 'Use as Front';
                              }
                            }

                            return (
                              <motion.div
                                key={idx}
                                className="relative w-[340px] h-[340px] rounded-[28px] overflow-hidden bg.white/5 border border-white/10 shadow-2xl shrink-0 group"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{
                                  opacity: 1,
                                  y: 0,
                                }}
                              >
                                <Image
                                  src={url}
                                  alt="design"
                                  fill
                                  className="object-contain p-6 transition-transform duration-700 hover:scale-105"
                                  unoptimized
                                />
                                {/* Email send button (top-right of generated image) */}
                                <button
                                  type="button"
                                  onClick={() => handleSendImageByEmail(pointer, url)}
                                  className="absolute top-3 right-3 rounded-full bg-black/70 border border-white/40 px-3 py-1 text-xs font-semibold text-white shadow-lg hover:bg-black/90 transition-colors"
                                >
                                  Email
                                </button>

                                <button
                                  onClick={() =>
                                    handleUseImage(
                                      url,
                                      pointer,
                                      buttonAction
                                    )
                                  }
                                  className={
                                    isSelectedAsFront ||
                                      isSelectedAsBack
                                      ? selectedButtonStyle
                                      : glassButtonStyle
                                  }
                                >
                                  {buttonLabel}
                                </button>
                              </motion.div>
                            );
                          })}
                        </div>
                      )}

                      {msg.text && (
                        <div className="px-5 py-4 rounded-2xl bg-gray-800 border border-white/10 text-white text-sm leading-relaxed shadow-lg max-w-[90%]">
                          {msg.text}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-start mt-4">
                <div className="px-6 py-3 rounded-full bg-gray-800 border border.white/10 animate-pulse">
                  <p className="text-sm text-gray-300 font-medium">
                    Generating...
                  </p>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="flex items-center gap-4 mt-auto w-full relative">
            <button
              type="button"
              onClick={() => handleExitTo('/catalog')}
              className="pointer-events-auto w-28 h-12 rounded-full bg-white/10 text-white/80 border border-white/20 backdrop-blur-md text-sm font-medium hover:bg-white/20 hover:border-white/40 transition-all"
            >
              Back
            </button>

            <div className="relative flex-1 flex items-center gap-3 rounded-2xl border border-white/15 bg-black/40 backdrop-blur-xl px-3 py-2 shadow-2xl ring-1 ring-white/10">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/5 border border-white/20">
                <Image
                  src="/auren_white_logo.png"
                  alt="Auren"
                  width={22}
                  height={22}
                />
              </div>
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={
                  !frontImageSelected
                    ? 'Describe the front...'
                    : 'Describe the back...'
                }
                className="flex-1 bg-transparent outline-none placeholder-white/50 text-white text-base sm:text-lg"
              />
              <label className="relative grid.place-items-center w-10 h-10 rounded-lg border border-white/20 bg-white/10 hover:bg-white/15 transition cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) =>
                    onFile(e.target.files?.[0] || undefined)
                  }
                />
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="text-white"
                >
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
              <button
                onClick={handleSend}
                disabled={isLoading}
                className="grid place-items-center w-10 h-10 rounded-lg bg-white/10 border border-white/20 text-white hover:bg-white/15 transition"
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
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
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

              {previewUrls.length > 0 && (
                <div className="absolute bottom-full mb-4 right-0 z-20 flex items-center gap-3 overflow-x-auto p-3 bg-black/80 rounded-2xl backdrop-blur-xl border border-white/10 max-w-[80%] shadow-2xl">
                  {previewUrls.map((url, idx) => (
                    <div
                      key={idx}
                      className="relative w-20 h-20 rounded-xl overflow-hidden border border-white/20 bg-white/5 shrink-0 group"
                    >
                      <Image
                        src={url}
                        alt="preview"
                        fill
                        className="object-cover"
                      />
                      <button
                        onClick={() => removePreview(idx)}
                        className="absolute top-1 right-1 w-6 h-6 bg-red-600 text.white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 shadow-sm"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={goToNextPage}
                disabled={!frontImageSelected || !backImageSelected}
                className={`w-32 h-12 rounded-full border text-white text-lg font-semibold transition-all ${!frontImageSelected || !backImageSelected
                  ? 'bg-white/5 border-white/10 opacity-50 cursor-not-allowed'
                  : 'bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/20 hover:border-white/40 shadow-xl'
                  }`}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}