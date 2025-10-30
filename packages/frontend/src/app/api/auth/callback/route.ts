import { NextResponse } from "next/server";
import { WorkOS } from "@workos-inc/node";
import { db } from "@/lib/firestore";
import jwt from "jsonwebtoken";

const workos = new WorkOS(process.env.WORKOS_API_KEY!);

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    if (!code) {
      return NextResponse.json({ error: "Missing authorization code in callback." }, { status: 400 });
    }

    const { user } = await workos.userManagement.authenticateWithCode({
      clientId: process.env.WORKOS_CLIENT_ID!,
      code,
    });

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

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
      },
      process.env.JWT_SECRET!,
      { expiresIn: "1h" }
    );

    const response = NextResponse.redirect("http://localhost:3000/");
    response.cookies.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60,
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to authenticate user." },
      { status: 500 }
    );
  }
}


