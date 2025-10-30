import { NextResponse } from "next/server";
import { GoogleAuth } from "google-auth-library";

export async function POST(req: Request) {
  try {
    const { imageBase64, lastPrompt } = await req.json();

    const project = process.env.GOOGLE_PROJECT_ID!;
    const location = "us-central1";
    const model = "gemini-2.5-flash";

    const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
    const client = await auth.getClient();
    const token = await client.getAccessToken();

    const prompt = `
You are a visual refinement assistant. Given an image and its description, 
suggest how to subtly improve it without changing the core composition.
Focus on enhancing realism, lighting, and color balance.
Be brief (one sentence). The last prompt was: "${lastPrompt || "none"}"
`;

    const body = {
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { mimeType: "image/png", data: imageBase64 } },
          ],
        },
      ],
      generationConfig: { temperature: 0.5, responseModalities: ["TEXT"] },
      safetySettings: [
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "OFF" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "OFF" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "OFF" },
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "OFF" },
      ],
    };

    const res = await fetch(
      `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token.token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini refine failed: ${err}`);
    }

    const data = await res.json();
    const suggestion = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      "Enhance clarity and lighting.";

    return NextResponse.json({ suggestion });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Gemini refine failed" }, { status: 500 });
  }
}


