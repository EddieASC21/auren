// packages/backend/auren-demo/src/app/api/design-session/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/firestore";
import { Storage } from "@google-cloud/storage";

const DESIGN_SESSIONS_COLLECTION = "designSessions";
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

// ---------------------------------------------------
// OPTIONS: CORS preflight
// ---------------------------------------------------
export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

// ---------------------------------------------------
// GET: read a designSession by sessionId
//   /api/design-session?sessionId=...
// ---------------------------------------------------
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return jsonWithCors({ error: "Missing sessionId" }, { status: 400 });
    }

    const docRef = db.collection(DESIGN_SESSIONS_COLLECTION).doc(sessionId);
    const snap = await docRef.get();

    if (!snap.exists) {
      return jsonWithCors({ error: "Session not found" }, { status: 404 });
    }

    const session = snap.data();

    return jsonWithCors(
      {
        sessionId,
        session,
        history: session?.history ?? [],
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[design-session] GET failed:", err);
    return jsonWithCors(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------
// POST: delete designSession + GCS assets
//   body: { sessionId: string }
// ---------------------------------------------------
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const sessionId = (body?.sessionId as string | undefined)?.trim();

    if (!sessionId) {
      return jsonWithCors({ error: "Missing sessionId" }, { status: 400 });
    }

    console.log("🧹 [design-session] Deleting design session:", sessionId);

    const docRef = db.collection(DESIGN_SESSIONS_COLLECTION).doc(sessionId);
    const snap = await docRef.get();

    if (snap.exists) {
      const session = snap.data() as any;

      // 1) Try to delete specifically stored image paths (if present)
      if (GCS_BUCKET_NAME) {
        const bucket = storage.bucket(GCS_BUCKET_NAME);

        const paths: (string | null | undefined)[] = [
          session.currentFrontImagePath,
          session.currentBackImagePath,
        ];

        for (const p of paths) {
          if (!p) continue;
          try {
            await bucket.file(p).delete({ ignoreNotFound: true });
            console.log(
              "🧹 [design-session] Deleted GCS object:",
              p,
            );
          } catch (err) {
            console.warn(
              "⚠️ [design-session] Failed to delete GCS object:",
              p,
              err,
            );
          }
        }

        // 2) Extra safety: delete everything under sessions/<sessionId>/
        try {
          const prefix = `sessions/${sessionId}/`;
          await bucket.deleteFiles({ prefix });
          console.log(
            "🧹 [design-session] Deleted GCS files with prefix:",
            prefix,
          );
        } catch (err: any) {
          if (err?.code === 404) {
            console.warn(
              "⚠️ [design-session] No GCS files found for prefix:",
              `sessions/${sessionId}/`,
            );
          } else {
            console.warn(
              "⚠️ [design-session] Failed to delete GCS files for sessionId:",
              sessionId,
              err,
            );
          }
        }
      } else {
        console.warn(
          "⚠️ [design-session] GCP_BUCKET_NAME not set; skipping GCS cleanup",
        );
      }

      // 3) Delete Firestore doc
      await docRef.delete();
      console.log(
        "🧹 [design-session] Deleted Firestore doc for sessionId:",
        sessionId,
      );
    } else {
      console.log(
        "🧹 [design-session] Firestore doc not found for sessionId:",
        sessionId,
      );
    }

    return jsonWithCors({ ok: true, sessionId }, { status: 200 });
  } catch (err) {
    console.error("[design-session] POST delete failed:", err);
    return jsonWithCors(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}