import { NextResponse } from "next/server";
import { Storage } from "@google-cloud/storage";
import nodemailer from "nodemailer";
import { v4 as uuidv4 } from "uuid";

// --- 1. Define your live frontend URL ---
const LIVE_FRONTEND_URL =
  process.env.FRONTEND_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://auren.co"
    : "http://localhost:3000");

// --- 2. Initialize Google Cloud Storage ---
const storage = new Storage({
  projectId: process.env.GOOGLE_PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

const bucketName = process.env.GCP_BUCKET_NAME || 'auren-user-designs';

// --- Helper: Upload single image to GCS ---
async function uploadToGCS(base64String: string, suffix: string) {
  if (!base64String) return null;

  try {
    const base64Data = base64String.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Create unique filename: designs/uuid-front.png
    const fileName = `designs/${uuidv4()}-${suffix}.png`;
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(fileName);

    await file.save(buffer, {
      contentType: 'image/png',
      metadata: { cacheControl: 'public, max-age=31536000' },
    });

    return `https://storage.googleapis.com/${bucketName}/${fileName}`;
  } catch (err) {
    console.error(`Failed to upload ${suffix} image:`, err);
    return null;
  }
}

// --- 3. 🔹 Handle CORS preflight requests ---
export async function OPTIONS() {
  const headers = {
    "Access-Control-Allow-Origin": LIVE_FRONTEND_URL,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  return new NextResponse(null, { status: 204, headers });
}

// --- 4. 🔹 Handle POST requests ---
export async function POST(req: Request) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": LIVE_FRONTEND_URL,
  };

  try {
    const body = await req.json();
    // 👈 CHANGED: Now accepting front and back explicitly
    const { email, frontImageBase64, backImageBase64, designDetails } = body;

    // A. Validation
    if (!email || !frontImageBase64) {
      return NextResponse.json(
        { error: "Missing email or front image data" },
        { status: 400, headers: corsHeaders }
      );
    }

    // B. Upload Images to Google Cloud Storage
    // Run uploads in parallel for speed
    const [frontUrl, backUrl] = await Promise.all([
      uploadToGCS(frontImageBase64, "front"),
      backImageBase64 ? uploadToGCS(backImageBase64, "back") : Promise.resolve(null)
    ]);

    if (!frontUrl) {
      throw new Error("Failed to upload front image");
    }

    // C. Send Email via Nodemailer
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Build the Image HTML (conditionally add back image)
    const backImageHtml = backUrl 
      ? `<div style="margin-top: 20px;">
           <p style="color:#666; font-size: 14px; margin-bottom: 5px;">Back View</p>
           <img src="${backUrl}" alt="Back Design" style="max-width: 450px; width: 100%; border-radius: 8px; border: 1px solid #ddd;" />
         </div>` 
      : '';

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: `Your Custom Auren Design: ${designDetails.productName}`,
      html: `
        <div style="font-family: Arial, sans-serif; text-align: center; color: #333; padding: 20px;">
          
          <h2 style="font-weight: 300; margin-bottom: 30px;">
            Hello here is the design you have made so far with auren!
          </h2>

          <div style="background: #f9f9f9; padding: 20px; border-radius: 12px; display: inline-block;">
            
            <div>
              <p style="color:#666; font-size: 14px; margin-bottom: 5px;">Front View</p>
              <img src="${frontUrl}" alt="Front Design" style="max-width: 450px; width: 100%; border-radius: 8px; border: 1px solid #ddd;" />
            </div>

            ${backImageHtml}

            <div style="margin-top: 20px; text-align: left; font-size: 14px; color: #555;">
              <p><strong>Product:</strong> ${designDetails.productName}</p>
              <p><strong>Color:</strong> ${designDetails.color}</p>
            </div>
          </div>

          <p style="margin-top: 30px; font-size: 12px; color: #999;">
            Made with Auren
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json(
      { success: true, frontUrl, backUrl },
      { status: 200, headers: corsHeaders }
    );

  } catch (error: any) {
    console.error("Send Design Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process design" },
      { status: 500, headers: corsHeaders }
    );
  }
}