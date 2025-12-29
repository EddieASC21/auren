const { GoogleGenAI } = require("@google/genai");

// Replace with your actual key or ensure it's in your env
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

async function check() {
  console.log("Checking available models...");
  try {
    const result = await ai.models.list();
    console.log("--------------------------------");
    result.models.forEach(m => {
      if (m.name.includes("gemini") || m.name.includes("image")) {
        console.log(`Model ID: ${m.name}`);
        console.log(`Capabilities: ${m.supportedGenerationMethods}`);
        console.log("--------------------------------");
      }
    });
  } catch (e) {
    console.error("Error:", e.message);
  }
}
check();