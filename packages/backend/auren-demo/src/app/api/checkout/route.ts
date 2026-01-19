import { NextResponse } from "next/server";
import { Storage } from "@google-cloud/storage";
import Stripe from "stripe";
import { db } from "@/lib/firestore";
import { v4 as uuidv4 } from "uuid";

// 🔧 CONFIG
const DEFAULT_ALLOWED_ORIGIN = process.env.FRONTEND_URL || "http://localhost:3000";
const bucketName = process.env.GCP_BUCKET_NAME || "auren-user-designs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-10-29.clover" as any,
});

const storage = new Storage({
  projectId: process.env.GOOGLE_PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

// 🛡️ DYNAMIC CORS HELPER
function getCorsHeaders(origin: string | null) {
  let allowOrigin = DEFAULT_ALLOWED_ORIGIN;

  if (origin && (origin.includes("auren.co") || origin.includes("localhost"))) {
    allowOrigin = origin;
  }

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
  };
}

// ------------------------------------------------------------------
// 👇 CLEAN SIZE PARSER (mirrors ProductShowcase + exact-match rule)
// ------------------------------------------------------------------
function getCleanSizeString(rawText: string, totalQty?: number) {
  if (!rawText) return "";

  const regex = /(\d+)\s*([a-zA-Z0-9]+)/g;
  const parsed: { qty: number; size: string }[] = [];
  let match;

  while ((match = regex.exec(rawText)) !== null) {
    const qty = parseInt(match[1], 10);
    let size = match[2].toUpperCase();

    // Normalize size names (same as ProductCard)
    if (["SMALL", "SM", "S"].includes(size)) size = "S";
    else if (["MEDIUM", "MD", "M"].includes(size)) size = "M";
    else if (["LARGE", "LG", "L"].includes(size)) size = "L";
    else if (["EXTRA", "EXTRA LARGE", "XLARGE", "XL"].includes(size)) size = "XL";
    else if (["2XL", "XXL", "2X"].includes(size)) size = "2XL";

    // Only keep valid sizes
    if (["XS", "S", "M", "L", "XL", "2XL", "3XL"].includes(size)) {
      parsed.push({ qty, size });
    }
  }

  // Nothing parsed → just return cleaned raw text
  if (parsed.length === 0) {
    return rawText.replace("AI: ", "").trim();
  }

  // ⭐ If any entry matches the total quantity, assume "all one size"
  if (typeof totalQty === "number") {
    const exactMatches = parsed.filter((p) => p.qty === totalQty);
    if (exactMatches.length > 0) {
      const last = exactMatches[exactMatches.length - 1]; // last mention wins
      return `${last.qty} ${last.size}`;
    }
  }

  // Otherwise aggregate by size (like ProductShowcase)
  const bySize: Record<string, number> = {};
  for (const { qty, size } of parsed) {
    bySize[size] = (bySize[size] || 0) + qty;
  }

  const sizeOrder = ["XS", "S", "M", "L", "XL", "2XL", "3XL"];

  return Object.entries(bySize)
    .sort(([a], [b]) => sizeOrder.indexOf(a) - sizeOrder.indexOf(b))
    .map(([size, qty]) => `${qty} ${size}`)
    .join(", ");
}

// 📸 HELPER: ROBUST IMAGE UPLOAD
async function uploadDesignImage(base64String: string | null, suffix: string = "front") {
  if (!base64String || base64String.length < 100) return null;

  try {
    const base64Data = base64String.includes("base64,")
      ? base64String.split("base64,")[1]
      : base64String;

    const buffer = Buffer.from(base64Data, "base64");
    const fileName = `orders/${uuidv4()}-${suffix}.png`;
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(fileName);

    await file.save(buffer, {
      contentType: "image/png",
      metadata: { cacheControl: "public, max-age=31536000" },
    });

    const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
    console.log(`✅ ${suffix.toUpperCase()} Image Uploaded: ${publicUrl}`);
    return publicUrl;
  } catch (err) {
    console.error(`❌ GCS Upload Error (${suffix}):`, err);
    return null;
  }
}

// ✅ OPTIONS HANDLER
export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin");
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(origin),
  });
}

// ✅ POST HANDLER
export async function POST(req: Request) {
  const origin = req.headers.get("origin");

  try {
    const bodyText = await req.text();
    if (!bodyText) {
      return NextResponse.json(
        { error: "Empty body" },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    const { cartItems } = JSON.parse(bodyText);
    if (!cartItems || cartItems.length === 0) {
      return NextResponse.json(
        { error: "Cart is empty" },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    // 1. ENRICH ITEMS + UPLOAD IMAGES
    const enrichedItems = await Promise.all(
      cartItems.map(async (item: any, index: number) => {
        const quantity = Number(item.orderData?.quantity || 1);
        const unitPrice = Number(item.orderData?.unitPrice || 0);
        const subtotal = unitPrice * quantity;
        const taxAmount = subtotal * 0.08;
        const totalWithTax = subtotal + taxAmount;

        // --- IMAGE HANDLING ---
        let frontUrl = item.designData?.productImage || "";
        let backUrl = null;

        console.log(`📸 Processing Item ${index + 1}...`);

        const rawFront = item.snapshotFront || item.snapshotBase64;
        if (rawFront) {
          const url = await uploadDesignImage(rawFront, "front");
          if (url) frontUrl = url;
        }

        if (item.snapshotBack) {
          const url = await uploadDesignImage(item.snapshotBack, "back");
          if (url) backUrl = url;
        }

        if (frontUrl && frontUrl.startsWith("/")) {
          const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
          frontUrl = `${baseUrl}${frontUrl}`;
        }
        frontUrl = encodeURI(frontUrl);

        // ------------------------------------------------------------------
        // 👇 2. APPLY CLEANING LOGIC HERE
        // ------------------------------------------------------------------
        const rawBreakdown =
          item.orderData?.sizeBreakdownText || item.orderData?.comments || "";
        const cleanBreakdown = getCleanSizeString(rawBreakdown, quantity);

        return {
          productName: item.designData?.selectedProductName || "Custom Auren Product",
          quantity,
          unitPrice,
          subtotal,
          taxAmount,
          taxRate: 0.08,
          totalWithTax,
          sizeBreakdown: cleanBreakdown,
          comments: item.orderData?.comments || "",
          imageUrl: frontUrl,
          backImageUrl: backUrl,
        };
      })
    );

    // 2. SAVE TO FIRESTORE
    const orderRef = db.collection("orders").doc();
    const orderId = orderRef.id;

    await orderRef.set({
      status: "pending_payment",
      createdAt: new Date().toISOString(),
      items: enrichedItems,
    });

    console.log(`📝 Order Created in Firestore: ${orderId}`);

    // 3. PREPARE STRIPE ITEMS
    const line_items = enrichedItems.map((item) => {
      const taxPercent = (item.taxRate * 100).toFixed(0); // 8 -> "8"

      const desc = `Qty: ${item.quantity} • Subtotal: $${item.subtotal.toFixed(
        2
      )} • Tax, Shipping, and Handling (${taxPercent}%): $${item.taxAmount.toFixed(2)}`;

      return {
        price_data: {
          currency: "usd",
          product_data: {
            name: item.productName,
            description: desc,
          },
          // still charging subtotal + tax
          unit_amount: Math.round(item.totalWithTax * 100),
        },
        quantity: 1,
      };
    });

    // 4. CREATE STRIPE SESSION
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items,
      success_url: `${
        process.env.FRONTEND_URL || "http://localhost:3000"
      }/success?session_id={CHECKOUT_SESSION_ID}&order_id=${orderId}`,
      cancel_url: `${
        process.env.FRONTEND_URL || "http://localhost:3000"
      }/product-showcase`,
      billing_address_collection: "required",
      shipping_address_collection: {
        allowed_countries: ["US", "CA", "GB", "AU"],
      },
      metadata: { aurenOrderId: orderId },
      payment_intent_data: { metadata: { aurenOrderId: orderId } },
    });

    return NextResponse.json(
      { url: session.url },
      {
        headers: getCorsHeaders(origin),
      }
    );
  } catch (error: any) {
    console.error("Checkout Error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: getCorsHeaders(origin) }
    );
  }
}