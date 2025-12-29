import OpenAI from "openai"; // 👈 Changed from GoogleGenerativeAI
import { NextResponse } from "next/server";
import { db } from "@/lib/firestore"; // Ensure this path matches your project

// ---------------- CORS HELPERS ----------------
const LIVE_FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

function setCORSHeaders(res: NextResponse) {
  res.headers.set("Access-Control-Allow-Origin", LIVE_FRONTEND_URL);
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return res;
}

export async function OPTIONS() {
  const headers = {
    "Access-Control-Allow-Origin": LIVE_FRONTEND_URL,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
  return new NextResponse(null, { status: 204, headers });
}

// ---------------- MAIN ROUTE ----------------
export async function POST(req: Request) {
  try {
    // 🧾 Parse request body
    const { chatHistory = [], userMsg, draftId, context } = await req.json();
    
    if (!userMsg || typeof userMsg !== "string") {
      const res = NextResponse.json({ error: "Missing userMsg" }, { status: 400 });
      return setCORSHeaders(res);
    }

    const now = new Date().toISOString();

    // 🧠 Guest user setup
    const user = {
      userId: "guest",
      email: "guest@auren.ai",
      name: "Guest User",
    };

    // 👇 1. PARSE CONTEXT (Same logic as before)
    const { 
      quantity = 0, 
      category = "mens", 
      hasDesign = false 
    } = context || {};

    const sizeRange = category.toLowerCase().includes("women") ? "XS to 2XL" : "Small to XL";

    // 👇 2. DYNAMIC SYSTEM PROMPT
    // Note: We kept "Always return JSON" which is required for OpenAI JSON mode
    const systemPrompt = `
    You are an expert order assistant for Auren Custom Apparel.
    
    **CURRENT ORDER DATA:**
    - **Target Total Quantity:** ${quantity} units (The user's size breakdown MUST sum to exactly this).
    - **Category:** ${category} (Size range: ${sizeRange}).
    - **Custom Design Uploaded:** ${hasDesign ? "YES" : "NO"}.

    **YOUR TASKS:**
    1. **Check the Math:** If the user gives numbers (e.g. "10 S, 5 M"), sum them. 
       - If they don't equal ${quantity}, politely correct them: "That adds up to [SUM], but the slider is set to ${quantity}. Please adjust."
       - If they do equal ${quantity}, confirm it.
    2. **Technique:** ${hasDesign ? "Since they have a design, you MUST ask: 'Do you want this Screen Printed or Embroidered?'" : "Do not ask about print/embroidery."}
    3. **Sizes:** If sizes aren't set, ask for the breakdown for ${category} (${sizeRange}).

    Keep it conversational, short, and helpful.
    Always return JSON: { "reply": "your response" }
    `;

    // 3. INITIALIZE OPENAI
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY, 
    });

    // 4. CALL OPENAI
    // We map your frontend chatHistory to OpenAI's format
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Cost effective & fast
      messages: [
        { role: "system", content: systemPrompt },
        ...chatHistory.map((msg: any) => ({
          role: msg.role, // 'user' or 'assistant' work fine here
          content: msg.text // Map 'text' to 'content'
        })),
        { role: "user", content: userMsg },
      ],
      response_format: { type: "json_object" }, // 👈 Forces valid JSON response
    });

    // 5. PARSE RESPONSE
    const raw = completion.choices[0].message.content;
    let data: any;
    try {
      data = JSON.parse(raw || "{}");
    } catch {
      // Fallback if valid JSON wasn't returned
      data = { reply: raw || "I didn't understand that." };
    }

    const aiReply = data.reply || "Got it!";

    // 6. FIRESTORE TRANSACTION (Logic remains identical)
    let confirmedOrderId: string | null = null;
    let originalDraftData: any = null;

    await db.runTransaction(async (t) => {
      const draftRef = db.collection("orders_draft").doc(draftId || "demo-draft-123");
      const draftSnap = await t.get(draftRef);

      if (!draftSnap.exists) {
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

    // ✅ Return exact same structure frontend expects
    const res = NextResponse.json({
      id: confirmedOrderId,
      draftId: draftId || "demo-draft-123",
      aiReply, // Frontend looks for this
      createdAt: now,
      status: "confirmed",
      user,
    });
    return setCORSHeaders(res);

  } catch (error: any) {
    console.error("OpenAI Assistant Error:", error);
    const res = NextResponse.json(
      { error: error.message || "Assistant failed" },
      { status: 500 }
    );
    return setCORSHeaders(res);
  }
}