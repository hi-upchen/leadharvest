import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { products } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [row] = await db.select().from(products).where(eq(products.id, id))
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({
    ...row,
    keywords: JSON.parse(row.keywords as string),
    subreddits: JSON.parse(row.subreddits as string),
  })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const updateData: Record<string, unknown> = { ...body }
  if (body.keywords) updateData.keywords = JSON.stringify(body.keywords)
  if (body.subreddits) updateData.subreddits = JSON.stringify(body.subreddits)

  const [row] = await db.update(products)
    .set(updateData)
    .where(eq(products.id, id))
    .returning()
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({
    ...row,
    keywords: JSON.parse(row.keywords as string),
    subreddits: JSON.parse(row.subreddits as string),
  })
}
