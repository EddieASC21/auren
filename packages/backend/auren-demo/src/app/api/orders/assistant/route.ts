import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { db } from "@/lib/firestore";
import { getAuthenticatedUser } from "@/lib/auth";

// AI-powered order assistant endpoint using Google Gemini for order confirmation
export async function POST(req: Request) {
  try {
    // 🧠 Authenticate user
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 🧾 Parse body
    const { prompt, draftId } = await req.json();
    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }

    // 🤖 Initialize Gemini
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
    const model = genAI.getGenerativeModel({
      model: "models/gemini-2.5-flash",
      generationConfig: {
        temperature: 0.5,
        responseMimeType: "application/json",
      },
    });

    // 🪄 System prompt for structured output
    const systemPrompt = `
You are an **order assistant** for a fashion customization company.
You confirm order details and return structured JSON as shown in the example.
`;

    // ✨ Generate AI response
    const result = await model.generateContent({
      contents: [
        { role: "user", parts: [{ text: `${systemPrompt}\n\nUser: ${prompt}` }] },
      ],
    });

    // Parse the AI response
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

    // 🔒 Firestore transaction (atomic)
    await db.runTransaction(async (t) => {
      if (!draftId) throw new Error("draftId required for transactional write");

      const draftRef = db.collection("orders_draft").doc(draftId);
      const draftSnap = await t.get(draftRef);
      if (!draftSnap.exists) throw new Error(`Draft with ID ${draftId} not found`);

      originalDraftData = draftSnap.data();

      // Update draft to finalized
      t.update(draftRef, { status: "finalized" });

      // Create confirmed order
      const confirmedRef = db.collection("orders_confirmed").doc();
      confirmedOrderId = confirmedRef.id;

      const orderConfirmed = {
        draftId,
        aiReply,
        summary,
        original: originalDraftData,
        createdAt: now,
        status: "confirmed",

        // Attach authenticated user info
        userId: user.userId,
        userEmail: user.email,
        userName: user.name || "",
      };

      t.set(confirmedRef, orderConfirmed);
    });

    // 📨 Optional post-transaction (email, webhook, etc.)
    try {
      console.log(`📧 Email queued for ${user.email} (draft ${draftId})`);
      // await sendOrderConfirmationEmail(user.email, summary);
    } catch (emailErr) {
      console.warn("Email sending failed (non-blocking):", emailErr);
    }

    // ✅ Return success
    return NextResponse.json({
      id: confirmedOrderId,
      draftId,
      aiReply,
      summary,
      original: originalDraftData,
      createdAt: now,
      status: "confirmed",
      user,
    });
  } catch (error: any) {
    console.error("Order Assistant Error:", error);
    return NextResponse.json(
      { error: error.message || "Assistant failed" },
      { status: 500 }
    );
  }
}