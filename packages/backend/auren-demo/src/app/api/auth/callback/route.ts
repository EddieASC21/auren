import { NextResponse } from "next/server";
import { WorkOS } from "@workos-inc/node";
import { db } from "@/lib/firestore";
import jwt from "jsonwebtoken";
import Stripe from "stripe";

// ✅ Initialize Stripe + WorkOS
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-10-29.clover",
});
const workos = new WorkOS(process.env.WORKOS_API_KEY!);

export async function GET(req: Request) {
  try {
    // 🔹 1. Parse callback and get the authorization code
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    if (!code) {
      return NextResponse.json(
        { error: "Missing authorization code in callback." },
        { status: 400 }
      );
    }

    // 🔹 2. Authenticate user with WorkOS
    const { user } = await workos.userManagement.authenticateWithCode({
      clientId: process.env.WORKOS_CLIENT_ID!,
      code,
    });
    console.log("✅ Authenticated user:", user);

    // 🔹 3. Save or update user in Firestore
    const userRef = db.collection("users").doc(user.id);
    await userRef.set(
      {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profilePictureUrl: user.profilePictureUrl,
        emailVerified: user.emailVerified,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    // 🔹 4. Create JWT token (for session)
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
      },
      process.env.JWT_SECRET!,
      { expiresIn: "1h" }
    );

    // 🔹 5. (Optional) Fetch the latest confirmed order from Firestore
    const ordersRef = db
      .collection("orders_confirmed")
      .where("userEmail", "==", user.email)
      .orderBy("createdAt", "desc")
      .limit(1);

    const snapshot = await ordersRef.get();
    const order = snapshot.empty ? null : snapshot.docs[0].data();

    // 🔹 6. Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: order?.original?.productId || "Custom Order",
              description: order?.original?.notes || "Customized item",
            },
            unit_amount: 5000, // 💵 $50 fixed for now
          },
          quantity: 1,
        },
      ],
      success_url: process.env.STRIPE_SUCCESS_URL!,
      cancel_url: process.env.STRIPE_CANCEL_URL!,
      metadata: {
        userId: user.id,
        draftId: order?.draftId || "unknown",
        confirmedId: snapshot.empty ? "none" : snapshot.docs[0].id,
      },
    });

    console.log("✅ Stripe checkout session created:", session.id);

    // 🔹 7. Redirect user directly to Stripe Checkout
    const response = NextResponse.redirect(session.url!);

    // Include session cookie
    response.cookies.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60, // 1 hour
    });

    return response;
  } catch (err: any) {
    console.error("❌ WorkOS + Stripe callback error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to authenticate or redirect to Stripe." },
      { status: 500 }
    );
  }
}