import { GoogleAuth } from "google-auth-library";

export async function GET() {
  const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  return Response.json({ hasToken: !!token.token });
}


