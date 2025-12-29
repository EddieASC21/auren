import { NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/lib/firestore";
import nodemailer from "nodemailer";

export const dynamic = "force-dynamic";

console.log("⚡️ STRIPE WEBHOOK FILE LOADED");

// Single Stripe client (reuse inside handler)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-10-29.clover" as any,
});

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  // ✅ Verify signature + construct event
  try {
    const body = await req.text();
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error("❌ Webhook signature error:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      console.log(
        `🔔 Webhook received: ${event.type} | Session ID: ${session.id}`
      );

      const orderId = session.metadata?.aurenOrderId;
      const userEmail =
        session.customer_details?.email ||
        session.customer_email ||
        session.metadata?.email ||
        null;

      if (!orderId) {
        console.error(
          "❌ CRITICAL ERROR: Webhook received without 'aurenOrderId'."
        );
        return NextResponse.json(
          { received: true, status: "ignored_missing_metadata" },
          { status: 200 }
        );
      }

      // 🔍 Build shippingDetails as robustly as possible
      let shippingDetails: any = null;

      // 1) Directly on the session (if present)
      if ((session as any).shipping_details) {
        shippingDetails = (session as any).shipping_details;
      }

      // 2) Fallback: customer_details (has address/name/phone)
      if (!shippingDetails && session.customer_details) {
        const cd = session.customer_details;
        if (cd.address || cd.name || cd.phone) {
          shippingDetails = {
            name: cd.name || "",
            phone: cd.phone || "",
            address: cd.address || null,
            source: "customer_details",
          };
        }
      }

      // 3) Final fallback: PaymentIntent.shipping
      if (!shippingDetails && session.payment_intent) {
        try {
          const pi =
            typeof session.payment_intent === "string"
              ? await stripe.paymentIntents.retrieve(session.payment_intent)
              : session.payment_intent;

          if (pi && (pi as any).shipping) {
            shippingDetails = {
              ...(pi as any).shipping,
              source: "payment_intent.shipping",
            };
          }
        } catch (err) {
          console.error("⚠️ Could not retrieve PaymentIntent.shipping:", err);
        }
      }

      console.log("📦 Resolved shippingDetails:", shippingDetails);

      // 🔗 Look up pending order
      const pendingOrderRef = db.collection("orders").doc(orderId);
      const pendingSnap = await pendingOrderRef.get();

      if (!pendingSnap.exists) {
        console.error(
          `❌ Order ${orderId} not found in 'orders' collection.`
        );
        return NextResponse.json(
          { error: "Order not found" },
          { status: 200 }
        );
      }

      const orderData = pendingSnap.data();
      const items = orderData?.items || [];

      // ✅ Write to orders_confirmed with resolved shippingDetails
      await db.collection("orders_confirmed").doc(orderId).set({
        ...orderData,
        status: "paid",
        stripePaymentIntent: session.payment_intent,
        stripeSessionId: session.id,
        paidAt: new Date().toISOString(),
        customerEmail: userEmail,
        shippingDetails: shippingDetails || null,
      });

      // ✅ Update original order status
      await pendingOrderRef.update({ status: "paid" });

      // ✅ Create payment record
      await db.collection("payments").add({
        orderId,
        confirmedId: orderId,
        amount: session.amount_total ? session.amount_total / 100 : 0,
        currency: session.currency,
        email: userEmail,
        paymentIntent: session.payment_intent,
        createdAt: new Date().toISOString(),
      });

      console.log(`✅ Payment recorded and Order ${orderId} confirmed.`);

      // ✅ Send confirmation email
      if (userEmail) {
        await sendEnhancedEmail(
          userEmail,
          orderId,
          items,
          session.amount_total ? session.amount_total / 100 : 0
        );
      } else {
        console.warn(
          `⚠️ No email found for Order ${orderId}, skipping email notification.`
        );
      }
    }

    // Always acknowledge the webhook so Stripe stops retrying
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("❌ Webhook Internal Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// ======================================
// 📧 EMAIL BUILDER (unchanged)
// ======================================
async function sendEnhancedEmail(
  to: string,
  orderId: string,
  items: any[],
  totalAmount: number
) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });

    // 1. Calculate Totals
    const orderSubtotal = items.reduce(
      (acc, item) => acc + Number(item.subtotal),
      0
    );
    const orderTax = items.reduce(
      (acc, item) => acc + Number(item.taxAmount),
      0
    );

    // 2. Generate HTML for each item (Includes Back View Logic)
    const itemsHtml = items
      .map((item: any) => {
        const backImageHtml = item.backImageUrl
          ? `<div style="margin-top: 20px;">
            <p style="margin: 0 0 5px 0; font-size: 12px; color: #999; text-transform: uppercase; letter-spacing: 1px;">Back View</p>
            <img src="${item.backImageUrl}" 
                  alt="${item.productName} Back" 
                  style="max-width: 400px; width: 100%; border-radius: 8px; border: 1px solid #ddd; object-fit: contain; background: white;" />
          </div>`
          : "";

        return `
        <div style="background: #f9f9f9; padding: 20px; border-radius: 12px; margin-bottom: 25px; text-align: center; border: 1px solid #eee;">
          
          <h3 style="margin: 0 0 15px 0; color: #333; font-family: Arial, sans-serif; font-weight: 300; font-size: 22px;">
            ${item.productName}
          </h3>

          <div style="margin-bottom: 20px;">
            <p style="margin: 0 0 5px 0; font-size: 12px; color: #999; text-transform: uppercase; letter-spacing: 1px;">Front View</p>
            <img src="${
              item.imageUrl || "https://via.placeholder.com/400"
            }" 
                  alt="${item.productName}" 
                  style="max-width: 400px; width: 100%; border-radius: 8px; border: 1px solid #ddd; object-fit: contain; background: white;" />
            
            ${backImageHtml}
          </div>

          <div style="text-align: left; color: #555; font-size: 14px; background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #eee;">
            <!-- Qty and Unit on separate lines -->
            <div style="margin-bottom: 10px; line-height: 1.5;">
              <div>Qty: <strong>${item.quantity}</strong></div>
              <div>Unit: <strong>$${Number(item.unitPrice).toFixed(
                2
              )}</strong></div>
            </div>
            
            <div style="margin: 10px 0; padding-top: 10px; border-top: 1px solid #eee;">
              <strong style="color: #333;">Size Breakdown:</strong><br/>
              <span style="line-height: 1.5;">
                ${
                  item.sizeBreakdown
                    ? item.sizeBreakdown.replace(/\n/g, "<br/>")
                    : item.comments || "Standard"
                }
              </span>
            </div>

            <!-- Item total = pre-tax subtotal -->
            <p style="margin: 15px 0 0 0; font-weight: bold; text-align: right; font-size: 16px; color: #333;">
              Item Total: $${Number(item.subtotal).toFixed(2)}
            </p>
          </div>

        </div>
      `;
      })
      .join("");

    // 3. Send Email
    await transporter.sendMail({
      from: `Auren Team <${process.env.EMAIL_USER}>`,
      to,
      subject: `Order Confirmed #${orderId.slice(0, 8).toUpperCase()}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; padding: 20px;">
          
          <div style="text-align: center; padding-bottom: 20px; margin-bottom: 30px; border-bottom: 2px solid #000;">
            <h1 style="margin: 0; letter-spacing: 3px; font-size: 28px;">AUREN</h1>
            <p style="color: #666; margin-top: 5px;">Thanks for your order!</p>
          </div>

          <div style="padding: 0 10px;">
            <p style="text-align: center; margin-bottom: 30px; color: #666;">
              Your order <strong>#${orderId
                .slice(0, 8)
                .toUpperCase()}</strong> has been confirmed.
            </p>
            
            ${itemsHtml}

            <div style="margin-top: 40px; text-align: right; padding-top: 20px; border-top: 2px solid #000;">
              <table style="width: 100%; text-align: right; font-size: 16px; color: #555;">
                <tr>
                  <td style="padding-bottom: 5px;">Subtotal:</td>
                  <td style="padding-bottom: 5px; font-weight: bold;">$${orderSubtotal.toFixed(
                    2
                  )}</td>
                </tr>
                <tr>
                  <td style="padding-bottom: 15px;">Tax, Shipping, and Handling (8%):</td>
                  <td style="padding-bottom: 15px; font-weight: bold;">$${orderTax.toFixed(
                    2
                  )}</td>
                </tr>
                <tr style="font-size: 24px; color: #000;">
                  <td style="padding-top: 15px; font-weight: bold;">Total:</td>
                  <td style="padding-top: 15px; font-weight: bold;">$${totalAmount.toFixed(
                    2
                  )}</td>
                </tr>
              </table>
            </div>
          </div>

          <div style="text-align: center; font-size: 12px; color: #999; margin-top: 50px; padding-top: 20px; border-top: 1px solid #eee;">
            <p>You will receive another email when your order ships.</p>
            <p>© ${new Date().getFullYear()} Auren</p>
          </div>
        </div>
      `,
    });

    console.log(`✅ Enhanced Email sent to ${to}`);
  } catch (error) {
    console.error("❌ Email failed:", error);
  }
}