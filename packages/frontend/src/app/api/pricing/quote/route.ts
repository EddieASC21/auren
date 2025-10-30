export async function POST(req: Request) {
  try {
    const { quantity } = await req.json();
    const q = Number(quantity);
    if (!Number.isFinite(q) || q < 1) {
      return new Response("Invalid quantity", { status: 400 });
    }

    let unitPrice = 12;
    if (q >= 50) unitPrice = 10;
    if (q >= 100) unitPrice = 9;

    return Response.json({ unitPrice, total: unitPrice * q });
  } catch (err) {
    return new Response("Pricing failed", { status: 500 });
  }
}


