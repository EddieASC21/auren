import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { randomUUID } from "crypto";
import { Storage } from "@google-cloud/storage";
import { db } from "@/lib/firestore";

// -------------------------
// AI client
// -------------------------
const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY,
});

// ✅ Limit history we send to Gemini
const MAX_HISTORY_TURNS = 12;
// ✅ Limit how many turns we store in Firestore
const MAX_STORED_TURNS = 60;

// -------------------------
// Firestore + GCS setup
// -------------------------
const storage = new Storage({
  projectId: process.env.GOOGLE_PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

const DESIGN_SESSIONS_COLLECTION = "designSessions";
const PRODUCT_SESSIONS_COLLECTION = "productSessions";
const GCS_BUCKET_NAME = process.env.GCP_BUCKET_NAME || "auren-user-designs";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

type SessionSide = "front" | "back";

type DesignSession = {
  id: string;
  activeSide: SessionSide;

  // GCS object paths (for cleanup)
  currentFrontImagePath?: string | null;
  currentBackImagePath?: string | null;

  // Public URLs (for UI)
  currentFrontImageUrl?: string | null;
  currentBackImageUrl?: string | null;

  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  history?: any[];
};

type SaveImageResult = {
  path: string;
  url: string;
  side: SessionSide;
};

// For user-uploaded images
type UploadRef = { path: string; url: string };

// -------------------------
// Session helpers
// -------------------------
async function loadOrCreateSession(
  rawSessionId?: string | null
): Promise<{ sessionId: string; session: DesignSession }> {
  const now = new Date();
  const sessionId =
    rawSessionId && rawSessionId.trim().length > 0
      ? rawSessionId.trim()
      : randomUUID();

  const ref = db.collection(DESIGN_SESSIONS_COLLECTION).doc(sessionId);
  const snap = await ref.get();

  // No existing session → create fresh
  if (!snap.exists) {
    const fresh: DesignSession = {
      id: sessionId,
      activeSide: "front",
      currentFrontImagePath: null,
      currentBackImagePath: null,
      currentFrontImageUrl: null,
      currentBackImageUrl: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      history: [],
    };
    await ref.set(fresh);
    return { sessionId, session: fresh };
  }

  const data = snap.data() as DesignSession;
  const createdAtMs = new Date(data.createdAt).getTime();
  const isExpired = Date.now() - createdAtMs > SESSION_TTL_MS;

  // Expired session → cleanup + create a new one
  if (isExpired) {
    try {
      await cleanupSessionImages(data);
    } catch (err) {
      console.warn("⚠️ Failed to cleanup expired session images:", err);
    }
    await ref.delete();

    const newSessionId = randomUUID();
    const fresh: DesignSession = {
      id: newSessionId,
      activeSide: "front",
      currentFrontImagePath: null,
      currentBackImagePath: null,
      currentFrontImageUrl: null,
      currentBackImageUrl: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      history: [],
    };

    await db
      .collection(DESIGN_SESSIONS_COLLECTION)
      .doc(newSessionId)
      .set(fresh);

    return { sessionId: newSessionId, session: fresh };
  }

  return { sessionId, session: data };
}

export async function cleanupSessionImages(
  session: DesignSession
): Promise<void> {
  if (!GCS_BUCKET_NAME) {
    console.warn("[product-chat] GCP_BUCKET_NAME not set; skipping GCS cleanup");
    return;
  }

  const bucket = storage.bucket(GCS_BUCKET_NAME);

  // 1) Try to delete specifically stored image paths (if present)
  const paths: (string | null | undefined)[] = [
    session.currentFrontImagePath,
    session.currentBackImagePath,
  ];

  for (const p of paths) {
    if (!p) continue;
    try {
      await bucket.file(p).delete({ ignoreNotFound: true });
      console.log("[product-chat] Deleted GCS object:", p);
    } catch (err) {
      console.warn("[product-chat] Failed to delete GCS object:", p, err);
    }
  }

  // 2) Extra safety: delete everything under sessions/<session.id>/
  if (session.id) {
    const prefix = `sessions/${session.id}/`;
    try {
      await bucket.deleteFiles({ prefix });
      console.log("[product-chat] Deleted GCS files with prefix:", prefix);
    } catch (err: any) {
      if (err?.code === 404) {
        console.warn(
          "[product-chat] No GCS files found for prefix:",
          prefix
        );
      } else {
        console.warn(
          "[product-chat] Failed to delete GCS files for session id:",
          session.id,
          err
        );
      }
    }
  }
}

async function saveImageForSession(
  sessionId: string,
  session: DesignSession,
  side: SessionSide,
  base64Image: string
): Promise<{ session: DesignSession; saved?: SaveImageResult }> {
  if (!GCS_BUCKET_NAME) {
    console.warn("⚠️ GCP_BUCKET_NAME not set; skipping upload.");
    return { session, saved: undefined };
  }

  const bucket = storage.bucket(GCS_BUCKET_NAME);
  const buffer = Buffer.from(base64Image, "base64");
  const filename = `${side}-${Date.now()}.png`;
  const path = `sessions/${sessionId}/${filename}`;
  const file = bucket.file(path);

  // ✅ Updated for Uniform bucket-level access (no `public: true`, no ACLs)
  await file.save(buffer, {
    contentType: "image/png",
    resumable: false,
    metadata: { cacheControl: "public, max-age=31536000" },
  });

  const publicUrl = `https://storage.googleapis.com/${GCS_BUCKET_NAME}/${path}`;

  const nowIso = new Date().toISOString();
  const updatedSession: DesignSession = {
    ...session,
    activeSide: side,
    updatedAt: nowIso,
  };

  if (side === "front") {
    updatedSession.currentFrontImagePath = path;
    updatedSession.currentFrontImageUrl = publicUrl;
  } else {
    updatedSession.currentBackImagePath = path;
    updatedSession.currentBackImageUrl = publicUrl;
  }

  await db
    .collection(DESIGN_SESSIONS_COLLECTION)
    .doc(sessionId)
    .set(updatedSession, { merge: true });

  return {
    session: updatedSession,
    saved: { path, url: publicUrl, side },
  };
}

// 🔁 Save user-uploaded logos/images (NOT model-generated)
async function saveUserUploadImages(
  sessionId: string,
  base64Images: string[]
): Promise<UploadRef[]> {
  if (!GCS_BUCKET_NAME || !base64Images?.length) return [];

  const bucket = storage.bucket(GCS_BUCKET_NAME);
  const uploads: UploadRef[] = [];

  for (let i = 0; i < base64Images.length; i++) {
    const raw = base64Images[i];

    const match = raw.match(
      /^data:(image\/[a-zA-Z0-9+.+-]+);base64,(.*)$/
    );
    const mimeType = match ? match[1] : "image/png";
    const data = match ? match[2] : raw;

    const buffer = Buffer.from(data, "base64");
    const ext = mimeType.split("/")[1] || "png";
    const filename = `user-${Date.now()}-${i}.${ext}`;
    const path = `sessions/${sessionId}/${filename}`;
    const file = bucket.file(path);

    await file.save(buffer, {
      contentType: mimeType,
      resumable: false,
      metadata: { cacheControl: "public, max-age=31536000" },
    });

    const url = `https://storage.googleapis.com/${GCS_BUCKET_NAME}/${path}`;
    uploads.push({ path, url });
  }

  return uploads;
}

// ---------- Types for order routing ----------
type PricingMode = "catalog_markup" | "manual_quote";
type OrderCategory = "mens" | "womens" | "others" | "unknown";

type OrderMetadata = {
  category: OrderCategory;
  name: string;
  pricingMode: PricingMode;
};

// 🤖 The AI Decision Schema
type RawDecision = {
  reply: string;
  shouldGenerateImage: boolean;
  visualPrompt: string; // The "translation" for the artist
  intendedView: "front" | "back" | "default"; // Smart view detection
  productCategory?: string;
  productName?: string;
  pricingMode: PricingMode;
};

// 🧾 CATALOG NAMES
const CATALOG_NAMES: Record<OrderCategory, string[]> = {
  mens: [
    "t-shirt",
    "polo",
    "hoodie",
    "sweatshirt",
    "quarter zip",
    "long sleeve",
    "vest",
    "shorts",
    "sports short",
    "sports shirt",
    "sweatpants",
    "tank top",
  ],
  womens: [
    "t-shirt",
    "polo",
    "sweatshirt",
    "hoodie",
    "quarter zip",
    "long sleeve",
    "vest",
    "skirt",
    "sweatshorts",
    "sports bra",
    "sports shirt",
    "sports shorts",
    "sweatpants",
    "tank top",
    "baby tee", // 👈 NEW
    "spandex shorts", // 👈 NEW
  ],
  others: [
    "backpack",
    "baseball hat",
    "beanie",
    "bottle",
    "notebook",
    "tote bag",
    "tumbler",
    "tumbler bottle",
    "mug",
    "sock outer side",
    "sock inner side",
    "stationery",
  ],
  unknown: [],
};

// Normalize names to catalog keys
function canonicalizeProductName(raw: string | undefined): string | null {
  if (!raw) return null;
  const n = raw.toLowerCase().trim();
  if (!n) return null;

  // Standard mappings
  if (["tee", "t shirt", "t-shirt", "tshirt"].includes(n)) return "t-shirt";
  if (["crewneck", "crew neck", "sweatshirt"].includes(n)) return "sweatshirt";
  if (["quarter zip", "quarter-zip", "1/4 zip"].includes(n)) return "quarter zip";
  if (["long sleeve", "long-sleeve", "longsleeve"].includes(n))
    return "long sleeve";
  if (n === "vest") return "vest";
  if (n === "shorts") return "shorts";
  if (n === "sports short" || n === "sport short") return "sports short";
  if (n === "sports shirt" || n === "jersey") return "sports shirt";
  if (n === "sports shorts") return "sports shorts";
  if (["sweatpants", "joggers"].includes(n)) return "sweatpants";
  if (["tank", "tank top"].includes(n)) return "tank top";
  if (n === "sock outer") return "sock outer side";
  if (n === "sock inner") return "sock inner side";
  if (n === "pen") return "stationery";

  // 👇 NEW: Baby Tee logic
  if (["baby tee", "baby t-shirt", "crop top", "cropped tee"].includes(n))
    return "baby tee";

  // 👇 NEW: Spandex Logic
  if (
    ["spandex shorts", "spandex", "biker shorts", "cycling shorts"].includes(n)
  )
    return "spandex shorts";

  // Direct matches
  if (CATALOG_NAMES.mens.includes(n)) return n;
  if (CATALOG_NAMES.womens.includes(n)) return n;
  if (CATALOG_NAMES.others.includes(n)) return n;

  return null;
}

function isInCatalog(canonicalName: string): boolean {
  return (
    CATALOG_NAMES.mens.includes(canonicalName) ||
    CATALOG_NAMES.womens.includes(canonicalName) ||
    CATALOG_NAMES.others.includes(canonicalName)
  );
}

function resolveCategory(
  modelCategory: string | undefined,
  canonicalName: string
): OrderCategory {
  const c = (modelCategory || "").toLowerCase();
  if (c === "mens" || c === "womens" || c === "others") return c;
  if (CATALOG_NAMES.mens.includes(canonicalName)) return "mens";
  if (CATALOG_NAMES.womens.includes(canonicalName)) return "womens";
  if (CATALOG_NAMES.others.includes(canonicalName)) return "others";
  return "unknown";
}

// 🛡️ Ensure valid metadata for checkout
function coerceOrderMetadata(decision: RawDecision): OrderMetadata {
  const rawName = decision.productName?.toLowerCase().trim();
  const canonicalName = canonicalizeProductName(rawName);

  // 1. In Catalog -> Standard Markup
  if (canonicalName && isInCatalog(canonicalName)) {
    return {
      category: resolveCategory(decision.productCategory, canonicalName),
      name: canonicalName,
      pricingMode: "catalog_markup",
    };
  }

  // 2. Not in Catalog (Jeans, Umbrella) -> Manual Quote
  return {
    category: "unknown",
    name: rawName || "custom_item",
    pricingMode: "manual_quote",
  };
}

// --- CORS ---
function getCorsHeaders(requestOrigin: string | null) {
  const allowedOrigins = [
    "http://localhost:3000",
    "https://auren.co",
    "https://www.auren.co",
    process.env.FRONTEND_URL,
  ];
  const originToAllow = allowedOrigins.includes(requestOrigin || "")
    ? requestOrigin
    : "https://auren.co";

  return {
    "Access-Control-Allow-Origin": originToAllow || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

// --- 🟢 HELPER: Green Screen Remover ---
async function removeGreenBackground(base64Input: string): Promise<string> {
  const inputBuffer = Buffer.from(base64Input, "base64");
  const { data, info } = await sharp(inputBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const pixelCount = width * height;
  const mask = new Uint8Array(pixelCount);

  // 1. Detect Green
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];
    const rn = r / 255,
      gn = g / 255,
      bn = b / 255;
    const maxC = Math.max(rn, gn, bn),
      minC = Math.min(rn, gn, bn);
    const delta = maxC - minC;

    let isGreen = false;
    if (delta > 0) {
      let h = 0;
      if (maxC === rn) h = 60 * (((gn - bn) / delta) % 6);
      else if (maxC === gn) h = 60 * (((bn - rn) / delta) + 2);
      else h = 60 * (((rn - gn) / delta) + 4);
      if (h < 0) h += 360;

      const s = delta / maxC;
      const v = maxC;
      const hsvGreen = h >= 70 && h <= 170 && s >= 0.35 && v >= 0.55;
      const rgbGreen = g > 110 && g > r + 20 && g > b + 20;
      isGreen = hsvGreen || rgbGreen;
    }
    if (isGreen) mask[i / 4] = 1;
  }

  // 2. Expand Mask
  const expandedMask = new Uint8Array(pixelCount);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (mask[idx]) {
        expandedMask[idx] = 1;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx,
              ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              expandedMask[ny * width + nx] = 1;
            }
          }
        }
      }
    }
  }

  // 3. Apply Alpha
  for (let i = 0; i < data.length; i += 4) {
    if (expandedMask[i / 4]) data[i + 3] = 0;
  }

  return (
    await sharp(data, { raw: { width, height, channels: 4 } })
      .png()
      .toBuffer()
  ).toString("base64");
}

// --- 🔁 HELPER: Fetch a URL and return base64 ---
async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn("[product-chat] fetchImageAsBase64 non-200:", res.status, url);
      return null;
    }
    const arrayBuf = await res.arrayBuffer();
    return Buffer.from(arrayBuf).toString("base64");
  } catch (err) {
    console.warn("[product-chat] fetchImageAsBase64 failed:", url, err);
    return null;
  }
}

// ---------------------------------------------------------
// ROUTE HANDLERS
// ---------------------------------------------------------
export async function POST(req: Request) {
  const origin = req.headers.get("origin");

  try {
    const body = await req.json();
    const message: string = body?.message ?? body?.userMsg ?? "";
    const history = body.history || body.chatHistory || [];
    const inputImages = body.inputImages || [];
    const incomingDraftId = body?.draftId;
    const incomingSessionId = body?.sessionId;

    const { sessionId, session: initialSession } = await loadOrCreateSession(
      incomingDraftId || incomingSessionId
    );
    let session = initialSession;

    // 🔹 Full history from the client (keep imageUrl, imageSide, etc.)
    const incomingHistory: any[] = Array.isArray(history) ? history : [];

    // 🔹 Text-only copy for Gemini
    const geminiHistory = incomingHistory
      .map((h: any) => ({
        role: h.role,
        parts: (h.parts || [])
          .filter((p: any) => p.text)
          .map((p: any) => ({ text: p.text })),
      }))
      .filter((h: any) => h.parts.length > 0);

    const truncatedGeminiHistory = geminiHistory.slice(-MAX_HISTORY_TURNS);

    // 2. GEMINI (Conversationalist)
    const conversationalistResult = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            reply: { type: "STRING" },
            shouldGenerateImage: { type: "BOOLEAN" },
            // 🗣️ The Translation for the Artist
            visualPrompt: {
              type: "STRING",
              description:
                "Detailed description for the image generator. MUST include the item name. E.g. 'A blue baby tee with a star logo'.",
            },
            // 👀 Smart View Detection
            intendedView: { type: "STRING", enum: ["front", "back", "default"] },
            productCategory: {
              type: "STRING",
              enum: ["mens", "womens", "others", "unknown"],
            },
            productName: { type: "STRING" },
            pricingMode: {
              type: "STRING",
              enum: ["catalog_markup", "manual_quote"],
            },
          },
          required: ["reply", "shouldGenerateImage", "pricingMode", "visualPrompt"],
        },
        systemInstruction: `
You are an expert Fashion Assistant.
CATALOG ITEMS (pricingMode="catalog_markup"):
- Mens: t-shirt, polo, sweatshirt, hoodie, quarter zip, long sleeve, vest, shorts, sports short, sports shirt, sweatpants, tank top.
- Womens: t-shirt, polo, sweatshirt, hoodie, quarter zip, long sleeve, vest, skirt, sweatshorts, sports bra, sports shirt, sports shorts, sweatpants, tank top, baby tee, spandex shorts.
- Others: backpack, tote bag, baseball hat, beanie, bottle, notebook, tumbler, tumbler bottle, mug, socks, stationery.

CORE RULES:
1. **DESIGNER ROLE (Say YES):** You can design ANYTHING. If user wants "Jeans", "Umbrellas", "Baby Tees" or "Dresses", say YES and generate the image.
2. **SALES ROLE (Metadata):** 
   - Item in Catalog Lists? Set pricingMode = "catalog_markup".
   - Item NOT in lists? Set pricingMode = "manual_quote".

VISUAL PROMPT RULES:
3. You must generate a 'visualPrompt' for the artist model.
4. It must be self-contained. Replace pronouns like "it" with the item name.
   - BAD: "Make it blue."
   - GOOD: "A blue baby tee with a cropped fit and a white logo."
5. If the user edits the design ("add a star"), include the FULL description in visualPrompt.

VIEW RULES:
6. If user mentions "back", "rear", or "behind", set intendedView='back'.
7. Default is always front view.
`,
      },
      contents: [
        ...truncatedGeminiHistory,
        {
          role: "user",
          parts: [{ text: message || "Interactive Design Session" }],
        },
      ],
    });

    const rawText =
      conversationalistResult.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error("Conversationalist returned empty response");
    const decision: RawDecision = JSON.parse(rawText);

    // Force image if user clearly asks, even if AI hesitated
    const userWantsVisual = /design|mockup|preview|image|logo|front|back|hoodie|shirt|tee|shorts/.test(
      (message || "").toLowerCase()
    );
    if (userWantsVisual && !decision.shouldGenerateImage) {
      decision.shouldGenerateImage = true;
    }

    // 3. NANO BANANA (Image Generation)
    const responseParts: any[] = [{ type: "text", text: decision.reply }];
    let generatedImageBase64: string | null = null;
    let savedImage: SaveImageResult | undefined;

    // Determine Side: User Regex OR AI Inference
    const userAskedForBack =
      /back( side| view)?|rear|behind/i.test(message || "");
    const aiSaysBack = decision.intendedView === "back";
    const effectiveSide: SessionSide =
      userAskedForBack || aiSaysBack ? "back" : "front";

    if (decision.shouldGenerateImage) {
      // 🎯 DYNAMIC OBJECT: What are we drawing?
      // Use the productName detected by Gemini, or fallback to 'garment'
      const visualTarget = decision.productName || "garment";

      // 🎨 Use Gemini's translated prompt, not the raw user message
      const promptToUse =
        decision.visualPrompt && decision.visualPrompt.trim().length > 0
          ? decision.visualPrompt
          : message;

      const VISUAL_RULES =
        effectiveSide === "back"
          ? `[STRICT BACK VIEW]
1. Show EXACTLY ONE ${visualTarget}, showing ONLY the BACK.
2. The FRONT must NOT be visible.
3. BACKGROUND: Neon Green (#00FF00).
4. Do NOT draw a second garment.
5. The ${visualTarget} itself must NOT be neon green.`
          : `[STRICT FRONT VIEW]
1. Show EXACTLY ONE ${visualTarget}, showing ONLY the FRONT.
2. The BACK or SIDE must NOT be visible.
3. BACKGROUND: Neon Green (#00FF00).
4. Do NOT draw a second garment.
5. The ${visualTarget} itself must NOT be neon green.`;

      const artistInputParts: any[] = [
        { text: `User request: "${promptToUse}".\nRULES:\n${VISUAL_RULES}` },
      ];

      // 1) Attach any user reference images (logos, etc.) that the frontend sends
      if (inputImages && Array.isArray(inputImages)) {
        inputImages.forEach((imgBase64: string) => {
          const match = imgBase64.match(
            /^data:(image\/[a-zA-Z0-9+.+-]+);base64,(.*)$/
          );
          const mimeType = match ? match[1] : "image/png";
          const data = match ? match[2] : imgBase64;
          artistInputParts.push({ inlineData: { mimeType, data } });
        });
      }

      // 2) If user is asking for the BACK and there are no inputImages,
      //    automatically reuse the last FRONT design from the session.
      if (
        effectiveSide === "back" &&
        (!inputImages || inputImages.length === 0) &&
        session.currentFrontImageUrl
      ) {
        const data = await fetchImageAsBase64(session.currentFrontImageUrl);
        if (data) {
          artistInputParts.push({
            inlineData: {
              mimeType: "image/png",
              data,
            },
          });
        }
      }

      // 3) Optional symmetry: if they go from back → front, reuse the last BACK.
      if (
        effectiveSide === "front" &&
        (!inputImages || inputImages.length === 0) &&
        session.currentBackImageUrl
      ) {
        const data = await fetchImageAsBase64(session.currentBackImageUrl);
        if (data) {
          artistInputParts.push({
            inlineData: {
              mimeType: "image/png",
              data,
            },
          });
        }
      }

      try {
        const imageResult = await ai.models.generateContent({
          model: "gemini-3-pro-image-preview",
          contents: [{ role: "user", parts: artistInputParts }],
        });

        const imgPart =
          imageResult.candidates?.[0]?.content?.parts?.find(
            (p) => (p as any).inlineData
          ) as any;

        if (imgPart?.inlineData?.data) {
          generatedImageBase64 = await removeGreenBackground(
            imgPart.inlineData.data
          ).catch(() => imgPart.inlineData.data as string);

          responseParts.push({
            type: "image",
            base64: `data:image/png;base64,${generatedImageBase64}`,
          });
        }
      } catch (e) {
        console.error("Artist generation failed", e);
      }

      // 4. Save Image
      if (generatedImageBase64) {
        const res = await saveImageForSession(
          sessionId,
          session,
          effectiveSide,
          generatedImageBase64
        );
        session = res.session;
        savedImage = res.saved;

        const imgIdx = responseParts.findIndex((p) => p.type === "image");
        if (imgIdx !== -1 && savedImage) {
          responseParts[imgIdx].side = savedImage.side;
          responseParts[imgIdx].url = savedImage.url;
        }
      }
    }

    // 5. Persist any user-uploaded images for THIS TURN
    let userUploadRefs: UploadRef[] = [];
    if (inputImages && Array.isArray(inputImages) && inputImages.length > 0) {
      try {
        userUploadRefs = await saveUserUploadImages(sessionId, inputImages);
      } catch (err) {
        console.warn("[product-chat] Failed to save user uploads:", err);
      }
    }

    // 6. Finalize Metadata & History
    const orderMetadata = coerceOrderMetadata(decision);

    // Build user entry (text + optional uploaded images)
    const userEntry: any = {
      role: "user",
      parts: [{ text: message }],
    };

    if (userUploadRefs.length > 0) {
      // easy field for the UI
      userEntry.uploadedImages = userUploadRefs.map((u) => u.url);

      // also embed them as parts for richer history
      userEntry.parts.push(
        ...userUploadRefs.map((u) => ({
          imageUrl: u.url,
          imageRole: "upload",
        }))
      );
    }

    // Build model entry, optionally with generated image info
    const modelEntry: any = {
      role: "model",
      parts: [{ text: decision.reply }],
    };

    if (savedImage) {
      // These will be used by the frontend to restore images in chat
      modelEntry.imageUrl = savedImage.url;
      modelEntry.imageSide = savedImage.side;
    }

    // ✅ Preserve all previous history (including older imageUrl fields)
    const newHistory = [...incomingHistory, userEntry, modelEntry];

    // ✅ Soft-cap what we store in Firestore
    const trimmedHistory =
      newHistory.length > MAX_STORED_TURNS
        ? newHistory.slice(-MAX_STORED_TURNS)
        : newHistory;

    await db
      .collection(DESIGN_SESSIONS_COLLECTION)
      .doc(sessionId)
      .set(
        {
          ...session,
          history: trimmedHistory,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

    return NextResponse.json(
      {
        parts: responseParts,
        history: trimmedHistory,
        orderMetadata,
        session,
        designSessionId: sessionId,
        draftId: sessionId,
      },
      { headers: getCorsHeaders(origin) }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: getCorsHeaders(origin) }
    );
  }
}

export async function OPTIONS(req: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(req.headers.get("origin")),
  });
}

export async function GET(req: Request) {
  const origin = req.headers.get("origin");

  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing sessionId" },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    const docRef = db.collection(DESIGN_SESSIONS_COLLECTION).doc(sessionId);
    const snap = await docRef.get();

    if (!snap.exists) {
      return NextResponse.json(
        { error: "Session not found", history: [] },
        { status: 404, headers: getCorsHeaders(origin) }
      );
    }

    const session = snap.data() as DesignSession;

    return NextResponse.json(
      {
        sessionId,
        session,
        history: session?.history ?? [],
      },
      { status: 200, headers: getCorsHeaders(origin) }
    );
  } catch (err) {
    console.error("[product-chat] GET failed:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: getCorsHeaders(origin) }
    );
  }
}