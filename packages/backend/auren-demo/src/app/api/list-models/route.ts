import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// API endpoint to list available Google Generative AI models
export async function GET() {
    try {
        // Initialize Google Generative AI client
        const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

        // The SDK exposes a REST helper through genAI.models.listModels()
        // But we'll call directly via fetch for clarity and debug info
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GOOGLE_API_KEY}`,
            {
                headers: { "Content-Type": "application/json" },
            }
        );

        // Parse and return the models data
        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: any) {
        console.error("ListModels error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to list models" },
            { status: 500 }
        );
    }
}