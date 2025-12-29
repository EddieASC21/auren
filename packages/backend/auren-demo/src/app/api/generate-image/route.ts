import { NextResponse } from "next/server";
import { GoogleAuth } from "google-auth-library";

// --- 🔹 Handle CORS preflight
export async function OPTIONS() {
  const headers = {
    "Access-Control-Allow-Origin": process.env.FRONTEND_URL || "http://localhost:3000", // your frontend
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
  return new NextResponse(null, { status: 204, headers });
}

// --- 🔹 Main Image generation endpoint using Google Vertex AI Imagen 4
export async function POST(req: Request) {
  try {
    const { prompt, aspectRatio = "1:1" } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      const headers = { "Access-Control-Allow-Origin": process.env.FRONTEND_URL || "http://localhost:3000" };
      return NextResponse.json({ error: "Missing prompt" }, { status: 400, headers });
    }

    // === Vertex AI Imagen 4 configuration ===
    const project = process.env.GOOGLE_PROJECT_ID!;
    const location = "us-central1";
    const model = "imagen-4.0-generate-001";

    // Authenticate with Google service account
    const auth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
    const client = await auth.getClient();
    const token = await client.getAccessToken();

    // === Imagen 4 request body ===
    const body = {
      endpoint: `projects/${project}/locations/${location}/publishers/google/models/${model}`,
      instances: [
        {
          prompt,
        },
      ],
      parameters: {
        width: 2048,
        height: 2048,
        sampleCount: 1,
        negativePrompt: "",
        enhancePrompt: false,
        personGeneration: "allow_all",
        safetySetting: "block_few",
        addWatermark: true,
        includeRaiReason: true,
        language: "auto",
      },
    };

    // === Send request to Imagen 4 endpoint ===
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

    const data = await res.json();

    if (!res.ok) {
      console.error("Vertex AI error response:", data);
      const headers = { "Access-Control-Allow-Origin": process.env.FRONTEND_URL || "http://localhost:3000" };
      throw new Error(data.error?.message || "Imagen 4 request failed");
    }

    // === Extract base64 image ===
    const imageBase64 = data?.predictions?.[0]?.bytesBase64Encoded;
    const headers = { "Access-Control-Allow-Origin": process.env.FRONTEND_URL || "http://localhost:3000" };

    if (!imageBase64) {
      return NextResponse.json({ error: "No image returned" }, { status: 500, headers });
    }

    // === Return the image data URL to frontend ===
    return NextResponse.json(
      { imageUrl: `data:image/png;base64,${imageBase64}` },
      { status: 200, headers }
    );
  } catch (err: any) {
    console.error("Imagen 4 error:", err);

    const headers = { "Access-Control-Allow-Origin": process.env.FRONTEND_URL || "http://localhost:3000" };
    return NextResponse.json(
      { error: err.message || "Image generation failed" },
      { status: 500, headers }
    );
  }
}