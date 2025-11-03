import { NextResponse } from "next/server";
import { GoogleAuth } from "google-auth-library";

// ✅ Handle CORS preflight requests
export async function OPTIONS() {
  const response = new NextResponse(null, { status: 204 })
  response.headers.set("Access-Control-Allow-Origin", "*")
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS")
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization")
  return response
}

// Image refinement endpoint using Google Gemini 2.5 Flash for visual analysis
export async function POST(req: Request) {
  try {
    // Parse the request body to get the image and last prompt
    const { imageBase64, lastPrompt } = await req.json();

    // Configure Vertex AI Gemini 2.5 Flash
    const project = process.env.GOOGLE_PROJECT_ID!;
    const location = "us-central1";
    const model = "gemini-2.5-flash";

    // Authenticate with Google service account
    const auth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
    const client = await auth.getClient();
    const token = await client.getAccessToken();

    // ✨ Prompt Gemini for a concise text refinement suggestion
    const prompt = `
You are a visual refinement assistant. Given an image and its description, 
suggest how to subtly improve it without changing the core composition.
Focus on enhancing realism, lighting, and color balance.
Be brief (one sentence). The last prompt was: "${lastPrompt || "none"}"
`;

    // Prepare the request body for Gemini
    const body = {
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: "image/png",
                data: imageBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.5,
        responseModalities: ["TEXT"],
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "OFF" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "OFF" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "OFF" },
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "OFF" },
      ],
    };

    // Send the request to Gemini
    const res = await fetch(
      `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent`,
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
      console.error("Gemini refine error:", err);
      throw new Error(`Gemini refine failed: ${err}`);
    }

    // Extract the refinement suggestion from the response
    const data = await res.json();
    const suggestion =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      "Enhance clarity and lighting.";

    // ✅ Include CORS headers in successful response
    const response = NextResponse.json({ suggestion });
    response.headers.set("Access-Control-Allow-Origin", "*");
    return response;

  } catch (err: any) {
    console.error("Refine Image API error:", err);
    // ✅ Include CORS headers on error responses too
    const errorResponse = NextResponse.json(
      { error: err.message || "Gemini refine failed" },
      { status: 500 }
    );
    errorResponse.headers.set("Access-Control-Allow-Origin", "*");
    return errorResponse;
  }
}