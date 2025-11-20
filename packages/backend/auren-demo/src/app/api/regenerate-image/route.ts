import { NextResponse } from "next/server";
import { GoogleAuth } from "google-auth-library";

// --- Define your live frontend URL ---
const LIVE_FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// ✅ Handle CORS preflight requests
export async function OPTIONS() {
  const response = new NextResponse(null, { status: 204 });
  response.headers.set("Access-Control-Allow-Origin", LIVE_FRONTEND_URL); // FIXED
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  return response;
}

// Image regeneration endpoint using Google Vertex AI Imagen 3 for guided regeneration
export async function POST(req: Request) {
  try {
    // Parse the request body to get the image and suggestion
    const { imageBase64, suggestion } = await req.json();

    // Validate required parameters
    if (!imageBase64) {
      const res = NextResponse.json(
        { error: "Missing imageBase64" },
        { status: 400 }
      );
      res.headers.set("Access-Control-Allow-Origin", LIVE_FRONTEND_URL); // FIXED
      return res;
    }
    if (!suggestion) {
      const res = NextResponse.json(
        { error: "Missing suggestion text" },
        { status: 400 }
      );
      res.headers.set("Access-Control-Allow-Origin", LIVE_FRONTEND_URL); // FIXED
      return res;
    }

    // Configure Vertex AI Imagen 3
    const project = process.env.GOOGLE_PROJECT_ID!;
    const location = "us-central1";
    const model = "imagen-3.0-generate-002";

    // Authenticate with Google service account
    const auth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
    const client = await auth.getClient();
    const token = await client.getAccessToken();

    // 🧠 Imagen-3 guided regeneration
    const body = {
      instances: [
        {
          prompt: `Regenerate this image with subtle improvements — ${suggestion}`,
          image: { bytesBase64Encoded: imageBase64 },
        },
      ],
      parameters: {
        aspectRatio: "1:1",
        sampleCount: 1,
        enhancePrompt: false,
        safetySetting: "block_few",
        includeRaiReason: true,
        language: "auto",
      },
    };

    // Send the request to Imagen 3
    const res = await fetch(
      `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:predict`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    // Check if the request was successful
    if (!res.ok) {
      const err = await res.text();
      console.error("Imagen 3 refine error:", err);
      throw new Error(`Imagen 3 refine failed: ${err}`);
    }

    // Extract the regenerated image from the response
    const data = await res.json();
    const first = data?.predictions?.[0];
    const imageBase64Out =
      first?.bytesBase64Encoded || first?.image?.base64 || null;

    if (!imageBase64Out) {
      console.error("Full Imagen 3 response:", data);
      throw new Error("No image returned from Imagen 3 refine");
    }

    // ✅ Include CORS headers in success response
    const response = NextResponse.json({
      imageUrl: `data:image/png;base64,${imageBase64Out}`,
    });
    response.headers.set("Access-Control-Allow-Origin", LIVE_FRONTEND_URL); // FIXED
    return response;
  } catch (err: any) {
    console.error("Regenerate Image API error:", err);
    const errorResponse = NextResponse.json(
      { error: err.message || "Imagen 3 refine failed" },
      { status: 500 }
    );
    errorResponse.headers.set("Access-Control-Allow-Origin", LIVE_FRONTEND_URL); // FIXED
    return errorResponse;
  }
}