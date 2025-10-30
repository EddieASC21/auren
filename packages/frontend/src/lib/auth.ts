import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

export interface AuthUser {
  userId: string;
  email: string;
  name?: string;
}

export async function getAuthenticatedUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session")?.value;
    if (!token) {
      return null;
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as AuthUser;
    return decoded;
  } catch (err) {
    return null;
  }
}


