// API route to test environment variable configuration
// This endpoint checks if required environment variables are properly set
export async function GET() {
  return Response.json({
    // Check if OpenAI API key is configured (not placeholder)
    OPENAI_KEY_EXISTS: !!process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes("your_openai_api_key_here"),
    
    // Display Google Project ID (or "missing" if not set)
    GOOGLE_PROJECT_ID: process.env.GOOGLE_PROJECT_ID || "missing",
    
    // Check if Google Application Credentials path is set
    // Shows ✅ if set, ❌ if not set
    GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS
      ? "✅ set"
      : "❌ not set",
  });
}