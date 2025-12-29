import { NextResponse } from "next/server";
import { db } from "@/lib/firestore";
import { Storage } from "@google-cloud/storage";
import nodemailer from "nodemailer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ---------- CORS ----------
const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "https://auren.co",
  "https://www.auren.co",
  "https://api.auren.co",
];

function withCorsHeaders(res: NextResponse, origin: string | null) {
  const allowOrigin =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  res.headers.set("Access-Control-Allow-Origin", allowOrigin);
  res.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  res.headers.set("Vary", "Origin");
  return res;
}

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin");
  const res = new NextResponse(null, { status: 204 });
  return withCorsHeaders(res, origin);
}

// ---------- GCS SETUP (match checkout) ----------
const storage = new Storage({
  projectId: process.env.GOOGLE_PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

// Use the same bucket env name as checkout
const BUCKET_NAME =
  process.env.GCP_BUCKET_NAME ||
  process.env.GCS_BUCKET_NAME ||
  process.env.GCLOUD_STORAGE_BUCKET ||
  "auren-user-designs";

if (!BUCKET_NAME) {
  console.warn("⚠️ No GCS bucket name configured for manual-order uploads");
}

function getExtensionFromContentType(ct: string | undefined) {
  if (!ct) return "png";
  if (ct.includes("jpeg")) return "jpg";
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  return "png";
}

// Upload a data URL or raw base64 string to GCS
async function uploadBase64ToGcs(
  raw: string,
  pathPrefix: string
): Promise<string | null> {
  if (!BUCKET_NAME) return null;

  let contentType = "image/png";
  let base64 = raw;

  // Handle full data URL: data:image/png;base64,XXXX
  const dataUrlMatch = raw.match(/^data:(.+);base64,(.*)$/);
  if (dataUrlMatch) {
    contentType = dataUrlMatch[1];
    base64 = dataUrlMatch[2];
  } else if (raw.includes("base64,")) {
    // Handle "...base64,XXXX"
    base64 = raw.split("base64,")[1];
  }

  const buffer = Buffer.from(base64, "base64");
  const ext = getExtensionFromContentType(contentType);
  const filePath = `${pathPrefix}.${ext}`;

  const bucket = storage.bucket(BUCKET_NAME);
  const file = bucket.file(filePath);

  await file.save(buffer, {
    resumable: false,
    contentType,
    metadata: {
      cacheControl: "public, max-age=31536000",
    },
  });

  const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${filePath}`;
  console.log(`✅ Manual-order image uploaded: ${publicUrl}`);
  return publicUrl;
}

// Turn whatever the frontend sends into a usable URL
async function resolveImageToUrl(
  raw: string | null | undefined,
  pathPrefix: string
): Promise<string | null> {
  if (!raw || typeof raw !== "string") return null;

  // 1) Data URL / base64 → upload to GCS
  if (raw.startsWith("data:") || raw.includes("base64,")) {
    try {
      return await uploadBase64ToGcs(raw, pathPrefix);
    } catch (err) {
      console.error("❌ Failed to upload manual-order image:", err);
      return null;
    }
  }

  // 2) Already absolute URL → just use it
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw;
  }

  // 3) Relative path from frontend → prefix with FRONTEND_URL
  if (raw.startsWith("/")) {
    const base = process.env.FRONTEND_URL || "http://localhost:3000";
    return `${base}${raw}`;
  }

  // 4) 'blob:' URLs (and anything else) cannot be used on the backend
  if (raw.startsWith("blob:")) {
    console.warn(
      "⚠️ Received blob: URL for manual-order image; cannot upload on backend."
    );
    return null;
  }

  // 5) Fallback: return as-is (last resort)
  return raw;
}

// ---------- EMAIL ----------
async function sendManualOrderEmail(
  to: string,
  requestId: string,
  payload: any,
  frontImageUrl: string | null,
  backImageUrl: string | null
) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn("⚠️ EMAIL_USER / EMAIL_PASS not set, skipping email.");
    return;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });

  const {
    fullName,
    organization,
    email,
    phone,
    estimatedQuantity,
    sizeBreakdown,
    notes,
    productCategory,
  } = payload;

  const imagesHtml = `
    ${
      frontImageUrl
        ? `<div style="margin-top: 20px;">
             <p style="font-size: 12px; color: #666;">Front mockup</p>
             <img src="${frontImageUrl}" style="max-width: 400px; width: 100%; border-radius: 8px; border: 1px solid #ddd; background:#fff; object-fit: contain;" />
           </div>`
        : ""
    }
    ${
      backImageUrl
        ? `<div style="margin-top: 20px;">
             <p style="font-size: 12px; color: #666;">Back mockup</p>
             <img src="${backImageUrl}" style="max-width: 400px; width: 100%; border-radius: 8px; border: 1px solid #ddd; background:#fff; object-fit: contain;" />
           </div>`
        : ""
    }
  `;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #222; padding: 24px;">
      <h1 style="text-align:center; letter-spacing:3px; margin-bottom:4px;">AUREN</h1>
      <p style="text-align:center; color:#666; margin-bottom:24px;">
        We received your custom design request. Here's a copy for your records.
      </p>

      <h2 style="font-size:18px; margin-bottom:12px;">Request #${requestId
        .slice(0, 8)
        .toUpperCase()}</h2>

      <table style="width:100%; font-size:14px; border-collapse:collapse;">
        <tr>
          <td style="padding:4px 0; width:160px;"><strong>Full Name</strong></td>
          <td>${fullName || ""}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;"><strong>Organization</strong></td>
          <td>${organization || "—"}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;"><strong>Email</strong></td>
          <td>${email}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;"><strong>Phone</strong></td>
          <td>${phone || "—"}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;"><strong>Category</strong></td>
          <td>${productCategory || "—"}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;"><strong>Estimated Qty</strong></td>
          <td>${estimatedQuantity}</td>
        </tr>
        <tr>
          <td style="padding:4px 0; vertical-align:top;"><strong>Size Breakdown</strong></td>
          <td style="white-space:pre-wrap;">${sizeBreakdown || ""}</td>
        </tr>
        <tr>
          <td style="padding:4px 0; vertical-align:top;"><strong>Notes</strong></td>
          <td style="white-space:pre-wrap;">${notes}</td>
        </tr>
      </table>

      ${imagesHtml}

      <p style="margin-top:32px; font-size:13px; color:#666;">
        Our team will review your design and follow up with a tailored quote.
        You can expect a response in under 12 hours.
      </p>

      <p style="margin-top:24px; font-size:12px; color:#999; text-align:center;">
        © ${new Date().getFullYear()} Auren
      </p>
    </div>
  `;

  await transporter.sendMail({
    from: `Auren Team <${process.env.EMAIL_USER}>`,
    to,
    subject: `We received your design request #${requestId
      .slice(0, 8)
      .toUpperCase()}`,
    html,
  });

  console.log(`✅ Manual order confirmation email sent to ${to}`);
}

// ---------- MAIN HANDLER ----------
export async function POST(req: Request) {
  const origin = req.headers.get("origin");

  try {
    const body = await req.json();

    const {
      fullName,
      organization,
      email,
      phone,
      estimatedQuantity,
      sizeBreakdown,
      timeline,
      notes,
      productId,
      isCustom,
      frontImage,
      backImage,
      productCategory, // "mens" | "womens" | "other"
    } = body || {};

    const isOtherCategory = productCategory === "other";

    // Basic validation
    if (
      !fullName ||
      !email ||
      !phone ||
      !estimatedQuantity ||
      !notes ||
      (!isOtherCategory && !sizeBreakdown)
    ) {
      return withCorsHeaders(
        NextResponse.json(
          { error: "Missing required fields." },
          { status: 400 }
        ),
        origin
      );
    }

    const qtyNum = Number(estimatedQuantity);
    if (!Number.isFinite(qtyNum) || qtyNum < 35) {
      return withCorsHeaders(
        NextResponse.json(
          { error: "Estimated quantity must be at least 35 units." },
          { status: 400 }
        ),
        origin
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Create Firestore doc first to get ID
    const manualRef = db.collection("manualOrderRequests").doc();
    const requestId = manualRef.id;

    // Resolve / upload images (if provided)
    let frontImageUrl: string | null = null;
    let backImageUrl: string | null = null;

    try {
      if (typeof frontImage === "string") {
        frontImageUrl = await resolveImageToUrl(
          frontImage,
          `manual-orders/${requestId}/front`
        );
      }
      if (typeof backImage === "string") {
        backImageUrl = await resolveImageToUrl(
          backImage,
          `manual-orders/${requestId}/back`
        );
      }
    } catch (err) {
      console.error("❌ Failed to process manual-order images:", err);
      // continue without images
    }

    const payload = {
      fullName,
      organization: organization || "",
      email: normalizedEmail,
      phone,
      estimatedQuantity: qtyNum,
      sizeBreakdown: sizeBreakdown || "",
      timeline: timeline || "",
      notes,
      productId: productId || null,
      isCustom: !!isCustom,
      productCategory: productCategory || null,
      frontImageUrl,
      backImageUrl,
      status: "pending",
      createdAt: new Date().toISOString(),
      source: "manual-order-form",
    };

    // Persist to Firestore
    await manualRef.set(payload);

    // Send confirmation email to customer
    try {
      await sendManualOrderEmail(
        normalizedEmail,
        requestId,
        payload,
        frontImageUrl,
        backImageUrl
      );
    } catch (err) {
      console.error("⚠️ Failed to send manual-order confirmation email:", err);
    }

    return withCorsHeaders(
      NextResponse.json({ ok: true, requestId }, { status: 200 }),
      origin
    );
  } catch (err) {
    console.error("❌ Manual-order API error:", err);
    return withCorsHeaders(
      NextResponse.json(
        { error: "Internal server error." },
        { status: 500 }
      ),
      origin
    );
  }
}