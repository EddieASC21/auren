import { NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/lib/firestore";
import { getAuthenticatedUser } from "@/lib/auth";

// --- Define your live frontend URL ---
const LIVE_FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-10-29.clover",
});

// --- ADDED OPTIONS HANDLER FOR CORS ---
export async function OPTIONS() {
  const headers = {
    "Access-Control-Allow-Origin": LIVE_FRONTEND_URL,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
  return new NextResponse(null, { status: 204, headers });
}
// --- END ADDED HANDLER ---

export async function POST() {
  const headers = { "Access-Control-Allow-Origin": LIVE_FRONTEND_URL };

  try {
    // ✅ 1. Verify authentication
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
    }

    // ✅ 2. Get their latest confirmed order
    let order: any = null;
    let confirmedId: string = "none";
    try {
      const ordersRef = db
        .collection("orders_confirmed")
        .where("userEmail", "==", user.email)
        .orderBy("createdAt", "desc")
        .limit(1);

      const snapshot = await ordersRef.get();
      if (snapshot.empty) {
        return NextResponse.json(
          { error: "No confirmed order found" },
          { status: 404, headers }
        );
      }
      order = snapshot.docs[0].data();
      confirmedId = snapshot.docs[0].id;

    } catch (e) {
      console.warn("Checkout order query failed (collection might not exist):", e);
      return NextResponse.json(
        { error: "No confirmed order found for this user." },
        { status: 404, headers }
      );
    }
    
    // ✅ 3. Create a Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: order.original?.productId || "Custom Order",
              description: order.original?.notes || "Customized item",
            },
            unit_amount: 5000,
          },
          quantity: 1,
        },
      ],
      success_url: process.env.STRIPE_SUCCESS_URL!,
      cancel_url: process.env.STRIPE_CANCEL_URL!,
      metadata: {
        userId: user.userId,
        draftId: order.draftId,
        confirmedId: confirmedId,
      },
    });

    console.log(`✅ Created Stripe session: ${session.id}`);

    // ✅ 4. Return the Stripe session URL
    return NextResponse.json({ url: session.url }, { headers });
  } catch (error: any) {
    console.error("❌ Stripe Checkout Error:", error);
    return NextResponse.json(
      { error: error.message || "Checkout failed" },
      { status: 500, headers }
    );
  }
}