// API endpoint for calculating pricing quotes based on quantity
export async function POST(req: Request) {
  try {
    // Parse the request body to get the quantity
    const { quantity } = await req.json();
    const q = Number(quantity);

    // Validate that the quantity is a valid positive number
    if (!Number.isFinite(q) || q < 1) {
      return new Response("Invalid quantity", { status: 400 });
    }

    // Simple tiered pricing structure for demo purposes
    let unitPrice = 12; // Base price
    if (q >= 50)  unitPrice = 10; // Discount for 50+ units
    if (q >= 100) unitPrice = 9;  // Better discount for 100+ units

    // Return the calculated pricing information
    return Response.json({
      unitPrice,
      total: unitPrice * q,
    });
  } catch (err) {
    console.error("Pricing error:", err);
    return new Response("Pricing failed", { status: 500 });
  }
}