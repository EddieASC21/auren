import { NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/lib/firestore";
import { getAuthenticatedUser } from "@/lib/auth";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-10-29.clover", 
});

export async function POST() {
  try {
    // ✅ 1. Verify authentication
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ✅ 2. Get their latest confirmed order
    const ordersRef = db
      .collection("orders_confirmed")
      .where("userEmail", "==", user.email)
      .orderBy("createdAt", "desc")
      .limit(1);

    const snapshot = await ordersRef.get();
    if (snapshot.empty) {
      return NextResponse.json(
        { error: "No confirmed order found" },
        { status: 404 }
      );
    }

    const order = snapshot.docs[0].data();

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
            // 💵 For testing: fixed $50/order, adjust later based on real logic
            unit_amount: 5000, // $50.00
          },
          quantity: 1,
        },
      ],
      success_url: process.env.STRIPE_SUCCESS_URL!,
      cancel_url: process.env.STRIPE_CANCEL_URL!,
      metadata: {
        userId: user.userId,
        draftId: order.draftId,
        confirmedId: snapshot.docs[0].id,
      },
    });

    console.log(`✅ Created Stripe session: ${session.id}`);

    // ✅ 4. Return the Stripe session URL
    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("❌ Stripe Checkout Error:", error);
    return NextResponse.json(
      { error: error.message || "Checkout failed" },
      { status: 500 }
    );
  }
}