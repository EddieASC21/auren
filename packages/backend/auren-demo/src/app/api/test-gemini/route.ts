import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Test endpoint for Google Gemini API integration
export async function GET() {
  try {
    // Initialize the Google Generative AI client with API key
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

    // Use the stable Gemini 2.5 Flash model
    const model = genAI.getGenerativeModel({ model: "models/gemini-2.5-flash" });

    // Generate a basic message to test the API connection
    const result = await model.generateContent("Say hello from Gemini 2.5 Flash!");
    const text = result.response.text();

    // Return the generated response
    return NextResponse.json({ reply: text });
  } catch (error: any) {
    console.error("Gemini API test error:", error);
    return NextResponse.json(
      { error: error.message || "Gemini test failed" },
      { status: 500 }
    );
  }
}