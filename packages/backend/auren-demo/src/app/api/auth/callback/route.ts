import { NextResponse } from "next/server";
import { WorkOS } from "@workos-inc/node";
import { db } from "@/lib/firestore";
import jwt from "jsonwebtoken";

const LIVE_FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

export async function GET(req: Request) {
  try {
    const workos = new WorkOS(process.env.WORKOS_API_KEY!);
    
    // 1. Get Authorization Code
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    if (!code) {
      return NextResponse.json({ error: "Missing code" }, { status: 400 });
    }

    // 2. Authenticate User
    const { user } = await workos.userManagement.authenticateWithCode({
      clientId: process.env.WORKOS_CLIENT_ID!,
      code,
    });

    // 3. Save/Update User in Firestore
    await db.collection("users").doc(user.id).set({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    // 4. Create Session Token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: "1h" }
    );

    // 5. REDIRECT TO FRONTEND "PROCESSING" PAGE
    // This page will upload the Local Storage data to the backend
    const response = NextResponse.redirect(`${LIVE_FRONTEND_URL}/checkout?token=${token}`);
    
    // Set cookie so the next API call is authenticated
    response.cookies.set("session", token, {
      httpOnly: true,
      secure: true,
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60,
    });

    return response;

  } catch (err: any) {
    console.error("Auth Callback Error:", err);
    return NextResponse.redirect(`${LIVE_FRONTEND_URL}/?error=auth_failed`);
  }
}