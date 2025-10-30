import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { db } from "@/lib/firestore";
import { getAuthenticatedUser } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { prompt, draftId } = await req.json();
    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
    const model = genAI.getGenerativeModel({
      model: "models/gemini-2.5-flash",
      generationConfig: { temperature: 0.5, responseMimeType: "application/json" },
    });

    const systemPrompt = `
You are an **order assistant** for a fashion customization company.
You confirm order details and return structured JSON as shown in the example.
`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\nUser: ${prompt}` }] }],
    });

    const raw = result.response.text();
    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      data = { reply: raw || "No AI reply generated.", summary: {} };
    }

    const aiReply = data.reply ?? "No reply generated.";
    const summary = data.summary ?? {};
    const now = new Date().toISOString();
    let confirmedOrderId: string | null = null;
    let originalDraftData: any = null;

    // Persist in Firestore (simplified without transaction for demo)
    if (draftId) {
      const draftRef = db.collection("orders_draft").doc(draftId);
      const draftSnap = await draftRef.get();
      originalDraftData = draftSnap.exists ? draftSnap.data() : null;
      const confirmedRef = await db.collection("orders_confirmed").add({
        ...originalDraftData,
        status: "confirmed",
        confirmedAt: now,
        aiSummary: summary,
      });
      confirmedOrderId = confirmedRef.id;
    }

    return NextResponse.json({ reply: aiReply, summary, confirmedOrderId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Assistant failed" }, { status: 500 });
  }
}


