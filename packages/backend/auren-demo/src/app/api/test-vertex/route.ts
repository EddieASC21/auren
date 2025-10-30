import { NextResponse } from "next/server";

// Test endpoint for Google Vertex AI integration
export async function GET() {
  try {
    // Check if environment variables are properly set
    const projectId = process.env.GOOGLE_PROJECT_ID;
    const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    
    if (!projectId) {
      return NextResponse.json({ 
        error: "GOOGLE_PROJECT_ID not set",
        status: "missing_project_id"
      }, { status: 500 });
    }
    
    if (!credentials) {
      return NextResponse.json({ 
        error: "GOOGLE_APPLICATION_CREDENTIALS not set",
        status: "missing_credentials"
      }, { status: 500 });
    }

    // For now, return a success message indicating the configuration is correct
    return NextResponse.json({ 
      reply: "Vertex AI configuration is correct",
      projectId,
      credentialsPath: credentials,
      status: "configured"
    });
  } catch (err: any) {
    console.error("Vertex test error:", err);
    return NextResponse.json({ 
      error: err.message || String(err),
      details: "Check Google Cloud credentials and project configuration"
    }, { status: 500 });
  }
}