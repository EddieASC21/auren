import { NextResponse } from "next/server";
import { db } from "@/lib/firestore";
import { getAuthenticatedUser } from "@/lib/auth";

// API endpoint for creating order drafts in Firestore
export async function POST(req: Request) {
  try {
    // 🧠 Verify the logged-in user via cookie
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 📦 Parse the request body
    const { productId, quantity, notes, design } = await req.json();

    // 🧩 Basic validation
    if (!productId || !quantity || !design) {
      return NextResponse.json(
        { error: "Missing required fields: productId, quantity, or design" },
        { status: 400 }
      );
    }

    // 🪄 Prepare the order draft object
    const orderDraft = {
      productId,
      quantity,
      notes: notes || "",
      design,
      status: "draft",
      createdAt: new Date().toISOString(),

      // User context from WorkOS JWT
      userId: user.userId,
      userEmail: user.email,
      userName: user.name || "",
    };

    // 🗄️ Store in Firestore
    const docRef = await db.collection("orders_draft").add(orderDraft);

    // ✅ Return the response
    return NextResponse.json({
      id: docRef.id,
      ...orderDraft,
    });
  } catch (err: any) {
    console.error("❌ Draft creation error:", err);
    return NextResponse.json(
      { error: err.message || "Draft failed" },
      { status: 500 }
    );
  }
}