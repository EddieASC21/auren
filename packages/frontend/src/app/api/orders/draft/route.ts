import { NextResponse } from "next/server";
import { db } from "@/lib/firestore";
import { getAuthenticatedUser } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { productId, quantity, notes, design } = await req.json();
    if (!productId || !quantity || !design) {
      return NextResponse.json(
        { error: "Missing required fields: productId, quantity, or design" },
        { status: 400 }
      );
    }

    const orderDraft = {
      productId,
      quantity,
      notes: notes || "",
      design,
      status: "draft",
      createdAt: new Date().toISOString(),
      userId: user.userId,
      userEmail: user.email,
      userName: user.name || "",
    };

    const docRef = await db.collection("orders_draft").add(orderDraft);
    return NextResponse.json({ id: docRef.id, ...orderDraft });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Draft failed" },
      { status: 500 }
    );
  }
}


