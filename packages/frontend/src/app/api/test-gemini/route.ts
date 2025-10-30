export async function GET() {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GOOGLE_API_KEY}`
  );
  return new Response(await res.text(), { status: res.status, headers: { "content-type": "application/json" } });
}


