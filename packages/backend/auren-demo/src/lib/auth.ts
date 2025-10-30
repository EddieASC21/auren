import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

// Interface defining the structure of an authenticated user
export interface AuthUser {
  userId: string;
  email: string;
  name?: string;
}

/**
 * Reads and verifies the JWT stored in the "session" cookie.
 * Works in both Edge and Node runtimes.
 */
export async function getAuthenticatedUser(): Promise<AuthUser | null> {
  try {
    // Get the session cookie from the request
    const cookieStore = await cookies(); // ✅ await here
    const token = cookieStore.get("session")?.value;

    // Check if session cookie exists
    if (!token) {
      console.warn("⚠️ No session cookie found.");
      return null;
    }

    // Verify and decode the JWT token using the secret
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as AuthUser;
    return decoded;
  } catch (err) {
    console.error("❌ Invalid or expired session token:", err);
    return null;
  }
}