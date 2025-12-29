import OpenAI from "openai";
import { NextResponse } from "next/server";

// Initialize OpenAI client with API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Chat endpoint for creative design assistance using OpenAI
export async function POST(req: Request) {
  try {
    // Parse the request body to get the user's prompt
    const { prompt } = await req.json();

    // Validate that a prompt was provided
    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }

    // 💬 Send the prompt to OpenAI for creative design reasoning
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a creative design assistant that helps users brainstorm and refine ideas for product designs before generating images. Ask thoughtful follow-up questions if needed, and help them build clear image prompts.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    // Extract the response content from OpenAI
    const reply = completion.choices[0].message.content?.trim() || "";

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error("Chat error:", error);
    return NextResponse.json(
      { error: error.message || "Chat failed" },
      { status: 500 }
    );
  }
}
