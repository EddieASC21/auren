import { NextResponse } from "next/server";
import { GoogleAuth } from "google-auth-library";

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }

    const project = process.env.GOOGLE_PROJECT_ID!;
    const location = "us-central1";
    const model = "imagen-4.0-generate-001";

    const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
    const client = await auth.getClient();
    const token = await client.getAccessToken();

    const body = {
      endpoint: `projects/${project}/locations/${location}/publishers/google/models/${model}`,
      instances: [{ prompt }],
      parameters: { sampleCount: 1 },
    };

    const res = await fetch(
      `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:predict`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token.token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || "Imagen regenerate failed");
    }
    const imageBase64 = data?.predictions?.[0]?.bytesBase64Encoded;
    return NextResponse.json({ imageUrl: `data:image/png;base64,${imageBase64}` });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Regenerate failed" }, { status: 500 });
  }
}


