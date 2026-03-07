import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { redditPosts, products } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [row] = await db
    .select({
      post: redditPosts,
      product: { id: products.id, name: products.name },
    })
    .from(redditPosts)
    .leftJoin(products, eq(redditPosts.productId, products.id))
    .where(eq(redditPosts.id, id))

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({
    post: {
      ...row.post,
      matchedKeywords: JSON.parse(row.post.matchedKeywords as string),
    },
    product: row.product,
  })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const [row] = await db.update(redditPosts).set(body).where(eq(redditPosts.id, id)).returning()
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({
    ...row,
    matchedKeywords: JSON.parse(row.matchedKeywords as string),
  })
}
