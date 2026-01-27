// packages/backend/auren-demo/src/app/api/checkout/route.ts

import { NextResponse } from "next/server";
import { Storage } from "@google-cloud/storage";
import Stripe from "stripe";
import { db } from "@/lib/firestore";
import { v4 as uuidv4 } from "uuid";
import { getQuote } from "@/lib/pricing/pricing";
import { rateLimit, RATE_LIMITS } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// 🔧 CONFIG
const DEFAULT_ALLOWED_ORIGIN =
  process.env.FRONTEND_URL || "http://localhost:3000";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
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
    else if (["EXTRA", "EXTRA LARGE", "XLARGE", "XL"].includes(size))
      size = "XL";
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

// ------------------------------------------------------------------
// 📸 IMAGE HELPERS
// ------------------------------------------------------------------
function isHttpUrl(s: string) {
  return s.startsWith("http://") || s.startsWith("https://");
}

function isRelativeUrl(s: string) {
  return s.startsWith("/");
}

function isDataUrl(s: string) {
  return s.startsWith("data:image/");
}

function head(s: string | null | undefined, n = 40) {
  if (!s) return null;
  return s.slice(0, n);
}

function contentTypeToExt(contentType: string) {
  const ct = contentType.toLowerCase();
  if (ct.includes("png")) return "png";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
  if (ct.includes("webp")) return "webp";
  return "png";
}

async function fetchImageBytes(url: string): Promise<{
  buffer: Buffer;
  contentType: string;
} | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn("⚠️ [checkout] fetch failed", { url, status: res.status });
      return null;
    }
    const contentType = res.headers.get("content-type") || "image/png";
    const ab = await res.arrayBuffer();
    const buffer = Buffer.from(ab);
    if (!buffer || buffer.length < 32) {
      console.warn("⚠️ [checkout] fetched image too small", { url });
      return null;
    }
    return { buffer, contentType };
  } catch (e) {
    console.warn("⚠️ [checkout] fetch error", { url, error: e });
    return null;
  }
}

// ✅ No `s` (dotAll) flag; works with older TS targets.
// Uses [\s\S]* to match across newlines.
function parseDataUrl(
  dataUrl: string
): { base64Data: string; contentType: string } | null {
  // Example: data:image/png;base64,AAAA...
  const match =
    /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]*)$/.exec(dataUrl);
  if (!match) return null;
  return { contentType: match[1], base64Data: match[2] };
}

/**
 * Normalize an "image input" string into raw bytes + contentType.
 * Supports:
 * - data:image/...;base64,...
 * - raw base64 (assumed png)
 * - http(s) url
 * - /relative url (resolved against FRONTEND_URL)
 */
async function resolveImageToBytes(input: string): Promise<{
  buffer: Buffer;
  contentType: string;
} | null> {
  const val = input.trim();

  if (isDataUrl(val)) {
    const parsed = parseDataUrl(val);
    if (!parsed) return null;

    const buffer = Buffer.from(parsed.base64Data, "base64");
    if (!buffer || buffer.length < 32) return null;

    return { buffer, contentType: parsed.contentType || "image/png" };
  }

  if (isHttpUrl(val)) {
    return await fetchImageBytes(val);
  }

  if (isRelativeUrl(val)) {
    const abs = `${FRONTEND_URL}${val}`;
    return await fetchImageBytes(abs);
  }

  // Assume raw base64 (no header)
  if (val.length < 100) return null;

  try {
    const buffer = Buffer.from(val, "base64");
    if (!buffer || buffer.length < 32) return null;
    return { buffer, contentType: "image/png" };
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------
// 📸 HELPER: ROBUST IMAGE UPLOAD
// ------------------------------------------------------------------
async function uploadDesignImage(
  imageInput: string | null,
  suffix: string = "front"
) {
  if (!imageInput) return null;

  const trimmed = imageInput.trim();
  if (!trimmed) return null;

  const resolved = await resolveImageToBytes(trimmed);
  if (!resolved) {
    console.warn(
      "⚠️ [checkout] uploadDesignImage: could not resolve image input",
      {
        suffix,
        head: head(trimmed),
        len: trimmed.length,
      }
    );
    return null;
  }

  try {
    const { buffer, contentType } = resolved;
    const ext = contentTypeToExt(contentType);
    const fileName = `orders/${uuidv4()}-${suffix}.${ext}`;

    const bucket = storage.bucket(bucketName);
    const file = bucket.file(fileName);

    await file.save(buffer, {
      contentType,
      metadata: { cacheControl: "public, max-age=31536000" },
      resumable: false,
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

  // ✅ Rate limiting: Prevent checkout spam and abuse
  const limitCheck = await rateLimit(req, RATE_LIMITS.CHECKOUT);
  if (limitCheck.limited) {
    return limitCheck.response;
  }

  try {
    const bodyText = await req.text();
    if (!bodyText) {
      return NextResponse.json(
        { error: "Empty body" },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    const parsed = JSON.parse(bodyText);
    const cartItems = parsed?.cartItems;

    if (!cartItems || cartItems.length === 0) {
      return NextResponse.json(
        { error: "Cart is empty" },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    console.log(
      "🧾 cartItems[0] pricing keys:",
      JSON.stringify(
        {
          category: cartItems?.[0]?.orderData?.category,
          name: cartItems?.[0]?.orderData?.name,
          quantity: cartItems?.[0]?.orderData?.quantity,
          isCustom: cartItems?.[0]?.orderData?.isCustom,
        },
        null,
        2
      )
    );

    // 1) ENRICH ITEMS + UPLOAD IMAGES + ✅ SERVER-SIDE PRICING
    const enrichedItems = await Promise.all(
      cartItems.map(async (item: any, index: number) => {
        const quantity = Number(item.orderData?.quantity || 1);
        if (!Number.isFinite(quantity) || quantity < 1) {
          throw new Error(`Invalid quantity for item #${index + 1}`);
        }

        const category = String(item.orderData?.category || "").trim();
        const name = String(item.orderData?.name || "").trim();
        const isCustom = Boolean(item.orderData?.isCustom);

        if (!category || !name) {
          throw new Error(
            `Missing pricing keys for item #${index + 1}. Required: orderData.category and orderData.name`
          );
        }

        const quote = getQuote({ category, name, quantity, isCustom });
        if (quote.unitPriceCents <= 0) {
          throw new Error(
            `No pricing found for item #${index + 1} (category="${category}", name="${name}")`
          );
        }

        // ✅ Apply 10% markup for catalog items from product-chat (pricingMode: "catalog_markup")
        const pricingMode = item.orderData?.pricingMode;
        const isFromProductChat = pricingMode === "catalog_markup";

        let unitPrice = quote.unitPriceCents / 100;

        if (isFromProductChat && !isCustom) {
          unitPrice = unitPrice * 1.1; // 10% markup for product-chat catalog items
          console.log(`📈 Applied 10% markup for product-chat item #${index + 1}: $${(quote.unitPriceCents / 100).toFixed(2)} → $${unitPrice.toFixed(2)}`);
        }

        const subtotal = unitPrice * quantity;
        const taxAmount = subtotal * 0.08;
        const totalWithTax = subtotal + taxAmount;

        console.log(`📸 Processing Item ${index + 1}...`);

        const rawFront =
          item.snapshotFront ||
          item.snapshotBase64 ||
          item.frontImageUrl ||
          item.designData?.productImage ||
          item.designData?.frontUploadedImages?.[0]?.src ||
          null;

        const rawBack =
          item.snapshotBack ||
          item.backImageUrl ||
          item.designData?.backUploadedImages?.[0]?.src ||
          null;

        console.log("🧾 [checkout] image inputs", {
          index: index + 1,
          rawFrontHead: head(typeof rawFront === "string" ? rawFront : null),
          rawBackHead: head(typeof rawBack === "string" ? rawBack : null),
          rawFrontLen: typeof rawFront === "string" ? rawFront.length : null,
          rawBackLen: typeof rawBack === "string" ? rawBack.length : null,
        });

        let frontUrl: string = "";
        let backUrl: string | null = null;

        if (typeof rawFront === "string" && rawFront.trim()) {
          const uploaded = await uploadDesignImage(rawFront, "front");
          if (uploaded) frontUrl = uploaded;
        }

        if (typeof rawBack === "string" && rawBack.trim()) {
          const uploaded = await uploadDesignImage(rawBack, "back");
          if (uploaded) backUrl = uploaded;
        }

        console.log("🧾 [checkout] resolved uploads", {
          index: index + 1,
          frontUrl,
          backUrl,
        });

        const rawBreakdown =
          item.orderData?.sizeBreakdownText || item.orderData?.comments || "";
        const cleanBreakdown = getCleanSizeString(rawBreakdown, quantity);

        const productDisplayName =
          item.designData?.selectedProductName || "Custom Auren Product";

        return {
          productName: productDisplayName,

          pricingCategory: category,
          pricingName: name,
          isCustom,

          quantity,
          unitPrice,
          subtotal,
          taxAmount,
          taxRate: 0.08,
          totalWithTax,
          sizeBreakdown: cleanBreakdown,
          comments: item.orderData?.comments || "",

          imageUrl: frontUrl || "",
          backImageUrl: backUrl,
        };
      })
    );

    for (const [i, it] of enrichedItems.entries()) {
      if (!Number.isFinite(it.totalWithTax) || it.totalWithTax <= 0) {
        throw new Error(`Invalid computed total for item #${i + 1}`);
      }
    }

    // 2) SAVE TO FIRESTORE
    const orderRef = db.collection("orders").doc();
    const orderId = orderRef.id;

    await orderRef.set({
      status: "pending_payment",
      createdAt: new Date().toISOString(),
      items: enrichedItems,
    });

    console.log(`📝 Order Created in Firestore: ${orderId}`);

    // 3) CREATE OR RETRIEVE 8% TAX RATE (auto-discovery)
    // This tax rate will be applied AFTER promo codes discount the subtotal
    let taxRateId = process.env.STRIPE_TAX_RATE_ID;
    const desiredTaxDisplayName = "Tax, Shipping, and Handling";

    if (taxRateId) {
      try {
        const existingRate = await stripe.taxRates.retrieve(taxRateId);
        if (existingRate.display_name !== desiredTaxDisplayName) {
          const updated = await stripe.taxRates.update(taxRateId, {
            display_name: desiredTaxDisplayName,
            description: desiredTaxDisplayName,
          });
          console.log(
            `✅ Updated tax rate display name: ${existingRate.display_name} -> ${updated.display_name}`
          );
        }
      } catch (err) {
        console.warn("⚠️ Could not retrieve/update STRIPE_TAX_RATE_ID:", err);
      }
    }

    if (!taxRateId) {
      // First, try to find an existing 8% tax rate
      const existingRates = await stripe.taxRates.list({ limit: 100, active: true });
      const existing8PercentRate = existingRates.data.find(
        rate => rate.percentage === 8.0 && rate.inclusive === false
      );

      if (existing8PercentRate) {
        taxRateId = existing8PercentRate.id;
        if (existing8PercentRate.display_name !== desiredTaxDisplayName) {
          await stripe.taxRates.update(taxRateId, {
            display_name: desiredTaxDisplayName,
            description: desiredTaxDisplayName,
          });
        }
        console.log(`✅ Found existing 8% tax rate: ${taxRateId}`);
      } else {
        // Create tax rate if it doesn't exist
        const taxRate = await stripe.taxRates.create({
          display_name: desiredTaxDisplayName,
          description: desiredTaxDisplayName,
          percentage: 8.0,
          inclusive: false, // Tax added on top (after discount)
        });
        taxRateId = taxRate.id;
        console.log(`✅ Created new 8% tax rate: ${taxRateId}`);
      }
    }

    // 3.5) PREPARE STRIPE ITEMS with tax rates
    const line_items = enrichedItems.map((item) => {
      const desc = `Qty: ${item.quantity}${item.sizeBreakdown ? ' • ' + item.sizeBreakdown : ''}`;

      return {
        price_data: {
          currency: "usd",
          product_data: {
            name: item.productName,
            description: desc.trim(),
          },
          unit_amount: Math.round(item.subtotal * 100), // Pre-tax subtotal
        },
        quantity: 1,
        tax_rates: [taxRateId!], // Apply 8% tax to this item (after discount)
      };
    });

    // 4) CREATE STRIPE SESSION
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items,
      success_url: `${FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}&order_id=${orderId}`,
      cancel_url: `${FRONTEND_URL}/product-showcase`,
      billing_address_collection: "required",
      shipping_address_collection: {
        allowed_countries: ["US", "CA", "GB", "AU"],
      },
      allow_promotion_codes: true,
      metadata: { aurenOrderId: orderId },
      payment_intent_data: { metadata: { aurenOrderId: orderId } },
    });

    return NextResponse.json(
      { url: session.url },
      { headers: getCorsHeaders(origin) }
    );
  } catch (error: any) {
    console.error("Checkout Error:", error);
    return NextResponse.json(
      { error: error.message || "Checkout failed" },
      { status: 500, headers: getCorsHeaders(origin) }
    );
  }
}
