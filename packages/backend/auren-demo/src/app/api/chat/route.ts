import OpenAI from "openai";
import { NextResponse } from "next/server";

// --- Define your live frontend URL ---
const LIVE_FRONTEND_URL = process.env.FRONTEND_URL || "https://auren.co";

// Initialize OpenAI client with API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// --- 🔹 Handle CORS preflight requests
export async function OPTIONS() {
  const headers = {
    "Access-Control-Allow-Origin": LIVE_FRONTEND_URL,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
  return new NextResponse(null, { status: 204, headers });
}

// --- 🔹 Handle POST requests (actual chat logic)
export async function POST(req: Request) {
  try {
    // 👇 UPDATED: Now accepts imageBase64
    const { prompt, imageBase64 } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }

    // --- 👇 UPDATED: System prompt is more general ---
    const systemPrompt =
      "You are a creative partner. The user will provide a text prompt and may also provide an image for inspiration. Your goal is to refine their idea into a new, clear, visually detailed prompt for an image generation model. If an image is provided, use it as inspiration for the style, composition, or subject matter. Return only the new, improved text prompt.";

    // --- 👇 UPDATED: Build messages array dynamically ---
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: systemPrompt,
      },
    ];

    // Build the user message
    const userMessageContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
      {
        type: "text",
        text: prompt,
      },
    ];

    // If an image is provided, add it to the user message
    if (imageBase64 && typeof imageBase64 === "string") {
      // Ensure the base64 string is formatted correctly
      const dataUrl = imageBase64.startsWith('data:image') 
        ? imageBase64 
        : `data:image/jpeg;base64,${imageBase64.split(',').pop()}`;

      userMessageContent.push({
        type: "image_url",
        image_url: {
          url: dataUrl,
          detail: "low", // Use "low" for faster, cheaper analysis
        },
      });
    }

    messages.push({
      role: "user",
      content: userMessageContent,
    });
    // --- End of message builder update ---


    // 💬 Send prompt to OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // This model supports vision
      messages: messages,
    });

    const reply = completion.choices[0].message.content?.trim() || "";

    // --- ✅ Add CORS headers to the response
    const headers = {
      "Access-Control-Allow-Origin": LIVE_FRONTEND_URL,
    };

    return NextResponse.json({ reply }, { status: 200, headers });
  } catch (error: any) {
    console.error("Chat error:", error);

    const headers = {
      "Access-Control-Allow-Origin": LIVE_FRONTEND_URL,
    };

    return NextResponse.json(
      { error: error.message || "Chat failed" },
      { status: 500, headers }
    );
  }
}