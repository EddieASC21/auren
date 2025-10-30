import { NextResponse } from "next/server";
import { WorkOS } from "@workos-inc/node";
import { db } from "@/lib/firestore";
import jwt from "jsonwebtoken";

// Initialize WorkOS client
const workos = new WorkOS(process.env.WORKOS_API_KEY!);

// Handle OAuth callback from WorkOS after user authentication
export async function GET(req: Request) {
  try {
    // Parse the callback URL to get the authorization code
    const url = new URL(req.url);
    const code = url.searchParams.get("code");

    // Validate that we received an authorization code
    if (!code) {
      return NextResponse.json(
        { error: "Missing authorization code in callback." },
        { status: 400 }
      );
    }

    // ✅ Step 1: Exchange code for authenticated user
    const { user } = await workos.userManagement.authenticateWithCode({
      clientId: process.env.WORKOS_CLIENT_ID!,
      code,
    });

    console.log("✅ Authenticated user:", user);

    // ✅ Step 2: Store or update user in Firestore
    const userDocRef = db.collection("users").doc(user.id);
    await userDocRef.set(
      {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profilePictureUrl: user.profilePictureUrl,
        emailVerified: user.emailVerified,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    // ✅ Step 3: Generate a JWT session token (1 hour)
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
      },
      process.env.JWT_SECRET!,
      { expiresIn: "1h" }
    );

    // ✅ Step 4: Create secure cookie + redirect
    const response = NextResponse.redirect("http://localhost:3000/");

    // Set the session cookie with security settings
    response.cookies.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60, // 1 hour
    });

    return response;
  } catch (err: any) {
    console.error("❌ WorkOS callback error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to authenticate user." },
      { status: 500 }
    );
  }
}