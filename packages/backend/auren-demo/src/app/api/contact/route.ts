import { NextResponse } from 'next/server'
import { db } from '@/lib/firestore'

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://auren.co',
  'https://www.auren.co',
]

function withCors(req: Request, res: NextResponse) {
  const origin = req.headers.get('origin') ?? ''

  if (ALLOWED_ORIGINS.includes(origin)) {
    res.headers.set('Access-Control-Allow-Origin', origin)
  }

  res.headers.set('Vary', 'Origin')
  res.headers.set('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type')

  return res
}

export async function OPTIONS(req: Request) {
  const res = new NextResponse(null, { status: 204 })
  return withCors(req, res)
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const {
      fullName,
      organization,
      email,
      phone,
      message,
      referral,
    } = body

    if (!fullName || !email || !phone || !message || !referral) {
      const res = NextResponse.json(
        { error: 'Missing required fields.' },
        { status: 400 },
      )
      return withCors(req, res)
    }

    await db.collection('contactMessages').add({
      name: fullName,
      company: organization ?? '',
      email,
      phone,
      message,
      topic: referral,
      source: 'website-contact',
      createdAt: new Date().toISOString(),
    })

    const res = NextResponse.json({ ok: true })
    return withCors(req, res)
  } catch (err) {
    console.error('Contact API error:', err)
    const res = NextResponse.json(
      { error: 'Internal server error.' },
      { status: 500 },
    )
    return withCors(req, res)
  }
}