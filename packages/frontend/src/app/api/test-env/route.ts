export async function GET() {
  const keys = [
    "OPENAI_API_KEY",
    "GOOGLE_API_KEY",
    "GOOGLE_PROJECT_ID",
    "GOOGLE_APPLICATION_CREDENTIALS",
    "WORKOS_API_KEY",
    "WORKOS_CLIENT_ID",
    "JWT_SECRET",
  ];
  const present = keys.filter((k) => !!process.env[k]);
  return Response.json({ present, missing: keys.filter((k) => !present.includes(k)) });
}


