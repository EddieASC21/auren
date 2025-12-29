import { NextResponse } from 'next/server'
import { db } from '@/lib/firestore'

// 1. Define all allowed origins here
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://auren.co',
  'https://www.auren.co',
  'https://api.auren.co'
]

// 2. Dynamic CORS helper
function withCorsHeaders(res: NextResponse, origin: string | null) {
  // If the request origin is in our allowed list, use it. Otherwise, default to null or the first allowed.
  const allowOrigin = (origin && ALLOWED_ORIGINS.includes(origin)) 
    ? origin 
    : ALLOWED_ORIGINS[0];

  res.headers.set('Access-Control-Allow-Origin', allowOrigin)
  res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type')
  res.headers.set('Vary', 'Origin') // Important for caching
  return res
}

export async function OPTIONS(req: Request) {
  const origin = req.headers.get('origin')
  const res = new NextResponse(null, { status: 204 })
  return withCorsHeaders(res, origin)
}

export async function POST(req: Request) {
  const origin = req.headers.get('origin')

  try {
    const { email } = await req.json()

    if (!email || typeof email !== 'string') {
      return withCorsHeaders(
        NextResponse.json({ error: 'Email is required.' }, { status: 400 }),
        origin
      )
    }

    const normalized = email.trim().toLowerCase()
    if (!normalized) {
      return withCorsHeaders(
        NextResponse.json({ error: 'Email is required.' }, { status: 400 }),
        origin
      )
    }

    await db
      .collection('newsletterSubscribers')
      .doc(normalized)
      .set(
        {
          email: normalized,
          source: 'website-footer',
          subscribedAt: new Date().toISOString(),
        },
        { merge: true }
      )

    return withCorsHeaders(NextResponse.json({ ok: true }), origin)
  } catch (err) {
    console.error('Newsletter API error:', err)
    return withCorsHeaders(
      NextResponse.json({ error: 'Internal server error.' }, { status: 500 }),
      origin
    )
  }
}