import { NextResponse } from "next/server";
import { WorkOS } from "@workos-inc/node";
import { db } from "@/lib/firestore";
import jwt from "jsonwebtoken";
import Stripe from "stripe";

// --- Define your live frontend URL ---
const LIVE_FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

export async function GET(req: Request) {
  try {
    const workos = new WorkOS(process.env.WORKOS_API_KEY!);
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2025-10-29.clover",
    });

    // 1️⃣ Get code from callback
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    if (!code) {
      const response = NextResponse.json(
        { error: "Missing authorization code in callback." },
        { status: 400 }
      );
      response.headers.set("Access-Control-Allow-Origin", LIVE_FRONTEND_URL);
      return response;
    }

    // 2️⃣ Exchange code for user profile
    const { user } = await workos.userManagement.authenticateWithCode({
      clientId: process.env.WORKOS_CLIENT_ID!,
      code,
    });
    console.log("✅ Authenticated user:", user.email);

    // 3️⃣ Save user to Firestore
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

    // 4️⃣ Create session JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: "1h" }
    );

    // --- START FIX: Wrap order retrieval in a try/catch ---
    // 5️⃣ Optional: retrieve latest order
    let order: any = null;
    let confirmedId: string = "none";
    try {
      const ordersRef = db
        .collection("orders_confirmed")
        .where("userEmail", "==", user.email)
        .orderBy("createdAt", "desc")
        .limit(1);

      const snapshot = await ordersRef.get();
      if (!snapshot.empty) {
        order = snapshot.docs[0].data();
        confirmedId = snapshot.docs[0].id;
      }
    } catch (e) {
      console.warn("Could not retrieve latest order (collection might not exist yet):", e);
      // Fail gracefully and continue with no order info
    }
    // --- END FIX ---

    // 6️⃣ Create Stripe checkout session
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
            unit_amount: 5000,
          },
          quantity: 1,
        },
      ],
      success_url: process.env.STRIPE_SUCCESS_URL!,
      cancel_url: process.env.STRIPE_CANCEL_URL!,
      metadata: {
        userId: user.id,
        confirmedId: confirmedId,
      },
    });

    console.log("✅ Stripe checkout session created:", session.id);

    // 7️⃣ Redirect user to Stripe checkout
    const response = NextResponse.redirect(session.url!);
    response.cookies.set("session", token, {
      httpOnly: true,
      secure: true,
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60,
    });
    return response;
  } catch (err: any) {
    console.error("❌ WorkOS + Stripe callback error:", err);
    // --- Add CORS header to the error response ---
    const response = NextResponse.json(
      { error: err.message || "Failed to authenticate or redirect to Stripe." },
      { status: 500 }
    );
    response.headers.set("Access-Control-Allow-Origin", LIVE_FRONTEND_URL);
    return response;
  }
}