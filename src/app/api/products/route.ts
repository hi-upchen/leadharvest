import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { products } from '@/db/schema'
import { asc } from 'drizzle-orm'

export async function GET() {
  const rows = await db.select().from(products).orderBy(asc(products.createdAt))
  // Parse JSON fields
  return NextResponse.json(rows.map(r => ({
    ...r,
    keywords: JSON.parse(r.keywords as string),
    subreddits: JSON.parse(r.subreddits as string),
  })))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const [row] = await db.insert(products).values({
    ...body,
    keywords: JSON.stringify(body.keywords ?? []),
    subreddits: JSON.stringify(body.subreddits ?? []),
  }).returning()
  return NextResponse.json({
    ...row,
    keywords: JSON.parse(row.keywords as string),
    subreddits: JSON.parse(row.subreddits as string),
  }, { status: 201 })
}
