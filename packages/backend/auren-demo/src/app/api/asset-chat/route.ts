import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { randomUUID } from "crypto";
import { Storage } from "@google-cloud/storage";
import { db } from "@/lib/firestore";

export const runtime = "nodejs";

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY,
});

// ✅ Limit how much text history we keep (in turns)
const MAX_HISTORY_TURNS = 12;

// -------------------------
// Firestore + GCS setup
// -------------------------
const storage = new Storage({
  projectId: process.env.GOOGLE_PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

const ASSET_SESSIONS_COLLECTION = "assetSessions";
const GCS_BUCKET_NAME = process.env.GCP_BUCKET_NAME || "auren-user-designs";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// -------------------------
// Types
// -------------------------

type StoredTurn = {
  role: "user" | "model";
  text: string;
  imageUrl?: string | null;
};

type AssetSession = {
  id: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  history?: StoredTurn[];
  lastAssetPath?: string | null;
  lastAssetUrl?: string | null;
};

// -------------------------
// Session helpers
// -------------------------
async function loadOrCreateAssetSession(
  rawSessionId?: string | null
): Promise<{ sessionId: string; session: AssetSession }> {
  const now = new Date();
  const sessionId =
    rawSessionId && rawSessionId.trim().length > 0
      ? rawSessionId.trim()
      : randomUUID();

  const ref = db.collection(ASSET_SESSIONS_COLLECTION).doc(sessionId);
  const snap = await ref.get();

  // No existing session → create fresh
  if (!snap.exists) {
    const fresh: AssetSession = {
      id: sessionId,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      history: [],
      lastAssetPath: null,
      lastAssetUrl: null,
    };

    await ref.set(fresh);
    return { sessionId, session: fresh };
  }

  const data = snap.data() as AssetSession;
  const createdAtMs = new Date(data.createdAt).getTime();
  const isExpired = Date.now() - createdAtMs > SESSION_TTL_MS;

  if (isExpired) {
    // Expired session → best effort cleanup of last asset
    if (GCS_BUCKET_NAME && data.lastAssetPath) {
      try {
        await storage
          .bucket(GCS_BUCKET_NAME)
          .file(data.lastAssetPath)
          .delete({ ignoreNotFound: true });
      } catch (err) {
        console.warn("⚠️ Failed to delete expired asset:", data.lastAssetPath, err);
      }
    }

    await ref.delete();

    const newSessionId = randomUUID();
    const fresh: AssetSession = {
      id: newSessionId,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      history: [],
      lastAssetPath: null,
      lastAssetUrl: null,
    };

    await db.collection(ASSET_SESSIONS_COLLECTION).doc(newSessionId).set(fresh);
    return { sessionId: newSessionId, session: fresh };
  }

  return { sessionId, session: data };
}

async function saveAssetImageForSession(
  sessionId: string,
  session: AssetSession,
  base64Image: string
): Promise<{ session: AssetSession; path?: string; url?: string }> {
  if (!GCS_BUCKET_NAME) {
    console.warn("⚠️ GCP_BUCKET_NAME not set; skipping asset upload.");
    return { session, path: undefined, url: undefined };
  }

  const bucket = storage.bucket(GCS_BUCKET_NAME);
  const buffer = Buffer.from(base64Image, "base64");

  const filename = `asset-${Date.now()}.png`;
  const path = `asset-sessions/${sessionId}/${filename}`;
  const file = bucket.file(path);

  await file.save(buffer, {
    contentType: "image/png",
    resumable: false,
    metadata: { cacheControl: "public, max-age=31536000" },
  });

  const publicUrl = `https://storage.googleapis.com/${GCS_BUCKET_NAME}/${path}`;

  const nowIso = new Date().toISOString();
  const updatedSession: AssetSession = {
    ...session,
    updatedAt: nowIso,
    lastAssetPath: path,
    lastAssetUrl: publicUrl,
  };

  await db
    .collection(ASSET_SESSIONS_COLLECTION)
    .doc(sessionId)
    .set(updatedSession, { merge: true });

  return { session: updatedSession, path, url: publicUrl };
}

// --- 🛡️ SECURITY: Dynamic CORS Handler ---
function getCorsHeaders(requestOrigin: string | null) {
  const allowedOrigins = [
    "http://localhost:3000",
    "https://auren.co",
    "https://www.auren.co",
    process.env.FRONTEND_URL,
  ].filter(Boolean) as string[];

  const originToAllow = allowedOrigins.includes(requestOrigin || "")
    ? requestOrigin
    : "https://auren.co";

  return {
    "Access-Control-Allow-Origin": originToAllow || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

// --- 🟢 RESTORED: STRICT THRESHOLD REMOVER ---
// This uses the logic that worked better for you previously.
async function removeGreenBackground(base64Input: string): Promise<string> {
  const inputBuffer = Buffer.from(base64Input, "base64");
  const { data, info } = await sharp(inputBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const pixelCount = width * height;

  // 1. Identify "Non-Background" Pixels
  // We mark pixels that are definitively NOT our neon green background.
  const mask = new Uint8Array(pixelCount); // 0 = background, 1 = content

  for (let i = 0; i < pixelCount; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];

    // ✅ STRICT Neon Green Check (Approx #00FF00)
    // This worked better because it doesn't try to be "smart" about
    // shadows. It demands the AI make the background bright green.
    const isNeonGreen = g > 230 && r < 50 && b < 50; 
    
    if (!isNeonGreen) {
      mask[i] = 1; 
    }
  }

  // 2. Find the Largest Connected Component (The Asset)
  // This cleans up small green noise artifacts.
  let maxIslandSize = 0;
  let maxIslandLabel = 0;
  const labels = new Int32Array(pixelCount).fill(0);
  let currentLabel = 1;

  for (let i = 0; i < pixelCount; i++) {
    // If it's a content pixel and hasn't been labeled yet
    if (mask[i] === 1 && labels[i] === 0) {
      let size = 0;
      const stack = [i];
      labels[i] = currentLabel;

      while (stack.length > 0) {
        const idx = stack.pop()!;
        size++;

        const x = idx % width;
        const y = Math.floor(idx / width);

        // Check neighbors (up, down, left, right)
        const neighbors = [
          idx - width, // up
          idx + width, // down
          (x > 0) ? idx - 1 : -1, // left
          (x < width - 1) ? idx + 1 : -1 // right
        ];

        for (const nIdx of neighbors) {
          if (nIdx >= 0 && nIdx < pixelCount && mask[nIdx] === 1 && labels[nIdx] === 0) {
            labels[nIdx] = currentLabel;
            stack.push(nIdx);
          }
        }
      }

      if (size > maxIslandSize) {
        maxIslandSize = size;
        maxIslandLabel = currentLabel;
      }
      currentLabel++;
    }
  }

  // 3. Apply Transparency
  // Keep ONLY the pixels belonging to the largest island.
  for (let i = 0; i < pixelCount; i++) {
    if (labels[i] !== maxIslandLabel) {
      data[i * 4 + 3] = 0; // Set Alpha to 0
    }
  }

  return (await sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer()).toString("base64");
}

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin");
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(origin),
  });
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");

  try {
    const body = await req.json();
    const message: string = body?.message ?? "";
    const history: StoredTurn[] = Array.isArray(body?.history)
      ? body.history
      : [];
    const inputImages: string[] = Array.isArray(body?.inputImages)
      ? body.inputImages
      : [];

    const incomingDraftId = body?.draftId as string | undefined;
    const incomingSessionId = body?.sessionId as string | undefined;

    const { sessionId, session: initialSession } =
      await loadOrCreateAssetSession(incomingDraftId || incomingSessionId);
    let session = initialSession;

    const textOnlyHistory = history
      .filter(
        (h) => h && typeof h.text === "string" && h.text.trim().length > 0
      )
      .map((h) => {
        const prefix = h.role === "user" ? "User: " : "Assistant: ";
        return {
          role: "user" as const,
          parts: [{ text: prefix + h.text }],
        };
      });

    const truncatedGeminiHistory =
      textOnlyHistory.length > MAX_HISTORY_TURNS
        ? textOnlyHistory.slice(-MAX_HISTORY_TURNS)
        : textOnlyHistory;

    // ---------------------------------------------------------
    // SYSTEM INSTRUCTION (Restored to the working version)
    // ---------------------------------------------------------
    const systemInstruction = `
      You are Auren's Merch Asset Generator.

      PRIMARY PURPOSE:
      - Create clean, standalone graphic assets (logos, icons, badges, mascots, illustrations) that can be printed on apparel, stickers, hats, and other merch.

      DEFAULT OUTPUT:
      - Exactly ONE main subject.
      - Centered and filling most of the frame.
      - BACKGROUND MUST BE a perfectly uniform Neon Green (#00FF00) so we can remove it.
      - The ONLY non-green pixels should belong to the graphic itself (no extra frames or bars).
      - **ASPECT RATIO:** Prefer a 1:1 SQUARE format unless the user specifically asks otherwise.

      BACKGROUND RULES:
      - No rooms, furniture, people, windows, or photo scenes.
      - Do NOT add white or colored borders, drop shadows, stripes, or rectangles at the edges.
      - The background must be a solid green field from edge to edge.

      STYLE RULES:
      - If the user says "photo", "3D", etc., treat it as the rendering style of the logo/asset itself, not a scene.
      - If no style is specified, default to clean, high-contrast vector-style logo art.

      OUTPUT:
      - Behave like a sticker/logo asset, not a product mockup or lifestyle photo.
    `;

    // Strict Prompting to ensure the background hits that >230 Green threshold
    const merchPrompt = `${message}

[STRICT VISUAL RULES]
1. BACKGROUND: Perfectly solid Neon Green (#00FF00) ONLY.
2. SUBJECT: Isolated, centered, die-cut sticker style.
3. FORMAT: 1:1 Square. Do not match input aspect ratio if it is wide.`;

    const contentParts: any[] = [{ text: merchPrompt }];

    if (inputImages && Array.isArray(inputImages)) {
      inputImages.forEach((imgBase64: string) => {
        const cleanBase64 = imgBase64.replace(/^data:image\/\w+;base64,/, "");
        contentParts.push({
          inlineData: { mimeType: "image/png", data: cleanBase64 },
        });
      });
    }

    console.log(`🎨 Asset-Chat: "${message.substring(0, 40)}..."`);

    const result = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      config: {
        responseModalities: ["TEXT", "IMAGE"],
        systemInstruction,
      },
      contents: [
        ...truncatedGeminiHistory,
        { role: "user", parts: contentParts },
      ],
    });

    const candidates = (result as any).candidates;
    if (!candidates || candidates.length === 0) {
      throw new Error("No response from model");
    }

    const firstCandidate = candidates[0];

    const responseParts: any[] = [];
    let aggregatedReply = "";
    let generatedImageBase64: string | null = null;

    if (firstCandidate.content && firstCandidate.content.parts) {
      for (const part of firstCandidate.content.parts) {
        if (part.text) {
          aggregatedReply += (aggregatedReply ? "\n\n" : "") + part.text;
          responseParts.push({ type: "text", text: part.text });
        }

        if (part.inlineData && part.inlineData.data) {
          const cleanRawBase64 = part.inlineData.data as string;

          try {
            console.log("🧼 Removing neon-green background for asset...");
            // Uses the strict checker
            const transparentBase64 = await removeGreenBackground(
              cleanRawBase64
            );

            responseParts.push({
              type: "image",
              base64: `data:image/png;base64,${transparentBase64}`,
            });

            generatedImageBase64 = transparentBase64;
          } catch (err) {
            console.error(
              "Image processing failed for asset; sending original",
              err
            );
            responseParts.push({
              type: "image",
              base64: `data:image/png;base64,${cleanRawBase64}`,
            });

            generatedImageBase64 = cleanRawBase64;
          }
        }
      }
    }

    if (generatedImageBase64) {
      try {
        const { session: updated, path, url } =
          await saveAssetImageForSession(
            sessionId,
            session,
            generatedImageBase64
          );
        session = updated;

        const imgIndex = responseParts.findIndex((p) => p.type === "image");
        if (imgIndex !== -1 && path && url) {
          responseParts[imgIndex].url = url;
          responseParts[imgIndex].storagePath = path;
        }
      } catch (saveErr) {
        console.warn("⚠️ Failed to save asset image to session:", saveErr);
      }
    }

    const replyText =
      aggregatedReply.trim().length > 0
        ? aggregatedReply.trim()
        : "Here is a new asset based on your description.";

    let responseImageUrl: string | null = null;
    const firstImageForHistory = responseParts.find(
      (p) => p.type === "image"
    );
    if (firstImageForHistory) {
      if (typeof firstImageForHistory.url === "string") {
        responseImageUrl = firstImageForHistory.url;
      } else if (typeof firstImageForHistory.base64 === "string") {
        responseImageUrl = firstImageForHistory.base64;
      }
    }

    const truncatedStoredHistory =
      history.length > MAX_HISTORY_TURNS
        ? history.slice(-MAX_HISTORY_TURNS)
        : history;

    const userTurn: StoredTurn = {
      role: "user",
      text:
        message && message.trim().length > 0
          ? message
          : inputImages.length > 0
          ? "[image uploaded]"
          : "",
      imageUrl: null, 
    };

    const modelTurn: StoredTurn = {
      role: "model",
      text: replyText,
      imageUrl: responseImageUrl,
    };

    const newHistory: StoredTurn[] = [
      ...truncatedStoredHistory,
      userTurn,
      modelTurn,
    ];

    try {
      const nowIso = new Date().toISOString();
      const updatedSession: AssetSession = {
        ...session,
        history: newHistory,
        updatedAt: nowIso,
      };

      await db
        .collection(ASSET_SESSIONS_COLLECTION)
        .doc(sessionId)
        .set(updatedSession, { merge: true });

      session = updatedSession;
    } catch (histErr) {
      console.warn("⚠️ Failed to persist asset session history:", histErr);
    }

    return NextResponse.json(
      {
        parts: responseParts, 
        history: newHistory,  
        session: {
          id: sessionId,
          lastAssetPath: session.lastAssetPath || null,
          lastAssetUrl: session.lastAssetUrl || null,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          designSessionId: sessionId,
          draftId: sessionId,
        },
      },
      { headers: getCorsHeaders(origin) }
    );
  } catch (error: any) {
    console.error("Asset-Chat Error:", error);
    return NextResponse.json(
      { error: error.message ?? "Unknown error" },
      { status: 500, headers: getCorsHeaders(origin) }
    );
  }
}