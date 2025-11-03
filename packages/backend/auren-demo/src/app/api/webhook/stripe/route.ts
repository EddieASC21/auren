import { NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/lib/firestore";
import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import https from "https";

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-10-29.clover",
  });

  let event: Stripe.Event;
  try {
    const body = await req.text();
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    console.error("❌ Webhook verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const confirmedId = session.metadata?.confirmedId;
        const userEmail = session.customer_email || process.env.TEST_EMAIL_FALLBACK;

        // ✅ Update order in Firestore
        if (confirmedId) {
          const orderRef = db.collection("orders_confirmed").doc(confirmedId);
          await orderRef.update({
            paymentStatus: "paid",
            paymentIntent: session.payment_intent,
            paidAt: new Date().toISOString(),
          });
          console.log(`💰 Order ${confirmedId} marked as paid.`);
        }

        // ✅ Send confirmation email
        if (userEmail) {
          try {
            await sendConfirmationEmail(userEmail, confirmedId || "N/A");
            console.log(`📧 Confirmation email sent to ${userEmail}`);
          } catch (err) {
            console.error("❌ Failed to send email:", err);
          }
        } else {
          console.warn("⚠️ No email found; skipping email send.");
        }

        // ✅ Store payment receipt in Firestore
        try {
          await db.collection("payments").add({
            paymentIntent: session.payment_intent || "unknown",
            amount_total: session.amount_total ? session.amount_total / 100 : null,
            currency: session.currency?.toUpperCase() || "USD",
            email: userEmail || "unknown",
            confirmedId: confirmedId || "unknown",
            createdAt: new Date().toISOString(),
          });
          console.log(`🧾 Payment record stored for ${userEmail}`);
        } catch (err) {
          console.error("❌ Failed to store payment record:", err);
        }

        break;
      }

      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("❌ Error handling Stripe event:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// === Email helper ===
async function sendConfirmationEmail(to: string, orderId: string, productImageUrl?: string | null) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });

  await transporter.verify();
  console.log("📡 Gmail transporter verified successfully.");

  let attachment: any = null;

  if (productImageUrl) {
    console.log("🖼️ Downloading image for inline attachment:", productImageUrl);
    const imageBuffer = await new Promise<Buffer>((resolve, reject) => {
      https
        .get(productImageUrl, (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () => resolve(Buffer.concat(chunks)));
        })
        .on("error", (err) => reject(err));
    });

    attachment = {
      filename: "design.png",
      content: imageBuffer,
      cid: "design-image",
    };
    console.log("✅ Image buffer downloaded, size:", attachment.content.length);
  }

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject: "Auren - Your Order Confirmation",
    html: `
      <div style="font-family:Helvetica,Arial,sans-serif;padding:20px;color:#222;">
        <h2 style="text-align:center;color:#111;">Thank you for your purchase!</h2>
        <p>Your payment has been received and your order (<b>${orderId}</b>) is confirmed.</p>
        ${
          attachment
            ? `<div style="text-align:center;margin:20px 0;">
                 <img src="cid:design-image" alt="Your Auren Design" width="320"
                   style="border-radius:12px;box-shadow:0 4px 10px rgba(0,0,0,0.2);" />
               </div>`
            : ""
        }
        <p>We’ll notify you once it ships.</p>
        <br>
        <p>– The Auren Team</p>
      </div>
    `,
    attachments: attachment ? [attachment] : [],
  });

  console.log("📧 Email with inline buffer image sent successfully!");
}

// Required for Next.js App Router
export const dynamic = "force-dynamic";
export const runtime = "nodejs";