import { NextResponse } from "next/server";
import { GoogleAuth } from "google-auth-library";

// Image regeneration endpoint using Google Vertex AI Imagen 3 for guided regeneration
export async function POST(req: Request) {
  try {
    // Parse the request body to get the image and suggestion
    const { imageBase64, suggestion } = await req.json();

    // Validate required parameters
    if (!imageBase64) {
      return NextResponse.json({ error: "Missing imageBase64" }, { status: 400 });
    }
    if (!suggestion) {
      return NextResponse.json({ error: "Missing suggestion text" }, { status: 400 });
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

    // 🧠 Imagen-3 guided regeneration (no editMode)
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
        // no personGeneration / editMode / watermark here
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

    // Return the regenerated image as a data URL
    return NextResponse.json({
      imageUrl: `data:image/png;base64,${imageBase64Out}`,
    });
  } catch (err: any) {
    console.error("Regenerate Image API error:", err);
    return NextResponse.json(
      { error: err.message || "Imagen 3 refine failed" },
      { status: 500 }
    );
  }
}