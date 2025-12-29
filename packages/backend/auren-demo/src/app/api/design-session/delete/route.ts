import { NextResponse } from "next/server";
import { db } from "@/lib/firestore";
import { cleanupSessionImages } from "@/app/api/product-chat/route";

const DESIGN_SESSIONS_COLLECTION = "designSessions";

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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");

  try {
    const body = await req.json().catch(() => null);
    const sessionId = body?.sessionId as string | undefined;

    if (!sessionId || typeof sessionId !== "string" || !sessionId.trim()) {
      return NextResponse.json(
        { error: "Missing or invalid sessionId" },
        {
          status: 400,
          headers: getCorsHeaders(origin),
        }
      );
    }

    const trimmedId = sessionId.trim();
    const ref = db.collection(DESIGN_SESSIONS_COLLECTION).doc(trimmedId);
    const snap = await ref.get();

    if (!snap.exists) {
      // Treat as no-op success on the frontend
      return NextResponse.json(
        { deleted: false, reason: "not_found" },
        { headers: getCorsHeaders(origin) }
      );
    }

    const sessionData = snap.data();

    // Best-effort cleanup of images
    try {
      await cleanupSessionImages(sessionData as any);
    } catch (err) {
      console.warn(
        "⚠️ Failed to cleanup images when deleting design session:",
        err
      );
    }

    await ref.delete();

    return NextResponse.json(
      { deleted: true },
      { headers: getCorsHeaders(origin) }
    );
  } catch (err: any) {
    console.error("❌ Design-session delete error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status: 500, headers: getCorsHeaders(origin) }
    );
  }
}

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin");

  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(origin),
  });
}