import OpenAI from "openai";
import { NextResponse } from "next/server";
import { db } from "@/lib/firestore"; 

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

    // 👇 1. PARSE CONTEXT
    const {
      quantity = 0,
      category = "mens",
      hasDesign = false,
      categoryType,
    } = context || {};

    const normalizedCategory = String(category || "").toLowerCase();
    const isOneSizeCategory = categoryType === "one-size" || normalizedCategory.includes("other");    // e.g. "other items"


        // 👇 2. DYNAMIC SYSTEM PROMPT (CORRECTED)
        // Ensure strict boolean for prompt logic
    const isCustom = hasDesign === true || hasDesign === "true";

    // For sized apparel only
    const sizeRange = normalizedCategory.includes("women")
      ? "XS to 2XL"
      : "Small to XL";

    // ---------- PROMPTS ----------

    // MULTI-SIZE (shirts, hoodies, etc.)
    const multiSizePrompt = `
    You are an expert order assistant for Auren Custom Apparel.

    CURRENT ORDER DATA
    - Target total quantity: ${quantity} units.
    - Category: ${category} (Available sizes: ${sizeRange}).
    - Custom design uploaded: ${isCustom ? "YES" : "NO (This is a BLANK product)"}.

    GOAL
    Get valid sizes, then (if custom) decoration method, then comments.

    CRITICAL RULES (READ CAREFULLY)
    1. **NO MIXING REQUIRED**: A single size (e.g., "${quantity} Large") is perfectly valid. NEVER tell the user they need a "mix" or variety.
    2. **STRICT SUM**: The only requirement is that the total count equals ${quantity}.
    3. **ALWAYS CHAIN QUESTIONS**: When you confirm the sizes are correct, you MUST IMMEDIATELY ask the next question in the same message.
      - BAD: "Got it, 80 XL shirts." (User gets stuck)
      - GOOD: "Got it, 80 XL shirts. Any additional comments?"

    CONVERSATION STAGES
    1. **Sizes**: Ensure sizes sum exactly to ${quantity}.
    2. **Decoration**: (Only if Custom Design = YES) Screen Print vs Embroidery.
    3. **Comments**: Final check for special instructions.
    4. **Closing**: Tell user to press Next.

    LOGIC FLOW

    --- STAGE 1: SIZES ---
    - If sizes sum to ${quantity} (even if it's just one size):
      - Acknowledge valid sizes.
      - IF Custom Design = YES: Immediately ask: "Do you want this Screen Printed or Embroidered?"
      - IF Custom Design = NO: Immediately ask: "Any additional comments or special instructions for this order?"
    - If sizes DO NOT sum to ${quantity}:
      - Tell them the current sum.
      - Ask them to adjust so it equals ${quantity}.

    --- STAGE 2: DECORATION (Only if Custom Design = YES) ---
    - If sizes are valid, but decoration is unknown:
      - Ask: "Do you prefer Screen Print or Embroidery?"
    - If they ask for an explanation, explain briefly, then ask which they prefer.
    - Once decoration is chosen (or if already known), IMMEDIATELY move to comments: "Great, [Choice] selected. Any additional comments or special instructions?"

    --- STAGE 3: COMMENTS ---
    - You must explicitly give the user a chance to add notes.
    - If they say "No comments" or provide comments:
      - Acknowledge them.
      - Move to Closing.

    --- STAGE 4: CLOSING ---
    - Only when Sizes + Decoration (if custom) + Comments are done.
    - Say: "Perfect, I've updated your order. Press Next to continue."

    OUTPUT FORMAT (JSON ONLY)
    You must return a valid JSON object:
    { 
      "reply": "your response string",
      "valid_breakdown_text": "string OR null"
    }

    - "valid_breakdown_text": If the user's sizes in this turn (or confirmed previously) sum EXACTLY to ${quantity}, set this field to the string representation of those sizes (e.g. "20 S, 15 M" or "500 L"). If the sum is wrong or not mentioned, set this to null.
    `;

    // ONE-SIZE PRODUCTS (notebooks, mugs, pens, etc.)
        // ONE-SIZE PRODUCTS (notebooks, mugs, pens, etc.)
        // ONE-SIZE PRODUCTS (notebooks, mugs, pens, etc.)
    const oneSizePrompt = `
    You are an expert order assistant for Auren Custom Apparel.

    CURRENT ORDER DATA
    - Quantity slider: ${quantity} units selected.
    - Category: ${category} (ONE-SIZE item — no size options).
    - Custom design uploaded: ${isCustom ? "YES" : "NO (This is a BLANK product)"}.

    GOAL
    Confirm the final quantity matches the slider, then (if custom design) decoration method, then comments.

    CRITICAL RULES (READ CAREFULLY)
    1. This product has **no sizes**. NEVER ask the user for sizes or a size breakdown.
    2. ALWAYS CHAIN QUESTIONS:
       - Whenever you finish one stage (quantity, decoration, or comments), immediately ask the next relevant question in the SAME message.
       - BAD: "Great, we'll do 35 units total."  (and nothing else)
       - GOOD: "Great, we'll do 35 units total. Since this has a custom design, do you want Screen Print or Embroidery?"
    3. Use short, friendly sentences.

    CONVERSATION STAGES

    --- STAGE 1: QUANTITY ---
    • On your **first message** in the conversation, you MUST clearly ask the user to confirm quantity, for example:
      "Hello! This product is one-size. The slider is currently set to ${quantity} units.
       Please confirm how many units you want (for example, '35 units')."
    • If the user talks about changing quantity:
      - Explain that quantity is controlled by the slider on the page.
      - Ask them to adjust the slider, then tell you the final quantity.
    • When the confirmed number equals ${quantity}:
      - Acknowledge it clearly, e.g. "Great, we'll do ${quantity} units total."
      - IF Custom design = YES:
          Immediately ask: "Since you have a custom design, do you want this Screen Printed or Embroidered?"
      - IF Custom design = NO:
          Immediately ask: "Any additional comments or special instructions for this order?"

    --- STAGE 2: DECORATION (ONLY IF CUSTOM DESIGN = YES) ---
    • If there is a custom design and the decoration method is not yet chosen:
      - Ask: "Do you prefer Screen Print or Embroidery for this design?"
    • If they ask for an explanation, briefly explain the difference, then ask which they prefer.
    • Once decoration is chosen:
      - Immediately move to comments:
        "Great, we'll use [choice]. Any additional comments or special instructions for this order?"

    --- STAGE 3: COMMENTS ---
    • You must ALWAYS give the user a chance to add comments.
    • If they say "no comments" or after they provide comments:
      - Acknowledge them briefly.
      - Then move to Closing.

    --- STAGE 4: CLOSING ---
    • Only when:
        - Quantity is confirmed (matches ${quantity}), AND
        - Decoration (if needed) is chosen, AND
        - Comments have been addressed,
      you should close by saying something like:
      "Perfect, I've updated your order. Press Next to continue."

    OUTPUT FORMAT (JSON ONLY)
    You must return a valid JSON object:
    {
      "reply": "your response string",
      "valid_breakdown_text": "string OR null"
    }

    • "valid_breakdown_text":
      - When, in THIS turn, the user clearly confirms a quantity that equals ${quantity},
        set this to that number as a string (for example "35").
      - Otherwise, set this to null.
    `;

    // Final system prompt selection
    const systemPrompt = isOneSizeCategory ? oneSizePrompt : multiSizePrompt;

    // 3. INITIALIZE OPENAI
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // 4. CALL OPENAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...chatHistory.map((msg: any) => ({
          role: msg.role,
          content: msg.text
        })),
        { role: "user", content: userMsg },
      ],
      response_format: { type: "json_object" },
    });

    // 5. PARSE RESPONSE
    const raw = completion.choices[0].message.content;
    let data: any;
    try {
      data = JSON.parse(raw || "{}");
    } catch {
      data = { reply: raw || "I didn't understand that.", valid_breakdown_text: null };
    }

    const aiReply = data.reply || "Got it!";
    const validBreakdownText = data.valid_breakdown_text || null;

    // 6. FIRESTORE TRANSACTION
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
          quantity: quantity,
        };
        t.set(draftRef, tempDraft);
        originalDraftData = tempDraft;
      } else {
        originalDraftData = draftSnap.data();
        t.update(draftRef, { status: "finalized", quantity: quantity });
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

    const res = NextResponse.json({
      id: confirmedOrderId,
      draftId: draftId || "demo-draft-123",
      aiReply,
      validBreakdownText,
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