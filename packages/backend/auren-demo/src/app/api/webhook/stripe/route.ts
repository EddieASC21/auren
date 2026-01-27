// packages/backend/auren-demo/src/app/api/webhook/stripe/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/lib/firestore";
import nodemailer from "nodemailer";
import { sendAdminNotification } from "@/lib/email";

export const dynamic = "force-dynamic";

console.log("⚡️ STRIPE WEBHOOK FILE LOADED");

// Single Stripe client (reuse inside handler)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-10-29.clover" as any,
});

const TAX_RATE = 0.08;

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
      const sessionFromEvent = event.data.object as Stripe.Checkout.Session;

      // ✅ Re-fetch so discounts + promotion_code are reliable
      const session = await stripe.checkout.sessions.retrieve(sessionFromEvent.id, {
        expand: [
          "discounts",
          "discounts.promotion_code",
          "discounts.promotion_code.coupon",
        ],
      });

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
        console.error(`❌ Order ${orderId} not found in 'orders' collection.`);
        return NextResponse.json({ error: "Order not found" }, { status: 200 });
      }

      const orderData = pendingSnap.data();
      const items = orderData?.items || [];

      // ---- promo code text (if any) ----
      const promoCodeText =
        session.discounts?.[0]?.promotion_code &&
        typeof session.discounts[0].promotion_code !== "string"
          ? session.discounts[0].promotion_code.code
          : null;

      // ---- amounts in cents ----
      const orderSubtotalCents = Math.round(
        items.reduce((acc: number, item: any) => acc + Number(item.subtotal || 0), 0) * 100
      );

      // Stripe gives subtotal/discount in cents; fallback to Firestore subtotal if missing
      const amountSubtotalCents =
        typeof session.amount_subtotal === "number" ? session.amount_subtotal : orderSubtotalCents;

      const discountAmountCents =
        typeof session.total_details?.amount_discount === "number"
          ? session.total_details.amount_discount
          : 0;

      // ✅ Your desired rule: tax is 8% of (subtotal - discount)
      const discountedSubtotalCents = Math.max(0, amountSubtotalCents - discountAmountCents);
      // Use Stripe's actual tax when available for exact cents matching, otherwise compute
      const amountTaxCents = session.total_details?.amount_tax ?? Math.round(discountedSubtotalCents * TAX_RATE);
      const amountTotalCents = discountedSubtotalCents + amountTaxCents;

      const emailTotals = {
        subtotal: amountSubtotalCents / 100,
        discount: discountAmountCents / 100,
        tax: amountTaxCents / 100,
        total: amountTotalCents / 100,
      };

      console.log('📊 Session total details:', {
        amount_subtotal: session.amount_subtotal,
        amount_discount: session.total_details?.amount_discount,
        amount_tax: session.total_details?.amount_tax,
        amount_total: session.amount_total,
        discounts: session.discounts,
        promoCodeText,
      });

      console.log("📧 Email totals:", { emailTotals, promoCodeText });

      // ✅ Write to orders_confirmed with resolved shippingDetails and discount info
      await db.collection("orders_confirmed").doc(orderId).set({
        ...orderData,
        status: "paid",
        stripePaymentIntent: session.payment_intent,
        stripeSessionId: session.id,
        paidAt: new Date().toISOString(),
        customerEmail: userEmail,
        shippingDetails: shippingDetails || null,
        discountAmountCents: discountAmountCents,
        promotionCode: promoCodeText,
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

      // 🔎 Debug: confirm URLs that will be used for the email
      console.log(
        "📧 Email items preview:",
        items.map((it: any) => ({
          productName: it.productName,
          imageUrl: it.imageUrl,
          backImageUrl: it.backImageUrl,
        }))
      );

      // ✅ Send confirmation email (CID attachments)
      if (userEmail) {
        await sendEnhancedEmail(
          userEmail,
          orderId,
          items,
          emailTotals,
          promoCodeText
        );
      } else {
        console.warn(
          `⚠️ No email found for Order ${orderId}, skipping email notification.`
        );
      }

      // ✅ Send admin notification (non-blocking)
      const itemsSummary = items.map((item: any) =>
        `${item.productName} x${item.quantity} ($${Number(item.subtotal || 0).toFixed(2)})`
      ).join('<br/>');

      const shippingHtml = shippingDetails?.address
        ? `
          <tr>
            <td style="padding: 8px 0; color: #666; vertical-align: top;"><strong>Shipping</strong></td>
            <td style="padding: 8px 0;">
              ${shippingDetails.name || ''}<br/>
              ${shippingDetails.address?.line1 || ''}<br/>
              ${shippingDetails.address?.line2 ? shippingDetails.address.line2 + '<br/>' : ''}
              ${shippingDetails.address?.city || ''}, ${shippingDetails.address?.state || ''} ${shippingDetails.address?.postal_code || ''}<br/>
              ${shippingDetails.address?.country || ''}
            </td>
          </tr>
        `
        : '';

      sendAdminNotification(
        `New Order #${orderId.slice(0, 8).toUpperCase()} - $${emailTotals.total.toFixed(2)}`,
        `
          <h2 style="font-size: 18px; margin-bottom: 16px;">New Order Placed</h2>
          <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; width: 120px; color: #666;"><strong>Order ID</strong></td>
              <td style="padding: 8px 0;">#${orderId.slice(0, 8).toUpperCase()}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666;"><strong>Customer</strong></td>
              <td style="padding: 8px 0;"><a href="mailto:${userEmail}">${userEmail}</a></td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #666; vertical-align: top;"><strong>Items</strong></td>
              <td style="padding: 8px 0;">${itemsSummary}</td>
            </tr>
            ${shippingHtml}
            <tr>
              <td style="padding: 8px 0; color: #666;"><strong>Subtotal</strong></td>
              <td style="padding: 8px 0;">$${emailTotals.subtotal.toFixed(2)}</td>
            </tr>
            ${emailTotals.discount > 0 ? `
            <tr>
              <td style="padding: 8px 0; color: #27ae60;"><strong>Discount${promoCodeText ? ` (${promoCodeText})` : ''}</strong></td>
              <td style="padding: 8px 0; color: #27ae60;">-$${emailTotals.discount.toFixed(2)}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 8px 0; color: #666;"><strong>Tax (8%)</strong></td>
              <td style="padding: 8px 0;">$${emailTotals.tax.toFixed(2)}</td>
            </tr>
            <tr style="font-size: 16px;">
              <td style="padding: 12px 0; color: #000;"><strong>Total</strong></td>
              <td style="padding: 12px 0;"><strong>$${emailTotals.total.toFixed(2)}</strong></td>
            </tr>
          </table>
        `,
        { type: 'order_placed', orderId, email: userEmail, total: emailTotals.total }
      ).catch((err) => console.error('[stripe-webhook] Admin notification failed:', err));
    }

    // Always acknowledge the webhook so Stripe stops retrying
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("❌ Webhook Internal Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// ======================================
// 📧 EMAIL BUILDER (CID attachments)
// ======================================
async function sendEnhancedEmail(
  to: string,
  orderId: string,
  items: any[],
  totals: { subtotal: number; discount: number; tax: number; total: number },
  promoCode: string | null = null
) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });

    // 1) Totals - trust the values passed in from webhook (no recompute)
    const orderSubtotal = Number.isFinite(totals?.subtotal)
      ? totals.subtotal
      : items.reduce((acc, item) => acc + Number(item.subtotal || 0), 0);

    const discountAmount = Number.isFinite(totals?.discount) ? totals.discount : 0;

    // ✅ tax must be computed on discounted subtotal (or use totals.tax if provided)
    const discountedSubtotal = Math.max(0, orderSubtotal - discountAmount);
    const computedTax = Math.round(discountedSubtotal * TAX_RATE * 100) / 100;

    const orderTax = Number.isFinite(totals?.tax) ? totals.tax : computedTax;
    const totalAmount = Number.isFinite(totals?.total)
      ? totals.total
      : Math.max(0, discountedSubtotal + orderTax);

    let discountLabel = "Discount";
    if (discountAmount > 0 && orderSubtotal > 0) {
      const pct = Math.round((discountAmount / orderSubtotal) * 100);
      if (pct > 0 && promoCode) {
        discountLabel = `${pct}% off (${promoCode})`;
      } else if (pct > 0) {
        discountLabel = `${pct}% off`;
      } else if (promoCode) {
        discountLabel = `Promo code (${promoCode})`;
      }
    } else if (promoCode) {
      discountLabel = `Promo code (${promoCode})`;
    }
    const taxLabel = "Tax, Shipping, and Handling (8%):";

    // 2) Build attachments + safe img tags (CID)
    const attachments: any[] = [];

    async function urlToAttachment(url: string, cid: string) {
      try {
        // If the URL is empty or not an http(s) URL, skip
        if (!url || typeof url !== "string") return null;
        if (!/^https?:\/\//i.test(url)) {
          console.warn("⚠️ [email] Non-http URL, skipping attach:", url);
          return null;
        }

        const res = await fetch(url);
        if (!res.ok) {
          console.warn("⚠️ [email] Failed to fetch image:", url, res.status);
          return null;
        }

        const arrayBuf = await res.arrayBuffer();
        const buf = Buffer.from(arrayBuf);

        // Keep email size under control
        if (buf.length > 12 * 1024 * 1024) {
          console.warn(
            "⚠️ [email] Image too large, skipping attach:",
            cid,
            buf.length
          );
          return null;
        }

        // Detect content type from response or URL
        let contentType = res.headers.get("content-type") || "image/png";
        // Fallback: infer from URL extension if content-type is not an image
        if (!contentType.startsWith("image/")) {
          if (url.endsWith(".webp")) contentType = "image/webp";
          else if (url.endsWith(".jpg") || url.endsWith(".jpeg"))
            contentType = "image/jpeg";
          else contentType = "image/png";
        }

        // Determine file extension from content type
        const ext = contentType.includes("webp")
          ? "webp"
          : contentType.includes("jpeg")
            ? "jpg"
            : "png";

        attachments.push({
          filename: `${cid}.${ext}`,
          content: buf,
          cid,
          contentType,
        });

        return `cid:${cid}`;
      } catch (e) {
        console.warn("⚠️ [email] Error fetching image:", url, e);
        return null;
      }
    }

    const itemsHtmlArr = await Promise.all(
      items.map(async (item: any, idx: number) => {
        const frontUrl = typeof item.imageUrl === "string" ? item.imageUrl : "";
        const backUrl =
          typeof item.backImageUrl === "string" ? item.backImageUrl : "";

        const frontCid = `front_${idx}`;
        const backCid = `back_${idx}`;

        const frontSrc =
          (frontUrl && (await urlToAttachment(frontUrl, frontCid))) ||
          "https://via.placeholder.com/400";

        const backSrc = backUrl && (await urlToAttachment(backUrl, backCid));

        const backImageHtml = backSrc
          ? `<div style="margin-top: 18px;">
              <p style="margin:0 0 6px 0; font-size:12px; color:#999; text-transform:uppercase; letter-spacing:1px; text-align:center;">Back View</p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center">
                    <img src="${backSrc}" alt="${item.productName} Back"
                         style="max-width:400px; width:100%; height:auto; border-radius:8px; border:1px solid #ddd; object-fit:contain; background:#ffffff;" />
                  </td>
                </tr>
              </table>
            </div>`
          : "";

        return `
          <div style="background:#f9f9f9; padding:20px; border-radius:12px; margin-bottom:25px; border:1px solid #eee;">
            <h3 style="margin:0 0 15px 0; color:#333; font-family:Arial,sans-serif; font-weight:300; font-size:22px; text-align:center;">
              ${item.productName || "Auren Product"}
            </h3>

            <div style="margin-bottom:20px;">
              <p style="margin:0 0 6px 0; font-size:12px; color:#999; text-transform:uppercase; letter-spacing:1px; text-align:center;">Front View</p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center">
                    <img src="${frontSrc}" alt="${item.productName || "Front"}"
                         style="max-width:400px; width:100%; height:auto; border-radius:8px; border:1px solid #ddd; object-fit:contain; background:#ffffff;" />
                  </td>
                </tr>
              </table>
              ${backImageHtml}
            </div>

            <div style="text-align:left; color:#555; font-size:14px; background:#fff; padding:15px; border-radius:8px; border:1px solid #eee;">
              <div style="margin-bottom:10px; line-height:1.5;">
                <div>Qty: <strong>${Number(item.quantity || 1)}</strong></div>
                <div>Unit: <strong>$${Number(item.unitPrice || 0).toFixed(
                  2
                )}</strong></div>
              </div>

              <div style="margin:10px 0; padding-top:10px; border-top:1px solid #eee;">
                <strong style="color:#333;">Size Breakdown:</strong><br/>
                <span style="line-height:1.5;">
                  ${
                    item.sizeBreakdown
                      ? String(item.sizeBreakdown).replace(/\n/g, "<br/>")
                      : item.comments || "Standard"
                  }
                </span>
              </div>

              <p style="margin:15px 0 0 0; font-weight:bold; text-align:right; font-size:16px; color:#333;">
                Item Total: $${Number(item.subtotal || 0).toFixed(2)}
              </p>
            </div>
          </div>
        `;
      })
    );

    const itemsHtml = itemsHtmlArr.join("");

    // 3) Send email with attachments
    await transporter.sendMail({
      from: `Auren Team <${process.env.EMAIL_USER}>`,
      to,
      cc: 'team@auren.co',
      subject: `Order Confirmed #${orderId.slice(0, 8).toUpperCase()}`,
      attachments,
      html: `
        <div style="font-family:Arial,sans-serif; max-width:600px; margin:0 auto; color:#333; padding:20px;">
          <div style="background-color: #000; padding: 24px 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <img src="https://storage.googleapis.com/auren-public-asset/auren_white_logo.png" alt="AUREN" style="max-width: 120px; height: auto;" />
          </div>
          <div style="text-align:center; padding:20px 0; margin-bottom:30px; border-bottom:2px solid #000;">
            <p style="color:#666; margin:0;">Thanks for your order!</p>
          </div>

          <div style="padding:0 10px;">
            <p style="text-align:center; margin-bottom:30px; color:#666;">
              Your order <strong>#${orderId
                .slice(0, 8)
                .toUpperCase()}</strong> has been confirmed.
            </p>

            ${itemsHtml}

            <div style="margin-top:40px; text-align:right; padding-top:20px; border-top:2px solid #000;">
              <table style="width:100%; text-align:right; font-size:16px; color:#555;">
                <tr>
                  <td style="padding-bottom:5px;">Subtotal:</td>
                  <td style="padding-bottom:5px; font-weight:bold;">$${orderSubtotal.toFixed(
                    2
                  )}</td>
                </tr>
                ${
                  discountAmount > 0
                    ? `<tr style="color:#27ae60;">
                    <td style="padding-bottom:5px;">${discountLabel}:</td>
                    <td style="padding-bottom:5px; font-weight:bold;">-$${discountAmount.toFixed(
                      2
                    )}</td>
                  </tr>`
                    : ""
                }
                <tr>
                  <td style="padding-bottom:15px;">${taxLabel}</td>
                  <td style="padding-bottom:15px; font-weight:bold;">$${orderTax.toFixed(
                    2
                  )}</td>
                </tr>
                <tr style="font-size:24px; color:#000;">
                  <td style="padding-top:15px; font-weight:bold;">Total:</td>
                  <td style="padding-top:15px; font-weight:bold;">$${Number(
                    totalAmount || 0
                  ).toFixed(2)}</td>
                </tr>
              </table>
            </div>
          </div>

          <div style="text-align:center; font-size:12px; color:#999; margin-top:50px; padding-top:20px; border-top:1px solid #eee;">
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
