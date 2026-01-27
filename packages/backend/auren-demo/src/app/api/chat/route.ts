import OpenAI from "openai";
import { NextResponse } from "next/server";
import { rateLimit, RATE_LIMITS } from "@/lib/rateLimit";


// --- Define your live frontend URL ---
const LIVE_FRONTEND_URL =
 process.env.FRONTEND_URL ||
 (process.env.NODE_ENV === "production"
   ? "https://auren.co"
   : "http://localhost:3000");
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
 // ✅ Rate limiting: AI chat is moderately expensive
 const limitCheck = await rateLimit(req, RATE_LIMITS.AI_MODERATE);
 if (limitCheck.limited) {
   return limitCheck.response;
 }

 try {
   // 👇 Now accepts previousPrompt + imageBase64
   const { prompt, imageBase64, previousPrompt } = await req.json();


   if (!prompt || typeof prompt !== "string") {
     return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
   }


   const systemPrompt = `
You are an image prompt composer for an image generation model.


The user may:
- Start a brand-new idea, or
- Ask for edits to an existing image.


If a "previousPrompt" is provided, treat it as the full description of the current image.
The new "prompt" describes changes or additions (for example: "add a cat to the image").


Your job in that case is to:
- KEEP all important elements, style, and composition from previousPrompt.
- APPLY the changes requested in the new prompt so the scene is updated, not replaced.


Always respond with a single, self-contained image prompt that could be sent directly
to an image generator. Do not mention "previousPrompt", "edits", or instructions;
just describe the final image.
`.trim();


   // ✅ DEFINE messages (with system message)
   const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
     {
       role: "system",
       content: systemPrompt,
     },
   ];


   // --- Build the user message text ---
   let combinedText: string;


   if (previousPrompt && typeof previousPrompt === "string" && previousPrompt.trim() !== "") {
     combinedText = `
Previous image description:
"""${previousPrompt}"""


The user now says:
"""${prompt}"""


Produce ONE updated image prompt that keeps the scene from the previous description
but incorporates the new instructions.
`.trim();
   } else {
     // First time / no prior image: just use the user's prompt as-is
     combinedText = prompt;
   }


   const userMessageContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
     {
       type: "text",
       text: combinedText,
     },
   ];


   // If an image is provided, add it to the user message
   if (imageBase64 && typeof imageBase64 === "string") {
     const dataUrl = imageBase64.startsWith("data:image")
       ? imageBase64
       : `data:image/jpeg;base64,${imageBase64.split(",").pop()}`;


     userMessageContent.push({
       type: "image_url",
       image_url: {
         url: dataUrl,
         detail: "low",
       },
     });
   }


   messages.push({
     role: "user",
     content: userMessageContent,
   });


   // 💬 Send prompt to OpenAI
   const completion = await openai.chat.completions.create({
     model: "gpt-4o-mini", // This model supports vision
     messages,
   });


   const reply = completion.choices[0].message.content?.trim() || "";


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
