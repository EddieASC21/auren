import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { db } from "@/lib/firestore";

// ---------------- CORS HELPERS ----------------
function setCORSHeaders(res: NextResponse) {
  res.headers.set("Access-Control-Allow-Origin", "*"); // Replace * with your domain later
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return res;
}

export async function OPTIONS() {
  const res = NextResponse.json({}, { status: 200 });
  return setCORSHeaders(res);
}

// ---------------- MAIN ROUTE ----------------
export async function POST(req: Request) {
  try {
    // 🧾 Parse request body (now includes full chat history)
    const { chatHistory = [], userMsg, draftId } = await req.json();
    if (!userMsg || typeof userMsg !== "string") {
      const res = NextResponse.json({ error: "Missing userMsg" }, { status: 400 });
      return setCORSHeaders(res);
    }

    const now = new Date().toISOString();

    // 🧠 Guest user (auth skipped for now)
    const user = {
      userId: "guest",
      email: "guest@auren.ai",
      name: "Guest User",
    };

    // 🤖 Initialize Gemini
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
    const model = genAI.getGenerativeModel({
      model: "models/gemini-2.5-flash",
      generationConfig: {
        temperature: 0.5,
        responseMimeType: "application/json",
      },
    });

    // 🪄 System prompt — context aware
    const systemPrompt = `
You are an **order assistant** for a fashion customization company called Auren.
You help customers finalize their clothing orders by asking about sizes, materials, embroidery, or delivery.
Keep replies friendly, concise, and natural.
If sizes have already been provided, acknowledge them — do **not** ask again.
If materials or colors are mentioned, continue the conversation based on that.
Always return JSON:
{
  "reply": "friendly response to display to the user"
}
`;

    // 🧱 Format chat context for Gemini
    const formattedHistory = [
      { role: "user", parts: [{ text: systemPrompt }] },
      ...chatHistory.map((msg: any) => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.text }],
      })),
      { role: "user", parts: [{ text: userMsg }] },
    ];

    // ✨ Generate AI reply
    const result = await model.generateContent({ contents: formattedHistory });

    // Parse Gemini response safely
    const raw = result.response.text();
    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      data = { reply: raw || "Got it! How else would you like to customize your order?" };
    }

    const aiReply = data.reply ?? "Got it!";

    // 🧾 Firestore Transaction — Auto-create draft if missing
    let confirmedOrderId: string | null = null;
    let originalDraftData: any = null;

    await db.runTransaction(async (t) => {
      const draftRef = db.collection("orders_draft").doc(draftId || "demo-draft-123");
      const draftSnap = await t.get(draftRef);

      if (!draftSnap.exists) {
        console.warn(`⚠️ Draft ${draftId} not found — creating temporary draft`);
        const tempDraft = {
          createdAt: now,
          status: "in_progress",
          productName: "Guest Custom Tee",
          productCategory: "T-Shirt",
          quantity: 35,
        };
        t.set(draftRef, tempDraft);
        originalDraftData = tempDraft;
      } else {
        originalDraftData = draftSnap.data();
        t.update(draftRef, { status: "finalized" });
      }

      // Confirmed order creation
      const confirmedRef = db.collection("orders_confirmed").doc();
      confirmedOrderId = confirmedRef.id;

      t.set(confirmedRef, {
        draftId: draftId || "demo-draft-123",
        aiReply,
        original: originalDraftData,
        createdAt: now,
        status: "confirmed",
        userId: user.userId,
        userEmail: user.email,
        userName: user.name,
      });
    });

    console.log(`✅ Gemini reply (guest):`, aiReply);

    // ✅ Return response
    const res = NextResponse.json({
      id: confirmedOrderId,
      draftId: draftId || "demo-draft-123",
      aiReply,
      createdAt: now,
      status: "confirmed",
      user,
    });
    return setCORSHeaders(res);
  } catch (error: any) {
    console.error("Order Assistant Error:", error);
    const res = NextResponse.json(
      { error: error.message || "Assistant failed" },
      { status: 500 }
    );
    return setCORSHeaders(res);
  }
}