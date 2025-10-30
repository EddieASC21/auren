import { NextResponse } from "next/server";
import { WorkOS } from "@workos-inc/node";

// Instantiate WorkOS with your API key
const workos = new WorkOS(process.env.WORKOS_API_KEY!);

// Mapping friendly query params → WorkOS provider IDs
const PROVIDER_MAP: Record<string, string> = {
  google: "GoogleOAuth",
  apple: "AppleOAuth",
  github: "GitHubOAuth",
  microsoft: "MicrosoftOAuth",
};

// Handle OAuth login requests for different providers
export async function GET(req: Request) {
  try {
    // Parse the request URL to get the provider parameter
    const url = new URL(req.url);
    const providerQuery = (url.searchParams.get("provider") || "").toLowerCase();

    // Map the provider query to WorkOS provider ID
    const provider = PROVIDER_MAP[providerQuery];
    if (!provider) {
      return NextResponse.json(
        {
          error:
            "Invalid provider. Use one of: google | apple | github | microsoft",
        },
        { status: 400 }
      );
    }

    // Ensure redirect matches what you whitelisted under Developer → Redirects
    const redirectUri =
      process.env.WORKOS_REDIRECT_URI ||
      "http://localhost:3000/api/auth/callback";

    // Generate the authorization URL for the selected provider
    const authorizationUrl = await workos.userManagement.getAuthorizationUrl({
      clientId: process.env.WORKOS_CLIENT_ID!,
      provider, // e.g., "GoogleOAuth"
      redirectUri,
      // optional: state, loginHint, etc.
    });

    console.log(`🔐 Redirecting to WorkOS ${provider}: ${authorizationUrl}`);

    // Redirect user to the OAuth provider
    return NextResponse.redirect(authorizationUrl);
  } catch (err: any) {
    console.error("WorkOS login error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to start login" },
      { status: 500 }
    );
  }
}