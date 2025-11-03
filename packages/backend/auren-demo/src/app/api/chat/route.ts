import OpenAI from "openai";
import { NextResponse } from "next/server";

// Initialize OpenAI client with API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// --- 🔹 Handle CORS preflight requests (required for frontend to connect)
export async function OPTIONS() {
  const headers = {
    "Access-Control-Allow-Origin": "http://localhost:3000", // your frontend
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
  return new NextResponse(null, { status: 204, headers });
}

// --- 🔹 Handle POST requests (actual chat logic)
export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }

    // 💬 Send prompt to OpenAI for creative design reasoning
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a creative image prompt refiner. The user describes a concept, and you rewrite it into a clear, concise, visually detailed prompt that can be sent directly to an image model. Do not ask follow-up questions. Just return the improved text prompt only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const reply = completion.choices[0].message.content?.trim() || "";

    // --- ✅ Add CORS headers to the response
    const headers = {
      "Access-Control-Allow-Origin": "http://localhost:3000",
    };

    return NextResponse.json({ reply }, { status: 200, headers });
  } catch (error: any) {
    console.error("Chat error:", error);

    const headers = {
      "Access-Control-Allow-Origin": "http://localhost:3000",
    };

    return NextResponse.json(
      { error: error.message || "Chat failed" },
      { status: 500, headers }
    );
  }
}