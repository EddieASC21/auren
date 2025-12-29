// packages/backend/auren-demo/src/app/api/asset-session/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/firestore";
import { Storage } from "@google-cloud/storage";

const ASSET_SESSIONS_COLLECTION = "assetSessions";
const GCS_BUCKET_NAME = process.env.GCP_BUCKET_NAME || "auren-user-designs";

// 👇 tweak this if your prod frontend uses a different domain
const ALLOWED_ORIGIN =
  process.env.NODE_ENV === "production"
    ? "https://auren.co"
    : "http://localhost:3000";

const storage = new Storage({
  projectId: process.env.GOOGLE_PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

function corsHeaders(extra: HeadersInit = {}): HeadersInit {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    // ✅ include POST here
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
    ...extra,
  };
}

function jsonWithCors(body: any, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      ...corsHeaders(),
    },
  });
}

// Handle preflight if the browser ever sends it
export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

// ----------------------
// GET: read assetSession
// ----------------------
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return jsonWithCors(
        { error: "Missing sessionId" },
        { status: 400 }
      );
    }

    const docRef = db.collection(ASSET_SESSIONS_COLLECTION).doc(sessionId);
    const snap = await docRef.get();

    if (!snap.exists) {
      return jsonWithCors(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    const session = snap.data();

    return jsonWithCors(
      {
        sessionId,
        session,
        history: session?.history ?? [],
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Failed to fetch asset session:", err);
    return jsonWithCors(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// --------------------------------------------
// POST: delete assetSession + GCS assets
// body: { sessionId: string }
// --------------------------------------------
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const sessionId = (body?.sessionId as string | undefined)?.trim();

    if (!sessionId) {
      return jsonWithCors(
        { error: "Missing sessionId" },
        { status: 400 }
      );
    }

    console.log("🧹 [asset-session] Deleting asset session:", sessionId);

    // 1) Delete Firestore doc (best-effort)
    const docRef = db.collection(ASSET_SESSIONS_COLLECTION).doc(sessionId);
    const snap = await docRef.get();

    if (snap.exists) {
      await docRef.delete();
      console.log(
        "🧹 [asset-session] Deleted Firestore doc for sessionId:",
        sessionId
      );
    } else {
      console.log(
        "🧹 [asset-session] Firestore doc not found for sessionId:",
        sessionId
      );
    }

    // 2) Delete all GCS files under asset-sessions/<sessionId>/
    if (GCS_BUCKET_NAME) {
      try {
        const bucket = storage.bucket(GCS_BUCKET_NAME);
        const prefix = `asset-sessions/${sessionId}/`;

        // This will delete any file that matches that prefix
        await bucket.deleteFiles({ prefix });

        console.log(
          "🧹 [asset-session] Deleted GCS files with prefix:",
          prefix
        );
      } catch (err: any) {
        // If bucket or files don't exist, just log and move on
        if (err?.code === 404) {
          console.warn(
            "⚠️ [asset-session] No GCS files found for session prefix:",
            `asset-sessions/${sessionId}/`
          );
        } else {
          console.warn(
            "⚠️ [asset-session] Failed to delete GCS files for sessionId:",
            sessionId,
            err
          );
        }
      }
    } else {
      console.warn(
        "⚠️ [asset-session] GCP_BUCKET_NAME not set; skipping GCS cleanup"
      );
    }

    return jsonWithCors({ ok: true, sessionId }, { status: 200 });
  } catch (err) {
    console.error("Failed to delete asset session:", err);
    return jsonWithCors(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}