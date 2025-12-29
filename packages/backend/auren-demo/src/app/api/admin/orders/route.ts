import { NextResponse } from "next/server";
import { db } from "@/lib/firestore";
import { getAuthenticatedUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// --- CORS SETUP ---
const LIVE_FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

function setCORSHeaders(res: NextResponse) {
  res.headers.set("Access-Control-Allow-Origin", LIVE_FRONTEND_URL);
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.headers.set("Access-Control-Allow-Credentials", "true"); // Required for cookies
  return res;
}

export async function OPTIONS() {
  return setCORSHeaders(new NextResponse(null, { status: 204 }));
}

const ADMIN_EMAILS = ["eddieny12@gmail.com"];

// Shape of a payment document in Firestore
interface PaymentDoc {
  id: string;
  orderId?: string;
  confirmedId?: string;
  [key: string]: any; // allow all other dynamic fields
}

export async function GET(req: Request) {
  try {
    // 1. SECURITY CHECK
    const user = await getAuthenticatedUser();

    if (!user) {
      const res = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      return setCORSHeaders(res);
    }

    if (!ADMIN_EMAILS.includes(user.email)) {
      const res = NextResponse.json({ error: "Forbidden" }, { status: 403 });
      return setCORSHeaders(res);
    }

    // 2. QUERY FIRESTORE (relevant collections)
    const [
      ordersSnap,
      paymentsSnap,
      contactMessagesSnap,
      newsletterSnap,
      usersSnap,
    ] = await Promise.all([
      db.collection("orders").orderBy("createdAt", "desc").get(),
      db.collection("payments").orderBy("createdAt", "desc").get(),
      db.collection("contactMessages").orderBy("createdAt", "desc").get(),
      db.collection("newsletterSubscribers").orderBy("createdAt", "desc").get(),
      db.collection("users").orderBy("createdAt", "desc").get(),
    ]);

    const rawOrders =
      ordersSnap.empty
        ? []
        : ordersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const payments: PaymentDoc[] =
      paymentsSnap.empty
        ? []
        : paymentsSnap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any),
          }));

    const contactMessages =
      contactMessagesSnap.empty
        ? []
        : contactMessagesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const newsletterSubscribers =
      newsletterSnap.empty
        ? []
        : newsletterSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const users =
      usersSnap.empty
        ? []
        : usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // 3. JOIN: attach latest payment (if any) to each order by orderId / confirmedId
    const paymentsByOrderId: Record<string, PaymentDoc> = {};

    // paymentsSnap is ordered by createdAt desc,
    // so first payment we see per order is the latest
    for (const p of payments) {
      const key = (p.orderId || p.confirmedId) as string | undefined;
      if (!key) continue;
      if (!paymentsByOrderId[key]) {
        paymentsByOrderId[key] = p;
      }
    }

    const orders = rawOrders.map((order) => ({
      ...order,
      payment: paymentsByOrderId[order.id] || null,
    }));

    // 4. RETURN RESPONSE
    return setCORSHeaders(
      NextResponse.json({
        orders,
        payments,
        contactMessages,
        newsletterSubscribers,
        users,
      })
    );
  } catch (error: any) {
    console.error("Admin API Error:", error);
    const res = NextResponse.json(
      { error: error.message || "Failed to fetch admin data" },
      { status: 500 }
    );
    return setCORSHeaders(res);
  }
}