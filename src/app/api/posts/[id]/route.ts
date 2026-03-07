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

// Only allow updating status — no mass-assignment
const ALLOWED_STATUS = ['new', 'draft', 'approved', 'posted', 'skipped', 'bookmarked'] as const
type AllowedStatus = typeof ALLOWED_STATUS[number]

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  // Whitelist: only status can be changed via this route
  const update: Partial<{ status: AllowedStatus }> = {}
  if (body.status !== undefined) {
    if (!ALLOWED_STATUS.includes(body.status)) {
      return NextResponse.json({ error: `Invalid status: ${body.status}` }, { status: 400 })
    }
    update.status = body.status
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const [row] = await db.update(redditPosts).set(update).where(eq(redditPosts.id, id)).returning()
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({
    ...row,
    matchedKeywords: JSON.parse(row.matchedKeywords as string),
  })
}
