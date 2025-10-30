import { NextResponse } from "next/server";
import { WorkOS } from "@workos-inc/node";

const workos = new WorkOS(process.env.WORKOS_API_KEY!);

const PROVIDER_MAP: Record<string, string> = {
  google: "GoogleOAuth",
  apple: "AppleOAuth",
  github: "GitHubOAuth",
  microsoft: "MicrosoftOAuth",
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const providerQuery = (url.searchParams.get("provider") || "").toLowerCase();
    const provider = PROVIDER_MAP[providerQuery];
    if (!provider) {
      return NextResponse.json(
        { error: "Invalid provider. Use one of: google | apple | github | microsoft" },
        { status: 400 }
      );
    }

    const redirectUri =
      process.env.WORKOS_REDIRECT_URI || "http://localhost:3000/api/auth/callback";

    const authorizationUrl = await workos.userManagement.getAuthorizationUrl({
      clientId: process.env.WORKOS_CLIENT_ID!,
      provider,
      redirectUri,
    });

    return NextResponse.redirect(authorizationUrl);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to start login" },
      { status: 500 }
    );
  }
}


